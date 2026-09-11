import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveYandexMapsPreview } from "@/lib/yandex-maps-url";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rl = rateLimit(`yandex-preview:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url : "";
  if (!url.trim()) {
    return NextResponse.json({ error: "Укажите ссылку" }, { status: 400 });
  }

  const preview = await resolveYandexMapsPreview(url);
  if (!preview.ok) {
    return NextResponse.json({ ok: false, error: preview.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, name: preview.name, canonicalUrl: preview.canonicalUrl });
}
