/**
 * Отдача файла пользователю. На телефонах — системное «Поделиться» (на iPhone там есть
 * «Сохранить изображение» в Фото), на десктопе — обычное скачивание через blob-URL.
 */

export type DeliverResult = 'shared' | 'downloaded' | 'cancelled';

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

export function canShareFile(file: File): boolean {
  return (
    isTouchDevice() &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files: [file] })
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deliverFile(blob: Blob, filename: string, preferShare = true): Promise<DeliverResult> {
  const file = new File([blob], filename, { type: blob.type });
  if (preferShare && canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: 'QR-код' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // Share sheet недоступен (не из жеста пользователя и т.п.) — падаем на скачивание.
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality);
  });
}
