/**
 * Авария у хостинг-провайдера Beget 2 ноября 2026: база QR-кодов утрачена,
 * напечатанные коды ведут в пустоту. Пока флаг включён — на сайте плашка,
 * а неизвестный код при скане показывает «временно недоступен» с ID кода
 * и путь восстановления для владельца (`/restore` → `/dashboard/restore`).
 */
export const BEGET_INCIDENT = {
  active: true,
  newsUrl: "https://www.rbc.ru/technology_and_media/02/11/2026/6ae8876e2273f59e1557a612",
  dateLabel: "2 ноября",
} as const;

/** Код, который владелец ввёл на `/restore` до входа, — подставляется в форму после регистрации. */
export const PENDING_RESTORE_CODE_KEY = "qrstars_restore_code";
