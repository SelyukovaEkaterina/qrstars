import { NextResponse } from "next/server";
import { collectWeeklyInsightsData } from "@/lib/insights/weekly-insights-data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Отдельный секрет, а не CRON_SECRET: им пользуется ИИ-агент на VPS, и ему не нужен
 * доступ к остальным cron-ручкам (рассылки, списания).
 */
function authorize(request: Request): boolean {
  const secret = process.env.INSIGHTS_DATA_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Пакет метрик за прошлую неделю (МСК) для недельного ИИ-отчёта: база + Яндекс Метрика,
 * без персональных данных. `?referenceDate=ISO` — отчёт за неделю до этой даты.
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ref = new URL(request.url).searchParams.get("referenceDate");
  const referenceDate = ref ? new Date(ref) : new Date();
  if (Number.isNaN(referenceDate.getTime())) {
    return NextResponse.json({ error: "Invalid referenceDate" }, { status: 400 });
  }

  const data = await collectWeeklyInsightsData(referenceDate);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
