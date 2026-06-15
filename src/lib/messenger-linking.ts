export const DEFAULT_MAX_BOT_URL = "https://max.ru/id540536312882_bot";

/** Публичная страница бота — всегда /id…; в env иногда ошибочно ставят /+d… из админки MAX. */
export function normalizeMaxBotUrl(url: string): string {
  return url.trim().replace(/\/\+d(\d+_bot\b)/, "/id$1");
}

export function getMaxBotUrl(baseUrl?: string | null): string {
  const raw = (baseUrl ?? process.env.NEXT_PUBLIC_MAX_BOT_URL ?? DEFAULT_MAX_BOT_URL).trim();
  return normalizeMaxBotUrl(raw || DEFAULT_MAX_BOT_URL);
}

/** Единый код привязки аккаунта (Telegram / MAX). */
export function accountLinkCode(userId: string): string {
  return messengerLinkCode(userId);
}

/** @deprecated Используйте accountLinkCode; SR- поддерживается для старых ссылок. */
export function establishmentLinkCode(establishmentId: string): string {
  return `SR-${establishmentId}`;
}

/** Код привязки контакта для формы «Связь» на визитке (MAX / Telegram). */
export function messengerLinkCode(userId: string): string {
  return `MC-${userId}`;
}

export function telegramEstablishmentStartPayload(establishmentId: string): string {
  return `link_${establishmentId}`;
}

export function telegramMessengerStartPayload(userId: string): string {
  return `link_mc_${userId}`;
}

export function telegramBotUrl(username: string): string {
  return `https://t.me/${username.replace(/^@/, "")}`;
}

export function telegramDeepLink(username: string, startPayload: string): string {
  return `${telegramBotUrl(username)}?start=${encodeURIComponent(startPayload)}`;
}

export function parseMessengerLinkCode(
  message: string
): { kind: "mc" | "sr"; id: string } | null {
  const trimmed = message.trim();
  const upper = trimmed.toUpperCase();
  if (upper.startsWith("MC-")) return { kind: "mc", id: trimmed.slice(3) };
  if (upper.startsWith("SR-")) return { kind: "sr", id: trimmed.slice(3) };
  return null;
}

let cachedTelegramUsername: string | null | undefined;

/** Имя бота из env или Telegram getMe (сервер). */
export async function resolveTelegramBotUsername(): Promise<string | null> {
  const fromEnv = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (fromEnv) return fromEnv;

  if (cachedTelegramUsername !== undefined) return cachedTelegramUsername;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    cachedTelegramUsername = null;
    return null;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as { ok?: boolean; result?: { username?: string } };
    cachedTelegramUsername =
      data.ok && data.result?.username ? String(data.result.username) : null;
  } catch {
    cachedTelegramUsername = null;
  }

  return cachedTelegramUsername;
}
