import type { MessengerContact, MessengerProvider } from "@/generated/prisma/client";
import type { ClientInfo } from "@/lib/client-info";
import { sendMaxMessage } from "@/lib/max";
import { sendTelegramContactNotification } from "@/lib/telegram";

export interface ContactNotificationPayload {
  qrLabel: string;
  guestName: string;
  message: string;
  client: ClientInfo;
}

function buildContactText(payload: ContactNotificationPayload): string {
  const { qrLabel, guestName, message, client } = payload;
  return [
    `<b>📩 Новое сообщение с визитки</b>`,
    "",
    `<b>QR:</b> ${escapeHtml(qrLabel)}`,
    `<b>От:</b> ${escapeHtml(guestName)}`,
    "",
    `<b>Сообщение:</b>`,
    `<i>${escapeHtml(message)}</i>`,
    "",
    `<b>IP:</b> ${escapeHtml(client.ip)}`,
    `<b>Регион:</b> ${escapeHtml(client.region)}`,
    `<b>Браузер:</b> ${escapeHtml(client.browser)}`,
    `<b>Устройство:</b> ${escapeHtml(client.device)}`,
  ].join("\n");
}

export async function sendBusinessCardContactNotification(
  contact: Pick<MessengerContact, "provider" | "externalId">,
  payload: ContactNotificationPayload
): Promise<boolean> {
  const text = buildContactText(payload);

  if (contact.provider === "TELEGRAM") {
    return sendTelegramContactNotification(contact.externalId, text);
  }

  if (contact.provider === "MAX") {
    return sendMaxMessage(contact.externalId, text, "html");
  }

  return false;
}

export function formatMessengerContactLabel(
  contact: Pick<MessengerContact, "provider" | "label" | "externalId">
): string {
  if (contact.label?.trim()) return contact.label.trim();
  return contact.provider === "TELEGRAM" ? "Telegram" : "MAX";
}

export function messengerProviderLabel(provider: MessengerProvider): string {
  return provider === "TELEGRAM" ? "Telegram" : "MAX";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
