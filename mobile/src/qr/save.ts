import type { QRTemplateConfig } from "./types";
import { exportQRToBase64 } from "./render";
import { loadEmojiImage } from "./emoji-images";

export interface QrSaveResult {
  ok: boolean;
  message: string;
}

/**
 * Make sure any emoji logo is loaded into the cache before we rasterize the QR,
 * so the saved/previewed image actually contains the logo.
 */
async function ensureLogoReady(config: QRTemplateConfig): Promise<void> {
  if (config.logoPreset) {
    await loadEmojiImage(config.logoPreset);
  }
}

/** Render the QR to a PNG file in the OS cache directory and return its file:// URI. */
async function writeQrToCacheFile(
  config: QRTemplateConfig,
  payload: string,
): Promise<string> {
  await ensureLogoReady(config);
  const { cacheDirectory, writeAsStringAsync, EncodingType } =
    require("expo-file-system/legacy");
  const base64 = exportQRToBase64(config, payload, { qrSize: 1024 });
  const fileUri = `${cacheDirectory}qr-${Date.now()}.png`;
  await writeAsStringAsync(fileUri, base64, { encoding: EncodingType.Base64 });
  return fileUri;
}

/**
 * Save the QR code PNG directly to the device media library (Photos on iOS,
 * Pictures on Android) with a single tap. Uses the legacy media-library module
 * whose native impl is bundled in Expo Go (the new `ExpoMediaLibraryNext` API
 * requires a development build).
 *
 * On Android in Expo Go, media-library write access is restricted, so if the
 * direct save is denied or fails we transparently fall back to the system share
 * sheet (where the user picks "Save image").
 */
export async function saveQrToGallery(
  config: QRTemplateConfig,
  payload: string,
): Promise<QrSaveResult> {
  let fileUri: string;
  try {
    fileUri = await writeQrToCacheFile(config, payload);
  } catch (e) {
    return { ok: false, message: String(e) };
  }

  try {
    const { requestPermissionsAsync, saveToLibraryAsync } =
      require("expo-media-library/legacy");
    const perm = await requestPermissionsAsync();
    const granted =
      perm?.granted === true ||
      perm?.status === "granted" ||
      perm?.accessPrivileges === "all" ||
      perm?.accessPrivileges === "limited";

    if (granted) {
      try {
        await saveToLibraryAsync(fileUri);
        return { ok: true, message: "QR-код сохранён в галерею" };
      } catch {
        // Permission granted but write failed (common in Expo Go on Android) —
        // fall through to the share-sheet fallback below.
      }
    }
  } catch {
    // Media library unavailable — fall through to share sheet.
  }

  // Fallback: open the share sheet so the user can "Save image" manually.
  try {
    const Sharing = require("expo-sharing");
    await Sharing.shareAsync(fileUri, {
      mimeType: "image/png",
      dialogTitle: "Сохранить QR-код",
    });
    return {
      ok: true,
      message: 'Выберите «Сохранить изображение», чтобы сохранить QR в галерею',
    };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/** Write the QR PNG to cache and open the system share sheet. */
export async function shareQr(
  config: QRTemplateConfig,
  payload: string,
): Promise<QrSaveResult> {
  try {
    const Sharing = require("expo-sharing");
    const fileUri = await writeQrToCacheFile(config, payload);
    await Sharing.shareAsync(fileUri, {
      mimeType: "image/png",
      dialogTitle: "Поделиться QR-кодом",
    });
    return { ok: true, message: "" };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}
