import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { sendMail } from "@/lib/mailer";
import { sendTelegramContactNotification } from "@/lib/telegram";
import { sendMaxMessage } from "@/lib/max";
import { renderEmailLayout, featureBlock } from "@/lib/email-layout";
import { userHasPaidFeatures } from "@/lib/subscription-utils";
import { pluralize } from "@/lib/utils";
import { MODE_LABELS } from "@/lib/qr-routing";
import {
  getReportEmailTargets,
  getReportTelegramTargets,
  getReportMaxTargets,
} from "@/lib/owner-messenger-notify";
import {
  MSK_OFFSET_MS,
  formatMskDate,
  pad2,
  deltaLine,
  deltaPercent,
  escapeHtml,
  fmtRu,
} from "@/lib/report-formatting";

export interface MonthlyReportRange {
  /** Период: первый день месяца 00:00:00 МСК */
  from: Date;
  /** Период: последний день месяца 23:59:59.999 МСК */
  to: Date;
  /** Предыдущий период (MoM): первый день позапрошлого месяца */
  prevFrom: Date;
  /** Предыдущий период: последний день позапрошлого месяца */
  prevTo: Date;
  /** Полночь МСК первого дня (для фильтра по DailyScanStat.date) */
  scanFrom: Date;
  /** Полночь МСК последнего дня (для фильтра по DailyScanStat.date) */
  scanTo: Date;
  scanPrevFrom: Date;
  scanPrevTo: Date;
  year: number;
  month: number; // 1-12 (MSK)
  key: string; // monthly_report_YYYY_MM
  labelHuman: string; // «июня 2026»
  labelFrom: string;
  labelTo: string;
}

export interface PeriodMetric {
  current: number;
  previous: number;
}

export interface ModeScanStat {
  mode: string;
  label: string;
  scans: PeriodMetric;
}

export interface ReviewStat {
  count: PeriodMetric;
  negative: PeriodMetric;
  positive: number;
  avgRating: number | null;
  prevAvgRating: number | null;
  ratingDistribution: number[]; // [1★,2★,3★,4★,5★] — текущий период
}

export interface MenuStat {
  orders: PeriodMetric;
  revenue: PeriodMetric;
  avgCheck: number | null;
  conversion: number | null; // заказы / сканы MENU (%)
}

export interface TopQr {
  code: string;
  label: string | null;
  mode: string;
  scans: number;
}

export interface EstablishmentBreakdownRow {
  id: string;
  name: string;
  scans: number;
  reviews: number;
  avgRating: number | null;
}

export interface OwnerReportMetrics {
  userId: string;
  ownerEmail: string;
  isPro: boolean;
  range: MonthlyReportRange;
  establishmentCount: number;
  qrCount: number;
  qrModeSet: Set<string>;
  totalScans: PeriodMetric;
  reviewCapableScans: PeriodMetric;
  modes: ModeScanStat[];
  reviews: ReviewStat;
  menu: MenuStat | null;
  topRedirectUrls: { url: string; scans: number }[];
  topQrsByMode: Record<string, TopQr[]>;
  establishmentBreakdown: EstablishmentBreakdownRow[];
  hasActivity: boolean;
}

export interface OwnerReportSendResult {
  userId: string;
  status: "sent" | "skipped" | "failed";
  reason?: string;
  channels?: { email: number; telegram: number; max: number };
}

export interface OwnerReportBatchResult {
  ok: boolean;
  sent: OwnerReportSendResult[];
  skipped: OwnerReportSendResult[];
  failed: OwnerReportSendResult[];
  periodKey: string;
  error?: string;
}

const REVIEW_CAPABLE_MODES = ["REVIEW", "LANDING"];
const MAX_TG_MESSAGE_LEN = 4000;

/**
 * Прошлый календарный месяц по Москве относительно referenceDate.
 * Сравнение MoM — с позапрошлым месяцем.
 */
export function getPreviousMskMonthRange(referenceDate = new Date()): MonthlyReportRange {
  const mskNow = new Date(referenceDate.getTime() + MSK_OFFSET_MS);
  // Текущий год/месяц в МСК. Прошлый месяц = current-1 (с учётом перехода года).
  let year = mskNow.getUTCFullYear();
  let month = mskNow.getUTCMonth(); // 0-based
  month -= 1;
  if (month < 0) {
    month = 11;
    year -= 1;
  }
  return buildMonthRange(year, month);
}

/** Сборка диапазона для конкретного месяца (MSK). month — 0-based (как Date). */
function buildMonthRange(year: number, month: number): MonthlyReportRange {
  const labelHuman = formatMonthHumanRaw(year, month);

  // Полночь МСК первого дня месяца → UTC
  const scanFromUtc = mskMidnightToUtc(Date.UTC(year, month, 1));
  // Полночь МСК последнего дня месяца → UTC
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const scanToUtc = mskMidnightToUtc(Date.UTC(year, month, lastDayOfMonth));

  // datetime-границы для createdAt (полное покрытие последнего дня до 23:59:59.999 МСК)
  const from = scanFromUtc;
  const to = new Date(scanToUtc.getTime() + 86_400_000 - 1);

  // Предыдущий период (позапрошлый месяц)
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear -= 1;
  }
  const scanPrevFromUtc = mskMidnightToUtc(Date.UTC(prevYear, prevMonth, 1));
  const prevLastDay = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
  const scanPrevToUtc = mskMidnightToUtc(Date.UTC(prevYear, prevMonth, prevLastDay));
  const prevFrom = scanPrevFromUtc;
  const prevTo = new Date(scanPrevToUtc.getTime() + 86_400_000 - 1);

  return {
    from,
    to,
    prevFrom,
    prevTo,
    scanFrom: scanFromUtc,
    scanTo: scanToUtc,
    scanPrevFrom: scanPrevFromUtc,
    scanPrevTo: scanPrevToUtc,
    year,
    month: month + 1,
    key: `monthly_report_${year}_${pad2(month + 1)}`,
    labelHuman,
    labelFrom: formatMskDate(from),
    labelTo: formatMskDate(to),
  };
}

function mskMidnightToUtc(mskMidnightUtcMs: number): Date {
  // mskMidnightUtcMs — это "как если бы это было UTC", но это полночь по МСК.
  // Переводим МСК-полночь в реальный UTC: UTC = МСК - 3h.
  return new Date(mskMidnightUtcMs - MSK_OFFSET_MS);
}

function formatMonthHumanRaw(year: number, month0: number): string {
  const names = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
  ];
  return `${names[month0]} ${year}`;
}

function modeLabel(mode: string): string {
  return MODE_LABELS[mode as keyof typeof MODE_LABELS] ?? mode;
}

interface RawModeScan {
  mode: string;
  scans: bigint;
}

interface RawTopQr {
  qrCodeId: string;
  mode: string;
  scans: bigint;
}

interface RawRedirectUrl {
  redirectUrl: string | null;
  scans: bigint;
}

async function scanAggregationByMode(
  estIds: string[],
  scanFrom: Date,
  scanTo: Date
): Promise<Map<string, number>> {
  if (estIds.length === 0) return new Map();
  const estIdsJoined = Prisma.join(estIds);
  const rows: RawModeScan[] = await prisma.$queryRaw(Prisma.sql`
    SELECT q."mode" AS mode, COALESCE(SUM(d.count), 0)::bigint AS scans
    FROM "DailyScanStat" d
    JOIN "QRCode" q ON q.id = d."qrCodeId"
    WHERE d.date >= ${scanFrom} AND d.date <= ${scanTo}
      AND q."establishmentId" IN (${estIdsJoined})
    GROUP BY q."mode"
  `);
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.mode, Number(r.scans));
  }
  return map;
}

async function topQrsByMode(
  estIds: string[],
  scanFrom: Date,
  scanTo: Date,
  limitPerMode = 3
): Promise<Record<string, TopQr[]>> {
  if (estIds.length === 0) return {};
  const estIdsJoined = Prisma.join(estIds);
  // Топ-QR по сканам за период (один проход, группируем в памяти по mode).
  const rows: RawTopQr[] = await prisma.$queryRaw(Prisma.sql`
    SELECT d."qrCodeId" AS "qrCodeId", q."mode" AS mode, SUM(d.count)::bigint AS scans
    FROM "DailyScanStat" d
    JOIN "QRCode" q ON q.id = d."qrCodeId"
    WHERE d.date >= ${scanFrom} AND d.date <= ${scanTo}
      AND q."establishmentId" IN (${estIdsJoined})
    GROUP BY d."qrCodeId", q."mode"
    ORDER BY scans DESC
    LIMIT 50
  `);
  const byModeAcc: Record<string, { id: string; mode: string; scans: number }[]> = {};
  for (const r of rows) {
    const arr = byModeAcc[r.mode] ?? (byModeAcc[r.mode] = []);
    arr.push({ id: r.qrCodeId, mode: r.mode, scans: Number(r.scans) });
  }
  // Обогащаем метаданными QR и обрезаем по limitPerMode.
  const allTopIds = Object.values(byModeAcc)
    .flat()
    .slice(0, 50)
    .map((x) => x.id);
  const qrMeta =
    allTopIds.length > 0
      ? await prisma.qRCode.findMany({
          where: { id: { in: allTopIds } },
          select: { id: true, code: true, label: true, mode: true },
        })
      : [];
  const metaMap = new Map(qrMeta.map((q) => [q.id, q]));
  const result: Record<string, TopQr[]> = {};
  for (const [mode, arr] of Object.entries(byModeAcc)) {
    result[mode] = arr
      .slice(0, limitPerMode)
      .map((x) => {
        const m = metaMap.get(x.id);
        return {
          code: m?.code ?? x.id.slice(0, 8),
          label: m?.label ?? null,
          mode: x.mode,
          scans: x.scans,
        };
      });
  }
  return result;
}

async function topRedirectUrls(
  estIds: string[],
  scanFrom: Date,
  scanTo: Date,
  limit = 3
): Promise<{ url: string; scans: number }[]> {
  if (estIds.length === 0) return [];
  const estIdsJoined = Prisma.join(estIds);
  const rows: RawRedirectUrl[] = await prisma.$queryRaw(Prisma.sql`
    SELECT q."redirectUrl" AS "redirectUrl", SUM(d.count)::bigint AS scans
    FROM "DailyScanStat" d
    JOIN "QRCode" q ON q.id = d."qrCodeId"
    WHERE d.date >= ${scanFrom} AND d.date <= ${scanTo}
      AND q."establishmentId" IN (${estIdsJoined})
      AND q."mode" = 'REDIRECT'
      AND q."redirectUrl" IS NOT NULL
      AND q."redirectUrl" <> ''
    GROUP BY q."redirectUrl"
    ORDER BY scans DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ url: r.redirectUrl ?? "", scans: Number(r.scans) }));
}

async function aggregateReviews(
  estIds: string[],
  from: Date,
  to: Date
): Promise<{
  count: number;
  negative: number;
  positive: number;
  avgRating: number | null;
  ratingDistribution: number[];
}> {
  if (estIds.length === 0) {
    return { count: 0, negative: 0, positive: 0, avgRating: null, ratingDistribution: [0, 0, 0, 0, 0] };
  }
  const reviews = await prisma.review.findMany({
    where: { establishmentId: { in: estIds }, createdAt: { gte: from, lte: to } },
    select: { rating: true, isNegative: true },
  });
  const dist = [0, 0, 0, 0, 0];
  let negative = 0;
  let sum = 0;
  for (const r of reviews) {
    const idx = Math.min(4, Math.max(0, r.rating - 1));
    dist[idx]++;
    sum += r.rating;
    if (r.isNegative) negative++;
  }
  const count = reviews.length;
  return {
    count,
    negative,
    positive: count - negative,
    avgRating: count > 0 ? +(sum / count).toFixed(2) : null,
    ratingDistribution: dist,
  };
}

async function aggregateMenu(
  estIds: string[],
  from: Date,
  to: Date
): Promise<{ orders: number; revenue: number }> {
  if (estIds.length === 0) return { orders: 0, revenue: 0 };
  const agg = await prisma.menuOrder.aggregate({
    where: { establishmentId: { in: estIds }, createdAt: { gte: from, lte: to } },
    _count: { id: true },
    _sum: { total: true },
  });
  return { orders: agg._count.id, revenue: agg._sum.total ?? 0 };
}

async function establishmentBreakdown(
  establishments: { id: string; name: string }[],
  scanFrom: Date,
  scanTo: Date,
  reviewFrom: Date,
  reviewTo: Date
): Promise<EstablishmentBreakdownRow[]> {
  if (establishments.length <= 1) return [];
  const estIds = establishments.map((e) => e.id);
  const estIdsJoined = Prisma.join(estIds);
  const scanRows: { establishmentId: string; scans: bigint }[] = await prisma.$queryRaw(Prisma.sql`
    SELECT q."establishmentId" AS "establishmentId", SUM(d.count)::bigint AS scans
    FROM "DailyScanStat" d
    JOIN "QRCode" q ON q.id = d."qrCodeId"
    WHERE d.date >= ${scanFrom} AND d.date <= ${scanTo}
      AND q."establishmentId" IN (${estIdsJoined})
    GROUP BY q."establishmentId"
  `);
  const scanMap = new Map(scanRows.map((r) => [r.establishmentId, Number(r.scans)]));

  const reviewAgg = await prisma.review.groupBy({
    by: ["establishmentId"],
    where: { establishmentId: { in: estIds }, createdAt: { gte: reviewFrom, lte: reviewTo } },
    _count: { id: true },
    _avg: { rating: true },
  });
  const reviewMap = new Map(reviewAgg.map((r) => [r.establishmentId, r]));

  return establishments
    .map((e) => {
      const rv = reviewMap.get(e.id);
      return {
        id: e.id,
        name: e.name,
        scans: scanMap.get(e.id) ?? 0,
        reviews: rv?._count.id ?? 0,
        avgRating: rv?._avg.rating ? +rv._avg.rating.toFixed(2) : null,
      };
    })
    .sort((a, b) => b.scans - a.scans);
}

export async function collectOwnerMonthlyMetrics(
  userId: string,
  range: MonthlyReportRange
): Promise<OwnerReportMetrics> {
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const ownerEmail = owner?.email ?? "";

  const establishments = await prisma.establishment.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const estIds = establishments.map((e) => e.id);
  const establishmentCount = establishments.length;

  const isPro = await userHasPaidFeatures(userId);

  // Все QR владельца, привязанные к заведениям — определяем множество режимов.
  const qrs = establishmentCount > 0
    ? await prisma.qRCode.findMany({
        where: { establishmentId: { in: estIds } },
        select: { mode: true },
      })
    : [];
  const qrCount = qrs.length;
  const qrModeSet = new Set(qrs.map((q) => q.mode));

  // Сканы по режимам: текущий и предыдущий периоды.
  const [curModeMap, prevModeMap] = await Promise.all([
    scanAggregationByMode(estIds, range.scanFrom, range.scanTo),
    scanAggregationByMode(estIds, range.scanPrevFrom, range.scanPrevTo),
  ]);

  // Объединяем множества режимов из конфигурации QR и реально сканированных.
  const allModes = new Set<string>([...qrModeSet, ...curModeMap.keys(), ...prevModeMap.keys()]);
  const modes: ModeScanStat[] = [...allModes]
    .map((mode) => ({
      mode,
      label: modeLabel(mode),
      scans: {
        current: curModeMap.get(mode) ?? 0,
        previous: prevModeMap.get(mode) ?? 0,
      },
    }))
    .sort((a, b) => b.scans.current + b.scans.previous - (a.scans.current + a.scans.previous));

  const totalScans: PeriodMetric = {
    current: modes.reduce((s, m) => s + m.scans.current, 0),
    previous: modes.reduce((s, m) => s + m.scans.previous, 0),
  };

  const reviewCapableScans: PeriodMetric = {
    current: modes
      .filter((m) => REVIEW_CAPABLE_MODES.includes(m.mode))
      .reduce((s, m) => s + m.scans.current, 0),
    previous: modes
      .filter((m) => REVIEW_CAPABLE_MODES.includes(m.mode))
      .reduce((s, m) => s + m.scans.previous, 0),
  };

  // Отзывы: текущий и предыдущий периоды.
  const [curReviews, prevReviews] = await Promise.all([
    aggregateReviews(estIds, range.from, range.to),
    aggregateReviews(estIds, range.prevFrom, range.prevTo),
  ]);
  const reviews: ReviewStat = {
    count: { current: curReviews.count, previous: prevReviews.count },
    negative: { current: curReviews.negative, previous: prevReviews.negative },
    positive: curReviews.positive,
    avgRating: curReviews.avgRating,
    prevAvgRating: prevReviews.avgRating,
    ratingDistribution: curReviews.ratingDistribution,
  };

  // Меню (заказы) — только если есть MENU-QR.
  const hasMenuQr = qrModeSet.has("MENU");
  let menu: MenuStat | null = null;
  if (hasMenuQr) {
    const [curMenu, prevMenu] = await Promise.all([
      aggregateMenu(estIds, range.from, range.to),
      aggregateMenu(estIds, range.prevFrom, range.prevTo),
    ]);
    const menuScansCur = curModeMap.get("MENU") ?? 0;
    menu = {
      orders: { current: curMenu.orders, previous: prevMenu.orders },
      revenue: { current: curMenu.revenue, previous: prevMenu.revenue },
      avgCheck: curMenu.orders > 0 ? +(curMenu.revenue / curMenu.orders).toFixed(0) : null,
      conversion: menuScansCur > 0 ? +((curMenu.orders / menuScansCur) * 100).toFixed(1) : null,
    };
  }

  // Топ-QR по режимам и топ redirect-URL — только для PRO.
  let topQrsByModeMap: Record<string, TopQr[]> = {};
  let topRedirectUrlsList: { url: string; scans: number }[] = [];
  if (isPro) {
    [topQrsByModeMap, topRedirectUrlsList] = await Promise.all([
      topQrsByMode(estIds, range.scanFrom, range.scanTo),
      topRedirectUrls(estIds, range.scanFrom, range.scanTo),
    ]);
  }

  const breakdown =
    establishmentCount > 1
      ? await establishmentBreakdown(
          establishments,
          range.scanFrom,
          range.scanTo,
          range.from,
          range.to
        )
      : [];

  const hasActivity =
    totalScans.current > 0 || reviews.count.current > 0 || qrCount > 0;

  return {
    userId,
    ownerEmail,
    isPro,
    range,
    establishmentCount,
    qrCount,
    qrModeSet,
    totalScans,
    reviewCapableScans,
    modes,
    reviews,
    menu,
    topRedirectUrls: topRedirectUrlsList,
    topQrsByMode: topQrsByModeMap,
    establishmentBreakdown: breakdown,
    hasActivity,
  };
}

/* ----------------------------- Рендер Email ----------------------------- */

function emailDeltaPill(cur: number, prev: number): string {
  const pct = deltaPercent(cur, prev);
  if (pct === null) return cur > 0 ? `<span style="color:#6366f1;">новое</span>` : "";
  if (pct === 0) return `<span style="color:#9ca3af;">0%</span>`;
  const color = pct > 0 ? "#16a34a" : "#dc2626";
  const sign = pct > 0 ? "+" : "";
  return `<span style="color:${color};font-weight:600;">${sign}${pct}%</span>`;
}

function emailMetricCard(label: string, value: string, cur: number, prev: number): string {
  const pill = emailDeltaPill(cur, prev);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
    <tr>
      <td style="padding:16px 18px;background:#f9fafb;border-radius:12px;">
        <p style="margin:0;font-size:13px;color:#6b7280;">${escapeHtml(label)}</p>
        <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#111827;">${value} ${pill ? `&nbsp; <span style="font-size:14px;font-weight:500;">${pill}</span>` : ""}</p>
      </td>
    </tr>
  </table>`;
}

function emailSectionTitle(emoji: string, title: string): string {
  return `<h2 style="margin:28px 0 12px;font-size:18px;color:#111827;">${emoji} ${escapeHtml(title)}</h2>`;
}

function emailRatingDistribution(dist: number[]): string {
  const max = Math.max(1, ...dist);
  const rows = dist
    .map((count, i) => {
      const star = i + 1;
      const pctWidth = Math.round((count / max) * 100);
      const color = star >= 4 ? "#16a34a" : star === 3 ? "#f59e0b" : "#dc2626";
      return `<tr>
        <td style="padding:3px 8px 3px 0;font-size:13px;color:#6b7280;width:36px;">${star}★</td>
        <td style="padding:3px 0;width:60%;">
          <div style="background:#f3f4f6;border-radius:6px;height:10px;overflow:hidden;">
            <div style="width:${pctWidth}%;background:${color};height:10px;"></div>
          </div>
        </td>
        <td style="padding:3px 0 3px 10px;font-size:13px;color:#374151;font-weight:600;width:40px;">${count}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

export function renderOwnerMonthlyReportEmail(m: OwnerReportMetrics): string {
  const r = m.range;
  const lines: string[] = [];

  // Шапка
  lines.push(
    `<p style="margin:0 0 4px;color:#6b7280;font-size:14px;">Отчёт за ${escapeHtml(r.labelHuman)} · сравнение с прошлым месяцем</p>`
  );
  if (m.establishmentCount > 1) {
    lines.push(
      `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Сводно по всем заведениям (${m.establishmentCount})</p>`
    );
  } else {
    lines.push(`<p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${m.qrCount} ${pluralize(m.qrCount, "QR-код активен", "QR-кода активны", "QR-кодов активны")}</p>`);
  }

  // Ключевые метрики
  lines.push(emailMetricCard("Всего сканирований QR", fmtRu(m.totalScans.current), m.totalScans.current, m.totalScans.previous));
  if (m.reviews.count.current > 0 || m.reviewCapableScans.current > 0) {
    const conv =
      m.reviewCapableScans.current > 0
        ? +((m.reviews.count.current / m.reviewCapableScans.current) * 100).toFixed(1)
        : null;
    lines.push(
      emailMetricCard(
        "Получено отзывов",
        fmtRu(m.reviews.count.current) + (m.reviews.avgRating != null ? ` · ${m.reviews.avgRating}★` : ""),
        m.reviews.count.current,
        m.reviews.count.previous
      )
    );
    if (m.isPro && conv !== null) {
      lines.push(`<p style="margin:-4px 0 16px;font-size:13px;color:#6b7280;">Конверсия в отзыв: <b style="color:#111827;">${conv}%</b>${m.reviews.positive !== m.reviews.count.current ? ` · ${pluralize(m.reviews.positive, "позитивный", "позитивных", "позитивных")} ${m.reviews.positive}` : ""}</p>`);
    }
  }

  // PRO-секции по режимам
  if (m.isPro) {
    lines.push(...renderEmailProSections(m));
  } else {
    lines.push(...renderEmailFreeSections(m));
  }

  // Сводка по заведениям (Сеть)
  if (m.establishmentBreakdown.length > 1) {
    lines.push(emailSectionTitle("🏪", "По точкам сети"));
    const rows = m.establishmentBreakdown
      .map(
        (e, i) =>
          `<tr>
            <td style="padding:8px 12px 8px 0;font-size:14px;color:#111827;">${i + 1}. ${escapeHtml(e.name)}</td>
            <td style="padding:8px;font-size:14px;color:#374151;text-align:right;">${fmtRu(e.scans)} скан.</td>
            <td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;">${e.reviews} отз.${e.avgRating != null ? ` · ${e.avgRating}★` : ""}</td>
          </tr>`
      )
      .join("");
    lines.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:8px 14px;">${rows}</table>`
    );
  }

  // Промо-блоки (кросс-селл)
  const promo = buildPromoBlocks(m);
  for (const p of promo) {
    lines.push(featureBlock(p.title, p.text));
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const bodyHtml = lines.join("\n");
  return renderEmailLayout({
    userId: m.userId,
    title: `Ваш отчёт за ${r.labelHuman}`,
    preheader: `Сканирования, отзывы и динамика за ${r.labelHuman.toLowerCase()}`,
    bodyHtml,
    cta: base ? { label: "Открыть аналитику", href: `${base}/dashboard/analytics` } : undefined,
    showUnsubscribe: true,
  });
}

function renderEmailProSections(m: OwnerReportMetrics): string[] {
  const out: string[] = [];

  // Секция отзывов
  if (m.qrModeSet.has("REVIEW") || m.qrModeSet.has("LANDING") || m.reviews.count.current > 0) {
    out.push(emailSectionTitle("⭐", "Отзывы"));
    out.push(
      `<p style="margin:0 0 8px;font-size:14px;color:#374151;">
        Получено <b>${fmtRu(m.reviews.count.current)}</b> ${emailDeltaPill(m.reviews.count.current, m.reviews.count.previous)}
        · негативных (1–3★) <b>${m.reviews.negative.current}</b>
        ${m.reviews.avgRating != null ? `· средняя <b>${m.reviews.avgRating}★</b>${m.reviews.prevAvgRating != null ? ` (было ${m.reviews.prevAvgRating}★)` : ""}` : ""}
      </p>`
    );
    if (m.reviews.count.current > 0) {
      out.push(emailRatingDistribution(m.reviews.ratingDistribution));
    }
    const topReviewQrs = [...(m.topQrsByMode["REVIEW"] ?? []), ...(m.topQrsByMode["LANDING"] ?? [])]
      .sort((a, b) => b.scans - a.scans)
      .slice(0, 3);
    if (topReviewQrs.length > 0) {
      out.push(renderEmailTopQrs(topReviewQrs));
    }
  }

  // Секция QR-меню
  if (m.menu) {
    out.push(emailSectionTitle("🍽", "QR-меню"));
    const menuScans = m.modes.find((x) => x.mode === "MENU")?.scans.current ?? 0;
    const menuScansPrev = m.modes.find((x) => x.mode === "MENU")?.scans.previous ?? 0;
    out.push(
      `<p style="margin:0 0 8px;font-size:14px;color:#374151;">
        Сканы меню: <b>${fmtRu(menuScans)}</b> ${emailDeltaPill(menuScans, menuScansPrev)} ·
        заказов <b>${fmtRu(m.menu.orders.current)}</b> ${emailDeltaPill(m.menu.orders.current, m.menu.orders.previous)}
        ${m.menu.avgCheck != null ? `· средний чек <b>≈ ${fmtRu(m.menu.avgCheck)} ₽</b>` : ""}
        ${m.menu.conversion != null ? `· конверсия в заказ <b>${m.menu.conversion}%</b>` : ""}
      </p>`
    );
    const topMenuQrs = m.topQrsByMode["MENU"] ?? [];
    if (topMenuQrs.length > 0) {
      out.push(renderEmailTopQrs(topMenuQrs));
    }
  }

  // Секция редиректа
  if (m.qrModeSet.has("REDIRECT")) {
    const redirScans = m.modes.find((x) => x.mode === "REDIRECT")?.scans;
    out.push(emailSectionTitle("🔗", "Редирект"));
    out.push(
      `<p style="margin:0 0 8px;font-size:14px;color:#374151;">
        Переходов: <b>${fmtRu(redirScans?.current ?? 0)}</b> ${emailDeltaPill(redirScans?.current ?? 0, redirScans?.previous ?? 0)}
      </p>`
    );
    if (m.topRedirectUrls.length > 0) {
      const items = m.topRedirectUrls
        .map(
          (u) =>
            `<li style="margin-bottom:6px;font-size:13px;color:#374151;"><b>${fmtRu(u.scans)}</b> — <a href="${escapeHtml(u.url)}" style="color:#6366f1;text-decoration:none;">${escapeHtml(shortenUrl(u.url))}</a></li>`
        )
        .join("");
      out.push(`<ol style="margin:8px 0;padding-left:20px;">${items}</ol>`);
    }
  }

  // Прочие режимы — кратко
  const otherModes = m.modes.filter(
    (x) => !["REVIEW", "LANDING", "MENU", "REDIRECT"].includes(x.mode) && (x.scans.current > 0 || x.scans.previous > 0)
  );
  if (otherModes.length > 0) {
    out.push(emailSectionTitle("📱", "Прочие режимы"));
    const items = otherModes
      .map(
        (x) =>
          `<li style="margin-bottom:6px;font-size:14px;color:#374151;">${escapeHtml(x.label)}: <b>${fmtRu(x.scans.current)}</b> ${emailDeltaPill(x.scans.current, x.scans.previous)}</li>`
      )
      .join("");
    out.push(`<ul style="margin:8px 0;padding-left:20px;">${items}</ul>`);
  }

  return out;
}

function renderEmailFreeSections(m: OwnerReportMetrics): string[] {
  const out: string[] = [];
  // Краткий топ-режим (без детализации и конверсии).
  const activeModes = m.modes.filter((x) => x.scans.current > 0).slice(0, 3);
  if (activeModes.length > 0) {
    out.push(emailSectionTitle("📊", "Сканирования по типам QR"));
    const items = activeModes
      .map(
        (x) =>
          `<li style="margin-bottom:6px;font-size:14px;color:#374151;">${escapeHtml(x.label)}: <b>${fmtRu(x.scans.current)}</b></li>`
      )
      .join("");
    out.push(`<ul style="margin:8px 0;padding-left:20px;">${items}</ul>`);
  }
  return out;
}

function renderEmailTopQrs(top: TopQr[]): string {
  const items = top
    .map(
      (q) =>
        `<li style="margin-bottom:6px;font-size:13px;color:#374151;"><b>${fmtRu(q.scans)}</b> — ${escapeHtml(q.label ?? q.code)}</li>`
    )
    .join("");
  return `<p style="margin:8px 0 4px;font-size:13px;color:#6b7280;">Топ QR:</p><ol style="margin:4px 0;padding-left:20px;">${items}</ol>`;
}

interface PromoBlock {
  title: string;
  text: string;
}

function buildPromoBlocks(m: OwnerReportMetrics): PromoBlock[] {
  const out: PromoBlock[] = [];
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  // Нет QR на отзывы → расскажи про отзывы.
  if (!m.qrModeSet.has("REVIEW") && !m.qrModeSet.has("LANDING")) {
    out.push({
      title: "💡 А вы собираете отзывы на Яндекс.Картах?",
      text: `Создайте QR на отзывы — гости с оценкой 4–5★ перейдут на Яндекс/2GIS, а негатив уйдёт вам в личный кабинет. ${
        base ? `<a href="${base}/dashboard/start" style="color:#6366f1;text-decoration:none;">Создать бесплатно →</a>` : ""
      }`,
    });
  }

  // Нет меню, но есть заведение → расскажи про меню.
  if (!m.qrModeSet.has("MENU") && m.establishmentCount > 0) {
    out.push({
      title: "🍽 Подключите QR-меню с приёмом заказов",
      text: `Цифровое меню + заказы в iiko или вам в Telegram. Доступно на PRO-тарифе. ${
        base ? `<a href="${base}/dashboard/subscription" style="color:#6366f1;text-decoration:none;">Подробнее →</a>` : ""
      }`,
    });
  }

  // FREE → upsell PRO.
  if (!m.isPro) {
    out.push({
      title: "⚡ Расширенная аналитика на PRO",
      text: `Конверсия в отзыв, динамика по дням и устройствам, умная ротация площадок и жалобы в Telegram. ${
        base ? `<a href="${base}/dashboard/subscription" style="color:#6366f1;text-decoration:none;">Перейти на PRO →</a>` : ""
      }`,
    });
  }

  return out;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return (u.hostname + path).slice(0, 60);
  } catch {
    return url.slice(0, 60);
  }
}

/* -------------------------- Рендер мессенджеров -------------------------- */

export function renderOwnerMonthlyReportMessenger(m: OwnerReportMetrics): string[] {
  const r = m.range;
  const lines: string[] = [];

  lines.push(`📋 <b>QrStars — отчёт за ${escapeHtml(r.labelHuman)}</b>`);
  lines.push(`<i>сравнение с прошлым месяцем${m.establishmentCount > 1 ? ` · сводно по ${m.establishmentCount} точкам` : ""}</i>`);
  lines.push("");
  lines.push(`<b>Сканирования:</b> ${fmtRu(m.totalScans.current)}${deltaLine(m.totalScans.current, m.totalScans.previous)}`);

  if (m.reviews.count.current > 0 || m.reviewCapableScans.current > 0) {
    const ratingStr = m.reviews.avgRating != null ? ` · ср. ${m.reviews.avgRating}★` : "";
    lines.push(
      `<b>Отзывы:</b> ${fmtRu(m.reviews.count.current)}${deltaLine(m.reviews.count.current, m.reviews.count.previous)}${ratingStr} · негатив ${m.reviews.negative.current}`
    );
  }

  // PRO-секции
  if (m.isPro) {
    // Отзывы
    if (m.qrModeSet.has("REVIEW") || m.qrModeSet.has("LANDING") || m.reviews.count.current > 0) {
      lines.push("");
      lines.push("<b>⭐ Отзывы</b>");
      if (m.reviews.count.current > 0 && m.reviews.ratingDistribution.some((c) => c > 0)) {
        const dist = m.reviews.ratingDistribution
          .map((c, i) => `${i + 1}★:${c}`)
          .join(" ");
        lines.push(`   ${dist}`);
      }
    }
    // Меню
    if (m.menu) {
      const ms = m.modes.find((x) => x.mode === "MENU")?.scans;
      lines.push("");
      lines.push("<b>🍽 QR-меню</b>");
      lines.push(
        `   Сканы: ${fmtRu(ms?.current ?? 0)}${deltaLine(ms?.current ?? 0, ms?.previous ?? 0)} · заказов ${fmtRu(m.menu.orders.current)}${deltaLine(m.menu.orders.current, m.menu.orders.previous)}${m.menu.avgCheck != null ? ` · чек ≈${fmtRu(m.menu.avgCheck)}₽` : ""}`
      );
    }
    // Редирект
    if (m.qrModeSet.has("REDIRECT")) {
      const rs = m.modes.find((x) => x.mode === "REDIRECT")?.scans;
      lines.push("");
      lines.push("<b>🔗 Редирект</b>");
      lines.push(`   Переходов: ${fmtRu(rs?.current ?? 0)}${deltaLine(rs?.current ?? 0, rs?.previous ?? 0)}`);
      if (m.topRedirectUrls.length > 0) {
        m.topRedirectUrls.forEach((u, i) => {
          lines.push(`   ${i + 1}. ${fmtRu(u.scans)} — ${escapeHtml(shortenUrl(u.url))}`);
        });
      }
    }
    // Прочие режимы
    const otherModes = m.modes.filter(
      (x) => !["REVIEW", "LANDING", "MENU", "REDIRECT"].includes(x.mode) && (x.scans.current > 0 || x.scans.previous > 0)
    );
    if (otherModes.length > 0) {
      lines.push("");
      lines.push("<b>📱 Прочее</b>");
      otherModes.forEach((x) => {
        lines.push(`   ${escapeHtml(x.label)}: ${fmtRu(x.scans.current)}${deltaLine(x.scans.current, x.scans.previous)}`);
      });
    }
  }

  // Сеть: топ-точки
  if (m.establishmentBreakdown.length > 1) {
    lines.push("");
    lines.push("<b>🏪 По точкам</b>");
    m.establishmentBreakdown.slice(0, 5).forEach((e, i) => {
      lines.push(`   ${i + 1}. ${escapeHtml(e.name)} — ${fmtRu(e.scans)} ${pluralize(Number(e.scans), "скан", "скана", "сканов")} · ${e.reviews} ${pluralize(Number(e.reviews), "отз.", "отз.", "отз.")}`);
    });
  }

  const full = lines.join("\n");
  // Разбиваем на части, если превышает лимит Telegram.
  return splitMessage(full, MAX_TG_MESSAGE_LEN);
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  const linesArr = text.split("\n");
  let buf = "";
  for (const ln of linesArr) {
    if ((buf + "\n" + ln).length > maxLen - 50) {
      if (buf) parts.push(buf);
      buf = ln;
    } else {
      buf = buf ? buf + "\n" + ln : ln;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

/* ------------------------------- Отправка ------------------------------- */

export async function wasMonthlyReportSent(userId: string, campaignKey: string): Promise<boolean> {
  const existing = await prisma.userLifecycleEmail.findUnique({
    where: { userId_campaignKey: { userId, campaignKey } },
    select: { id: true },
  });
  return !!existing;
}

async function recordMonthlyReportSent(userId: string, campaignKey: string): Promise<void> {
  try {
    await prisma.userLifecycleEmail.create({ data: { userId, campaignKey } });
  } catch (err) {
    // Unique constraint = уже записано (гонка при параллельных cron) — это ок.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}

export async function sendOwnerMonthlyReport(
  userId: string,
  range: MonthlyReportRange,
  options?: { force?: boolean }
): Promise<OwnerReportSendResult> {
  if (!options?.force && (await wasMonthlyReportSent(userId, range.key))) {
    return { userId, status: "skipped", reason: "already_sent" };
  }

  const metrics = await collectOwnerMonthlyMetrics(userId, range);

  if (metrics.establishmentCount === 0) {
    return { userId, status: "skipped", reason: "no_establishment" };
  }
  if (!metrics.hasActivity) {
    return { userId, status: "skipped", reason: "no_activity" };
  }

  const [emailTargets, tgTargets, maxTargets] = await Promise.all([
    getReportEmailTargets(userId),
    getReportTelegramTargets(userId),
    getReportMaxTargets(userId),
  ]);

  if (emailTargets.length === 0 && tgTargets.length === 0 && maxTargets.length === 0) {
    return { userId, status: "skipped", reason: "no_channels_enabled" };
  }

  let emailSent = 0;
  let telegramSent = 0;
  let maxSent = 0;

  // Email — полная HTML-версия.
  if (emailTargets.length > 0) {
    const html = renderOwnerMonthlyReportEmail(metrics);
    const subject = `Ваш отчёт QrStars за ${range.labelHuman}`;
    for (const to of emailTargets) {
      if (await sendMail(to, subject, html)) emailSent++;
    }
  }

  // Telegram / MAX — компактная версия.
  if (tgTargets.length > 0 || maxTargets.length > 0) {
    const parts = renderOwnerMonthlyReportMessenger(metrics);
    for (const part of parts) {
      for (const chatId of tgTargets) {
        if (await sendTelegramContactNotification(chatId, part)) telegramSent++;
      }
      for (const maxUserId of maxTargets) {
        if (await sendMaxMessage(maxUserId, part, "html")) maxSent++;
      }
    }
  }

  const anySent = emailSent > 0 || telegramSent > 0 || maxSent > 0;
  if (!anySent) {
    return { userId, status: "failed", reason: "all_channels_failed" };
  }

  // Идемпотентность: фиксируем факт отправки.
  await recordMonthlyReportSent(userId, range.key);

  console.log(
    `[owner-monthly-report] userId=${userId} key=${range.key} email=${emailSent} tg=${telegramSent} max=${maxSent}`
  );

  return {
    userId,
    status: "sent",
    channels: { email: emailSent, telegram: telegramSent, max: maxSent },
  };
}

const BATCH_SIZE = 100;

export async function sendOwnerMonthlyReports(options?: {
  /** Переопределить период в формате YYYY-MM (MSK). Для бэкфилла. */
  periodMonth?: string;
  /** Один userId (для тестовой/ручной отправки). */
  userId?: string;
  /** Игнорировать идемпотентность (для ручной переотправки). */
  force?: boolean;
  referenceDate?: Date;
}): Promise<OwnerReportBatchResult> {
  const range = resolveRange(options?.periodMonth, options?.referenceDate);

  const sent: OwnerReportSendResult[] = [];
  const skipped: OwnerReportSendResult[] = [];
  const failed: OwnerReportSendResult[] = [];

  try {
    if (options?.userId) {
      const result = await sendOwnerMonthlyReport(options.userId, range, { force: options.force });
      (result.status === "sent" ? sent : result.status === "skipped" ? skipped : failed).push(result);
      return { ok: true, sent, skipped, failed, periodKey: range.key };
    }

    let cursor: string | undefined;
    for (;;) {
      const users = await prisma.user.findMany({
        where: { role: { not: "ADMIN" }, establishments: { some: {} } },
        select: { id: true },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });
      if (users.length === 0) break;

      for (const { id: userId } of users) {
        const result = await sendOwnerMonthlyReport(userId, range, { force: options?.force });
        if (result.status === "sent") sent.push(result);
        else if (result.status === "skipped") skipped.push(result);
        else failed.push(result);
      }

      cursor = users[users.length - 1]?.id;
      if (users.length < BATCH_SIZE) break;
    }

    console.log(
      `[owner-monthly-report] batch key=${range.key} sent=${sent.length} skipped=${skipped.length} failed=${failed.length}`
    );
    return { ok: true, sent, skipped, failed, periodKey: range.key };
  } catch (err) {
    console.error("[owner-monthly-report] batch error:", err);
    return {
      ok: false,
      sent,
      skipped,
      failed,
      periodKey: range.key,
      error: err instanceof Error ? err.message : "batch_failed",
    };
  }
}

export function resolveRange(
  periodMonth: string | undefined,
  referenceDate: Date | undefined
): MonthlyReportRange {
  if (periodMonth && /^\d{4}-\d{2}$/.test(periodMonth)) {
    const [yStr, mStr] = periodMonth.split("-");
    const year = Number(yStr);
    const month0 = Number(mStr) - 1;
    return buildMonthRange(year, month0);
  }
  return getPreviousMskMonthRange(referenceDate ?? new Date());
}
