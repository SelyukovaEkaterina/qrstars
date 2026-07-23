import { Skia } from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import { EMOJI_ASSETS } from "./emoji-assets";

/**
 * Skia's default font has no emoji glyphs, so drawing an emoji string renders
 * blank. Instead we rasterize emoji logos from bundled Twemoji PNGs
 * (see scripts/gen-emoji-assets.mjs) → `EMOJI_ASSETS`. Fully offline, sync.
 */

const cache = new Map<string, SkImage>();

/** Twemoji file-name codepoints for an emoji (variation selector FE0F stripped). */
function codepoint(emoji: string): string {
  return Array.from(emoji)
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((h) => h !== "fe0f")
    .join("-");
}

/** Decode (once, cached) the emoji's bundled PNG into a Skia image. Sync. */
export function getEmojiImageSync(emoji: string): SkImage | null {
  const cached = cache.get(emoji);
  if (cached) return cached;
  const b64 = EMOJI_ASSETS[codepoint(emoji)];
  if (!b64) return null;
  try {
    const data = Skia.Data.fromBase64(b64);
    const img = Skia.Image.MakeImageFromEncoded(data);
    if (img) cache.set(emoji, img);
    return img;
  } catch {
    return null;
  }
}

/** Alias used by the render path. */
export function ensureEmojiImage(emoji: string): SkImage | null {
  return getEmojiImageSync(emoji);
}

/** Kept for callers that prefer an async signature (e.g. pre-save warm-up). */
export function loadEmojiImage(emoji: string): Promise<SkImage | null> {
  return Promise.resolve(getEmojiImageSync(emoji));
}
