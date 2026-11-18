/**
 * Сводка Яндекс Метрики за период для недельного ИИ-отчёта (`/api/cron/insights-data`).
 *
 * Один счётчик на лендинг (qrstars.ru) и кабинет (app.qrstars.ru). Гостевые страницы
 * (`/q/`, `/scan/`, `/a/`, поддомены микросайтов) — это трафик клиентов, а не наш:
 * из маркетинговых срезов они вырезаны фильтром.
 */

const API = "https://api-metrika.yandex.net";
const MAX_METRICS_PER_REQUEST = 20;

/** Только сайт и кабинет, без гостевых сканов и микросайтов клиентов. */
const OWN_TRAFFIC_FILTER =
  "ym:s:startURLDomain=.('qrstars.ru','www.qrstars.ru','app.qrstars.ru')" +
  " AND ym:s:startURLPath!~'^/(q|scan|a|activate)/'";

/** Ключевые цели — по ним считаются конверсии в разрезе кампаний и страниц. */
const KEY_GOALS: { id: number; key: string }[] = [
  { id: 578806213, key: "goal_visits_reached_register_page" },
  { id: 570551912, key: "goal_visits_onboarding_completed" },
  { id: 675277332, key: "goal_visits_project_created" },
  { id: 675276557, key: "goal_visits_payment" },
];

export interface MetrikaPeriod {
  date1: string; // YYYY-MM-DD
  date2: string;
}

export interface MetrikaTotals {
  visits: number;
  users: number;
  bounceRate: number;
  pageDepth: number;
  avgVisitDurationSec: number;
}

export interface MetrikaRow {
  key: string;
  [metric: string]: string | number | null;
}

export interface MetrikaInsightsReport {
  ok: true;
  counterId: string;
  period: MetrikaPeriod;
  previousPeriod: MetrikaPeriod;
  totals: { current: MetrikaTotals; previous: MetrikaTotals };
  byHost: MetrikaRow[];
  trafficSources: { current: MetrikaRow[]; previous: MetrikaRow[] };
  campaigns: MetrikaRow[];
  landingPages: MetrikaRow[];
  devices: MetrikaRow[];
  searchPhrases: MetrikaRow[];
  goals: { id: number; name: string; current: number; previous: number }[];
}

export type MetrikaInsightsResult =
  | MetrikaInsightsReport
  | { ok: false; skipped?: boolean; error: string };

interface StatResponse {
  data?: { dimensions: { name: string | null }[]; metrics: (number | null)[] }[];
  totals?: (number | null)[];
  errors?: { message: string }[];
  message?: string;
}

function counterId(): string {
  return (
    process.env.YANDEX_METRIKA_COUNTER_ID?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() ||
    "109307713"
  );
}

function round(value: number | null | undefined, digits = 1): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

/**
 * Метрика ограничивает параллельные запросы на пользователя (ошибка «Превышена квота на
 * количество параллельных запросов»), поэтому все запросы идут по очереди.
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function stat(
  token: string,
  period: MetrikaPeriod,
  params: Record<string, string>
): Promise<StatResponse> {
  return serial(() => statNow(token, period, params));
}

async function statNow(
  token: string,
  period: MetrikaPeriod,
  params: Record<string, string>
): Promise<StatResponse> {
  const qs = new URLSearchParams({
    ids: counterId(),
    date1: period.date1,
    date2: period.date2,
    accuracy: "full",
    lang: "ru",
    ...params,
  });
  const res = await fetch(`${API}/stat/v1/data?${qs}`, {
    headers: { Authorization: `OAuth ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as StatResponse;
  if (!res.ok) {
    throw new Error(body.errors?.[0]?.message || body.message || `Metrika HTTP ${res.status}`);
  }
  return body;
}

/** Строки отчёта: `key` — значения измерений через « / », метрики — по именам `names`. */
function toRows(body: StatResponse, names: string[], digits = 1): MetrikaRow[] {
  return (body.data ?? []).map((row) => {
    const out: MetrikaRow = {
      key: row.dimensions.map((d) => d.name ?? "(не задано)").join(" / "),
    };
    names.forEach((name, i) => {
      out[name] = round(row.metrics[i], digits);
    });
    return out;
  });
}

const BEHAVIOR_METRICS = [
  "ym:s:visits",
  "ym:s:users",
  "ym:s:bounceRate",
  "ym:s:pageDepth",
  "ym:s:avgVisitDurationSeconds",
];
const BEHAVIOR_NAMES = ["visits", "users", "bounceRate", "pageDepth", "avgDurationSec"];

const GOAL_METRICS = KEY_GOALS.map((g) => `ym:s:goal${g.id}visits`);
const GOAL_NAMES = KEY_GOALS.map((g) => g.key);

async function totals(token: string, period: MetrikaPeriod): Promise<MetrikaTotals> {
  const body = await stat(token, period, {
    metrics: BEHAVIOR_METRICS.join(","),
    filters: OWN_TRAFFIC_FILTER,
  });
  const t = body.totals ?? [];
  return {
    visits: round(t[0], 0),
    users: round(t[1], 0),
    bounceRate: round(t[2]),
    pageDepth: round(t[3], 2),
    avgVisitDurationSec: round(t[4], 0),
  };
}

async function goalReaches(
  token: string,
  goals: { id: number; name: string }[],
  current: MetrikaPeriod,
  previous: MetrikaPeriod
) {
  const result: { id: number; name: string; current: number; previous: number }[] = [];
  for (let i = 0; i < goals.length; i += MAX_METRICS_PER_REQUEST) {
    const chunk = goals.slice(i, i + MAX_METRICS_PER_REQUEST);
    const metrics = chunk.map((g) => `ym:s:goal${g.id}reaches`).join(",");
    const [cur, prev] = await Promise.all([
      stat(token, current, { metrics }),
      stat(token, previous, { metrics }),
    ]);
    chunk.forEach((g, j) => {
      result.push({
        id: g.id,
        name: g.name,
        current: round(cur.totals?.[j], 0),
        previous: round(prev.totals?.[j], 0),
      });
    });
  }
  return result
    .filter((g) => g.current > 0 || g.previous > 0)
    .sort((a, b) => b.current - a.current);
}

function listGoals(token: string): Promise<{ id: number; name: string }[]> {
  return serial(() => listGoalsNow(token));
}

async function listGoalsNow(token: string): Promise<{ id: number; name: string }[]> {
  const res = await fetch(`${API}/management/v1/counter/${counterId()}/goals`, {
    headers: { Authorization: `OAuth ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Metrika goals HTTP ${res.status}`);
  const body = (await res.json()) as { goals?: { id: number; name: string }[] };
  return (body.goals ?? []).map((g) => ({ id: g.id, name: g.name }));
}

export async function collectMetrikaInsights(
  period: MetrikaPeriod,
  previousPeriod: MetrikaPeriod
): Promise<MetrikaInsightsResult> {
  const token = process.env.YANDEX_METRIKA_OAUTH_TOKEN?.trim();
  if (!token) {
    return { ok: false, skipped: true, error: "YANDEX_METRIKA_OAUTH_TOKEN not set" };
  }

  try {
    const sourceParams = {
      metrics: [...BEHAVIOR_METRICS, ...GOAL_METRICS].join(","),
      dimensions: "ym:s:lastsignTrafficSource",
      filters: OWN_TRAFFIC_FILTER,
    };
    const sourceNames = [...BEHAVIOR_NAMES, ...GOAL_NAMES];

    const [
      currentTotals,
      previousTotals,
      byHost,
      sourcesCurrent,
      sourcesPrevious,
      campaigns,
      landingPages,
      devices,
      searchPhrases,
      goalList,
    ] = await Promise.all([
      totals(token, period),
      totals(token, previousPeriod),
      stat(token, period, {
        metrics: BEHAVIOR_METRICS.join(","),
        dimensions: "ym:s:startURLDomain",
        limit: "10",
      }),
      stat(token, period, sourceParams),
      stat(token, previousPeriod, sourceParams),
      stat(token, period, {
        metrics: [...BEHAVIOR_METRICS, ...GOAL_METRICS].join(","),
        dimensions: "ym:s:lastsignUTMSource,ym:s:lastsignUTMCampaign,ym:s:lastsignUTMContent",
        filters: OWN_TRAFFIC_FILTER,
        sort: "-ym:s:visits",
        limit: "25",
      }),
      stat(token, period, {
        metrics: [...BEHAVIOR_METRICS, ...GOAL_METRICS].join(","),
        dimensions: "ym:s:startURLDomain,ym:s:startURLPath",
        filters: OWN_TRAFFIC_FILTER,
        sort: "-ym:s:visits",
        limit: "30",
      }),
      stat(token, period, {
        metrics: [...BEHAVIOR_METRICS, ...GOAL_METRICS].join(","),
        dimensions: "ym:s:deviceCategory",
        filters: OWN_TRAFFIC_FILTER,
      }),
      stat(token, period, {
        metrics: "ym:s:visits,ym:s:bounceRate",
        dimensions: "ym:s:lastsignSearchPhrase",
        filters: OWN_TRAFFIC_FILTER,
        sort: "-ym:s:visits",
        limit: "30",
      }),
      listGoals(token),
    ]);

    const goals = await goalReaches(token, goalList, period, previousPeriod);

    return {
      ok: true,
      counterId: counterId(),
      period,
      previousPeriod,
      totals: { current: currentTotals, previous: previousTotals },
      byHost: toRows(byHost, BEHAVIOR_NAMES),
      trafficSources: {
        current: toRows(sourcesCurrent, sourceNames),
        previous: toRows(sourcesPrevious, sourceNames),
      },
      campaigns: toRows(campaigns, sourceNames),
      landingPages: toRows(landingPages, sourceNames),
      devices: toRows(devices, sourceNames),
      searchPhrases: toRows(searchPhrases, ["visits", "bounceRate"]),
      goals,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Ключи целей в строках `campaigns` / `landingPages` / `trafficSources`. */
export const METRIKA_KEY_GOALS = KEY_GOALS;

/* ───────────── Короткая сводка сайта для дневного / недельного отчёта в Telegram ───────────── */

const LANDING_HOSTS = new Set(["qrstars.ru", "www.qrstars.ru"]);
const LANDING_FILTER = "ym:s:startURLDomain=.('qrstars.ru','www.qrstars.ru')";

/** Подписи ключевых целей в отчёте (порядок как в `KEY_GOALS`). */
const KEY_GOAL_LABELS: Record<string, string> = {
  goal_visits_reached_register_page: "Дошли до регистрации",
  goal_visits_onboarding_completed: "Прошли мастер",
  goal_visits_project_created: "Создали проект",
  goal_visits_payment: "Оплатили",
};

export interface SiteReportHostStats {
  visits: number;
  users: number;
  bounceRate: number;
}

export interface SiteReportStats {
  ok: true;
  landing: { current: SiteReportHostStats; previous: SiteReportHostStats };
  goals: { key: string; label: string; current: number; previous: number }[];
  sources: { name: string; visits: number; register: number }[];
  campaigns: { name: string; visits: number; register: number }[];
  landingPages: { path: string; visits: number; bounceRate: number }[];
}

export type SiteReportResult = SiteReportStats | { ok: false; skipped?: boolean; error: string };

const SITE_METRICS = ["ym:s:visits", "ym:s:users", "ym:s:bounceRate", ...GOAL_METRICS];

function splitByHost(body: StatResponse) {
  let visits = 0;
  let users = 0;
  let bounced = 0;
  for (const row of body.data ?? []) {
    const host = row.dimensions[0]?.name ?? "";
    const v = row.metrics[0] ?? 0;
    if (LANDING_HOSTS.has(host)) {
      visits += v;
      users += row.metrics[1] ?? 0;
      bounced += (v * (row.metrics[2] ?? 0)) / 100;
    }
  }
  const goals = GOAL_NAMES.map((_, i) => round(body.totals?.[3 + i], 0));
  return {
    landing: {
      visits: round(visits, 0),
      users: round(users, 0),
      bounceRate: visits > 0 ? round((bounced / visits) * 100) : 0,
    },
    goals,
  };
}

/** Сводка Метрики по нашему сайту за период и сравнение с предыдущим. Никогда не бросает. */
export async function collectSiteReportStats(
  period: MetrikaPeriod,
  previousPeriod: MetrikaPeriod
): Promise<SiteReportResult> {
  const token = process.env.YANDEX_METRIKA_OAUTH_TOKEN?.trim();
  if (!token) {
    return { ok: false, skipped: true, error: "YANDEX_METRIKA_OAUTH_TOKEN not set" };
  }

  try {
    const byHostParams = {
      metrics: SITE_METRICS.join(","),
      dimensions: "ym:s:startURLDomain",
      filters: OWN_TRAFFIC_FILTER,
      limit: "20",
    };
    const registerMetric = `ym:s:goal${KEY_GOALS[0].id}visits`;
    const [cur, prev, sources, campaigns, pages] = await Promise.all([
      stat(token, period, byHostParams),
      stat(token, previousPeriod, byHostParams),
      stat(token, period, {
        metrics: `ym:s:visits,${registerMetric}`,
        dimensions: "ym:s:lastsignTrafficSource",
        filters: OWN_TRAFFIC_FILTER,
        sort: "-ym:s:visits",
        limit: "5",
      }),
      stat(token, period, {
        metrics: `ym:s:visits,${registerMetric}`,
        dimensions: "ym:s:lastsignUTMSource,ym:s:lastsignUTMCampaign",
        filters: `${OWN_TRAFFIC_FILTER} AND ym:s:lastsignUTMCampaign!n`,
        sort: "-ym:s:visits",
        limit: "5",
      }),
      stat(token, period, {
        metrics: "ym:s:visits,ym:s:bounceRate",
        dimensions: "ym:s:startURLPath",
        filters: LANDING_FILTER,
        sort: "-ym:s:visits",
        limit: "5",
      }),
    ]);

    const current = splitByHost(cur);
    const previous = splitByHost(prev);
    const named = (body: StatResponse) =>
      (body.data ?? []).map((row) => ({
        name: row.dimensions.map((d) => d.name ?? "(не задано)").join(" / "),
        visits: round(row.metrics[0], 0),
        register: round(row.metrics[1], 0),
      }));

    return {
      ok: true,
      landing: { current: current.landing, previous: previous.landing },
      goals: GOAL_NAMES.map((key, i) => ({
        key,
        label: KEY_GOAL_LABELS[key] ?? key,
        current: current.goals[i],
        previous: previous.goals[i],
      })),
      sources: named(sources),
      campaigns: named(campaigns),
      landingPages: (pages.data ?? []).map((row) => ({
        path: row.dimensions[0]?.name ?? "/",
        visits: round(row.metrics[0], 0),
        bounceRate: round(row.metrics[1], 0),
      })),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
