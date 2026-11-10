import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/report-formatting";
import { PARTNER_MIN_WITHDRAWAL_RUB } from "@/lib/partner-constants";
import { formatRub } from "@/lib/plans";

class WithdrawError extends Error {}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();

  const {
    recepientName,
    recepientInn,
    recepientType,
    bankName,
    bankBik,
    bankAccount,
    corrAccount,
    comment,
  } = body;

  if (
    typeof recepientName !== "string" ||
    typeof recepientInn !== "string" ||
    !recepientName.trim() ||
    !recepientInn.trim() ||
    (recepientType !== "IP" && recepientType !== "OOO")
  ) {
    return NextResponse.json(
      { error: "Укажите все обязательные поля получателя" },
      { status: 400 }
    );
  }

  const now = new Date();
  const availableWhere = {
    partnerId: userId,
    withdrawalId: null,
    OR: [
      { status: "AVAILABLE" as const },
      { status: "PENDING" as const, availableAt: { lte: now } },
    ],
  };

  // Выводим весь доступный баланс: начисления неделимы, а раньше частичный
  // вывод помечал WITHDRAWN все начисления и остаток пропадал. Всё в одной
  // транзакции: двойной клик не создаёт вторую заявку на те же деньги.
  let withdrawal;
  try {
    withdrawal = await prisma.$transaction(async (tx) => {
      const active = await tx.partnerWithdrawal.count({
        where: { userId, status: { in: ["PENDING", "APPROVED"] } },
      });
      if (active > 0) throw new WithdrawError("У вас уже есть активная заявка на вывод");

      const earnings = await tx.partnerEarning.findMany({
        where: availableWhere,
        select: { id: true, amount: true },
      });
      const total = Math.round(earnings.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
      if (total < PARTNER_MIN_WITHDRAWAL_RUB) {
        throw new WithdrawError(
          `Минимальная сумма вывода — ${formatRub(PARTNER_MIN_WITHDRAWAL_RUB).replace(/\u00a0/g, " ")}. Доступно: ${total.toFixed(2)} ₽`
        );
      }

      const created = await tx.partnerWithdrawal.create({
        data: {
          amount: total,
          recepientName: String(recepientName).trim(),
          recepientInn: String(recepientInn).trim(),
          recepientType,
          bankName: bankName || null,
          bankBik: bankBik || null,
          bankAccount: bankAccount || null,
          corrAccount: corrAccount || null,
          comment: comment || null,
          user: { connect: { id: userId } },
        },
      });

      // Условие withdrawalId: null перепроверяется после блокировки строк —
      // параллельная заявка получит меньший count и откатится.
      const claimed = await tx.partnerEarning.updateMany({
        where: { id: { in: earnings.map((e) => e.id) }, withdrawalId: null },
        data: { status: "WITHDRAWN", withdrawalId: created.id },
      });
      if (claimed.count !== earnings.length) {
        throw new WithdrawError("Заявка уже создаётся — обновите страницу");
      }
      return created;
    });
  } catch (err) {
    if (err instanceof WithdrawError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const amount = withdrawal.amount;

  const userEmail = (session.user as Record<string, unknown>).email as string;
  const userName = (session.user as Record<string, unknown>).name as string;
  const esc = (v: unknown) => escapeHtml(String(v ?? ""));
  const adminTo = process.env.SMTP_FROM || "QrStars.ru <noreply@qrstars.ru>";
  const sent = await sendMail(
    adminTo,
    `Заявка на вывод #${withdrawal.id.slice(-8)} — ${amount.toFixed(2)} ₽`,
    `
        <h2>Новая заявка на вывод партнёрских средств</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">ID заявки</td><td style="padding: 8px; border: 1px solid #ddd;">${withdrawal.id}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Партнёр</td><td style="padding: 8px; border: 1px solid #ddd;">${esc(userName || "—")} (${esc(userEmail)})</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Сумма</td><td style="padding: 8px; border: 1px solid #ddd;">${amount.toFixed(2)} ₽</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Тип получателя</td><td style="padding: 8px; border: 1px solid #ddd;">${recepientType === "IP" ? "ИП" : "ООО"}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Название / ФИО</td><td style="padding: 8px; border: 1px solid #ddd;">${esc(recepientName)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">ИНН</td><td style="padding: 8px; border: 1px solid #ddd;">${esc(recepientInn)}</td></tr>
          ${bankName ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Банк</td><td style="padding: 8px; border: 1px solid #ddd;">${esc(bankName)}</td></tr>` : ""}
          ${bankBik ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">БИК</td><td style="padding: 8px; border: 1px solid #ddd;">${esc(bankBik)}</td></tr>` : ""}
          ${bankAccount ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Расчётный счёт</td><td style="padding: 8px; border: 1px solid #ddd;">${esc(bankAccount)}</td></tr>` : ""}
          ${corrAccount ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Корр. счёт</td><td style="padding: 8px; border: 1px solid #ddd;">${esc(corrAccount)}</td></tr>` : ""}
          ${comment ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Комментарий</td><td style="padding: 8px; border: 1px solid #ddd;">${esc(comment)}</td></tr>` : ""}
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Дата</td><td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString("ru-RU")}</td></tr>
        </table>
        <p style="margin-top: 16px; color: #666;">Обработайте заявку в панели администратора.</p>
      `,
  );
  if (!sent) console.error("Failed to send withdrawal notification email");

  return NextResponse.json({ success: true, withdrawal });
}
