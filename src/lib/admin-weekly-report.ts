import prisma from "@/lib/prisma";
import { analyticsCohortUserWhere } from "@/lib/analytics-exclusion";
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

export interface DailyReportRange {
  from: Date;
  to: Date;
  label: string;
}

export interface WeeklyReportMetrics {
  range: WeeklyReportRange;
  scans: { current: number; previous: number };
  registrations: { current: number; previous: number };
  establishments: { current: number; previous: number };
  qrcodes: { current: number; previous: number };
  reviews: {
    current: number;
    previous: number;
    negativeCurrent: number;
    avgRating: number | null;
  };
  setupCompleted: { current: number; previous: number };
  setupCompletedReviewsLanding: { current: number; previous: number };
  setupCompletedRedirect: { current: number; previous: number };
  qualifiedRegistrations: { current: number; previous: number };
  redirectQrWithoutEstablishment: { current: number; previous: number };
  qrcodesWithEstablishment: { current: number; previous: number };
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

/** Вчерашний календарный день по Москве относительно referenceDate. */
export function getPreviousMskDayRange(referenceDate = new Date()): DailyReportRange {
  const todayStart = startOfMskDay(referenceDate);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const yesterdayEnd = new Date(todayStart.getTime() - 1);

  return {
    from: yesterdayStart,
    to: yesterdayEnd,
    label: formatMskDate(yesterdayStart),
  };
}

/** Текущий календарный день по Москве (с 00:00 до сейчас). */
export function getCurrentMskDayRange(referenceDate = new Date()): DailyReportRange {
  const todayStart = startOfMskDay(referenceDate);

  return {
    from: todayStart,
    to: referenceDate,
    label: formatMskDate(todayStart),
  };
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

function valueLine(label: string, value: number): string {
  return `<b>${escapeHtml(label)}:</b> ${value.toLocaleString("ru-RU")}`;
}

export async function collectWeeklyReportMetrics(
  range: WeeklyReportRange,
  options?: { comparePrevious?: boolean }
): Promise<WeeklyReportMetrics> {
  const comparePrevious = options?.comparePrevious ?? true;
  const period = { gte: range.from, lte: range.to };
  const prevPeriod = { gte: range.prevFrom, lte: range.prevTo };
  const notAdmin = analyticsCohortUserWhere();

  const [
    scansCurrent,
    scansPrevious,
    registrationsCurrent,
    registrationsPrevious,
    establishmentsCurrent,
    establishmentsPrevious,
    qrcodesCurrent,
    qrcodesPrevious,
    reviewsCurrent,
    reviewsPrevious,
    negativeCurrent,
    avgRatingResult,
    setupCompletedCurrent,
    setupCompletedPrevious,
    setupCompletedReviewsLandingCurrent,
    setupCompletedReviewsLandingPrevious,
    setupCompletedRedirectCurrent,
    setupCompletedRedirectPrevious,
    qualifiedRegistrationsCurrent,
    qualifiedRegistrationsPrevious,
    redirectQrWithoutEstablishmentCurrent,
    redirectQrWithoutEstablishmentPrevious,
    qrcodesWithEstablishmentCurrent,
    qrcodesWithEstablishmentPrevious,
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
    comparePrevious
      ? prisma.qRScan.count({ where: { createdAt: prevPeriod } })
      : Promise.resolve(0),
    prisma.user.count({ where: { createdAt: period, ...notAdmin } }),
    comparePrevious
      ? prisma.user.count({ where: { createdAt: prevPeriod, ...notAdmin } })
      : Promise.resolve(0),
    prisma.establishment.count({ where: { createdAt: period } }),
    comparePrevious
      ? prisma.establishment.count({ where: { createdAt: prevPeriod } })
      : Promise.resolve(0),
    prisma.qRCode.count({ where: { createdAt: period } }),
    comparePrevious
      ? prisma.qRCode.count({ where: { createdAt: prevPeriod } })
      : Promise.resolve(0),
    prisma.review.count({ where: { createdAt: period } }),
    comparePrevious
      ? prisma.review.count({ where: { createdAt: prevPeriod } })
      : Promise.resolve(0),
    prisma.review.count({ where: { createdAt: period, isNegative: true } }),
    prisma.review.aggregate({
      where: { createdAt: period },
      _avg: { rating: true },
    }),
    prisma.userEvent.count({
      where: { event: "setup.completed", createdAt: period },
    }),
    comparePrevious
      ? prisma.userEvent.count({
          where: { event: "setup.completed", createdAt: prevPeriod },
        })
      : Promise.resolve(0),
    prisma.userEvent.count({
      where: {
        event: "setup.completed",
        createdAt: period,
        OR: [
          { props: { path: ["intent"], equals: "reviews" } },
          { props: { path: ["intent"], equals: "landing" } },
        ],
      },
    }),
    comparePrevious
      ? prisma.userEvent.count({
          where: {
            event: "setup.completed",
            createdAt: prevPeriod,
            OR: [
              { props: { path: ["intent"], equals: "reviews" } },
              { props: { path: ["intent"], equals: "landing" } },
            ],
          },
        })
      : Promise.resolve(0),
    prisma.userEvent.count({
      where: {
        event: "setup.completed",
        createdAt: period,
        props: { path: ["intent"], equals: "redirect" },
      },
    }),
    comparePrevious
      ? prisma.userEvent.count({
          where: {
            event: "setup.completed",
            createdAt: prevPeriod,
            props: { path: ["intent"], equals: "redirect" },
          },
        })
      : Promise.resolve(0),
    prisma.user.count({
      where: {
        createdAt: period,
        ...notAdmin,
        establishments: { some: { createdAt: period } },
      },
    }),
    comparePrevious
      ? prisma.user.count({
          where: {
            createdAt: prevPeriod,
            ...notAdmin,
            establishments: { some: { createdAt: prevPeriod } },
          },
        })
      : Promise.resolve(0),
    prisma.qRCode.count({
      where: {
        createdAt: period,
        mode: "REDIRECT",
        establishmentId: null,
      },
    }),
    comparePrevious
      ? prisma.qRCode.count({
          where: {
            createdAt: prevPeriod,
            mode: "REDIRECT",
            establishmentId: null,
          },
        })
      : Promise.resolve(0),
    prisma.qRCode.count({
      where: {
        createdAt: period,
        establishmentId: { not: null },
      },
    }),
    comparePrevious
      ? prisma.qRCode.count({
          where: {
            createdAt: prevPeriod,
            establishmentId: { not: null },
          },
        })
      : Promise.resolve(0),
    prisma.menuOrder.count({ where: { createdAt: period } }),
    comparePrevious
      ? prisma.menuOrder.count({ where: { createdAt: prevPeriod } })
      : Promise.resolve(0),
    prisma.subscription.count({
      where: {
        createdAt: period,
        plan: { in: ["PRO", "NETWORK"] },
        status: "ACTIVE",
      },
    }),
    prisma.supportTicket.count({ where: { createdAt: period } }),
    comparePrevious
      ? prisma.supportTicket.count({ where: { createdAt: prevPeriod } })
      : Promise.resolve(0),
    comparePrevious ? prisma.user.count({ where: notAdmin }) : Promise.resolve(0),
    comparePrevious ? prisma.establishment.count() : Promise.resolve(0),
    comparePrevious ? prisma.qRCode.count() : Promise.resolve(0),
    comparePrevious
      ? prisma.subscription.findMany({
          where: { status: "ACTIVE", plan: { in: ["PRO", "NETWORK"] } },
          include: { user: { include: { _count: { select: { establishments: true } } } } },
        })
      : Promise.resolve([]),
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
    qrcodes: { current: qrcodesCurrent, previous: qrcodesPrevious },
    reviews: {
      current: reviewsCurrent,
      previous: reviewsPrevious,
      negativeCurrent,
      avgRating: avgRatingResult._avg.rating
        ? +avgRatingResult._avg.rating.toFixed(1)
        : null,
    },
    setupCompleted: { current: setupCompletedCurrent, previous: setupCompletedPrevious },
    setupCompletedReviewsLanding: {
      current: setupCompletedReviewsLandingCurrent,
      previous: setupCompletedReviewsLandingPrevious,
    },
    setupCompletedRedirect: {
      current: setupCompletedRedirectCurrent,
      previous: setupCompletedRedirectPrevious,
    },
    qualifiedRegistrations: {
      current: qualifiedRegistrationsCurrent,
      previous: qualifiedRegistrationsPrevious,
    },
    redirectQrWithoutEstablishment: {
      current: redirectQrWithoutEstablishmentCurrent,
      previous: redirectQrWithoutEstablishmentPrevious,
    },
    qrcodesWithEstablishment: {
      current: qrcodesWithEstablishmentCurrent,
      previous: qrcodesWithEstablishmentPrevious,
    },
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
    countLine("Квалиф. регистрации", metrics.qualifiedRegistrations.current, metrics.qualifiedRegistrations.previous),
    countLine("Новые заведения", metrics.establishments.current, metrics.establishments.previous),
    countLine("Новые QR-коды", metrics.qrcodes.current, metrics.qrcodes.previous),
    `  ↳ с заведением: ${metrics.qrcodesWithEstablishment.current.toLocaleString("ru-RU")} · redirect-only: ${metrics.redirectQrWithoutEstablishment.current.toLocaleString("ru-RU")}`,
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
    countLine(
      "Завершили онбординг",
      metrics.setupCompletedReviewsLanding.current,
      metrics.setupCompletedReviewsLanding.previous
    ),
    countLine(
      "Setup completed (redirect)",
      metrics.setupCompletedRedirect.current,
      metrics.setupCompletedRedirect.previous
    ),
    countLine(
      "Redirect-QR без заведения",
      metrics.redirectQrWithoutEstablishment.current,
      metrics.redirectQrWithoutEstablishment.previous
    ),
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

export function formatDailyReportTelegram(metrics: WeeklyReportMetrics): string {
  const label = metrics.range.labelFrom;
  const adminUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/admin`
    : "";

  const lines: string[] = [
    `📊 <b>QrStars — дневной отчёт</b>`,
    `<i>${label} (МСК)</i>`,
    "",
    valueLine("Сканирования QR", metrics.scans.current),
    valueLine("Регистрации", metrics.registrations.current),
    valueLine("Квалиф. регистрации", metrics.qualifiedRegistrations.current),
    valueLine("Новые заведения", metrics.establishments.current),
    valueLine("Новые QR-коды", metrics.qrcodes.current),
    `  ↳ с заведением: ${metrics.qrcodesWithEstablishment.current.toLocaleString("ru-RU")} · redirect-only: ${metrics.redirectQrWithoutEstablishment.current.toLocaleString("ru-RU")}`,
    valueLine("Отзывы", metrics.reviews.current),
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
    valueLine("Завершили онбординг", metrics.setupCompletedReviewsLanding.current),
    valueLine("Setup completed (redirect)", metrics.setupCompletedRedirect.current),
    valueLine("Redirect-QR без заведения", metrics.redirectQrWithoutEstablishment.current),
    `<b>Новые PRO/Сеть:</b> ${metrics.newPaidSubscriptions}`,
    valueLine("Заказы из меню", metrics.menuOrders.current),
    valueLine("Тикеты поддержки", metrics.supportTickets.current),
    "",
    "<b>🏆 Топ заведений по сканам</b>",
  );

  if (metrics.topEstablishments.length === 0) {
    lines.push("— за день сканов не было");
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
      const labelPart = q.label ? ` «${q.label}»` : "";
      const place = q.establishmentName ? ` (${escapeHtml(q.establishmentName)})` : "";
      lines.push(
        `${i + 1}. <code>${escapeHtml(q.code)}</code>${labelPart}${place} — ${q.scans.toLocaleString("ru-RU")}`
      );
    });
  }

  if (metrics.topRegions.length > 0) {
    lines.push("", "<b>🌍 Регионы сканов</b>");
    metrics.topRegions.forEach((r, i) => {
      lines.push(`${i + 1}. ${escapeHtml(r.region)} — ${r.scans.toLocaleString("ru-RU")}`);
    });
  }

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

export function getDailyReportChatId(): string | null {
  const dailyOverride = process.env.ADMIN_DAILY_REPORT_TELEGRAM_CHAT_ID?.trim();
  if (dailyOverride) return dailyOverride;
  return getWeeklyReportChatId();
}

export async function collectDailyReportMetrics(
  range: DailyReportRange
): Promise<WeeklyReportMetrics> {
  const weekRange: WeeklyReportRange = {
    from: range.from,
    to: range.to,
    prevFrom: range.from,
    prevTo: range.to,
    labelFrom: range.label,
    labelTo: range.label,
  };
  return collectWeeklyReportMetrics(weekRange, { comparePrevious: false });
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

export async function sendDailyReport(options?: {
  chatId?: string;
  referenceDate?: Date;
  /** `today` — текущий день МСК; по умолчанию вчера (для cron). */
  period?: "today" | "yesterday";
}): Promise<{ ok: boolean; error?: string; metrics?: WeeklyReportMetrics }> {
  const chatId = options?.chatId ?? getDailyReportChatId();
  if (!chatId) {
    return { ok: false, error: "TELEGRAM_SUPPORT_GROUP_ID не задан" };
  }

  const ref = options?.referenceDate ?? new Date();
  const range =
    options?.period === "today"
      ? getCurrentMskDayRange(ref)
      : getPreviousMskDayRange(ref);
  const metrics = await collectDailyReportMetrics(range);
  const text = formatDailyReportTelegram(metrics);
  const sent = await sendSupportTelegramMessage(chatId, text);

  if (!sent) {
    return { ok: false, error: "Не удалось отправить сообщение в Telegram", metrics };
  }

  return { ok: true, metrics };
}
