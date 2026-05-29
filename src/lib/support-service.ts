import prisma from "@/lib/prisma";
import { mirrorSupportToMax, postUserMessageToTelegram } from "@/lib/telegram-support";
import { uploadSupportAttachment, type SupportAttachmentMeta } from "@/lib/support-attachments";

export type SupportMessagePayload = {
  body: string;
  attachment?: SupportAttachmentMeta;
};

export function formatSupportMessageResponse(m: {
  id: string;
  author: string;
  body: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  createdAt: Date;
}) {
  return {
    id: m.id,
    author: m.author,
    body: m.body,
    attachmentUrl: m.attachmentUrl,
    attachmentName: m.attachmentName,
    attachmentMime: m.attachmentMime,
    createdAt: m.createdAt,
  };
}

export async function getOrCreateOpenTicket(userId: string) {
  const existing = await prisma.supportTicket.findFirst({
    where: { userId, status: "OPEN" },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (existing) return existing;

  return prisma.supportTicket.create({
    data: { userId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function sendUserSupportMessage(
  userId: string,
  payload: SupportMessagePayload
) {
  const trimmed = payload.body.trim();
  const attachment = payload.attachment;

  if (!trimmed && !attachment) {
    throw new Error("EMPTY");
  }
  if (trimmed.length > 4000) {
    throw new Error("TOO_LONG");
  }

  const ticket = await getOrCreateOpenTicket(userId);

  const displayBody =
    trimmed || (attachment ? `📎 ${attachment.name}` : "");

  const message = await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      author: "USER",
      body: displayBody,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentMime: attachment?.mime ?? null,
    },
  });

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() },
  });

  const ticketWithUser = await prisma.supportTicket.findUniqueOrThrow({
    where: { id: ticket.id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  await postUserMessageToTelegram(ticketWithUser, {
    body: trimmed,
    attachment,
  });

  await mirrorSupportToMax(ticket.id, ticketWithUser.user, displayBody);

  return { ticket: ticketWithUser, message };
}

export async function uploadUserSupportAttachment(
  userId: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<SupportAttachmentMeta> {
  const ticket = await getOrCreateOpenTicket(userId);
  return uploadSupportAttachment(ticket.id, buffer, fileName, mimeType);
}

export async function markSupportMessagesRead(userId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { userId, status: "OPEN" },
    select: { id: true },
  });
  if (!ticket) return;

  await prisma.supportMessage.updateMany({
    where: {
      ticketId: ticket.id,
      author: "STAFF",
      readByUser: false,
    },
    data: { readByUser: true },
  });
}

export async function getSupportUnreadCount(userId: string): Promise<number> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { userId, status: "OPEN" },
    select: { id: true },
  });
  if (!ticket) return 0;

  return prisma.supportMessage.count({
    where: {
      ticketId: ticket.id,
      author: "STAFF",
      readByUser: false,
    },
  });
}
