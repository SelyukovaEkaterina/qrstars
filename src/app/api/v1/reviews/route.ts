import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { establishmentRelationWhere } from "@/lib/establishment-access";
import { apiError, apiJson, apiOptions, withApiAuth } from "@/lib/public-api/auth";
import { parseDateParam, parseLimit } from "@/lib/public-api/pagination";
import { serializeReview } from "@/lib/public-api/serialize";

export const OPTIONS = apiOptions;

/** Отзывы и жалобы гостей, новые сверху. */
export const GET = withApiAuth(async (request, { userId }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));
  if (limit === null) return apiError(400, "invalid_request", "limit — число от 1 до 200");
  const since = parseDateParam(searchParams.get("since"));
  if (since === null) return apiError(400, "invalid_request", "since — дата ISO 8601");

  const where: Prisma.ReviewWhereInput = { ...establishmentRelationWhere(userId) };
  const projectId = searchParams.get("projectId")?.trim();
  if (projectId) where.establishmentId = projectId;
  const qrCodeId = searchParams.get("qrCodeId")?.trim();
  if (qrCodeId) where.qrCodeId = qrCodeId;
  if (since) where.createdAt = { gte: since };

  const negative = searchParams.get("negative");
  if (negative === "true") where.isNegative = true;
  else if (negative === "false") where.isNegative = false;
  else if (negative !== null) return apiError(400, "invalid_request", "negative — true или false");

  const cursor = searchParams.get("cursor")?.trim() || null;
  const rows = await prisma.review.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, limit);
  return apiJson({
    reviews: page.map(serializeReview),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  });
});
