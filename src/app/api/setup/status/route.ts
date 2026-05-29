import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userNeedsSetupGuide } from "@/lib/setup-guide";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const needsSetup = await userNeedsSetupGuide(userId);

  return NextResponse.json({ needsSetup });
}
