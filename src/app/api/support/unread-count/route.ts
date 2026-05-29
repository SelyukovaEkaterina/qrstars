import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupportUnreadCount } from "@/lib/support-service";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const unreadCount = await getSupportUnreadCount(userId);

    return NextResponse.json({ unreadCount });
  } catch (e) {
    return apiErrorResponse(e, "Не удалось получить счётчик");
  }
}
