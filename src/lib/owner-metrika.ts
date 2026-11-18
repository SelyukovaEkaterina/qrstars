/**
 * Своя Яндекс Метрика владельца на страницах проекта (PRO / «Сеть»).
 * Чистые функции без зависимостей — используются и в API, и в кабинете.
 */

/** Номер счётчика: только цифры, у Метрики сейчас 8–9 знаков; берём с запасом. */
const COUNTER_RE = /^\d{5,12}$/;

/**
 * Достаёт номер счётчика из того, что вставил владелец: сам номер, код счётчика
 * целиком (`ym(12345678, "init"…`, `tag.js?id=…`, `/watch/…`) или ссылку на отчёт
 * (`metrika.yandex.ru/dashboard?id=…`). `""` / `null` — отключить счётчик.
 * Возвращает `null` (отключить), номер строкой или `undefined`, если номер не найден.
 */
export function parseMetrikaCounterInput(input: unknown): string | null | undefined {
  if (input === null) return null;
  if (typeof input !== "string" && typeof input !== "number") return undefined;
  const raw = String(input).trim();
  if (!raw) return null;
  if (COUNTER_RE.test(raw)) return raw;

  const patterns = [
    /\bym\(\s*(\d{5,12})\s*,/,
    /tag\.js\?id=(\d{5,12})\b/,
    /mc\.yandex\.ru\/watch\/(\d{5,12})\b/,
    /metrika\.yandex\.[a-z]+\/[^\s"']*[?&]id=(\d{5,12})\b/,
    /metrika\.yandex\.[a-z]+\/counters?\/(\d{5,12})\b/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
  }
  return undefined;
}

export function isMetrikaCounterId(value: unknown): value is string {
  return typeof value === "string" && COUNTER_RE.test(value);
}

/** Откуда пришёл гость — параметр визита в Метрике владельца. */
export type OwnerMetrikaSource = "qr" | "direct";

export const METRIKA_COUNTER_INPUT_ERROR =
  "Не нашли номер счётчика. Вставьте номер из Метрики (только цифры, например 12345678) или код счётчика целиком.";

/** Событие, которое шлют страницы гостя при переходе между разделами (микросайт). */
export const OWNER_METRIKA_SECTION_EVENT = "qrstars:section-view";
