import { NextResponse } from "next/server";

function redirectToCabinet() {
  const base = (
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://app.qrstars.ru"
  ).replace(/\/+$/, "");
  return NextResponse.redirect(`${base}/dashboard/subscription?status=fail`, 303);
}

export function GET() {
  return redirectToCabinet();
}

export function POST() {
  return redirectToCabinet();
}
