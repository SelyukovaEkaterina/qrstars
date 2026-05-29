import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getOrCreateOpenTicket,
  markSupportMessagesRead,
  sendUserSupportMessage,
  uploadUserSupportAttachment,
  formatSupportMessageResponse,
} from "@/lib/support-service";
import { apiErrorResponse } from "@/lib/api-error";

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return (session.user as Record<string, unknown>).id as string;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await getOrCreateOpenTicket(userId);
    await markSupportMessagesRead(userId);

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        status: ticket.status,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
      messages: ticket.messages.map(formatSupportMessageResponse),
    });
  } catch (e) {
    return apiErrorResponse(e, "Не удалось загрузить чат поддержки");
  }
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  try {
    let text = "";
    let attachment: Awaited<ReturnType<typeof uploadUserSupportAttachment>> | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      text = typeof formData.get("body") === "string" ? String(formData.get("body")) : "";
      const file = formData.get("file");
      if (file && file instanceof File && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        attachment = await uploadUserSupportAttachment(
          userId,
          buffer,
          file.name || "file",
          file.type || "application/octet-stream"
        );
      }
    } else {
      const body = await request.json();
      text = typeof body.body === "string" ? body.body : "";
    }

    const { ticket, message } = await sendUserSupportMessage(userId, {
      body: text,
      attachment,
    });

    return NextResponse.json({
      message: formatSupportMessageResponse(message),
      ticket: {
        id: ticket.id,
        status: ticket.status,
        updatedAt: ticket.updatedAt,
      },
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "EMPTY") {
      return NextResponse.json({ error: "Введите сообщение или прикрепите файл" }, { status: 400 });
    }
    if (code === "TOO_LONG") {
      return NextResponse.json({ error: "Слишком длинное сообщение" }, { status: 400 });
    }
    if (code === "UNSUPPORTED_TYPE") {
      return NextResponse.json(
        { error: "Неподдерживаемый тип файла. Допустимы изображения, PDF, документы, архивы, аудио и видео." },
        { status: 400 }
      );
    }
    if (code === "TOO_LARGE") {
      return NextResponse.json({ error: "Файл слишком большой (максимум 20 МБ)" }, { status: 400 });
    }
    return apiErrorResponse(e, "Не удалось отправить сообщение");
  }
}
