import { z } from "zod";

export const SETUP_USER_EVENTS = [
  "setup.intent_viewed",
  "setup.intent_selected",
  "setup.form_submitted",
  "setup.completed",
  "setup.qr_downloaded",
  "setup.preview_opened",
  "setup.next_step_clicked",
] as const;

export type SetupUserEvent = (typeof SETUP_USER_EVENTS)[number];

const ALLOWED_EVENTS = new Set<string>(SETUP_USER_EVENTS);

const eventBodySchema = z.object({
  event: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export function parseUserEvent(
  body: unknown
):
  | { ok: true; event: SetupUserEvent; props: Record<string, unknown> | null }
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
    return { ok: true, event: event as SetupUserEvent, props };
  }

  return { ok: true, event: event as SetupUserEvent, props: null };
}
