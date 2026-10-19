import { NextResponse } from "next/server";

function redirectToCabinet(status: "success" | "fail") {
  const base = (
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://app.qrstars.ru"
  ).replace(/\/+$/, "");
  // 303: и GET, и POST с Robokassa превращаются в переход, на котором есть сессия.
  return NextResponse.redirect(`${base}/dashboard/subscription?status=${status}`, 303);
}

export function GET() {
  return redirectToCabinet("success");
}

export function POST() {
  return redirectToCabinet("success");
}
