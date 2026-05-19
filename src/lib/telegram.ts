export async function sendTelegramNotification(
  chatId: string,
  establishmentName: string,
  rating: number,
  comment: string,
  guestName?: string
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  const stars = "⭐".repeat(rating) + "☆".repeat(5 - rating);
  const text = [
    `<b>⚠️ Негативный отзыв (${rating}/5)</b>`,
    "",
    `<b>Заведение:</b> ${escapeHtml(establishmentName)}`,
    `<b>Оценка:</b> ${stars}`,
    guestName ? `<b>Гость:</b> ${escapeHtml(guestName)}` : null,
    "",
    `<b>Комментарий:</b>`,
    comment
      ? `<i>${escapeHtml(comment)}</i>`
      : "<i>Без комментария</i>",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    const result = await res.json();
    if (!result.ok) {
      console.error("Telegram API error:", result.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}

export async function sendTelegramContactNotification(
  chatId: string,
  text: string
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    const result = await res.json();
    if (!result.ok) {
      console.error("Telegram API error:", result.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
