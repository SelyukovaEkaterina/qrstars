import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const { email, password, name, phone, consentPd } = await request.json();

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

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Пароль должен быть не менее 6 символов" },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Пользователь с таким email уже существует" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      phone: phone || null,
      hashedPassword,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Аккаунт создан",
    user: { id: user.id, email: user.email, name: user.name },
  });
}
