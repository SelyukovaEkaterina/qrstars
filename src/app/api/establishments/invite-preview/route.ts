import { NextResponse } from "next/server";
import { getInvitePreview } from "@/lib/establishment-access";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const preview = await getInvitePreview(token);
  if (!preview) {
    return NextResponse.json({ error: "Приглашение не найдено" }, { status: 404 });
  }

  return NextResponse.json(preview);
}
