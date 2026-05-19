import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";

const LANDING_ORIGINS = [
  "https://qrstars.ru",
  "https://www.qrstars.ru",
  "http://localhost:4321",
  "http://127.0.0.1:4321",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && LANDING_ORIGINS.includes(origin) ? origin : LANDING_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  try {
    const { email, name, phone, consentPd, source } = await request.json();

    if (!consentPd) {
      return NextResponse.json(
        { error: "Необходимо согласие на обработку и передачу персональных данных" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Укажите email" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || "support@qrstars.ru";
    const html = `
      <h2>Новая предрегистрация QrStars</h2>
      <p><strong>Email:</strong> ${email}</p>
      ${name ? `<p><strong>Имя:</strong> ${name}</p>` : ""}
      ${phone ? `<p><strong>Телефон:</strong> ${phone}</p>` : ""}
      <p><strong>Источник:</strong> ${source || "landing"}</p>
      <p><strong>Согласие ПД:</strong> да</p>
      <p><em>${new Date().toISOString()}</em></p>
    `;

    const sent = await sendMail(adminEmail, `[QrStars] Предрегистрация: ${email}`, html);

    if (!sent) {
      return NextResponse.json(
        { error: "Не удалось сохранить заявку. Попробуйте позже." },
        { status: 503, headers: corsHeaders(origin) }
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders(origin) });
  } catch {
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
