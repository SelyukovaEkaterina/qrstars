import prisma from "@/lib/prisma";
import { analyticsCohortUserWhere } from "@/lib/analytics-exclusion";
import { parseRegistrationUtm } from "@/lib/registration-utm";
import { DASH_CLIENT_EVENTS, PLAN_LIMIT_HIT_EVENT, SETUP_USER_EVENTS } from "@/lib/user-events";

const FUNNEL_STEP_DEFS = [
  { key: "registrations", event: null, label: "Регистрации" },
  { key: "setup.intent_viewed", event: "setup.intent_viewed", label: "Открыл мастер" },
  { key: "setup.intent_selected", event: "setup.intent_selected", label: "Выбрал сценарий" },
  { key: "setup.form_submitted", event: "setup.form_submitted", label: "Отправил форму" },
  { key: "setup.completed", event: "setup.completed", label: "QR создан" },
  { key: "setup.qr_downloaded", event: "setup.qr_downloaded", label: "Скачал PNG" },
  { key: "setup.preview_opened", event: "setup.preview_opened", label: "Открыл превью" },
] as const;

const MAX_RANGE_DAYS = 90;

export type FunnelStepKey = (typeof FUNNEL_STEP_DEFS)[number]["key"];

export interface FunnelStep {
  key: FunnelStepKey;
  label: string;
  count: number;
  rateFromStart: number | null;
  rateFromPrev: number | null;
}

export interface FunnelUserRow {
  id: string;
  email: string;
  name: string | null;
  registeredAt: string;
  source: string;
  intent: string | null;
  steps: {
    intentViewed: boolean;
    intentSelected: boolean;
    formSubmitted: boolean;
    completed: boolean;
    qrDownloaded: boolean;
    previewOpened: boolean;
  };
  lastDestination: string | null;
}

export interface SetupFunnelReport {
  range: { from: string; to: string };
  summary: {
    registrations: number;
    intentViewed: number;
    intentSelected: number;
    formSubmitted: number;
    completed: number;
    qrDownloaded: number;
    previewOpened: number;
    completionRate: number | null;
    downloadRate: number | null;
  };
  funnel: FunnelStep[];
  intentBreakdown: { intent: string; selected: number; completed: number }[];
  sourceBreakdown: { source: string; registrations: number; completed: number; downloaded: number }[];
  destinations: { destination: string; count: number }[];
  daily: { date: string; registrations: number; completed: number; downloaded: number }[];
  monetization: MonetizationReport;
  users: FunnelUserRow[];
}

/** Путь когорты к оплате: числа — уникальные пользователи. */
export interface MonetizationReport {
  steps: { key: string; label: string; count: number; rateFromStart: number | null }[];
  /** Какие разделы кабинета открывали (пользователей). */
  sections: { section: string; users: number }[];
  /** Откуда кликали на «Тариф и оплата»: раздел + текст ссылки. */
  upgradeClicks: { from: string; text: string; users: number }[];
  paywalls: { feature: string; users: number }[];
  limitHits: { limit: string; users: number }[];
  /** Нажали «Оплатить» без галочки автосписаний и так и не создали счёт. */
  checkoutWithoutConsent: number;
}

const RETURN_AFTER_MS = 24 * 3_600_000;

function propString(props: unknown, key: string): string | null {
  if (!props || typeof props !== "object") return null;
  const value = (props as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

function addToSetMap(map: Map<string, Set<string>>, key: string, userId: string) {
  const set = map.get(key) ?? new Set<string>();
  set.add(userId);
  map.set(key, set);
}

function setMapRows<K extends string>(map: Map<string, Set<string>>, field: K) {
  return [...map.entries()]
    .map(([key, set]) => ({ [field]: key, users: set.size }) as Record<K, string> & { users: number })
    .sort((a, b) => b.users - a.users);
}

async function getMonetizationReport(
  cohortUsers: { id: string; createdAt: Date }[]
): Promise<MonetizationReport> {
  const cohortIds = cohortUsers.map((u) => u.id);
  const registeredAt = new Map(cohortUsers.map((u) => [u.id, u.createdAt.getTime()]));

  const [events, orders, scannedOwners] =
    cohortIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          prisma.userEvent.findMany({
            where: {
              userId: { in: cohortIds },
              event: { in: [...DASH_CLIENT_EVENTS, PLAN_LIMIT_HIT_EVENT] },
            },
            select: { userId: true, event: true, props: true, createdAt: true },
          }),
          prisma.paymentOrder.findMany({
            where: { userId: { in: cohortIds }, kind: "INITIAL" },
            select: { userId: true, status: true },
          }),
          prisma.qRCode.findMany({
            where: { userId: { in: cohortIds }, scansCount: { gte: 3 } },
            select: { userId: true },
            distinct: ["userId"],
          }),
        ]);

  const returned = new Set<string>();
  const viewedPlans = new Set<string>();
  const clickedUpgrade = new Set<string>();
  const clickedPay = new Set<string>();
  const clickedPayNoConsent = new Set<string>();
  const sections = new Map<string, Set<string>>();
  const upgradeClicks = new Map<string, Set<string>>();
  const paywalls = new Map<string, Set<string>>();
  const limitHits = new Map<string, Set<string>>();

  for (const ev of events) {
    if (ev.event === "dash.section_viewed") {
      const section = propString(ev.props, "section") ?? "?";
      addToSetMap(sections, section, ev.userId);
      if (section === "subscription") viewedPlans.add(ev.userId);
      const reg = registeredAt.get(ev.userId);
      if (reg !== undefined && ev.createdAt.getTime() - reg >= RETURN_AFTER_MS) {
        returned.add(ev.userId);
      }
    } else if (ev.event === "dash.upgrade_clicked") {
      clickedUpgrade.add(ev.userId);
      const from = propString(ev.props, "from") ?? "?";
      const text = propString(ev.props, "text") ?? "";
      addToSetMap(upgradeClicks, `${from}\u0000${text}`, ev.userId);
    } else if (ev.event === "dash.paywall_viewed") {
      addToSetMap(paywalls, propString(ev.props, "feature") ?? "?", ev.userId);
    } else if (ev.event === "dash.checkout_clicked") {
      clickedPay.add(ev.userId);
      const consent = (ev.props as Record<string, unknown> | null)?.consent;
      if (consent === false) clickedPayNoConsent.add(ev.userId);
    } else if (ev.event === PLAN_LIMIT_HIT_EVENT) {
      addToSetMap(limitHits, propString(ev.props, "limit") ?? "?", ev.userId);
    }
  }

  const orderUsers = new Set(orders.map((o) => o.userId));
  const paidUsers = new Set(orders.filter((o) => o.status === "PAID").map((o) => o.userId));
  const total = cohortUsers.length;

  const stepDefs: [string, string, number][] = [
    ["registrations", "Регистрации", total],
    ["scans3", "QR с 3+ сканами", scannedOwners.length],
    ["returned", "Вернулся через сутки и позже", returned.size],
    ["plansViewed", "Открыл «Тариф и оплата»", viewedPlans.size],
    ["payClicked", "Нажал «Оплатить»", clickedPay.size],
    ["orderCreated", "Ушёл в Robokassa (счёт создан)", orderUsers.size],
    ["paid", "Оплатил", paidUsers.size],
  ];

  return {
    steps: stepDefs.map(([key, label, count]) => ({
      key,
      label,
      count,
      rateFromStart: pct(count, total),
    })),
    sections: setMapRows(sections, "section"),
    upgradeClicks: [...upgradeClicks.entries()]
      .map(([key, set]) => {
        const [from, text] = key.split("\u0000");
        return { from, text, users: set.size };
      })
      .sort((a, b) => b.users - a.users)
      .slice(0, 20),
    paywalls: setMapRows(paywalls, "feature"),
    limitHits: setMapRows(limitHits, "limit"),
    checkoutWithoutConsent: [...clickedPayNoConsent].filter((id) => !orderUsers.has(id)).length,
  };
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function resolveFunnelDateRange(
  fromParam: string | null,
  toParam: string | null
): { from: Date; to: Date; toExclusive: Date } | { error: string } {
  const today = startOfDay(new Date());
  const defaultTo = today;
  const defaultFrom = addDays(today, -6);

  const from = parseDateParam(fromParam) ?? defaultFrom;
  const to = parseDateParam(toParam) ?? defaultTo;

  if (from > to) {
    return { error: "Дата «с» не может быть позже даты «по»" };
  }

  const daySpan = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (daySpan > MAX_RANGE_DAYS) {
    return { error: `Максимальный период — ${MAX_RANGE_DAYS} дней` };
  }

  return {
    from: startOfDay(from),
    to: startOfDay(to),
    toExclusive: addDays(startOfDay(to), 1),
  };
}

function pct(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function propsIntent(props: unknown): string | null {
  if (!props || typeof props !== "object") return null;
  const intent = (props as Record<string, unknown>).intent;
  return typeof intent === "string" ? intent : null;
}

function propsDestination(props: unknown): string | null {
  if (!props || typeof props !== "object") return null;
  const destination = (props as Record<string, unknown>).destination;
  return typeof destination === "string" ? destination : null;
}

function registrationSourceLabel(registrationUtm: unknown): string {
  const utm = parseRegistrationUtm(registrationUtm);
  const campaign = utm?.utm_campaign?.toLowerCase() ?? "";
  const content = utm?.utm_content?.toLowerCase() ?? "";

  if (campaign === "generator_search") return "Генератор QR";
  if (campaign === "main_landing") return "Главная QrStars";
  if (campaign === "menu_search") return "QR-меню";
  if (campaign === "reviews_search" || campaign === "reviews_landing") {
    if (content.includes("2gis")) return "Отзывы · 2GIS";
    if (content.includes("yandeks") || content.includes("yandex")) return "Отзывы · Яндекс Карты";
    return "Отзывы";
  }
  if (utm?.utm_source) return utm.utm_source;
  return "Прямой / неизвестно";
}

export async function getSetupFunnelReport(
  from: Date,
  to: Date,
  toExclusive: Date
): Promise<SetupFunnelReport> {
  const cohortUsers = await prisma.user.findMany({
    where: {
      ...analyticsCohortUserWhere(),
      createdAt: { gte: from, lt: toExclusive },
    },
    select: { id: true, email: true, name: true, createdAt: true, registrationUtm: true },
    orderBy: { createdAt: "desc" },
  });

  const cohortIds = cohortUsers.map((u) => u.id);
  const monetization = await getMonetizationReport(cohortUsers);

  const events =
    cohortIds.length === 0
      ? []
      : await prisma.userEvent.findMany({
          where: {
            userId: { in: cohortIds },
            event: { in: [...SETUP_USER_EVENTS] },
          },
          select: { userId: true, event: true, props: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        });

  const eventsByUser = new Map<string, typeof events>();
  for (const ev of events) {
    const list = eventsByUser.get(ev.userId) ?? [];
    list.push(ev);
    eventsByUser.set(ev.userId, list);
  }

  const stepUserSets = new Map<string, Set<string>>();
  for (const def of FUNNEL_STEP_DEFS) {
    if (!def.event) continue;
    stepUserSets.set(def.event, new Set());
  }

  const intentSelected = new Map<string, Set<string>>();
  const intentCompleted = new Map<string, Set<string>>();
  const destinations = new Map<string, number>();
  const sourceRows = new Map<string, { registrations: number; completed: number; downloaded: number }>();

  const userRows: FunnelUserRow[] = cohortUsers.map((user) => {
    const source = registrationSourceLabel(user.registrationUtm);
    const sourceRow = sourceRows.get(source) ?? { registrations: 0, completed: 0, downloaded: 0 };
    sourceRow.registrations += 1;
    sourceRows.set(source, sourceRow);
    const userEvents = eventsByUser.get(user.id) ?? [];
    const steps = {
      intentViewed: false,
      intentSelected: false,
      formSubmitted: false,
      completed: false,
      qrDownloaded: false,
      previewOpened: false,
    };

    let intent: string | null = null;
    let lastDestination: string | null = null;

    for (const ev of userEvents) {
      stepUserSets.get(ev.event)?.add(user.id);

      if (ev.event === "setup.intent_viewed") steps.intentViewed = true;
      if (ev.event === "setup.intent_selected") {
        steps.intentSelected = true;
        const v = propsIntent(ev.props);
        if (v) {
          intent = v;
          if (!intentSelected.has(v)) intentSelected.set(v, new Set());
          intentSelected.get(v)!.add(user.id);
        }
      }
      if (ev.event === "setup.form_submitted") steps.formSubmitted = true;
      if (ev.event === "setup.completed") {
        if (!steps.completed) sourceRow.completed += 1;
        steps.completed = true;
        const v = propsIntent(ev.props);
        if (v) {
          intent = intent ?? v;
          if (!intentCompleted.has(v)) intentCompleted.set(v, new Set());
          intentCompleted.get(v)!.add(user.id);
        }
      }
      if (ev.event === "setup.qr_downloaded") {
        if (!steps.qrDownloaded) sourceRow.downloaded += 1;
        steps.qrDownloaded = true;
      }
      if (ev.event === "setup.preview_opened") steps.previewOpened = true;
      if (ev.event === "setup.next_step_clicked") {
        const dest = propsDestination(ev.props);
        if (dest) {
          lastDestination = dest;
          destinations.set(dest, (destinations.get(dest) ?? 0) + 1);
        }
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      registeredAt: user.createdAt.toISOString(),
      source,
      intent,
      steps,
      lastDestination,
    };
  });

  const registrations = cohortUsers.length;
  const counts: Record<string, number> = {
    registrations,
    "setup.intent_viewed": stepUserSets.get("setup.intent_viewed")?.size ?? 0,
    "setup.intent_selected": stepUserSets.get("setup.intent_selected")?.size ?? 0,
    "setup.form_submitted": stepUserSets.get("setup.form_submitted")?.size ?? 0,
    "setup.completed": stepUserSets.get("setup.completed")?.size ?? 0,
    "setup.qr_downloaded": stepUserSets.get("setup.qr_downloaded")?.size ?? 0,
    "setup.preview_opened": stepUserSets.get("setup.preview_opened")?.size ?? 0,
  };

  let prevCount: number | null = null;
  const funnel: FunnelStep[] = FUNNEL_STEP_DEFS.map((def) => {
    const count = counts[def.key] ?? 0;
    const step: FunnelStep = {
      key: def.key,
      label: def.label,
      count,
      rateFromStart: pct(count, registrations),
      rateFromPrev: prevCount === null ? null : pct(count, prevCount),
    };
    prevCount = count;
    return step;
  });

  const intentKeys = new Set([...intentSelected.keys(), ...intentCompleted.keys()]);
  const intentBreakdown = [...intentKeys]
    .sort()
    .map((intent) => ({
      intent,
      selected: intentSelected.get(intent)?.size ?? 0,
      completed: intentCompleted.get(intent)?.size ?? 0,
    }));

  const dailyMap = new Map<string, { registrations: number; completed: number; downloaded: number }>();
  for (let d = startOfDay(from); d < toExclusive; d = addDays(d, 1)) {
    dailyMap.set(formatDateKey(d), { registrations: 0, completed: 0, downloaded: 0 });
  }

  for (const user of cohortUsers) {
    const key = formatDateKey(startOfDay(user.createdAt));
    const bucket = dailyMap.get(key);
    if (bucket) bucket.registrations += 1;
  }

  for (const ev of events) {
    const key = formatDateKey(startOfDay(ev.createdAt));
    const bucket = dailyMap.get(key);
    if (!bucket) continue;
    if (ev.event === "setup.completed") bucket.completed += 1;
    if (ev.event === "setup.qr_downloaded") bucket.downloaded += 1;
  }

  const daily = [...dailyMap.entries()].map(([date, value]) => ({
    date,
    ...value,
  }));

  return {
    range: { from: formatDateKey(from), to: formatDateKey(to) },
    summary: {
      registrations,
      intentViewed: counts["setup.intent_viewed"],
      intentSelected: counts["setup.intent_selected"],
      formSubmitted: counts["setup.form_submitted"],
      completed: counts["setup.completed"],
      qrDownloaded: counts["setup.qr_downloaded"],
      previewOpened: counts["setup.preview_opened"],
      completionRate: pct(counts["setup.completed"], registrations),
      downloadRate: pct(counts["setup.qr_downloaded"], counts["setup.completed"]),
    },
    funnel,
    intentBreakdown,
    sourceBreakdown: [...sourceRows.entries()]
      .map(([source, value]) => ({ source, ...value }))
      .sort((a, b) => b.registrations - a.registrations),
    destinations: [...destinations.entries()]
      .map(([destination, count]) => ({ destination, count }))
      .sort((a, b) => b.count - a.count),
    daily,
    monetization,
    users: userRows,
  };
}
