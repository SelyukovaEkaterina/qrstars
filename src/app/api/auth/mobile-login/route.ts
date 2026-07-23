import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { normalizeInviteEmail } from "@/lib/establishment-access";
import { signMobileToken, withCorsHeaders, corsOkResponse } from "@/lib/mobile-auth";

export async function OPTIONS() {
  return corsOkResponse();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return withCorsHeaders(
        NextResponse.json({ error: "Email и пароль обязательны" }, { status: 400 }),
      );
    }

    const normalizedEmail = normalizeInviteEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, role: true, hashedPassword: true },
    });

    if (!user || !user.hashedPassword) {
      return withCorsHeaders(
        NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 }),
      );
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
      return withCorsHeaders(
        NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 }),
      );
    }

    const token = await signMobileToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return withCorsHeaders(
      NextResponse.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      }),
    );
  } catch (e) {
    console.error("mobile-login error:", e);
    return withCorsHeaders(
      NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 }),
    );
  }
}
