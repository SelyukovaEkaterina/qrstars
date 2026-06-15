import { enqueueScan } from "@/lib/scan-stats";

interface RecordQrScanParams {
  qrCodeId: string;
  establishmentId?: string | null;
  headers: Headers;
}

/**
 * Регистрация скана QR-кода.
 * Неблокирующая постановка в Redis-очередь (счётчик + detail для PRO).
 * Запись в БД выполняется батчевым flushScanStats() (cron / setInterval).
 */
export function recordQrScan({
  qrCodeId,
  establishmentId,
  headers,
}: RecordQrScanParams): void {
  enqueueScan({ qrCodeId, establishmentId, headers });
}
