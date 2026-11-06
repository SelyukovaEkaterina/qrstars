import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbUserId } from "@/lib/session-user";
import { rateLimit } from "@/lib/rate-limit";
import {
  MAX_ACTIVE_API_KEYS,
  apiKeyDisplayPrefix,
  generateApiKey,
  hashApiKey,
  normalizeApiKeyName,
} from "@/lib/public-api/keys";
import { logUserEvent } from "@/lib/user-events-server";

const KEY_SELECT = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  createdAt: true,
} as const;

/** Ключи открытого API управляются только из кабинета (cookie-сессия), не самим API-ключом. */
export async function GET() {
  const auth = await requireDbUserId();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const keys = await prisma.apiKey.findMany({
    where: { userId: auth.userId, revokedAt: null },
    select: KEY_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const auth = await requireDbUserId();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = rateLimit(`api-key-create:${auth.userId}`, 20, 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Слишком много ключей за час, попробуйте позже" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const name = normalizeApiKeyName(body?.name);
  if (!name) {
    return NextResponse.json({ error: "Укажите название ключа (до 60 символов)" }, { status: 400 });
  }

  const active = await prisma.apiKey.count({ where: { userId: auth.userId, revokedAt: null } });
  if (active >= MAX_ACTIVE_API_KEYS) {
    return NextResponse.json(
      { error: `Не больше ${MAX_ACTIVE_API_KEYS} активных ключей. Отзовите ненужный` },
      { status: 400 }
    );
  }

  const key = generateApiKey();
  const created = await prisma.apiKey.create({
    data: {
      userId: auth.userId,
      name,
      prefix: apiKeyDisplayPrefix(key),
      keyHash: hashApiKey(key),
    },
    select: KEY_SELECT,
  });

  logUserEvent(auth.userId, "dash.api_key_created", { keyId: created.id });

  // Полный ключ отдаётся один раз — в БД только хеш.
  return NextResponse.json({ key: created, secret: key });
}
