"use client";

import { isAnalyticsDisabledClient } from "@/lib/analytics-exclusion";

type TrackEventProps = Record<string, string | number | boolean | null | undefined>;

const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "109307713");

const METRIKA_GOAL_MAP: Record<string, string> = {
  "setup.form_submitted": "setup_form_submitted",
  "setup.completed": "setup_completed",
  "setup.qr_downloaded": "setup_qr_downloaded",
  "setup.intent_selected": "setup_intent_selected",
};

type PendingGoal = { goal: string; props: Record<string, unknown> };

const pendingMetrikaGoals: PendingGoal[] = [];
let metrikaFlushScheduled = false;

function resolveMetrikaGoal(event: string, props?: TrackEventProps): string | null {
  if (event === "setup.completed") {
    const intent = props?.intent;
    if (intent === "reviews") return "setup_completed_reviews";
    if (intent === "landing") return "setup_completed_landing";
    if (intent === "menu") return "setup_completed_menu";
    return METRIKA_GOAL_MAP[event] ?? null;
  }
  return METRIKA_GOAL_MAP[event] ?? null;
}

function sanitizeMetrikaProps(props?: TrackEventProps): Record<string, unknown> {
  if (!props) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

function flushPendingMetrikaGoals(): boolean {
  if (typeof window === "undefined" || !window.ym) return false;
  while (pendingMetrikaGoals.length > 0) {
    const { goal, props } = pendingMetrikaGoals.shift()!;
    window.ym(METRIKA_ID, "reachGoal", goal, props);
  }
  return true;
}

function scheduleMetrikaFlush() {
  if (metrikaFlushScheduled || typeof window === "undefined") return;
  metrikaFlushScheduled = true;

  const tryFlush = () => {
    if (flushPendingMetrikaGoals()) return;
    window.setTimeout(tryFlush, 100);
  };

  if (document.readyState === "complete") {
    tryFlush();
  } else {
    window.addEventListener("load", tryFlush, { once: true });
    tryFlush();
  }

  window.setTimeout(() => {
    flushPendingMetrikaGoals();
  }, 10_000);
}

function reachMetrikaGoal(event: string, props?: TrackEventProps) {
  if (isAnalyticsDisabledClient()) return;
  const goal = resolveMetrikaGoal(event, props);
  if (!goal || typeof window === "undefined") return;

  pendingMetrikaGoals.push({ goal, props: sanitizeMetrikaProps(props) });
  if (!flushPendingMetrikaGoals()) {
    scheduleMetrikaFlush();
  }
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
