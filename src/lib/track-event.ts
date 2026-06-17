"use client";

type TrackEventProps = Record<string, string | number | boolean | null | undefined>;

const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "109307713");

const METRIKA_GOAL_MAP: Record<string, string> = {
  "setup.form_submitted": "setup_form_submitted",
  "setup.completed": "setup_completed",
  "setup.qr_downloaded": "setup_qr_downloaded",
  "setup.intent_selected": "setup_intent_selected",
};

function resolveMetrikaGoal(event: string, props?: TrackEventProps): string | null {
  if (event === "setup.completed") {
    const intent = props?.intent;
    if (intent === "reviews") return "setup_completed_reviews";
    if (intent === "landing") return "setup_completed_landing";
    return METRIKA_GOAL_MAP[event] ?? null;
  }
  return METRIKA_GOAL_MAP[event] ?? null;
}

function reachMetrikaGoal(event: string, props?: TrackEventProps) {
  if (typeof window === "undefined" || !window.ym) return;
  const goal = resolveMetrikaGoal(event, props);
  if (!goal) return;
  window.ym(METRIKA_ID, "reachGoal", goal, props ?? {});
}

export function trackEvent(event: string, props?: TrackEventProps) {
  const payload = JSON.stringify({
    event,
    props: props ?? {},
  });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/events", blob);
  } else {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  }

  reachMetrikaGoal(event, props);
}
