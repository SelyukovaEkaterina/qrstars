import { randomBytes } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { PLAN_PRICING, PRO_INTRO_OFFER, type PlanId } from "@/lib/plans";

export const PRO_OFFER_CAMPAIGN_STARTED_AT_KEY = "pro_offer_campaign_started_at";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class IntroOfferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntroOfferError";
  }
}

export type ProIntroOfferRecord = {
  id: string;
  code: string;
  amountRub: number;
  listAmountRub: number;
  expiresAt: Date;
  usedAt: Date | null;
};

function randomOfferCode(): string {
  const bytes = randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `${PRO_INTRO_OFFER.codePrefix}-${suffix}`;
}

function toRecord(offer: {
  id: string;
  code: string;
  amountRub: number;
  listAmountRub: number;
  expiresAt: Date;
  usedAt: Date | null;
}): ProIntroOfferRecord {
  return {
    id: offer.id,
    code: offer.code,
    amountRub: offer.amountRub,
    listAmountRub: offer.listAmountRub,
    expiresAt: offer.expiresAt,
    usedAt: offer.usedAt,
  };
}

export async function findProIntroOffer(userId: string): Promise<ProIntroOfferRecord | null> {
  const offer = await prisma.subscriptionIntroOffer.findUnique({
    where: {
      userId_campaignKey: { userId, campaignKey: PRO_INTRO_OFFER.campaignKey },
    },
  });
  return offer ? toRecord(offer) : null;
}

export function isProIntroOfferActive(
  offer: ProIntroOfferRecord | null,
  now = new Date()
): offer is ProIntroOfferRecord {
  if (!offer || offer.usedAt) return false;
  return offer.expiresAt.getTime() > now.getTime();
}

export async function findActiveProIntroOffer(
  userId: string,
  now = new Date()
): Promise<ProIntroOfferRecord | null> {
  const offer = await findProIntroOffer(userId);
  return isProIntroOfferActive(offer, now) ? offer : null;
}

/**
 * Создаёт код или обновляет срок, если письмо ещё не было отмечено отправленным
 * и предыдущая попытка не дошла. Повторный вызов после успешной отправки не делается.
 */
export async function issueProIntroOffer(userId: string, now = new Date()): Promise<ProIntroOfferRecord> {
  const expiresAt = new Date(now.getTime() + PRO_INTRO_OFFER.validDays * 24 * 60 * 60 * 1000);
  const amountRub = PRO_INTRO_OFFER.yearlyRub;
  const listAmountRub = PLAN_PRICING.PRO.yearlyRub;
  const where = {
    userId_campaignKey: { userId, campaignKey: PRO_INTRO_OFFER.campaignKey },
  };

  const existing = await prisma.subscriptionIntroOffer.findUnique({ where });
  if (existing) {
    if (existing.usedAt) return toRecord(existing);
    const updated = await prisma.subscriptionIntroOffer.update({
      where: { id: existing.id },
      data: { expiresAt, amountRub, listAmountRub },
    });
    return toRecord(updated);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.subscriptionIntroOffer.create({
        data: {
          userId,
          code: randomOfferCode(),
          campaignKey: PRO_INTRO_OFFER.campaignKey,
          plan: "PRO",
          billing: "yearly",
          amountRub,
          listAmountRub,
          expiresAt,
        },
      });
      return toRecord(created);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      const winner = await prisma.subscriptionIntroOffer.findUnique({ where });
      if (winner) return toRecord(winner);
    }
  }

  throw new Error("intro_offer_code_collision");
}

export async function resolveProIntroOfferAmount(params: {
  userId: string;
  plan: "PRO" | "NETWORK";
  catalogAmount: number;
  requestedCode?: unknown;
  now?: Date;
}): Promise<{ amount: number; offerId: string | null }> {
  const requested =
    typeof params.requestedCode === "string" ? params.requestedCode.trim().toUpperCase() : "";

  if (params.plan !== "PRO") {
    if (requested) {
      throw new IntroOfferError("Промокод действует только на годовой тариф PRO");
    }
    return { amount: params.catalogAmount, offerId: null };
  }

  const offer = await findActiveProIntroOffer(params.userId, params.now);
  if (requested && (!offer || offer.code !== requested)) {
    throw new IntroOfferError("Промокод не подходит или срок действия истёк");
  }
  if (!offer) return { amount: params.catalogAmount, offerId: null };
  return { amount: offer.amountRub, offerId: offer.id };
}

export async function markProIntroOfferUsed(
  userId: string,
  paidAmount: number,
  paymentOrderId?: string
): Promise<void> {
  const offer = await findActiveProIntroOffer(userId);
  if (!offer) return;
  if (offer.amountRub !== Math.round(Number(paidAmount))) return;
  await prisma.subscriptionIntroOffer.updateMany({
    where: { id: offer.id, usedAt: null },
    data: {
      usedAt: new Date(),
      ...(paymentOrderId ? { paymentOrderId } : {}),
    },
  });
}

export function introOfferPublicView(offer: ProIntroOfferRecord) {
  const discountPercent = Math.round((1 - offer.amountRub / offer.listAmountRub) * 100);
  return {
    code: offer.code,
    amountRub: offer.amountRub,
    listAmountRub: offer.listAmountRub,
    expiresAt: offer.expiresAt.toISOString(),
    discountPercent,
    plan: "PRO" as PlanId,
  };
}
