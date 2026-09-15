/** True when the scan page is shown inside another site (landing phone iframe). */
export function isEmbeddedInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Open a maps/review URL.
 * Top-level scan keeps `location.assign` (same tab, as on a real phone).
 * Inside an iframe Yandex/2GIS send X-Frame-Options and show a connection error —
 * open a new tab instead.
 */
export function openExternalUrl(
  url: string,
  options: { history?: "assign" | "replace" } = {},
): { openedInNewTab: boolean } {
  if (isEmbeddedInIframe()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return { openedInNewTab: true };
  }
  if (options.history === "replace") {
    window.location.replace(url);
  } else {
    window.location.assign(url);
  }
  return { openedInNewTab: false };
}
