import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  requireEstablishmentAccess,
  normalizeInviteEmail,
  MAX_ESTABLISHMENT_MEMBERS,
  INVITE_RATE_LIMIT_USER,
  INVITE_RATE_LIMIT_ESTABLISHMENT,
  INVITE_RATE_WINDOW_MS,
} from "@/lib/establishment-access";
import {
  sendEstablishmentInviteEmail,
  sendEstablishmentAccessGrantedEmail,
} from "@/lib/mailer";
import { getAppBaseUrl } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id: establishmentId } = await context.params;

  const access = await requireEstablishmentAccess(userId, establishmentId);
  if (!access.ok) {
    if (access.error.type === "forbidden") {
      return NextResponse.json({ error: access.error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: {
      user: { select: { id: true, email: true, name: true } },
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          status: true,
          createdAt: true,
          acceptedAt: true,
          invitedBy: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!establishment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const owner = establishment.user;
  const members = establishment.members.map((m) => ({
    id: m.id,
    email: m.email,
    status: m.status,
    role: "member" as const,
    createdAt: m.createdAt.toISOString(),
    acceptedAt: m.acceptedAt?.toISOString() ?? null,
    invitedBy: m.invitedBy.name || m.invitedBy.email,
  }));

  return NextResponse.json({
    isOwner: access.role === "owner",
    owner: {
      email: owner.email,
      name: owner.name,
    },
    members,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { id: establishmentId } = await context.params;

  const access = await requireEstablishmentAccess(userId, establishmentId, { ownerOnly: true });
  if (!access.ok) {
    if (access.error.type === "forbidden") {
      return NextResponse.json({ error: access.error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const rlUser = rateLimit(
    `establishment-invite:user:${userId}`,
    INVITE_RATE_LIMIT_USER,
    INVITE_RATE_WINDOW_MS
  );
  if (!rlUser.ok) {
    return NextResponse.json(
      { error: "Слишком много приглашений. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rlUser.retryAfterSeconds) } }
    );
  }

  const rlEst = rateLimit(
    `establishment-invite:est:${establishmentId}`,
    INVITE_RATE_LIMIT_ESTABLISHMENT,
    INVITE_RATE_WINDOW_MS
  );
  if (!rlEst.ok) {
    return NextResponse.json(
      { error: "Слишком много приглашений для этого заведения. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rlEst.retryAfterSeconds) } }
    );
  }

  const body = await request.json();
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const email = normalizeInviteEmail(rawEmail);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
  }

  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!establishment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ownerEmail = normalizeInviteEmail(establishment.user.email);
  if (email === ownerEmail) {
    return NextResponse.json({ error: "Нельзя пригласить владельца заведения" }, { status: 400 });
  }

  const inviter = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (inviter && normalizeInviteEmail(inviter.email) === email) {
    return NextResponse.json({ error: "Нельзя пригласить самого себя" }, { status: 400 });
  }

  const memberCount = await prisma.establishmentMember.count({
    where: { establishmentId },
  });
  if (memberCount >= MAX_ESTABLISHMENT_MEMBERS) {
    return NextResponse.json(
      { error: `Максимум ${MAX_ESTABLISHMENT_MEMBERS} участников на заведение` },
      { status: 400 }
    );
  }

  const existingMember = await prisma.establishmentMember.findUnique({
    where: { establishmentId_email: { establishmentId, email } },
  });
  if (existingMember) {
    return NextResponse.json({ error: "Этот email уже приглашён" }, { status: 409 });
  }

  const targetUser = await prisma.user.findUnique({ where: { email } });
  const inviterName = inviter?.name || inviter?.email || "Владелец";
  const baseUrl = getAppBaseUrl();

  if (targetUser) {
    const member = await prisma.establishmentMember.create({
      data: {
        establishmentId,
        email,
        userId: targetUser.id,
        status: "ACTIVE",
        invitedById: userId,
        acceptedAt: new Date(),
      },
    });

    void sendEstablishmentAccessGrantedEmail(
      email,
      inviterName,
      establishment.name,
      `${baseUrl}/dashboard/establishments`
    ).catch((err) => console.error("sendEstablishmentAccessGrantedEmail:", err));

    return NextResponse.json(
      {
        member: {
          id: member.id,
          email: member.email,
          status: member.status,
          role: "member",
          createdAt: member.createdAt.toISOString(),
          acceptedAt: member.acceptedAt?.toISOString() ?? null,
        },
      },
      { status: 201 }
    );
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const member = await prisma.establishmentMember.create({
    data: {
      establishmentId,
      email,
      status: "PENDING",
      inviteToken,
      invitedById: userId,
    },
  });

  const registerUrl = `${baseUrl}/register?establishmentInvite=${inviteToken}`;
  void sendEstablishmentInviteEmail(
    email,
    inviterName,
    establishment.name,
    registerUrl
  ).catch((err) => console.error("sendEstablishmentInviteEmail:", err));

  return NextResponse.json(
    {
      member: {
        id: member.id,
        email: member.email,
        status: member.status,
        role: "member",
        createdAt: member.createdAt.toISOString(),
        acceptedAt: null,
      },
    },
    { status: 201 }
  );
}
