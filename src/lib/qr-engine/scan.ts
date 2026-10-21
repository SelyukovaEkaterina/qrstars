import type { QrLayout } from "./render";

/** `ok` — уверенно читается, `print` — может хуже читаться мелко/на печати, `screen` — плохо читается. */
export type QrScanLevel = "ok" | "print" | "screen";

/** Сигнатура `jsQR` из пакета `jsqr` — передаётся снаружи, чтобы движок был без зависимостей. */
export type JsQrDecoder = (data: Uint8ClampedArray, width: number, height: number) => unknown;

export const SCAN_LEVEL_TEXT: Record<Exclude<QrScanLevel, "ok">, string> = {
  screen:
    "QR-код может плохо сканироваться: добавьте контраста, уменьшите логотип или уберите фото. Проверьте камерой телефона перед печатью.",
  print: "Код может хуже читаться при печати мелко или на старых телефонах. Проверьте его камерой перед тиражом.",
};

/**
 * Реальная проверка декодером: код вырезается из готовой картинки, уменьшается
 * и размывается, как при печати мелким размером и съёмке камерой.
 */
export function checkScanLevel(source: HTMLCanvasElement, L: QrLayout, jsQR: JsQrDecoder): QrScanLevel {
  const k = source.width / L.canvasW;
  const sx = L.qrLeft * k;
  const sy = L.qrTop * k;
  const sSize = L.qrSize * k;
  const tmp = document.createElement("canvas");
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  if (!tctx) return "ok";

  const decodeAt = (size: number, blurPx: number) => {
    tmp.width = size;
    tmp.height = size;
    tctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
    // Прозрачный фон камера видит на белом листе.
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, size, size);
    tctx.drawImage(source, sx, sy, sSize, sSize, 0, 0, size, size);
    tctx.filter = "none";
    return jsQR(tctx.getImageData(0, 0, size, size).data, size, size) !== null;
  };
  const anyOk = (sizes: number[], blur: number) => sizes.some((s) => decodeAt(s, blur));

  if (!anyOk([600, 500, 400, 300], 0)) return "screen";
  if (!anyOk([300, 240, 180], 0.5) || !anyOk([240, 180, 140], 1)) return "print";
  return "ok";
}
