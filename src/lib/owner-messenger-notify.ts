import prisma from "@/lib/prisma";
import type { MessengerProvider } from "@/generated/prisma/client";

export type NotifyPurpose = "reviews" | "requests" | "reports";

type EstablishmentNotifyFields = {
  userId: string;
  notificationTelegramEnabled: boolean;
  notificationTelegramRequestsEnabled: boolean;
  notificationTelegramChatId: string | null;
  notificationMaxEnabled: boolean;
  notificationMaxRequestsEnabled: boolean;
  notificationMaxUserId: string | null;
  notificationEmailEnabled: boolean;
  notificationEmailRequestsEnabled: boolean;
  notificationEmail: string | null;
};

function telegramEnabledForPurpose(
  establishment: EstablishmentNotifyFields,
  purpose: NotifyPurpose
): boolean {
  return purpose === "reviews"
    ? establishment.notificationTelegramEnabled
    : establishment.notificationTelegramRequestsEnabled;
}

function maxEnabledForPurpose(
  establishment: EstablishmentNotifyFields,
  purpose: NotifyPurpose
): boolean {
  return purpose === "reviews"
    ? establishment.notificationMaxEnabled
    : establishment.notificationMaxRequestsEnabled;
}

function emailEnabledForPurpose(
  establishment: EstablishmentNotifyFields,
  purpose: NotifyPurpose
): boolean {
  return purpose === "reviews"
    ? establishment.notificationEmailEnabled
    : establishment.notificationEmailRequestsEnabled;
}

export async function getOwnerMessengerContacts(
  userId: string,
  provider: MessengerProvider
) {
  return prisma.messengerContact.findMany({
    where: { userId, provider },
    orderBy: { createdAt: "asc" },
  });
}

/** Куда слать Telegram для заведения: контакты аккаунта или legacy chatId. */
export async function getTelegramTargets(
  establishment: EstablishmentNotifyFields,
  purpose: NotifyPurpose = "reviews"
): Promise<string[]> {
  if (!telegramEnabledForPurpose(establishment, purpose)) return [];

  const contacts = await getOwnerMessengerContacts(establishment.userId, "TELEGRAM");
  if (contacts.length > 0) {
    return contacts.map((c) => c.externalId);
  }
  if (establishment.notificationTelegramChatId) {
    return [establishment.notificationTelegramChatId];
  }
  return [];
}

/** Куда слать MAX для заведения: контакты аккаунта или legacy userId. */
export async function getMaxTargets(
  establishment: EstablishmentNotifyFields,
  purpose: NotifyPurpose = "reviews"
): Promise<string[]> {
  if (!maxEnabledForPurpose(establishment, purpose)) return [];

  const contacts = await getOwnerMessengerContacts(establishment.userId, "MAX");
  if (contacts.length > 0) {
    return contacts.map((c) => c.externalId);
  }
  if (establishment.notificationMaxUserId) {
    return [establishment.notificationMaxUserId];
  }
  return [];
}

/** Email для уведомлений: контакты аккаунта или legacy поле заведения. */
export async function getEmailTargets(
  establishment: EstablishmentNotifyFields,
  purpose: NotifyPurpose = "reviews"
): Promise<string[]> {
  if (!emailEnabledForPurpose(establishment, purpose)) return [];

  const contacts = await getOwnerMessengerContacts(establishment.userId, "EMAIL");
  if (contacts.length > 0) {
    return contacts.map((c) => c.externalId);
  }
  if (establishment.notificationEmail) {
    return [establishment.notificationEmail];
  }
  return [];
}

export async function ownerHasMessengerProvider(
  userId: string,
  provider: MessengerProvider
): Promise<boolean> {
  const contact = await prisma.messengerContact.findFirst({
    where: { userId, provider },
    select: { id: true },
  });
  return !!contact;
}

const REVIEW_NOTIFY_FIELD: Record<
  Extract<MessengerProvider, "TELEGRAM" | "MAX">,
  "notificationTelegramEnabled" | "notificationMaxEnabled"
> = {
  TELEGRAM: "notificationTelegramEnabled",
  MAX: "notificationMaxEnabled",
};

/** Включить приём жалоб 1–3★ во всех заведениях владельца для канала. */
export async function enableReviewNotificationsForProvider(
  userId: string,
  provider: Extract<MessengerProvider, "TELEGRAM" | "MAX">
): Promise<number> {
  const result = await prisma.establishment.updateMany({
    where: { userId },
    data: { [REVIEW_NOTIFY_FIELD[provider]]: true },
  });
  return result.count;
}

/**
 * Owner-level резолверы каналов для ежемесячного отчёта.
 * Отчёт сводный (на владельца), поэтому тумблеры на User, цели — MessengerContact.
 */
type OwnerReportFlags = {
  reportsEmailEnabled: boolean;
  reportsTelegramEnabled: boolean;
  reportsMaxEnabled: boolean;
};

async function getReportTargets(
  userId: string,
  provider: MessengerProvider,
  enabled: boolean
): Promise<string[]> {
  if (!enabled) return [];
  const contacts = await getOwnerMessengerContacts(userId, provider);
  return contacts.map((c) => c.externalId);
}

/** Telegram chat_id-ы для отчёта (из MessengerContact владельца). */
export async function getReportTelegramTargets(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { reportsTelegramEnabled: true },
  });
  return getReportTargets(userId, "TELEGRAM", u?.reportsTelegramEnabled ?? false);
}

/** MAX user_id для отчёта (из MessengerContact владельца). */
export async function getReportMaxTargets(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { reportsMaxEnabled: true },
  });
  return getReportTargets(userId, "MAX", u?.reportsMaxEnabled ?? false);
}

/**
 * Email для отчёта: контакты аккаунта (EMAIL), иначе user.email.
 * Учитывает marketingEmailsEnabled (one-click unsubscribe глушит email-канал).
 */
export async function getReportEmailTargets(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      reportsEmailEnabled: true,
      marketingEmailsEnabled: true,
      email: true,
    },
  });
  if (!u || !u.reportsEmailEnabled) return [];
  const contacts = await getOwnerMessengerContacts(userId, "EMAIL");
  if (contacts.length > 0) return contacts.map((c) => c.externalId);
  // Для отчётов email-фолбэк на user.email только если не отписался от marketing.
  return u.marketingEmailsEnabled ? [u.email] : [];
}

/** Полный набор флагов отчётов для UI настроек. */
export async function getOwnerReportFlags(userId: string): Promise<OwnerReportFlags> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      reportsEmailEnabled: true,
      reportsTelegramEnabled: true,
      reportsMaxEnabled: true,
    },
  });
  return {
    reportsEmailEnabled: u?.reportsEmailEnabled ?? true,
    reportsTelegramEnabled: u?.reportsTelegramEnabled ?? false,
    reportsMaxEnabled: u?.reportsMaxEnabled ?? false,
  };
}
