import { z } from "zod";

export const SETUP_USER_EVENTS = [
  "setup.intent_viewed",
  "setup.intent_selected",
  "setup.form_submitted",
  "setup.completed",
  "setup.qr_downloaded",
  "setup.preview_opened",
  "setup.next_step_clicked",
  "setup.wizard_dismissed",
  /** Ответ quick-start с ошибкой: props.error — текст, который увидел пользователь. */
  "setup.form_failed",
  /** Клик по бесплатной альтернативе: props.from (landing_paywall | reviews_no_card), props.to. */
  "setup.alternative_clicked",
] as const;

export type SetupUserEvent = (typeof SETUP_USER_EVENTS)[number];

/**
 * Клиентские события кабинета — путь к оплате. Остальные `dash.*` пишет сервер
 * (`logUserEvent`) и с клиента не принимаются.
 */
export const DASH_CLIENT_EVENTS = [
  /** Раздел кабинета открыт (раз в день на раздел): props.section, plan, firstToday. */
  "dash.section_viewed",
  /** Клик по ссылке на «Тариф и оплата»: props.from (раздел), text, place, nav. */
  "dash.upgrade_clicked",
  /** Показан paywall платной функции: props.feature (landing | gif | stl). */
  "dash.paywall_viewed",
  /** Нажата кнопка оплаты: props.plan, billing, consent (стояла ли галочка автосписаний). */
  "dash.checkout_clicked",
  /** «Приведи друга»: скопирована ссылка или нажато «Поделиться». props.place, via (copy | telegram | whatsapp | share). */
  "dash.referral_link_shared",
] as const;

export type DashClientEvent = (typeof DASH_CLIENT_EVENTS)[number];
export type ClientUserEvent = SetupUserEvent | DashClientEvent;

/** Серверное событие: API ответил 403 по тарифу. props.limit (projects | landing), plan, via. */
export const PLAN_LIMIT_HIT_EVENT = "dash.plan_limit_hit";

const ALLOWED_EVENTS = new Set<string>([...SETUP_USER_EVENTS, ...DASH_CLIENT_EVENTS]);

const eventBodySchema = z.object({
  event: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export function parseUserEvent(
  body: unknown
):
  | { ok: true; event: ClientUserEvent; props: Record<string, unknown> | null }
  | { ok: false; error: string } {
  const parsed = eventBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Некорректное тело запроса" };
  }

  const { event, props } = parsed.data;
  if (!ALLOWED_EVENTS.has(event)) {
    return { ok: false, error: "Неизвестное событие" };
  }

  if (props) {
    const serialized = JSON.stringify(props);
    if (serialized.length > 2000) {
      return { ok: false, error: "props слишком большие" };
    }
    return { ok: true, event: event as ClientUserEvent, props };
  }

  return { ok: true, event: event as ClientUserEvent, props: null };
}

/** Demo rerun of the wizard — not a real setup completion. */
export function shouldMarkOnboardingCompleted(
  event: string,
  props: Record<string, unknown> | null | undefined
): boolean {
  if (event !== "setup.completed") return false;
  return props?.rerun !== true;
}
