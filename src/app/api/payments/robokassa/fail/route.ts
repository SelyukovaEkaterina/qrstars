import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://app.qrstars.ru";
  return NextResponse.redirect(`${base}/dashboard/subscription?status=fail`);
}
