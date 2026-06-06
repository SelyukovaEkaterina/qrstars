"use client";

type TrackEventProps = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(event: string, props?: TrackEventProps) {
  const payload = JSON.stringify({
    event,
    props: props ?? {},
  });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon("/api/events", blob)) {
      return;
    }
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  });
}
