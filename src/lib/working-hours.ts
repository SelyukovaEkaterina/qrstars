/**
 * Часы работы заведения.
 *
 * Хранятся в JSON-поле `Establishment.workingHours`. Каждый день — либо
 * { open: "HH:MM", close: "HH:MM" }, либо null (выходной).
 *
 * Если поле полностью пусто (`null`), считается, что часы не указаны —
 * UI просто ничего не показывает.
 *
 * Часы трактуются как локальные. Если `close <= open`, считаем что заведение
 * закрывается на следующий день (например, ночной клуб 20:00 → 04:00).
 */

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEK_DAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};

export interface DayHours {
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}

export type WorkingHours = Partial<Record<WeekDay, DayHours | null>>;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTime(t: unknown): t is string {
  return typeof t === "string" && TIME_RE.test(t);
}

/** Безопасный парсинг произвольного JSON в WorkingHours. */
export function parseWorkingHours(raw: unknown): WorkingHours | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const result: WorkingHours = {};
  let hasAny = false;
  for (const day of WEEK_DAYS) {
    const v = obj[day];
    if (v === null || v === undefined) continue;
    if (typeof v !== "object") continue;
    const cell = v as Record<string, unknown>;
    if (!isValidTime(cell.open) || !isValidTime(cell.close)) continue;
    result[day] = { open: cell.open, close: cell.close };
    hasAny = true;
  }
  // Явные выходные (день есть, но null) — сохраняем
  for (const day of WEEK_DAYS) {
    if (day in obj && obj[day] === null) {
      result[day] = null;
      hasAny = true;
    }
  }
  return hasAny ? result : null;
}

/** Есть ли хоть один день с расписанием. */
export function hasAnyHours(wh: WorkingHours | null | undefined): boolean {
  if (!wh) return false;
  return WEEK_DAYS.some((d) => wh[d]);
}

/** JS Date.getDay() → WeekDay (с пн=0). */
function jsDayToWeekDay(jsDay: number): WeekDay {
  // JS: 0=Sun..6=Sat
  const map: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[jsDay];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface HoursStatus {
  /** Открыто ли сейчас. */
  open: boolean;
  /** Короткая строка: «Открыто до 22:00» / «Закрыто • Откроется в пн в 09:00» / «Откроется в 18:00». */
  text: string;
}

/**
 * Вычисляет статус «открыто/закрыто» на момент `now`.
 * Возвращает null, если расписания нет.
 */
export function formatHoursStatus(
  wh: WorkingHours | null | undefined,
  now: Date = new Date()
): HoursStatus | null {
  if (!hasAnyHours(wh)) return null;

  const today = jsDayToWeekDay(now.getDay());
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // 1) Может быть, мы внутри «вчерашней» смены, которая зашла за полночь.
  const yesterdayIdx = (WEEK_DAYS.indexOf(today) + 6) % 7;
  const yesterday = WEEK_DAYS[yesterdayIdx];
  const yHours = wh![yesterday];
  if (yHours) {
    const yOpen = timeToMinutes(yHours.open);
    const yClose = timeToMinutes(yHours.close);
    if (yClose <= yOpen) {
      // ночная смена → закрывается утром следующего дня
      if (nowMin < yClose) {
        return { open: true, text: `Открыто до ${yHours.close}` };
      }
    }
  }

  // 2) Сегодняшняя смена.
  const tHours = wh![today];
  if (tHours) {
    const tOpen = timeToMinutes(tHours.open);
    const tCloseRaw = timeToMinutes(tHours.close);
    const tClose = tCloseRaw <= tOpen ? tCloseRaw + 24 * 60 : tCloseRaw;
    if (nowMin >= tOpen && nowMin < tClose) {
      return { open: true, text: `Открыто до ${formatHHMM(tClose)}` };
    }
    if (nowMin < tOpen) {
      return { open: false, text: `Откроется сегодня в ${tHours.open}` };
    }
  }

  // 3) Ищем ближайший открытый день.
  const todayIdx = WEEK_DAYS.indexOf(today);
  for (let i = 1; i <= 7; i++) {
    const d = WEEK_DAYS[(todayIdx + i) % 7];
    const h = wh![d];
    if (h) {
      const label = i === 1 ? "завтра" : `в ${WEEK_DAY_LABELS[d].toLowerCase()}`;
      return { open: false, text: `Откроется ${label} в ${h.open}` };
    }
  }
  return { open: false, text: "Закрыто" };
}
