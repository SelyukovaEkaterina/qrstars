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
  if (process.env.E2E_TESTING === "true") {
    return true;
  }
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

export function sendEstablishmentInviteEmail(
  to: string,
  inviterName: string,
  establishmentName: string,
  registerUrl: string
) {
  return sendMail(
    to,
    `Приглашение в заведение «${establishmentName}» — QrStars.ru`,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e;">Вас пригласили в команду</h1>
      <p><strong>${inviterName}</strong> приглашает вас управлять заведением <strong>${establishmentName}</strong> в QrStars.ru.</p>
      <p>Зарегистрируйтесь по ссылке ниже — после регистрации заведение появится в вашем личном кабинете.</p>
      <a href="${registerUrl}"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">
        Принять приглашение
      </a>
      <p style="color:#666;margin-top:24px;font-size:12px;">Если вы не ожидали это письмо, проигнорируйте его.</p>
    </div>
    `
  );
}

export function sendEstablishmentAccessGrantedEmail(
  to: string,
  inviterName: string,
  establishmentName: string,
  dashboardUrl: string
) {
  return sendMail(
    to,
    `Доступ к заведению «${establishmentName}» — QrStars.ru`,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e;">Вам открыт доступ</h1>
      <p><strong>${inviterName}</strong> добавил вас в команду заведения <strong>${establishmentName}</strong>.</p>
      <a href="${dashboardUrl}"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">
        Открыть личный кабинет
      </a>
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Ответ оператора из Telegram-форума → email клиенту (дубль ЛК). */
export function sendSupportStaffReplyEmail(
  to: string,
  body: string,
  opts?: { attachmentUrl?: string | null; attachmentName?: string | null }
) {
  const supportUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.qrstars.ru"}/dashboard/support`;
  const safeBody = escapeHtml(body).replace(/\n/g, "<br>");
  const attachmentBlock =
    opts?.attachmentUrl && opts.attachmentName
      ? `<p style="margin:16px 0 0;">
           <a href="${escapeHtml(opts.attachmentUrl)}"
              style="color:#4f46e5;text-decoration:underline;">
             📎 ${escapeHtml(opts.attachmentName)}
           </a>
         </p>`
      : "";

  return sendMail(
    to,
    "Ответ службы поддержки — QrStars.ru",
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e;">Ответ службы поддержки</h1>
      <p>В вашем обращении появился новый ответ:</p>
      <div style="background:#f9fafb;padding:16px;border-radius:8px;border-left:4px solid #4f46e5;margin:16px 0;color:#1f2937;line-height:1.6;">
        ${safeBody}
        ${attachmentBlock}
      </div>
      <a href="${supportUrl}"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;margin-top:8px;">
        Открыть чат в кабинете
      </a>
      <p style="color:#666;margin-top:24px;font-size:12px;">Ответить можно в личном кабинете → Поддержка.</p>
    </div>
    `
  );
}

export function sendPromoSurveyEmail(to: string, surveyUrl: string) {
  return sendMail(
    to,
    "Подарок от QrStars: PRO-тариф на 3 месяца за ваше мнение 🎁",
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e; margin-bottom: 16px;">Дарим PRO-тариф за вашу обратную связь!</h1>
      <p style="font-size: 16px; color: #4b5563; line-height: 1.5; margin-bottom: 16px;">
        Здравствуйте! Вы зарегистрировались в QrStars более недели назад. Мы постоянно улучшаем наш сервис и нам очень важно ваше мнение.
      </p>
      <p style="font-size: 16px; color: #4b5563; line-height: 1.5; margin-bottom: 24px;">
        Пройдите короткий опрос — он займёт не более двух минут. В благодарность мы <strong>бесплатно активируем PRO-тариф на 3 месяца</strong> для вашего аккаунта или продлим его, если он уже подключён.
      </p>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${surveyUrl}"
           style="display:inline-block;padding:14px 28px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight: bold; font-size: 16px;">
          Пройти опрос и получить PRO
        </a>
      </div>
      <p style="color:#9ca3af;margin-top:32px;font-size:12px; text-align: center;">
        Это единоразовая акция. Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
        <a href="${surveyUrl}" style="color: #6b7280;">${surveyUrl}</a>
      </p>
    </div>
    `
  );
}
