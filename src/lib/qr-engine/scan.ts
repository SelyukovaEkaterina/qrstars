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
  const box = L.scanBox;
  const tmp = document.createElement("canvas");
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  if (!tctx) return "ok";

  // `size` — ширина самого кода: с силуэтом или ромбом в кадр попадает больше, чем код.
  const codeShare = L.qrSize / Math.max(box.w, box.h);
  const decodeAt = (size: number, blurPx: number) => {
    const w = Math.max(1, Math.round((size / codeShare) * (box.w / Math.max(box.w, box.h))));
    const h = Math.max(1, Math.round((size / codeShare) * (box.h / Math.max(box.w, box.h))));
    tmp.width = w;
    tmp.height = h;
    tctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
    // Прозрачный фон камера видит на белом листе.
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, w, h);
    // Из готовой картинки в координаты кода. Ромб поворачиваем обратно: камеры телефонов
    // читают код под любым углом, а jsQR на 45° ошибается — проверяем саму сетку модулей.
    tctx.save();
    tctx.scale(w / box.w, h / box.h);
    tctx.translate(-box.x, -box.y);
    if (L.rotated) {
      tctx.translate(L.innerW / 2, L.innerH / 2);
      tctx.rotate(-Math.PI / 4);
      tctx.translate(-L.canvasW / 2, -L.canvasH / 2);
    }
    tctx.drawImage(source, 0, 0, source.width / k, source.height / k);
    tctx.restore();
    tctx.filter = "none";
    return jsQR(tctx.getImageData(0, 0, w, h).data, w, h) !== null;
  };
  const anyOk = (sizes: number[], blur: number) => sizes.some((s) => decodeAt(s, blur));

  if (!anyOk([600, 500, 400, 300], 0)) return "screen";
  if (!anyOk([300, 240, 180], 0.5) || !anyOk([240, 180, 140], 1)) return "print";
  return "ok";
}
