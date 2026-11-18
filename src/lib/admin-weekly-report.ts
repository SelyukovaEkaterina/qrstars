import prisma from "@/lib/prisma";
import { analyticsCohortUserWhere } from "@/lib/analytics-exclusion";
import {
  getSupportGroupChatId,
  sendSupportTelegramMessage,
} from "@/lib/telegram-support";
import { estimateSubscriptionMonthlyRevenue } from "@/lib/plans";
import {
  MSK_OFFSET_MS,
  escapeHtml,
  formatMskDate,
  startOfMskDay,
  countLine,
  valueLine,
} from "@/lib/report-formatting";
import {
  collectSiteReportStats,
  type MetrikaPeriod,
  type SiteReportResult,
} from "@/lib/insights/metrika-report";

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

export async function collectWeeklyReportMetrics(
  range: WeeklyReportRange,
  options?: { comparePrevious?: boolean }
): Promise<WeeklyReportMetrics> {
  const comparePrevious = options?.comparePrevious ?? true;
  const period = { gte: range.from, lte: range.to };
  const prevPeriod = { gte: range.prevFrom, lte: range.prevTo };
  // DailyScanStat.date хранит полночь МСК дня; период по `date` —
  // от полуночи первого до полуночи последнего дня диапазона.
  const scanDayPeriod = { gte: range.from, lte: startOfMskDay(range.to) };
  const scanPrevDayPeriod = {
    gte: range.prevFrom,
    lte: startOfMskDay(range.prevTo),
  };
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
    prisma.dailyScanStat.aggregate({
      where: { date: scanDayPeriod },
      _sum: { count: true },
    }),
    comparePrevious
      ? prisma.dailyScanStat.aggregate({
          where: { date: scanPrevDayPeriod },
          _sum: { count: true },
        })
      : Promise.resolve({ _sum: { count: 0 } as const }),
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
    prisma.dailyScanStat.groupBy({
      by: ["establishmentId"],
      where: { date: scanDayPeriod, establishmentId: { not: null } },
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take: 5,
    }),
    prisma.dailyScanStat.groupBy({
      by: ["qrCodeId"],
      where: { date: scanDayPeriod },
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
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
      estimateSubscriptionMonthlyRevenue(s.plan, s.user._count.establishments, s.billing),
    0
  );

  return {
    range,
    scans: {
      current: scansCurrent._sum.count ?? 0,
      previous: scansPrevious._sum.count ?? 0,
    },
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
          scans: g._sum.count ?? 0,
        };
      }),
    topQrcodes: topQrGroups.map((g) => {
      const qr = qrMap.get(g.qrCodeId);
      return {
        code: qr?.code ?? g.qrCodeId.slice(0, 8),
        label: qr?.label ?? null,
        establishmentName: qr?.establishment?.name ?? null,
        scans: g._sum.count ?? 0,
      };
    }),
    topRegions: topRegionGroups
      .filter((g) => g.region)
      .map((g) => ({ region: g.region!, scans: g._count.id })),
  };
}

/** YYYY-MM-DD дня по Москве для момента `date`. */
function mskDateString(date: Date): string {
  return new Date(date.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 10);
}

function metrikaPeriod(from: Date, to: Date): MetrikaPeriod {
  return { date1: mskDateString(from), date2: mskDateString(to) };
}

export interface MicrositeVisitReport {
  visits: { current: number; previous: number };
  sitesWithVisits: number;
  top: { name: string; slug: string | null; visits: number; qrScans: number }[];
}

/**
 * Заходы на микросайты и визитки по короткому адресу (`{slug}.qrstars.ru`, `/a/{slug}`) —
 * `SiteVisitStat`, без сканов QR. В топе рядом — сканы QR того же проекта за период.
 */
export async function collectMicrositeVisitReport(
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date
): Promise<MicrositeVisitReport> {
  const day = { gte: startOfMskDay(from), lte: startOfMskDay(to) };
  const prevDay = { gte: startOfMskDay(prevFrom), lte: startOfMskDay(prevTo) };
  const [current, previous, groups] = await Promise.all([
    prisma.siteVisitStat.aggregate({ where: { date: day }, _sum: { count: true } }),
    prisma.siteVisitStat.aggregate({ where: { date: prevDay }, _sum: { count: true } }),
    prisma.siteVisitStat.groupBy({
      by: ["establishmentId"],
      where: { date: day, count: { gt: 0 } },
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
    }),
  ]);
  const topGroups = groups.slice(0, 5);
  const ids = topGroups.map((g) => g.establishmentId);
  const [ests, scans] = ids.length
    ? await Promise.all([
        prisma.establishment.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, shortSlug: true },
        }),
        prisma.dailyScanStat.groupBy({
          by: ["establishmentId"],
          where: { date: day, establishmentId: { in: ids } },
          _sum: { count: true },
        }),
      ])
    : [[], []];
  const estMap = new Map(ests.map((e) => [e.id, e]));
  const scanMap = new Map(scans.map((g) => [g.establishmentId, g._sum.count ?? 0]));
  return {
    visits: { current: current._sum.count ?? 0, previous: previous._sum.count ?? 0 },
    sitesWithVisits: groups.length,
    top: topGroups.map((g) => ({
      name: estMap.get(g.establishmentId)?.name ?? "—",
      slug: estMap.get(g.establishmentId)?.shortSlug ?? null,
      visits: g._sum.count ?? 0,
      qrScans: scanMap.get(g.establishmentId) ?? 0,
    })),
  };
}

/** Блок «Микросайты: заходы по прямой ссылке». */
export function formatMicrositeVisitsTelegram(
  report: MicrositeVisitReport | null | undefined
): string[] {
  if (!report) return [];
  const fmt = (n: number) => n.toLocaleString("ru-RU");
  const lines = [
    "",
    "<b>🔗 Микросайты: заходы по прямой ссылке</b>",
    countLine("Заходы (не через QR)", report.visits.current, report.visits.previous),
    `  ↳ сайтов с заходами: ${fmt(report.sitesWithVisits)}`,
  ];
  report.top.forEach((t, i) => {
    const addr = t.slug ? ` · ${escapeHtml(t.slug)}.qrstars.ru` : "";
    lines.push(
      `${i + 1}. ${escapeHtml(t.name)}${addr} — ${fmt(t.visits)} · QR ${fmt(t.qrScans)}`
    );
  });
  return lines;
}

/** Блок «Сайт (Метрика)» для Telegram-отчёта. Пусто, если токена Метрики нет. */
export function formatSiteStatsTelegram(site: SiteReportResult | null | undefined): string[] {
  if (!site) return [];
  if (!site.ok) {
    if (site.skipped) return [];
    return ["", "<b>🌐 Сайт</b>", `⚠️ Метрика недоступна: ${escapeHtml(site.error)}`];
  }
  const fmt = (n: number) => n.toLocaleString("ru-RU");
  const { landing } = site;
  const lines: string[] = [
    "",
    "<b>🌐 Сайт qrstars.ru (Метрика)</b>",
    countLine("Визиты", landing.current.visits, landing.previous.visits),
    countLine("Посетители", landing.current.users, landing.previous.users),
    `<b>Отказы:</b> ${landing.current.bounceRate}% (было ${landing.previous.bounceRate}%)`,
  ];
  for (const g of site.goals) {
    if (g.current > 0 || g.previous > 0) lines.push(countLine(g.label, g.current, g.previous));
  }
  if (site.sources.length > 0) {
    lines.push("", "<b>Источники</b> <i>(визиты · до регистрации)</i>");
    site.sources.forEach((s) =>
      lines.push(`• ${escapeHtml(s.name)} — ${fmt(s.visits)} · ${fmt(s.register)}`)
    );
  }
  if (site.campaigns.length > 0) {
    lines.push("", "<b>Кампании (UTM)</b>");
    site.campaigns.forEach((c) =>
      lines.push(`• ${escapeHtml(c.name)} — ${fmt(c.visits)} · ${fmt(c.register)}`)
    );
  }
  if (site.landingPages.length > 0) {
    lines.push("", "<b>Страницы входа</b> <i>(визиты · отказы)</i>");
    site.landingPages.forEach((p) =>
      lines.push(`• ${escapeHtml(p.path)} — ${fmt(p.visits)} · ${p.bounceRate}%`)
    );
  }
  return lines;
}

interface ReportExtras {
  site?: SiteReportResult | null;
  microsites?: MicrositeVisitReport | null;
}

export function formatWeeklyReportTelegram(
  metrics: WeeklyReportMetrics,
  extras: ReportExtras = {}
): string {
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
      "Завершили настройку (redirect)",
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
    ...formatMicrositeVisitsTelegram(extras.microsites),
    ...formatSiteStatsTelegram(extras.site)
  );

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

export function formatDailyReportTelegram(
  metrics: WeeklyReportMetrics,
  extras: ReportExtras = {}
): string {
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
    valueLine("Завершили настройку (redirect)", metrics.setupCompletedRedirect.current),
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

  lines.push(
    ...formatMicrositeVisitsTelegram(extras.microsites),
    ...formatSiteStatsTelegram(extras.site)
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
  const [metrics, site, microsites] = await Promise.all([
    collectWeeklyReportMetrics(range),
    collectSiteReportStats(
      metrikaPeriod(range.from, range.to),
      metrikaPeriod(range.prevFrom, range.prevTo)
    ),
    collectMicrositeVisitReport(range.from, range.to, range.prevFrom, range.prevTo).catch(
      () => null
    ),
  ]);
  const text = formatWeeklyReportTelegram(metrics, { site, microsites });
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
  const dayBefore = new Date(range.from.getTime() - 86_400_000);
  const [metrics, site, microsites] = await Promise.all([
    collectDailyReportMetrics(range),
    collectSiteReportStats(
      metrikaPeriod(range.from, range.to),
      metrikaPeriod(dayBefore, dayBefore)
    ),
    collectMicrositeVisitReport(range.from, range.to, dayBefore, dayBefore).catch(() => null),
  ]);
  const text = formatDailyReportTelegram(metrics, { site, microsites });
  const sent = await sendSupportTelegramMessage(chatId, text);

  if (!sent) {
    return { ok: false, error: "Не удалось отправить сообщение в Telegram", metrics };
  }

  return { ok: true, metrics };
}
