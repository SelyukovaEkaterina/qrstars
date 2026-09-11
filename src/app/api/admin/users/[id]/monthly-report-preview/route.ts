import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  collectOwnerMonthlyMetrics,
  renderOwnerMonthlyReportEmail,
  renderOwnerMonthlyReportMessenger,
  resolveRange,
  type OwnerReportMetrics,
} from "@/lib/owner-monthly-report";

/**
 * Admin-only превью ежемесячного отчёта владельца — метрики + HTML/TG.
 * Удобно для отладки и e2e-тестов (без UI).
 *
 *   GET /api/admin/users/[id]/monthly-report-preview?periodMonth=2026-06
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: userId } = await params;
  const url = new URL(request.url);
  const periodMonth = url.searchParams.get("periodMonth") ?? undefined;

  let range;
  try {
    range = resolveRange(periodMonth, new Date());
  } catch {
    return NextResponse.json(
      { error: "Invalid periodMonth, expected YYYY-MM" },
      { status: 400 }
    );
  }
  const metrics = await collectOwnerMonthlyMetrics(userId, range);

  return NextResponse.json({
    period: {
      key: range.key,
      labelHuman: range.labelHuman,
      from: range.from,
      to: range.to,
    },
    metrics: serializeMetrics(metrics),
    emailHtml: renderOwnerMonthlyReportEmail(metrics),
    messengerParts: renderOwnerMonthlyReportMessenger(metrics),
  });
}

function serializeMetrics(m: OwnerReportMetrics) {
  return {
    userId: m.userId,
    ownerEmail: m.ownerEmail,
    isPro: m.isPro,
    establishmentCount: m.establishmentCount,
    qrCount: m.qrCount,
    qrModes: [...m.qrModeSet],
    totalScans: m.totalScans,
    reviewCapableScans: m.reviewCapableScans,
    modes: m.modes,
    reviews: m.reviews,
    menu: m.menu,
    topRedirectUrls: m.topRedirectUrls,
    hasActivity: m.hasActivity,
    establishmentBreakdown: m.establishmentBreakdown,
  };
}
