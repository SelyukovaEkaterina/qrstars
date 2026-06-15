import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMaxBotUrl, resolveTelegramBotUsername } from "@/lib/messenger-linking";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const telegramBotUsername = await resolveTelegramBotUsername();

  return NextResponse.json({
    telegramBotUsername,
    maxBotUrl: getMaxBotUrl(),
  });
}
