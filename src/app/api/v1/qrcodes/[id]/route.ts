import prisma from "@/lib/prisma";
import { invalidateScanCache, redis } from "@/lib/cache";
import { qrcodeAccessWhere } from "@/lib/establishment-access";
import { assertCanAssignLandingMode } from "@/lib/qr-mode-access";
import {
  apiError,
  apiJson,
  apiOptions,
  readJsonObject,
  withApiAuth,
} from "@/lib/public-api/auth";
import { parseQrInput } from "@/lib/public-api/qr-input";
import { serializeQrCode } from "@/lib/public-api/serialize";
import { logUserEvent } from "@/lib/user-events-server";

type RouteContext = { params: Promise<{ id: string }> };

export const OPTIONS = apiOptions;

export const GET = withApiAuth<RouteContext>(async (_request, { userId }, context) => {
  const { id } = await context.params;
  const qrcode = await prisma.qRCode.findFirst({ where: { id, ...qrcodeAccessWhere(userId) } });
  if (!qrcode) return apiError(404, "not_found", "QR-код не найден");
  return apiJson({ qrcode: serializeQrCode(qrcode) });
});

export const PATCH = withApiAuth<RouteContext>(async (request, { userId }, context) => {
  const { id } = await context.params;
  const qrcode = await prisma.qRCode.findFirst({ where: { id, ...qrcodeAccessWhere(userId) } });
  if (!qrcode) return apiError(404, "not_found", "QR-код не найден");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "invalid_request", "Тело запроса — JSON-объект");
  const parsed = parseQrInput(body);
  if (!parsed.ok) return apiError(400, "invalid_request", parsed.message);
  const input = parsed.data;

  const nextMode = input.mode ?? qrcode.mode;
  const nextRedirect = input.redirectUrl !== undefined ? input.redirectUrl : qrcode.redirectUrl;
  if (nextMode === "REDIRECT" && !nextRedirect) {
    return apiError(400, "invalid_request", "Для mode=REDIRECT нужен redirectUrl");
  }

  if (input.mode !== undefined) {
    const landing = await assertCanAssignLandingMode({
      userId,
      establishmentId: qrcode.establishmentId,
      nextMode: input.mode,
      previousMode: qrcode.mode,
      grandfathered: qrcode.landingGrandfathered,
    });
    if (!landing.ok) {
      return apiError(403, "upgrade_required", landing.error, {
        requiredPlan: landing.upgradeRequired ?? "PRO",
      });
    }
  }

  const updated = await prisma.qRCode.update({
    where: { id },
    data: {
      ...input,
      ...(qrcode.source === "DASHBOARD" ? { isActive: true } : {}),
    },
  });
  invalidateScanCache(qrcode.code).catch(() => {});

  logUserEvent(userId, "dash.api_qr_updated", {
    qrCodeId: id,
    mode: updated.mode,
    ...(updated.mode !== qrcode.mode ? { fromMode: qrcode.mode } : {}),
    fields: Object.keys(input),
  });

  return apiJson({ qrcode: serializeQrCode(updated) });
});

export const DELETE = withApiAuth<RouteContext>(async (_request, { userId }, context) => {
  const { id } = await context.params;
  const qrcode = await prisma.qRCode.findFirst({
    where: { id, ...qrcodeAccessWhere(userId) },
    select: { id: true, code: true },
  });
  if (!qrcode) return apiError(404, "not_found", "QR-код не найден");

  await prisma.qRCode.delete({ where: { id: qrcode.id } });
  invalidateScanCache(qrcode.code).catch(() => {});
  redis?.del(`scan:count:${qrcode.id}`).catch(() => {});

  logUserEvent(userId, "dash.api_qr_deleted", { qrCodeId: qrcode.id });

  return apiJson({ deleted: true, id: qrcode.id });
});
