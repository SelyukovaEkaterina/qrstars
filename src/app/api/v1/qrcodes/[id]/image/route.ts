import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import { qrcodeAccessWhere } from "@/lib/establishment-access";
import { apiError, apiOptions, withApiAuth, withApiHeaders } from "@/lib/public-api/auth";
import { scanUrlForCode } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string }> };

export const OPTIONS = apiOptions;

/**
 * Простой чёрно-белый QR со ссылкой `/q/{code}`. Оформленные стили (цвета, логотип,
 * арт-режимы) рисуются в браузере движком `qr-engine` — их скачивают из кабинета.
 */
export const GET = withApiAuth<RouteContext>(async (request, { userId }, context) => {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "png").toLowerCase();
  if (format !== "png" && format !== "svg") {
    return apiError(400, "invalid_request", "format — png или svg");
  }
  const sizeRaw = searchParams.get("size");
  const size = sizeRaw ? Number(sizeRaw) : 1024;
  if (!Number.isInteger(size) || size < 128 || size > 2048) {
    return apiError(400, "invalid_request", "size — целое число от 128 до 2048");
  }

  const qrcode = await prisma.qRCode.findFirst({
    where: { id, ...qrcodeAccessWhere(userId) },
    select: { code: true },
  });
  if (!qrcode) return apiError(404, "not_found", "QR-код не найден");

  const url = scanUrlForCode(qrcode.code);
  const options = { errorCorrectionLevel: "M" as const, margin: 2, width: size };
  const filename = `qrstars-${qrcode.code}.${format}`;

  if (format === "svg") {
    const svg = await QRCode.toString(url, { ...options, type: "svg" });
    return withApiHeaders(
      new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    );
  }

  const png = await QRCode.toBuffer(url, { ...options, type: "png" });
  return withApiHeaders(
    new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    })
  );
});
