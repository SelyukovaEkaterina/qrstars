import prisma from "@/lib/prisma";
import {
  getSupportGroupChatId,
  sendSupportTelegramMessage,
} from "@/lib/telegram-support";
import { estimateSubscriptionMonthlyRevenue } from "@/lib/plans";

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface WeeklyReportRange {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  labelFrom: string;
  labelTo: string;
}

export interface WeeklyReportMetrics {
  range: WeeklyReportRange;
  scans: { current: number; previous: number };
  registrations: { current: number; previous: number };
  establishments: { current: number; previous: number };
  reviews: {
    current: number;
    previous: number;
    negativeCurrent: number;
    avgRating: number | null;
  };
  setupCompleted: { current: number; previous: number };
  menuOrders: { current: number; previous: number };
  newPaidSubscriptions: number;
  supportTickets: { current: number; previous: number };
  totals: {
    users: number;
    establishments: number;
    qrcodes: number;
    activePaidSubscriptions: number;
    monthlyRevenue: number;
  };
  topEstablishments: {
    name: string;
    ownerEmail: string;
    scans: number;
  }[];
  topQrcodes: {
    code: string;
    label: string | null;
    establishmentName: string | null;
    scans: number;
  }[];
  topRegions: { region: string; scans: number }[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMskDate(date: Date): string {
  const msk = new Date(date.getTime() + MSK_OFFSET_MS);
  const d = String(msk.getUTCDate()).padStart(2, "0");
  const m = String(msk.getUTCMonth() + 1).padStart(2, "0");
  const y = msk.getUTCFullYear();
  return `${d}.${m}.${y}`;
}

function startOfMskDay(date: Date): Date {
  const msk = new Date(date.getTime() + MSK_OFFSET_MS);
  msk.setUTCHours(0, 0, 0, 0);
  return new Date(msk.getTime() - MSK_OFFSET_MS);
}

/** Прошлая календарная неделя (пн–вс) по Москве относительно referenceDate. */
export function getPreviousMskWeekRange(referenceDate = new Date()): WeeklyReportRange {
  const todayStart = startOfMskDay(referenceDate);
  const dayOfWeek = new Date(todayStart.getTime() + MSK_OFFSET_MS).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const thisMonday = new Date(todayStart.getTime() - daysSinceMonday * 86_400_000);
  const prevMonday = new Date(thisMonday.getTime() - 7 * 86_400_000);
  const prevSundayEnd = new Date(thisMonday.getTime() - 1);
  const prevPrevMonday = new Date(prevMonday.getTime() - 7 * 86_400_000);

  return {
    from: prevMonday,
    to: prevSundayEnd,
    prevFrom: prevPrevMonday,
    prevTo: new Date(prevMonday.getTime() - 1),
    labelFrom: formatMskDate(prevMonday),
    labelTo: formatMskDate(prevSundayEnd),
  };
}

function deltaLine(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? " · <i>новое</i>" : "";
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return " · 0%";
  const sign = pct > 0 ? "+" : "";
  const emoji = pct > 0 ? "📈" : "📉";
  return ` · ${emoji} ${sign}${pct}%`;
}

function countLine(label: string, current: number, previous: number): string {
  return `<b>${escapeHtml(label)}:</b> ${current.toLocaleString("ru-RU")}${deltaLine(current, previous)}`;
}

export async function collectWeeklyReportMetrics(
  range: WeeklyReportRange
): Promise<WeeklyReportMetrics> {
  const period = { gte: range.from, lte: range.to };
  const prevPeriod = { gte: range.prevFrom, lte: range.prevTo };
  const notAdmin = { role: { not: "ADMIN" as const } };

  const [
    scansCurrent,
    scansPrevious,
    registrationsCurrent,
    registrationsPrevious,
    establishmentsCurrent,
    establishmentsPrevious,
    reviewsCurrent,
    reviewsPrevious,
    negativeCurrent,
    avgRatingResult,
    setupCompletedCurrent,
    setupCompletedPrevious,
    menuOrdersCurrent,
    menuOrdersPrevious,
    newPaidSubscriptions,
    supportTicketsCurrent,
    supportTicketsPrevious,
    totalUsers,
    totalEstablishments,
    totalQrcodes,
    paidSubscriptions,
    topEstablishmentGroups,
    topQrGroups,
    topRegionGroups,
  ] = await Promise.all([
    prisma.qRScan.count({ where: { createdAt: period } }),
    prisma.qRScan.count({ where: { createdAt: prevPeriod } }),
    prisma.user.count({ where: { createdAt: period, ...notAdmin } }),
    prisma.user.count({ where: { createdAt: prevPeriod, ...notAdmin } }),
    prisma.establishment.count({ where: { createdAt: period } }),
    prisma.establishment.count({ where: { createdAt: prevPeriod } }),
    prisma.review.count({ where: { createdAt: period } }),
    prisma.review.count({ where: { createdAt: prevPeriod } }),
    prisma.review.count({ where: { createdAt: period, isNegative: true } }),
    prisma.review.aggregate({
      where: { createdAt: period },
      _avg: { rating: true },
    }),
    prisma.userEvent.count({
      where: { event: "setup.completed", createdAt: period },
    }),
    prisma.userEvent.count({
      where: { event: "setup.completed", createdAt: prevPeriod },
    }),
    prisma.menuOrder.count({ where: { createdAt: period } }),
    prisma.menuOrder.count({ where: { createdAt: prevPeriod } }),
    prisma.subscription.count({
      where: {
        createdAt: period,
        plan: { in: ["PRO", "NETWORK"] },
        status: "ACTIVE",
      },
    }),
    prisma.supportTicket.count({ where: { createdAt: period } }),
    prisma.supportTicket.count({ where: { createdAt: prevPeriod } }),
    prisma.user.count({ where: notAdmin }),
    prisma.establishment.count(),
    prisma.qRCode.count(),
    prisma.subscription.findMany({
      where: { status: "ACTIVE", plan: { in: ["PRO", "NETWORK"] } },
      include: { user: { include: { _count: { select: { establishments: true } } } } },
    }),
    prisma.qRScan.groupBy({
      by: ["establishmentId"],
      where: { createdAt: period, establishmentId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.qRScan.groupBy({
      by: ["qrCodeId"],
      where: { createdAt: period },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.qRScan.groupBy({
      by: ["region"],
      where: {
        createdAt: period,
        region: { not: null },
        NOT: { region: "" },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  const establishmentIds = topEstablishmentGroups
    .map((g) => g.establishmentId)
    .filter((id): id is string => Boolean(id));

  const qrIds = topQrGroups.map((g) => g.qrCodeId);

  const [establishments, qrcodes] = await Promise.all([
    establishmentIds.length > 0
      ? prisma.establishment.findMany({
          where: { id: { in: establishmentIds } },
          select: {
            id: true,
            name: true,
            user: { select: { email: true } },
          },
        })
      : Promise.resolve([]),
    qrIds.length > 0
      ? prisma.qRCode.findMany({
          where: { id: { in: qrIds } },
          select: {
            id: true,
            code: true,
            label: true,
            establishment: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const establishmentMap = new Map(establishments.map((e) => [e.id, e]));
  const qrMap = new Map(qrcodes.map((q) => [q.id, q]));

  const monthlyRevenue = paidSubscriptions.reduce(
    (sum, s) =>
      sum +
      estimateSubscriptionMonthlyRevenue(s.plan, s.user._count.establishments),
    0
  );

  return {
    range,
    scans: { current: scansCurrent, previous: scansPrevious },
    registrations: { current: registrationsCurrent, previous: registrationsPrevious },
    establishments: { current: establishmentsCurrent, previous: establishmentsPrevious },
    reviews: {
      current: reviewsCurrent,
      previous: reviewsPrevious,
      negativeCurrent,
      avgRating: avgRatingResult._avg.rating
        ? +avgRatingResult._avg.rating.toFixed(1)
        : null,
    },
    setupCompleted: { current: setupCompletedCurrent, previous: setupCompletedPrevious },
    menuOrders: { current: menuOrdersCurrent, previous: menuOrdersPrevious },
    newPaidSubscriptions,
    supportTickets: { current: supportTicketsCurrent, previous: supportTicketsPrevious },
    totals: {
      users: totalUsers,
      establishments: totalEstablishments,
      qrcodes: totalQrcodes,
      activePaidSubscriptions: paidSubscriptions.length,
      monthlyRevenue,
    },
    topEstablishments: topEstablishmentGroups
      .filter((g) => g.establishmentId)
      .map((g) => {
        const est = establishmentMap.get(g.establishmentId!);
        return {
          name: est?.name ?? "—",
          ownerEmail: est?.user.email ?? "—",
          scans: g._count.id,
        };
      }),
    topQrcodes: topQrGroups.map((g) => {
      const qr = qrMap.get(g.qrCodeId);
      return {
        code: qr?.code ?? g.qrCodeId.slice(0, 8),
        label: qr?.label ?? null,
        establishmentName: qr?.establishment?.name ?? null,
        scans: g._count.id,
      };
    }),
    topRegions: topRegionGroups
      .filter((g) => g.region)
      .map((g) => ({ region: g.region!, scans: g._count.id })),
  };
}

export function formatWeeklyReportTelegram(metrics: WeeklyReportMetrics): string {
  const { range } = metrics;
  const adminUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/admin`
    : "";

  const lines: string[] = [
    `📊 <b>QrStars — недельный отчёт</b>`,
    `<i>${range.labelFrom} — ${range.labelTo} (МСК)</i>`,
    "",
    countLine("Сканирования QR", metrics.scans.current, metrics.scans.previous),
    countLine("Регистрации", metrics.registrations.current, metrics.registrations.previous),
    countLine("Новые заведения", metrics.establishments.current, metrics.establishments.previous),
    countLine("Отзывы", metrics.reviews.current, metrics.reviews.previous),
  ];

  if (metrics.reviews.current > 0) {
    lines.push(
      `<b>Негатив (1–3★):</b> ${metrics.reviews.negativeCurrent}` +
        (metrics.reviews.avgRating != null
          ? ` · средняя ${metrics.reviews.avgRating}★`
          : "")
    );
  }

  lines.push(
    countLine("Завершили онбординг", metrics.setupCompleted.current, metrics.setupCompleted.previous),
    `<b>Новые PRO/Сеть:</b> ${metrics.newPaidSubscriptions}`,
    countLine("Заказы из меню", metrics.menuOrders.current, metrics.menuOrders.previous),
    countLine("Тикеты поддержки", metrics.supportTickets.current, metrics.supportTickets.previous),
    "",
    "<b>🏆 Топ заведений по сканам</b>",
  );

  if (metrics.topEstablishments.length === 0) {
    lines.push("— за неделю сканов не было");
  } else {
    metrics.topEstablishments.forEach((e, i) => {
      lines.push(
        `${i + 1}. ${escapeHtml(e.name)} — ${e.scans.toLocaleString("ru-RU")} · ${escapeHtml(e.ownerEmail)}`
      );
    });
  }

  if (metrics.topQrcodes.length > 0) {
    lines.push("", "<b>🔥 Топ QR-кодов</b>");
    metrics.topQrcodes.forEach((q, i) => {
      const label = q.label ? ` «${q.label}»` : "";
      const place = q.establishmentName ? ` (${escapeHtml(q.establishmentName)})` : "";
      lines.push(
        `${i + 1}. <code>${escapeHtml(q.code)}</code>${label}${place} — ${q.scans.toLocaleString("ru-RU")}`
      );
    });
  }

  if (metrics.topRegions.length > 0) {
    lines.push("", "<b>🌍 Регионы сканов</b>");
    metrics.topRegions.forEach((r, i) => {
      lines.push(`${i + 1}. ${escapeHtml(r.region)} — ${r.scans.toLocaleString("ru-RU")}`);
    });
  }

  lines.push(
    "",
    "<b>📦 Всего на платформе</b>",
    `Пользователей: ${metrics.totals.users.toLocaleString("ru-RU")}`,
    `Заведений: ${metrics.totals.establishments.toLocaleString("ru-RU")}`,
    `QR-кодов: ${metrics.totals.qrcodes.toLocaleString("ru-RU")}`,
    `PRO/Сеть: ${metrics.totals.activePaidSubscriptions} · MRR ≈ ${metrics.totals.monthlyRevenue.toLocaleString("ru-RU")} ₽`
  );

  if (adminUrl) {
    lines.push("", `<a href="${escapeHtml(adminUrl)}">Открыть админку</a>`);
  }

  return lines.join("\n");
}

export function getWeeklyReportChatId(): string | null {
  const override = process.env.ADMIN_WEEKLY_REPORT_TELEGRAM_CHAT_ID?.trim();
  if (override) return override;
  return getSupportGroupChatId();
}

export async function sendWeeklyReport(options?: {
  chatId?: string;
  referenceDate?: Date;
}): Promise<{ ok: boolean; error?: string; metrics?: WeeklyReportMetrics }> {
  const chatId = options?.chatId ?? getWeeklyReportChatId();
  if (!chatId) {
    return { ok: false, error: "TELEGRAM_SUPPORT_GROUP_ID не задан" };
  }

  const range = getPreviousMskWeekRange(options?.referenceDate);
  const metrics = await collectWeeklyReportMetrics(range);
  const text = formatWeeklyReportTelegram(metrics);
  const sent = await sendSupportTelegramMessage(chatId, text);

  if (!sent) {
    return { ok: false, error: "Не удалось отправить сообщение в Telegram", metrics };
  }

  return { ok: true, metrics };
}
