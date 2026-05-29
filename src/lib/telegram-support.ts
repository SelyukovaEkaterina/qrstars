import prisma from "@/lib/prisma";
import type { SupportTicket, User } from "@/generated/prisma/client";
import { sendMaxMessage } from "@/lib/max";
import {
  isSupportImageMime,
  uploadSupportAttachment,
  type SupportAttachmentMeta,
} from "@/lib/support-attachments";

const BOT_TOKEN = () => process.env.TELEGRAM_SUPPORT_BOT_TOKEN;
const GROUP_ID = () => process.env.TELEGRAM_SUPPORT_GROUP_ID;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Supergroup id: -1003955775002 */
function normalizeGroupChatId(id: string | number): string {
  const s = String(id);
  if (s.startsWith("-100")) return s;
  if (s.startsWith("-")) return `-100${s.slice(1)}`;
  return `-100${s}`;
}

function isOurSupportGroup(messageChatId: number): boolean {
  const configured = GROUP_ID();
  if (!configured) return false;
  return normalizeGroupChatId(messageChatId) === normalizeGroupChatId(configured);
}

export function isSupportTelegramConfigured(): boolean {
  return Boolean(BOT_TOKEN() && GROUP_ID());
}

/** Уведомления в Telegram-форум только на проде (не локально / не test). */
export function shouldNotifySupportTelegram(): boolean {
  return process.env.NODE_ENV === "production" && isSupportTelegramConfigured();
}

export function getTelegramTopicUrl(topicId: number): string | null {
  const raw = GROUP_ID();
  if (!raw || !topicId) return null;
  const chatId = raw.startsWith("-100") ? raw.slice(4) : raw.replace("-", "");
  return `https://t.me/c/${chatId}/${topicId}`;
}

async function tgApi<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = BOT_TOKEN();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) {
      console.error(`Telegram support API ${method}:`, data.description);
      return null;
    }
    return data.result ?? null;
  } catch (e) {
    console.error(`Telegram support API ${method} error:`, e);
    return null;
  }
}

async function persistForumTopic(
  userId: string,
  ticketId: string,
  threadId: number,
  subject: string
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { telegramForumTopicId: threadId },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { telegramTopicId: threadId, subject },
    }),
  ]);
}

export async function createSupportForumTopic(
  ticket: SupportTicket,
  user: Pick<User, "id" | "email" | "name">
): Promise<number | null> {
  if (!shouldNotifySupportTelegram()) return null;

  const groupId = GROUP_ID()!;
  const label = user.name?.trim() || user.email.split("@")[0] || "Клиент";
  const topicName = `${label}`.slice(0, 128);

  const result = await tgApi<{ message_thread_id: number }>("createForumTopic", {
    chat_id: groupId,
    name: topicName,
  });

  const threadId = result?.message_thread_id;
  if (!threadId) return null;

  await persistForumTopic(user.id, ticket.id, threadId, topicName);

  await tgApi("sendMessage", {
    chat_id: groupId,
    message_thread_id: threadId,
    parse_mode: "HTML",
    text:
      `🎫 <b>Тикет поддержки</b>\n\n` +
      `<b>Имя:</b> ${escapeHtml(user.name || "—")}\n` +
      `<b>Email:</b> ${escapeHtml(user.email)}\n` +
      `<b>User ID:</b> <code>${escapeHtml(user.id)}</code>\n` +
      `<b>Ticket:</b> <code>${escapeHtml(ticket.id)}</code>\n\n` +
      `<i>Отвечайте в этой теме — сообщение уйдёт в личный кабинет.</i>`,
  });

  return threadId;
}

export type TelegramSupportOutbound = {
  body: string;
  attachment?: SupportAttachmentMeta;
};

async function ensureSupportTopicId(
  ticket: SupportTicket & { user: Pick<User, "id" | "email" | "name"> }
): Promise<number | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: ticket.user.id },
    select: { telegramForumTopicId: true },
  });

  let topicId = ticket.telegramTopicId ?? dbUser?.telegramForumTopicId ?? null;

  if (topicId && !ticket.telegramTopicId) {
    const label = ticket.user.name?.trim() || ticket.user.email.split("@")[0] || "Клиент";
    await persistForumTopic(ticket.user.id, ticket.id, topicId, label.slice(0, 128));
  }

  if (!topicId) {
    topicId = await createSupportForumTopic(ticket, ticket.user);
  }

  return topicId;
}

export async function postUserMessageToTelegram(
  ticket: SupportTicket & { user: Pick<User, "id" | "email" | "name"> },
  payload: TelegramSupportOutbound
): Promise<boolean> {
  if (!shouldNotifySupportTelegram()) return false;

  const topicId = await ensureSupportTopicId(ticket);
  if (!topicId) return false;

  const groupId = GROUP_ID()!;
  const { body, attachment } = payload;
  const caption = body.trim()
    ? `💬 <b>Из личного кабинета</b>\n\n${escapeHtml(body.trim())}`
    : `💬 <b>Файл из личного кабинета</b>`;

  if (attachment) {
    const common = {
      chat_id: groupId,
      message_thread_id: topicId,
      parse_mode: "HTML" as const,
      caption,
    };

    if (isSupportImageMime(attachment.mime)) {
      const ok = await tgApi("sendPhoto", {
        ...common,
        photo: attachment.url,
      });
      return ok !== null;
    }

    const ok = await tgApi("sendDocument", {
      ...common,
      document: attachment.url,
    });
    return ok !== null;
  }

  const ok = await tgApi("sendMessage", {
    chat_id: groupId,
    message_thread_id: topicId,
    parse_mode: "HTML",
    text: `💬 <b>Сообщение из личного кабинета</b>\n\n${escapeHtml(body)}`,
  });

  return ok !== null;
}

async function downloadTelegramFile(
  fileId: string
): Promise<{ buffer: Buffer; mime: string; fileName: string } | null> {
  const token = BOT_TOKEN();
  if (!token) return null;

  const info = await tgApi<{ file_path: string; file_size?: number }>("getFile", {
    file_id: fileId,
  });
  if (!info?.file_path) return null;

  try {
    const res = await fetch(
      `https://api.telegram.org/file/bot${token}/${info.file_path}`
    );
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const baseName = info.file_path.split("/").pop() || "file";
    const ext = baseName.includes(".") ? baseName.split(".").pop() : "";
    const mime =
      res.headers.get("content-type")?.split(";")[0]?.trim() ||
      (ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "pdf"
              ? "application/pdf"
              : "application/octet-stream");
    return { buffer, mime, fileName: baseName };
  } catch (e) {
    console.error("downloadTelegramFile:", e);
    return null;
  }
}

type TelegramIncomingFile = {
  fileId: string;
  fileName: string;
  mime: string;
};

function extractTelegramAttachment(message: {
  photo?: Array<{ file_id: string }>;
  document?: { file_id: string; file_name?: string; mime_type?: string };
  video?: { file_id: string; file_name?: string; mime_type?: string };
  voice?: { file_id: string; mime_type?: string };
  audio?: { file_id: string; file_name?: string; mime_type?: string };
  sticker?: { file_id: string; mime_type?: string; is_animated?: boolean };
}): TelegramIncomingFile | null {
  if (message.document) {
    return {
      fileId: message.document.file_id,
      fileName: message.document.file_name || "document",
      mime: message.document.mime_type || "application/octet-stream",
    };
  }
  if (message.photo?.length) {
    const largest = message.photo[message.photo.length - 1];
    return {
      fileId: largest.file_id,
      fileName: "photo.jpg",
      mime: "image/jpeg",
    };
  }
  if (message.video) {
    return {
      fileId: message.video.file_id,
      fileName: message.video.file_name || "video.mp4",
      mime: message.video.mime_type || "video/mp4",
    };
  }
  if (message.voice) {
    return {
      fileId: message.voice.file_id,
      fileName: "voice.ogg",
      mime: message.voice.mime_type || "audio/ogg",
    };
  }
  if (message.audio) {
    return {
      fileId: message.audio.file_id,
      fileName: message.audio.file_name || "audio.mp3",
      mime: message.audio.mime_type || "audio/mpeg",
    };
  }
  if (message.sticker && !message.sticker.is_animated) {
    return {
      fileId: message.sticker.file_id,
      fileName: "sticker.webp",
      mime: message.sticker.mime_type || "image/webp",
    };
  }
  return null;
}

/** Новая регистрация → сообщение в общий канал (только production). */
export async function notifyNewUserRegistration(user: {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  referredById?: string | null;
}): Promise<void> {
  if (!shouldNotifySupportTelegram()) return;

  const groupId = GROUP_ID()!;

  let referrerLine = "";
  if (user.referredById) {
    const referrer = await prisma.user.findUnique({
      where: { id: user.referredById },
      select: { email: true, name: true },
    });
    if (referrer) {
      referrerLine = `\n<b>Реферал:</b> ${escapeHtml(referrer.name || referrer.email)}`;
    }
  }

  const dashboardUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/admin/users`
    : "";

  await tgApi("sendMessage", {
    chat_id: groupId,
    parse_mode: "HTML",
    text:
      `<b>Новая регистрация</b>\n\n` +
      `<b>Имя:</b> ${escapeHtml(user.name || "—")}\n` +
      `<b>Email:</b> ${escapeHtml(user.email)}\n` +
      (user.phone ? `<b>Телефон:</b> ${escapeHtml(user.phone)}\n` : "") +
      `<b>User ID:</b> <code>${escapeHtml(user.id)}</code>` +
      referrerLine +
      (dashboardUrl ? `\n\n<a href="${escapeHtml(dashboardUrl)}">Пользователи в админке</a>` : ""),
  });
}

export async function mirrorSupportToMax(
  ticketId: string,
  user: Pick<User, "name" | "email">,
  body: string
): Promise<void> {
  if (!shouldNotifySupportTelegram()) return;

  const adminId = process.env.MAX_SUPPORT_ADMIN_USER_ID;
  if (!adminId) return;

  const short = ticketId.slice(-8);
  const name = user.name || user.email;
  await sendMaxMessage(
    adminId,
    `<b>🎫 Поддержка #${escapeHtml(short)}</b>\n` +
      `<b>От:</b> ${escapeHtml(name)} (${escapeHtml(user.email)})\n\n` +
      escapeHtml(body) +
      `\n\n<i>Ответьте в Telegram-форуме. MAX — только уведомление.</i>`
  );
}

async function resolveTicketForThread(threadId: number) {
  let ticket = await prisma.supportTicket.findFirst({
    where: { telegramTopicId: threadId, status: "OPEN" },
  });

  if (ticket) return ticket;

  const user = await prisma.user.findFirst({
    where: { telegramForumTopicId: threadId },
  });
  if (!user) return null;

  ticket = await prisma.supportTicket.findFirst({
    where: { userId: user.id, status: "OPEN" },
  });

  if (!ticket) {
    ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        telegramTopicId: threadId,
        subject: user.name || user.email,
      },
    });
  } else if (!ticket.telegramTopicId) {
    ticket = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { telegramTopicId: threadId },
    });
  }

  return ticket;
}

export async function handleTelegramSupportGroupMessage(message: {
  message_id: number;
  message_thread_id?: number;
  chat: { id: number; type: string };
  from?: { id: number; is_bot?: boolean };
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string }>;
  document?: { file_id: string; file_name?: string; mime_type?: string };
  video?: { file_id: string; file_name?: string; mime_type?: string };
  voice?: { file_id: string; mime_type?: string };
  audio?: { file_id: string; file_name?: string; mime_type?: string };
  sticker?: { file_id: string; mime_type?: string; is_animated?: boolean };
}): Promise<void> {
  if (!GROUP_ID()) return;

  if (!isOurSupportGroup(message.chat.id)) {
    return;
  }

  const threadId = message.message_thread_id;
  if (!threadId) return;

  if (message.from?.is_bot) return;

  const textBody = (message.text || message.caption || "").trim();
  if (textBody.startsWith("/")) return;

  const incomingFile = extractTelegramAttachment(message);
  if (!textBody && !incomingFile) return;

  const ticket = await resolveTicketForThread(threadId);
  if (!ticket) {
    console.warn("[support-webhook] no ticket for thread", threadId);
    return;
  }

  let attachmentUrl: string | null = null;
  let attachmentName: string | null = null;
  let attachmentMime: string | null = null;

  if (incomingFile) {
    const downloaded = await downloadTelegramFile(incomingFile.fileId);
    if (downloaded) {
      try {
        const uploaded = await uploadSupportAttachment(
          ticket.id,
          downloaded.buffer,
          incomingFile.fileName || downloaded.fileName,
          incomingFile.mime || downloaded.mime
        );
        attachmentUrl = uploaded.url;
        attachmentName = uploaded.name;
        attachmentMime = uploaded.mime;
      } catch (e) {
        console.error("[support-webhook] attachment upload failed:", e);
      }
    }
  }

  const displayBody =
    textBody || (attachmentName ? `📎 ${attachmentName}` : "📎 Вложение");

  if (!displayBody && !attachmentUrl) return;

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        author: "STAFF",
        body: displayBody,
        attachmentUrl,
        attachmentName,
        attachmentMime,
        readByUser: false,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    }),
  ]);
}
