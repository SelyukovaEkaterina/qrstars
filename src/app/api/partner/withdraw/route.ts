import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();

  const {
    amount,
    recepientName,
    recepientInn,
    recepientType,
    bankName,
    bankBik,
    bankAccount,
    corrAccount,
    comment,
  } = body;

  if (!amount || amount < 10000) {
    return NextResponse.json(
      { error: "Минимальная сумма вывода — 10 000 ₽" },
      { status: 400 }
    );
  }

  if (!recepientName || !recepientInn || !recepientType) {
    return NextResponse.json(
      { error: "Укажите все обязательные поля получателя" },
      { status: 400 }
    );
  }

  const now = new Date();
  const availableEarnings = await prisma.partnerEarning.findMany({
    where: {
      partnerId: userId,
      status: "AVAILABLE",
    },
  });

  const alsoAvailable = await prisma.partnerEarning.findMany({
    where: {
      partnerId: userId,
      status: "PENDING",
      availableAt: { lte: now },
    },
  });

  const allAvailable = [...availableEarnings, ...alsoAvailable];
  const totalAvailable = allAvailable.reduce((sum, e) => sum + e.amount, 0);

  if (amount > totalAvailable) {
    return NextResponse.json(
      { error: `Недостаточно средств. Доступно: ${totalAvailable.toFixed(2)} ₽` },
      { status: 400 }
    );
  }

  const pendingWithdrawals = await prisma.partnerWithdrawal.findMany({
    where: { userId, status: { in: ["PENDING", "APPROVED"] } },
  });

  if (pendingWithdrawals.length > 0) {
    return NextResponse.json(
      { error: "У вас уже есть активная заявка на вывод" },
      { status: 400 }
    );
  }

  const withdrawal = await prisma.partnerWithdrawal.create({
    data: {
      amount,
      recepientName,
      recepientInn,
      recepientType,
      bankName: bankName || null,
      bankBik: bankBik || null,
      bankAccount: bankAccount || null,
      corrAccount: corrAccount || null,
      comment: comment || null,
      user: { connect: { id: userId } },
    },
  });

  if (availableEarnings.length > 0) {
    await prisma.partnerEarning.updateMany({
      where: { id: { in: availableEarnings.map((e) => e.id) } },
      data: { status: "WITHDRAWN" },
    });
  }
  if (alsoAvailable.length > 0) {
    await prisma.partnerEarning.updateMany({
      where: { id: { in: alsoAvailable.map((e) => e.id) } },
      data: { status: "WITHDRAWN" },
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const userEmail = (session.user as Record<string, unknown>).email as string;
    const userName = (session.user as Record<string, unknown>).name as string;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_FROM,
      subject: `Заявка на вывод #${withdrawal.id.slice(-8)} — ${amount.toFixed(2)} ₽`,
      html: `
        <h2>Новая заявка на вывод партнёрских средств</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">ID заявки</td><td style="padding: 8px; border: 1px solid #ddd;">${withdrawal.id}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Партнёр</td><td style="padding: 8px; border: 1px solid #ddd;">${userName || "—"} (${userEmail})</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Сумма</td><td style="padding: 8px; border: 1px solid #ddd;">${amount.toFixed(2)} ₽</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Тип получателя</td><td style="padding: 8px; border: 1px solid #ddd;">${recepientType === "IP" ? "ИП" : "ООО"}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Название / ФИО</td><td style="padding: 8px; border: 1px solid #ddd;">${recepientName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">ИНН</td><td style="padding: 8px; border: 1px solid #ddd;">${recepientInn}</td></tr>
          ${bankName ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Банк</td><td style="padding: 8px; border: 1px solid #ddd;">${bankName}</td></tr>` : ""}
          ${bankBik ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">БИК</td><td style="padding: 8px; border: 1px solid #ddd;">${bankBik}</td></tr>` : ""}
          ${bankAccount ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Расчётный счёт</td><td style="padding: 8px; border: 1px solid #ddd;">${bankAccount}</td></tr>` : ""}
          ${corrAccount ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Корр. счёт</td><td style="padding: 8px; border: 1px solid #ddd;">${corrAccount}</td></tr>` : ""}
          ${comment ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Комментарий</td><td style="padding: 8px; border: 1px solid #ddd;">${comment}</td></tr>` : ""}
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Дата</td><td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString("ru-RU")}</td></tr>
        </table>
        <p style="margin-top: 16px; color: #666;">Обработайте заявку в панели администратора.</p>
      `,
    });
  } catch {
    console.error("Failed to send withdrawal notification email");
  }

  return NextResponse.json({ success: true, withdrawal });
}
