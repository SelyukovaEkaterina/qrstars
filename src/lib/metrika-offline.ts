import prisma from "@/lib/prisma";
import { INTERNAL_TEST_REGISTRATION_SOURCE } from "@/lib/analytics-exclusion";

export interface OfflineConversionRow {
  target: string;
  dateTime: number;
  clientId?: string | null;
  userId?: string | null;
  /** Доход конверсии; если есть хотя бы у одной строки — в CSV добавляются Price и Currency. */
  price?: number | null;
  currency?: string | null;
}

export function buildOfflineConversionsCsv(rows: OfflineConversionRow[]): string {
  const withPrice = rows.some((row) => row.price != null);
  const lines = [withPrice ? "ClientId,UserId,Target,DateTime,Price,Currency" : "ClientId,UserId,Target,DateTime"];
  for (const row of rows) {
    const clientId = row.clientId ?? "";
    const userId = row.userId ?? "";
    const base = `${clientId},${userId},${row.target},${row.dateTime}`;
    if (!withPrice) {
      lines.push(base);
      continue;
    }
    const price = row.price != null ? row.price.toFixed(2) : "";
    const currency = row.price != null ? row.currency || "RUB" : "";
    lines.push(`${base},${price},${currency}`);
  }
  return `${lines.join("\n")}\n`;
}

function metrikaCounterId(): string {
  return (
    process.env.YANDEX_METRIKA_COUNTER_ID?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() ||
    "109307713"
  );
}

function establishmentOfflineGoal(): string {
  return process.env.METRIKA_OFFLINE_GOAL_ESTABLISHMENT?.trim() || "establishment_created";
}

function paymentOfflineGoal(): string {
  return process.env.METRIKA_OFFLINE_GOAL_PAYMENT?.trim() || "payment_success";
}

/** Метрика привязывает офлайн-конверсию к визиту не дальше 21 дня — старше не грузим. */
export const METRIKA_ATTRIBUTION_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;

export async function uploadOfflineConversionsCsv(
  csv: string
): Promise<{ ok: true; uploadId: number } | { ok: false; error: string; skipped?: boolean }> {
  const token = process.env.YANDEX_METRIKA_OAUTH_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "YANDEX_METRIKA_OAUTH_TOKEN not set", skipped: true };
  }

  const counterId = metrikaCounterId();
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([csv], { type: "text/csv; charset=utf-8" }),
    "offline-conversions.csv"
  );

  const res = await fetch(
    `https://api-metrika.yandex.net/management/v1/counter/${counterId}/offline_conversions/upload`,
    {
      method: "POST",
      headers: { Authorization: `OAuth ${token}` },
      body: formData,
    }
  );

  let data: { uploading?: { id?: number }; message?: string } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    return {
      ok: false,
      error: data.message || `Metrika API HTTP ${res.status}`,
    };
  }

  return { ok: true, uploadId: data.uploading?.id ?? 0 };
}

export interface PendingEstablishmentConversion {
  establishmentId: string;
  userId: string;
  metrikaClientId: string | null;
  createdAt: Date;
}

export async function loadPendingEstablishmentConversions(options?: {
  limit?: number;
  graceMs?: number;
}): Promise<PendingEstablishmentConversion[]> {
  const limit = options?.limit ?? 500;
  const graceMs = options?.graceMs ?? 2 * 60 * 60 * 1000;
  const graceCutoff = new Date(Date.now() - graceMs);
  const windowStart = new Date(Date.now() - METRIKA_ATTRIBUTION_WINDOW_MS);

  const rows = await prisma.establishment.findMany({
    where: {
      metrikaOfflineSentAt: null,
      createdAt: { gte: windowStart, lte: graceCutoff },
      user: {
        role: { not: "ADMIN" },
        NOT: { registrationSource: INTERNAL_TEST_REGISTRATION_SOURCE },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      userId: true,
      user: { select: { metrikaClientId: true } },
    },
  });

  return rows.map((row) => ({
    establishmentId: row.id,
    userId: row.userId,
    metrikaClientId: row.user.metrikaClientId,
    createdAt: row.createdAt,
  }));
}

export function pendingToOfflineRows(
  pending: PendingEstablishmentConversion[]
): OfflineConversionRow[] {
  const goal = establishmentOfflineGoal();
  const rows: OfflineConversionRow[] = [];
  for (const row of pending) {
    const clientId = row.metrikaClientId?.trim() || null;
    if (!clientId && !row.userId) continue;
    rows.push({
      target: goal,
      dateTime: Math.floor(row.createdAt.getTime() / 1000),
      clientId,
      userId: row.userId,
    });
  }
  return rows;
}

export async function uploadPendingEstablishmentConversions(): Promise<{
  ok: boolean;
  skipped?: boolean;
  uploaded?: number;
  uploadId?: number;
  error?: string;
}> {
  const pending = await loadPendingEstablishmentConversions();
  if (pending.length === 0) {
    return { ok: true, uploaded: 0 };
  }

  const rows = pendingToOfflineRows(pending);
  if (rows.length === 0) {
    return { ok: true, uploaded: 0 };
  }

  const csv = buildOfflineConversionsCsv(rows);
  const upload = await uploadOfflineConversionsCsv(csv);
  if (!upload.ok) {
    return {
      ok: upload.skipped === true,
      skipped: upload.skipped,
      error: upload.error,
    };
  }

  const now = new Date();
  await prisma.establishment.updateMany({
    where: { id: { in: pending.map((p) => p.establishmentId) } },
    data: { metrikaOfflineSentAt: now },
  });

  return { ok: true, uploaded: rows.length, uploadId: upload.uploadId };
}

export interface PendingPaymentConversion {
  orderId: string;
  userId: string;
  metrikaClientId: string | null;
  paidAt: Date;
  amount: number;
}

/**
 * Первые оплаты подписки (PRO / Сеть), ещё не отправленные в Метрику.
 * Автопродления не грузим: цель payment_success — про конверсию в покупку,
 * а через год визита для привязки обычно уже нет.
 */
export async function loadPendingPaymentConversions(options?: {
  limit?: number;
  now?: Date;
}): Promise<PendingPaymentConversion[]> {
  const limit = options?.limit ?? 500;
  const now = options?.now ?? new Date();
  const windowStart = new Date(now.getTime() - METRIKA_ATTRIBUTION_WINDOW_MS);

  const rows = await prisma.paymentOrder.findMany({
    where: {
      kind: "INITIAL",
      status: "PAID",
      metrikaOfflineSentAt: null,
      // DateTime в CSV должен быть строго в прошлом.
      paidAt: { gte: windowStart, lt: now },
      user: {
        role: { not: "ADMIN" },
        NOT: { registrationSource: INTERNAL_TEST_REGISTRATION_SOURCE },
      },
    },
    orderBy: { paidAt: "asc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      paidAt: true,
      amount: true,
      user: { select: { metrikaClientId: true } },
    },
  });

  return rows.flatMap((row) =>
    row.paidAt
      ? [
          {
            orderId: row.id,
            userId: row.userId,
            metrikaClientId: row.user.metrikaClientId,
            paidAt: row.paidAt,
            amount: Number(row.amount),
          },
        ]
      : []
  );
}

export function paymentsToOfflineRows(pending: PendingPaymentConversion[]): OfflineConversionRow[] {
  const goal = paymentOfflineGoal();
  return pending.map((row) => ({
    target: goal,
    dateTime: Math.floor(row.paidAt.getTime() / 1000),
    clientId: row.metrikaClientId?.trim() || null,
    userId: row.userId,
    price: row.amount,
    currency: "RUB",
  }));
}

export async function uploadPendingPaymentConversions(): Promise<{
  ok: boolean;
  skipped?: boolean;
  uploaded?: number;
  uploadId?: number;
  error?: string;
}> {
  const pending = await loadPendingPaymentConversions();
  if (pending.length === 0) {
    return { ok: true, uploaded: 0 };
  }

  const csv = buildOfflineConversionsCsv(paymentsToOfflineRows(pending));
  const upload = await uploadOfflineConversionsCsv(csv);
  if (!upload.ok) {
    return {
      ok: upload.skipped === true,
      skipped: upload.skipped,
      error: upload.error,
    };
  }

  await prisma.paymentOrder.updateMany({
    where: { id: { in: pending.map((p) => p.orderId) } },
    data: { metrikaOfflineSentAt: new Date() },
  });

  return { ok: true, uploaded: pending.length, uploadId: upload.uploadId };
}
