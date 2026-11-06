import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { generateQRCode } from "@/lib/utils";
import { DEMO_QR_PREFIX } from "@/lib/demo-qrcodes";
import { establishmentAccessWhere, qrcodeAccessWhere } from "@/lib/establishment-access";
import { assertCanAssignLandingMode } from "@/lib/qr-mode-access";
import { rateLimit } from "@/lib/rate-limit";
import {
  apiError,
  apiJson,
  apiOptions,
  readJsonObject,
  withApiAuth,
} from "@/lib/public-api/auth";
import { parseLimit } from "@/lib/public-api/pagination";
import { parseQrInput } from "@/lib/public-api/qr-input";
import { serializeQrCode } from "@/lib/public-api/serialize";
import { logUserEvent } from "@/lib/user-events-server";

export const OPTIONS = apiOptions;

/** Создание QR через API: не больше на пользователя в час. */
const CREATE_LIMIT_PER_HOUR = 200;

export const GET = withApiAuth(async (request, { userId }) => {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() || null;
  const limit = parseLimit(searchParams.get("limit"));
  if (limit === null) return apiError(400, "invalid_request", "limit — число от 1 до 200");
  const cursor = searchParams.get("cursor")?.trim() || null;

  const where: Prisma.QRCodeWhereInput = { ...qrcodeAccessWhere(userId) };
  if (projectId) where.establishmentId = projectId;

  const rows = await prisma.qRCode.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, limit);
  return apiJson({
    qrcodes: page.map(serializeQrCode),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  });
});

export const POST = withApiAuth(async (request, { userId }) => {
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "invalid_request", "Тело запроса — JSON-объект");

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId) {
    return apiError(400, "invalid_request", "projectId обязателен (GET /api/v1/projects)");
  }

  const parsed = parseQrInput(body);
  if (!parsed.ok) return apiError(400, "invalid_request", parsed.message);
  const input = parsed.data;
  const mode = input.mode ?? (input.redirectUrl ? "REDIRECT" : "REVIEW");
  if (mode === "REDIRECT" && !input.redirectUrl) {
    return apiError(400, "invalid_request", "Для mode=REDIRECT нужен redirectUrl");
  }

  const project = await prisma.establishment.findFirst({
    where: { id: projectId, ...establishmentAccessWhere(userId) },
    select: { id: true },
  });
  if (!project) return apiError(404, "not_found", "Проект не найден");

  const landing = await assertCanAssignLandingMode({
    userId,
    establishmentId: projectId,
    nextMode: mode,
    previousMode: null,
    grandfathered: false,
  });
  if (!landing.ok) {
    return apiError(403, "upgrade_required", landing.error, {
      requiredPlan: landing.upgradeRequired ?? "PRO",
    });
  }

  const limited = rateLimit(`api-v1-qr-create:${userId}`, CREATE_LIMIT_PER_HOUR, 60 * 60_000);
  if (!limited.ok) {
    return apiError(
      429,
      "rate_limited",
      `Не больше ${CREATE_LIMIT_PER_HOUR} новых QR-кодов в час`,
      undefined,
      { "Retry-After": String(limited.retryAfterSeconds) }
    );
  }

  let code: string | null = null;
  for (let i = 0; i < 10 && !code; i++) {
    const candidate = generateQRCode();
    if (candidate.startsWith(DEMO_QR_PREFIX)) continue;
    const exists = await prisma.qRCode.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!exists) code = candidate;
  }
  if (!code) return apiError(500, "internal_error", "Не удалось сгенерировать уникальный код");

  const qrcode = await prisma.qRCode.create({
    data: {
      code,
      mode,
      label: input.label ?? null,
      redirectUrl: input.redirectUrl ?? null,
      isActive: true,
      source: "DASHBOARD",
      user: { connect: { id: userId } },
      establishment: { connect: { id: projectId } },
    },
  });

  logUserEvent(userId, "dash.api_qr_created", { qrCodeId: qrcode.id, mode });

  return apiJson({ qrcode: serializeQrCode(qrcode) }, { status: 201 });
});
