/**
 * Пакет данных для недельного ИИ-отчёта (агент Hermes на VPS, `deploy/insights-agent/`).
 *
 * Данные уходят во внешнюю LLM (DeepSeek), поэтому в пакете **нет персональных данных**:
 * ни email, ни имён, ни телефонов, ни названий проектов (у мастеров проект назван именем
 * человека), ни id пользователей. Только агрегаты, тексты ошибок мастера и обрезанные
 * комментарии из опросов (контакты из них вырезаются `scrubPii`).
 */
import prisma from "@/lib/prisma";
import { analyticsCohortUserWhere } from "@/lib/analytics-exclusion";
import {
  collectWeeklyReportMetrics,
  getPreviousMskWeekRange,
  type WeeklyReportRange,
} from "@/lib/admin-weekly-report";
import { getSetupFunnelReport } from "@/lib/setup-funnel-admin";
import { MSK_OFFSET_MS } from "@/lib/report-formatting";
import { scrubPii } from "@/lib/insights/scrub-pii";
import { collectMetrikaInsights, METRIKA_KEY_GOALS } from "@/lib/insights/metrika-report";

const TREND_WEEKS = 6;
function mskDate(date: Date): string {
  return new Date(date.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 10);
}

function shiftWeek(range: WeeklyReportRange, weeks: number): WeeklyReportRange {
  const ms = weeks * 7 * 86_400_000;
  const from = new Date(range.from.getTime() - ms);
  const to = new Date(range.to.getTime() - ms);
  return {
    from,
    to,
    prevFrom: new Date(range.prevFrom.getTime() - ms),
    prevTo: new Date(range.prevTo.getTime() - ms),
    labelFrom: mskDate(from),
    labelTo: mskDate(to),
  };
}

function pathOnly(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url, "https://app.qrstars.ru").pathname.replace(/\/c[a-z0-9]{20,}/g, "/:id");
  } catch {
    return null;
  }
}

async function weekTrend(range: WeeklyReportRange) {
  const weeks = await Promise.all(
    Array.from({ length: TREND_WEEKS }, (_, i) =>
      collectWeeklyReportMetrics(shiftWeek(range, i), { comparePrevious: false })
    )
  );
  return weeks
    .map((m) => ({
      week: `${mskDate(m.range.from)}..${mskDate(m.range.to)}`,
      registrations: m.registrations.current,
      qualifiedRegistrations: m.qualifiedRegistrations.current,
      setupCompleted: m.setupCompleted.current,
      establishments: m.establishments.current,
      qrcodes: m.qrcodes.current,
      scans: m.scans.current,
      reviews: m.reviews.current,
      menuOrders: m.menuOrders.current,
      newPaidSubscriptions: m.newPaidSubscriptions,
      supportTickets: m.supportTickets.current,
    }))
    .reverse();
}

async function formFailures(from: Date, to: Date) {
  const events = await prisma.userEvent.findMany({
    where: {
      event: "setup.form_failed",
      createdAt: { gte: from, lte: to },
      user: analyticsCohortUserWhere(),
    },
    select: { userId: true, props: true },
  });
  const byError = new Map<string, { attempts: number; users: Set<string>; intent: string | null }>();
  for (const ev of events) {
    const props = (ev.props ?? {}) as Record<string, unknown>;
    const error = typeof props.error === "string" ? scrubPii(props.error, 160) : "(без текста)";
    const stage = typeof props.stage === "string" ? props.stage : "?";
    const key = `${stage}: ${error}`;
    const row = byError.get(key) ?? {
      attempts: 0,
      users: new Set<string>(),
      intent: typeof props.intent === "string" ? props.intent : null,
    };
    row.attempts += 1;
    row.users.add(ev.userId);
    byError.set(key, row);
  }
  return [...byError.entries()]
    .map(([error, row]) => ({ error, intent: row.intent, attempts: row.attempts, users: row.users.size }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 20);
}

async function feedback(from: Date, to: Date) {
  const [nps, product] = await Promise.all([
    prisma.userFeedback.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { surveyKind: true, npsScore: true, comment: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.productFeedback.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { message: true, pageUrl: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);
  return {
    nps: nps.map((f) => ({
      survey: f.surveyKind,
      score: f.npsScore,
      comment: f.comment ? scrubPii(f.comment) : null,
    })),
    productFeedback: product.map((f) => ({
      page: pathOnly(f.pageUrl),
      message: scrubPii(f.message),
    })),
  };
}

export async function collectWeeklyInsightsData(referenceDate = new Date()) {
  const range = getPreviousMskWeekRange(referenceDate);
  const toExclusive = new Date(range.to.getTime() + 1);

  const [weekly, trend, funnel, failures, fb, metrika] = await Promise.all([
    collectWeeklyReportMetrics(range, { comparePrevious: true }),
    weekTrend(range),
    getSetupFunnelReport(range.from, range.to, toExclusive),
    formFailures(range.from, range.to),
    feedback(range.from, range.to),
    collectMetrikaInsights(
      { date1: mskDate(range.from), date2: mskDate(range.to) },
      { date1: mskDate(range.prevFrom), date2: mskDate(range.prevTo) }
    ),
  ]);

  // Без PII: топы заведений и QR (названия, email владельцев) не передаём.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { topEstablishments, topQrcodes, range: _range, ...weeklyPublic } = weekly;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { users, ...funnelPublic } = funnel;

  return {
    generatedAt: new Date().toISOString(),
    period: {
      from: mskDate(range.from),
      to: mskDate(range.to),
      previousFrom: mskDate(range.prevFrom),
      previousTo: mskDate(range.prevTo),
      timezone: "Europe/Moscow",
    },
    notes: [
      "Числа по базе — без админов и тестовых аккаунтов (analyticsCohortUserWhere).",
      "weekly.* — { current, previous }: прошлая неделя против позапрошлой.",
      "funnel и monetization — когорта зарегистрированных за неделю; оплата могла случиться позже.",
      "metrika — только qrstars.ru и app.qrstars.ru, без гостевых /q/, /scan/, /a/ и поддоменов микросайтов.",
      `Колонки целей в metrika (${METRIKA_KEY_GOALS.map((g) => g.key).join(", ")}) — число визитов, в которых цель достигнута. Это не уникальные люди и не регистрации: goal_visits_reached_register_page — дошли до страницы /register, а зарегистрировались ли — смотреть в базе (weekly.registrations, funnel.sourceBreakdown).`,
      "bounceRate — %, avgDurationSec — секунды.",
      "База восстановлена после аварии Beget 2026-11-02: данных до этой даты нет, нули в trend раньше 2026-11-02 — не реальный ноль. newPaidSubscriptions за неделю 2026-11-02..08 включает ручное восстановление платных клиентов, это не новые продажи.",
      "События пути к оплате (dash.section_viewed, dash.upgrade_clicked, dash.paywall_viewed, dash.checkout_clicked, dash.plan_limit_hit) пишутся с 2026-11-15: шаги monetization «вернулся / открыл тарифы / нажал оплатить» за более ранние дни занижены.",
      "Цель Метрики goal_visits_onboarding_completed недосчитывает (на 2026-11-15 срабатывала единицы раз при десятках проектов): воронку мастера брать из funnel (база), Метрику — для сравнения кампаний и страниц.",
    ],
    weekly: weeklyPublic,
    trend,
    funnel: funnelPublic,
    setupFormFailures: failures,
    feedback: fb,
    metrika,
  };
}

export type WeeklyInsightsData = Awaited<ReturnType<typeof collectWeeklyInsightsData>>;
