import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { hasPaidFeatures } from "@/lib/plans";
import { findActiveSubscription, userHasPaidFeatures } from "@/lib/subscription-utils";

export const MAX_ESTABLISHMENT_MEMBERS = 10;
export const INVITE_RATE_LIMIT_USER = 10;
export const INVITE_RATE_LIMIT_ESTABLISHMENT = 5;
export const INVITE_RATE_WINDOW_MS = 60 * 60_000;

export type EstablishmentAccessRole = "owner" | "member";

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Prisma where: user owns establishment OR is an active member */
export function establishmentAccessWhere(userId: string): Prisma.EstablishmentWhereInput {
  return {
    OR: [
      { userId },
      {
        members: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    ],
  };
}

/** For nested queries: { establishment: establishmentAccessWhere(...) } */
export function establishmentRelationWhere(
  userId: string
): { establishment: Prisma.EstablishmentWhereInput } {
  return { establishment: establishmentAccessWhere(userId) };
}

/** QR codes visible to user: owned by user OR linked to accessible establishment */
export function qrcodeAccessWhere(userId: string): Prisma.QRCodeWhereInput {
  return {
    OR: [
      { userId },
      {
        establishment: establishmentAccessWhere(userId),
      },
    ],
  };
}

export async function getEstablishmentAccess(
  userId: string,
  establishmentId: string
): Promise<{ establishment: { id: string; userId: string; name: string }; role: EstablishmentAccessRole } | null> {
  const establishment = await prisma.establishment.findFirst({
    where: { id: establishmentId, ...establishmentAccessWhere(userId) },
    select: { id: true, userId: true, name: true },
  });
  if (!establishment) return null;
  const role: EstablishmentAccessRole =
    establishment.userId === userId ? "owner" : "member";
  return { establishment, role };
}

export type EstablishmentAccessError =
  | { type: "not_found" }
  | { type: "forbidden"; message: string };

export async function requireEstablishmentAccess(
  userId: string,
  establishmentId: string,
  options?: { ownerOnly?: boolean }
): Promise<
  | { ok: true; establishment: { id: string; userId: string; name: string }; role: EstablishmentAccessRole }
  | { ok: false; error: EstablishmentAccessError }
> {
  const access = await getEstablishmentAccess(userId, establishmentId);
  if (!access) {
    return { ok: false, error: { type: "not_found" } };
  }
  if (options?.ownerOnly && access.role !== "owner") {
    return {
      ok: false,
      error: { type: "forbidden", message: "Только владелец может выполнить это действие" },
    };
  }
  return { ok: true, ...access };
}

/** PRO features follow the establishment owner's subscription */
export async function establishmentHasPaidFeatures(establishmentId: string): Promise<boolean> {
  const est = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { userId: true },
  });
  if (!est) return false;
  const sub = await findActiveSubscription(est.userId);
  return hasPaidFeatures(sub?.plan);
}

export async function acceptPendingInvitesForUser(
  userId: string,
  email: string
): Promise<number> {
  const normalized = normalizeInviteEmail(email);
  const result = await prisma.establishmentMember.updateMany({
    where: {
      email: normalized,
      status: "PENDING",
      userId: null,
    },
    data: {
      status: "ACTIVE",
      userId,
      acceptedAt: new Date(),
      inviteToken: null,
    },
  });
  return result.count;
}

export async function acceptInviteByToken(
  token: string,
  userId: string,
  email: string
): Promise<{ ok: true; establishmentName: string } | { ok: false; reason: string }> {
  const normalized = normalizeInviteEmail(email);
  const member = await prisma.establishmentMember.findFirst({
    where: { inviteToken: token, status: "PENDING" },
    include: { establishment: { select: { name: true } } },
  });
  if (!member) {
    return { ok: false, reason: "Приглашение не найдено или уже использовано" };
  }
  if (member.email !== normalized) {
    return { ok: false, reason: "Email не совпадает с приглашением" };
  }
  await prisma.establishmentMember.update({
    where: { id: member.id },
    data: {
      status: "ACTIVE",
      userId,
      acceptedAt: new Date(),
      inviteToken: null,
    },
  });
  return { ok: true, establishmentName: member.establishment.name };
}

/** Analytics: user's own PRO or PRO owner of an accessible establishment */
export async function canAccessAnalytics(
  userId: string,
  establishmentId?: string | null
): Promise<boolean> {
  if (await userHasPaidFeatures(userId)) return true;
  if (establishmentId) {
    const access = await getEstablishmentAccess(userId, establishmentId);
    if (!access) return false;
    return establishmentHasPaidFeatures(establishmentId);
  }
  const establishments = await prisma.establishment.findMany({
    where: establishmentAccessWhere(userId),
    select: { id: true },
  });
  for (const est of establishments) {
    if (await establishmentHasPaidFeatures(est.id)) return true;
  }
  return false;
}

export async function getInvitePreview(token: string) {
  const member = await prisma.establishmentMember.findFirst({
    where: { inviteToken: token, status: "PENDING" },
    include: {
      establishment: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });
  if (!member) return null;
  return {
    establishmentName: member.establishment.name,
    email: member.email,
    inviterName: member.invitedBy.name || member.invitedBy.email,
  };
}
