/**
 * Входящие письма (ответы на наши рассылки и уведомления).
 * Postfix на VPS принимает почту для support@ / noreply@qrstars.ru, скрипт
 * `deploy/mail/inbound-to-app.py` разбирает MIME и шлёт JSON в `POST /api/inbound-email`.
 * Здесь — чистая логика без `@/`-алиасов (юнит-тесты `inbound-email.test.ts`).
 */

export const INBOUND_MAX_TEXT = 3500;
export const INBOUND_MAX_ATTACHMENTS = 5;

export type InboundAttachment = { name: string; mime: string; dataBase64: string };

export type InboundEmail = {
  from: string;
  fromName: string | null;
  to: string | null;
  subject: string | null;
  text: string;
  /** Автоответ, отчёт о недоставке, рассылка — в поддержку не пишем. */
  automated: boolean;
  attachments: InboundAttachment[];
};

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** Проверка тела запроса от скрипта Postfix. `null` — мусор. */
export function parseInboundEmail(raw: unknown): InboundEmail | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const from = str(o.from, 254)?.toLowerCase() ?? null;
  if (!from || !EMAIL_RE.test(from)) return null;
  const attachments: InboundAttachment[] = Array.isArray(o.attachments)
    ? o.attachments
        .flatMap((a) => {
          if (!a || typeof a !== "object") return [];
          const r = a as Record<string, unknown>;
          const dataBase64 = typeof r.dataBase64 === "string" ? r.dataBase64 : "";
          if (!dataBase64) return [];
          return [
            {
              name: str(r.name, 200) || "file",
              mime: str(r.mime, 120) || "application/octet-stream",
              dataBase64,
            },
          ];
        })
        .slice(0, INBOUND_MAX_ATTACHMENTS)
    : [];
  return {
    from,
    fromName: str(o.fromName, 120),
    to: str(o.to, 254),
    subject: str(o.subject, 300),
    text: typeof o.text === "string" ? o.text : "",
    automated: o.automated === true,
    attachments,
  };
}

/**
 * Строка, с которой начинается цитата исходного письма:
 * «15 нояб. 2026 г., в 19:12, QrStars <noreply@qrstars.ru> написал(а):»,
 * «On Sat, Nov 15, 2026 at 7:12 PM QrStars wrote:», «-----Original Message-----»,
 * блок «От: … Отправлено: …» из Outlook.
 */
const QUOTE_HEADER_RES = [
  /^\s*(?:-{2,}\s*)?(?:Original Message|Исходное сообщение|Пересылаемое сообщение|Forwarded message)\s*(?:-{2,})?\s*$/i,
  /^\s*On\b.{0,200}\bwrote:\s*$/i,
  /^.{0,200}(?:написал|написала|написал\(а\)|пишет)\s*:\s*$/i,
  /^\s*(?:From|От|Отправитель)\s*:\s*.*(?:@|qrstars)/i,
  // «сб, 15 нояб. 2026 г. в 19:12, QrStars.ru <noreply@qrstars.ru>:» (Gmail), «… от QrStars.ru <…>:» (Mail.ru)
  /^.{0,200}\d.{0,200}<[^<>\s]+@[^<>\s]+>\s*:\s*$/,
];

/** Подпись с телефона: «Отправлено с iPhone», «Sent from my iPhone». */
const MOBILE_SIGNATURE_RE = /^\s*(?:Отправлено (?:с|из)\s|Sent from my\s|Get Outlook for\s)/i;

/**
 * Оставляет только новый текст ответа: убирает цитату нашего письма, строки с «>»
 * и подпись после «-- ». Если после чистки ничего не осталось — исходный текст
 * (лучше показать лишнее, чем потерять ответ).
 */
export function extractReplyText(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Заголовок цитаты бывает разбит на две строки (Gmail переносит длинный адрес).
    const joined = i + 1 < lines.length ? `${line} ${lines[i + 1]}` : line;
    if (QUOTE_HEADER_RES.some((re) => re.test(line))) break;
    if (line.trim() && /(?:написал|написала|написал\(а\)|wrote|>)\s*:\s*$/i.test(joined) && /\d/.test(line) && /@/.test(joined)) break;
    if (line.trim() === "--" || line === "-- ") break;
    if (/^\s*>/.test(line)) continue;
    if (MOBILE_SIGNATURE_RE.test(line)) continue;
    out.push(line);
  }
  const cleaned = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned || text.trim();
}

/** Текст сообщения в чат поддержки: тема (если не «Re: наше письмо» без смысла) + ответ. */
export function supportBodyFromEmail(email: Pick<InboundEmail, "subject" | "text">): string {
  const reply = extractReplyText(email.text);
  const subject = email.subject?.replace(/^\s*((re|fwd?|ответ|отв|пересл)\s*(\[\d+\])?\s*:\s*)+/i, "").trim();
  const head = subject ? `Письмо: «${subject.slice(0, 150)}»\n\n` : "";
  const body = `${head}${reply}`;
  return body.length > INBOUND_MAX_TEXT ? `${body.slice(0, INBOUND_MAX_TEXT)}…` : body;
}

/** Тема «Почта» в support-форуме: письма от незнакомых адресов, ответ реплаем уходит письмом. */
export const MAIL_TOPIC_NAME = "📬 Почта";

/**
 * Текст сообщения в теме «Почта» (HTML для Telegram). Строки «От:» и «Тема:» потом
 * разбирает `parseMailTopicMessage` из reply_to_message.text — формат не менять без него.
 */
export function mailTopicMessageText(
  email: { from: string; fromName?: string | null; to?: string | null; subject?: string | null; attachments: number },
  text: string,
  escape: (s: string) => string
): string {
  const who = email.fromName?.trim() ? `${escape(email.fromName.trim().replace(/[<>]/g, ""))} &lt;${escape(email.from)}&gt;` : escape(email.from);
  const lines = [
    `✉️ <b>Письмо${email.to ? ` на ${escape(email.to)}` : ""}</b>`,
    `<b>От:</b> ${who}`,
    email.subject?.trim() ? `<b>Тема:</b> ${escape(email.subject.trim().replace(/\s+/g, " ").slice(0, 200))}` : null,
    email.attachments > 0 ? `<b>Вложений:</b> ${email.attachments} (не сохранены)` : null,
    "",
    escape(text.slice(0, 3000)) || "<i>(пустое письмо)</i>",
    "",
    `<i>↩️ Ответьте реплаем на это сообщение — ответ уйдёт письмом на ${escape(email.from)}</i>`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/** Разбор нашего сообщения из темы «Почта» (plain text из reply_to_message). */
export function parseMailTopicMessage(text: string): { from: string; subject: string | null; body: string } | null {
  const from = text.match(/^От:[^\n]*?<?([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+?)>?\s*$/m)?.[1]?.toLowerCase();
  if (!from || !EMAIL_RE.test(from)) return null;
  const subject = text.match(/^Тема:\s*(.+)$/m)?.[1]?.trim() || null;
  const parts = text.split("\n\n");
  const body = parts.length >= 3 ? parts.slice(1, -1).join("\n\n").trim() : "";
  return { from, subject, body };
}
