import type { MessengerContact, MessengerProvider } from "@/generated/prisma/client";

export function formatMessengerContactLabel(
  contact: Pick<MessengerContact, "provider" | "label" | "externalId">
): string {
  if (contact.label?.trim()) return contact.label.trim();
  if (contact.provider === "EMAIL") return contact.externalId;
  return contact.provider === "TELEGRAM" ? "Telegram" : "MAX";
}

export function messengerProviderLabel(provider: MessengerProvider): string {
  if (provider === "EMAIL") return "Email";
  return provider === "TELEGRAM" ? "Telegram" : "MAX";
}
