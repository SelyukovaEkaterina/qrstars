import { truncateComment, type ComplaintMessageExtra } from "@/lib/complaint-message";

const MAX_API_URL = "https://platform-api2.max.ru";

export async function sendMaxNotification(
  userId: string,
  establishmentName: string,
  rating: number,
  comment: string,
  guestName?: string,
  extra: ComplaintMessageExtra = {}
): Promise<boolean> {
  const accessToken = process.env.MAX_BOT_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("MAX_BOT_ACCESS_TOKEN not configured");
    return false;
  }

  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const text = [
    `<b>⚠️ Негативный отзыв (${rating}/5)</b>`,
    "",
    `<b>Заведение:</b> ${escapeHtml(establishmentName)}`,
    `<b>Оценка:</b> ${stars}`,
    guestName ? `<b>Гость:</b> ${escapeHtml(guestName)}` : null,
    // Без контакта владельцу нечем ответить гостю — раньше он был только в письме.
    extra.guestContact
      ? `<b>Контакт:</b> ${escapeHtml(extra.guestContact)}`
      : `<b>Контакт:</b> <i>гость не оставил</i>`,
    extra.qrLabel ? `<b>QR:</b> ${escapeHtml(extra.qrLabel)}` : null,
    "",
    `<b>Комментарий:</b>`,
    comment ? escapeHtml(truncateComment(comment)) : "<i>Без комментария</i>",
    extra.inboxUrl ? `\n<a href="${escapeHtml(extra.inboxUrl)}">Открыть в кабинете</a>` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    const res = await fetch(`${MAX_API_URL}/messages?user_id=${userId}`, {
      method: "POST",
      headers: {
        Authorization: accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, format: "html" }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("MAX API error:", result);
      return false;
    }
    return true;
  } catch (error) {
    console.error("MAX send error:", error);
    return false;
  }
}

export async function sendMaxMessage(
  userId: string,
  text: string,
  format: "html" | "markdown" = "html"
): Promise<boolean> {
  const accessToken = process.env.MAX_BOT_ACCESS_TOKEN;
  if (!accessToken) return false;

  try {
    const res = await fetch(`${MAX_API_URL}/messages?user_id=${userId}`, {
      method: "POST",
      headers: {
        Authorization: accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, format }),
    });
    return res.ok;
  } catch (error) {
    console.error("MAX send error:", error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
