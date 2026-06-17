import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyNewUserRegistration } from "@/lib/telegram-support";
import {
  acceptInviteByToken,
  acceptPendingInvitesForUser,
  normalizeInviteEmail,
} from "@/lib/establishment-access";
import { sendLifecycleEmail } from "@/lib/lifecycle-emails";
import {
  normalizeMetrikaClientId,
  parseRegistrationUtm,
} from "@/lib/registration-utm";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(request: Request) {
  // Rate limit: 10 регистраций в час с одного IP (в e2e все запросы с одного IP)
  if (process.env.DISABLE_REGISTER_RATE_LIMIT !== "true") {
    const ip = getClientIp(request);
    const rl = rateLimit(`register:${ip}`, 10, 60 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Слишком много попыток регистрации. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }
  }

  const body = await request.json();
  const {
    email,
    password,
    name,
    phone,
    consentPd,
    ref,
    establishmentInvite,
    metrikaClientId: rawMetrikaClientId,
    _ym_uid,
    registrationUtm: rawRegistrationUtm,
    utm_source,
    utm_campaign,
    utm_content,
    utm_medium,
    utm_term,
    yclid,
    ymclid,
  } = body as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    consentPd?: boolean;
    ref?: string;
    establishmentInvite?: string;
    metrikaClientId?: string;
    _ym_uid?: string;
    registrationUtm?: unknown;
    utm_source?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_medium?: string;
    utm_term?: string;
    yclid?: string;
    ymclid?: string;
  };

  const registrationUtm =
    parseRegistrationUtm(rawRegistrationUtm) ??
    parseRegistrationUtm({ utm_source, utm_campaign, utm_content, utm_medium, utm_term, yclid, ymclid });
  const metrikaClientId = normalizeMetrikaClientId(rawMetrikaClientId ?? _ym_uid);

  if (!consentPd) {
    return NextResponse.json(
      { error: "Необходимо согласие на обработку и передачу персональных данных" },
      { status: 400 }
    );
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email и пароль обязательны" },
      { status: 400 }
    );
  }

  const normalizedEmail = normalizeInviteEmail(email);

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Пароль должен быть не менее 6 символов" },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Пользователь с таким email уже существует" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  let referredById: string | null = null;
  if (ref) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: ref } });
    if (referrer && normalizeInviteEmail(referrer.email) !== normalizedEmail) {
      referredById = referrer.id;
    }
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name || null,
      phone: phone || null,
      hashedPassword,
      registrationSource: "register",
      ...(registrationUtm
        ? { registrationUtm: registrationUtm as Prisma.InputJsonValue }
        : {}),
      ...(metrikaClientId ? { metrikaClientId } : {}),
      ...(referredById ? { referredBy: { connect: { id: referredById } } } : {}),
    },
  });

  if (typeof establishmentInvite === "string" && establishmentInvite) {
    await acceptInviteByToken(establishmentInvite, user.id, normalizedEmail);
  }
  await acceptPendingInvitesForUser(user.id, normalizedEmail);

  void notifyNewUserRegistration({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    referredById,
  }).catch((err) => console.error("notifyNewUserRegistration:", err));

  void sendLifecycleEmail(user.id, "welcome").catch((err) =>
    console.error("sendLifecycleEmail welcome:", err)
  );

  return NextResponse.json({
    success: true,
    message: "Аккаунт создан",
    user: { id: user.id, email: user.email, name: user.name },
  });
}
