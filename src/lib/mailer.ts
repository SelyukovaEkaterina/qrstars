import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpSecure =
  process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1" || smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "QrStars.ru <noreply@qrstars.ru>",
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

export function sendWelcomeEmail(to: string, password: string, establishmentName: string) {
  return sendMail(
    to,
    `Добро пожаловать в QrStars.ru! — ${establishmentName}`,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e;">Ваша табличка QrStars.ru активирована!</h1>
      <p>Заведение: <strong>${establishmentName}</strong></p>
      <p>Для входа в личный кабинет:</p>
      <ul>
        <li>Email: <strong>${to}</strong></li>
        <li>Пароль: <strong>${password}</strong></li>
      </ul>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">
        Войти в кабинет
      </a>
      <p style="color:#666;margin-top:24px;font-size:12px;">Рекомендуем сменить пароль после первого входа.</p>
    </div>
    `
  );
}

export function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendMail(
    to,
    "Восстановление пароля — QrStars.ru",
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e;">Восстановление пароля</h1>
      <p>Вы запросили сброс пароля для аккаунта <strong>${to}</strong>.</p>
      <p>Нажмите на кнопку ниже, чтобы задать новый пароль. Ссылка действительна 1 час.</p>
      <a href="${resetUrl}"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">
        Сбросить пароль
      </a>
      <p style="color:#666;margin-top:24px;font-size:12px;">Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
    </div>
    `
  );
}

export function sendNegativeReviewNotification(
  to: string,
  establishmentName: string,
  rating: number,
  comment: string,
  guestName?: string
) {
  return sendMail(
    to,
    `⚠️ Негативный отзыв — ${establishmentName} (${rating}★)`,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc2626;">Получен негативный отзыв</h2>
      <p><strong>Заведение:</strong> ${establishmentName}</p>
      <p><strong>Оценка:</strong> ${rating} из 5 ★</p>
      ${guestName ? `<p><strong>Имя гостя:</strong> ${guestName}</p>` : ""}
      <p><strong>Комментарий:</strong></p>
      <div style="background:#fef2f2;padding:16px;border-radius:8px;border-left:4px solid #dc2626;">
        ${comment || "Без комментария"}
      </div>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">
        Открыть кабинет
      </a>
    </div>
    `
  );
}
