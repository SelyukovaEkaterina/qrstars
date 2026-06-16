import { sendMail } from "@/lib/mailer";
import { formatRub } from "@/lib/plans";
import { SUBSCRIPTION_PAGE_URL } from "@/lib/legal-urls";

export async function sendRenewalNoticeEmail(params: {
  to: string;
  amount: number;
  chargeDate: Date;
  planLabel: string;
}) {
  const dateStr = params.chargeDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return sendMail(
    params.to,
    `QrStars: предстоящее списание ${formatRub(params.amount)}`,
    `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Напоминание о продлении подписки</h2>
      <p>Через 3 дня будет автоматически списано <strong>${formatRub(params.amount)}</strong>
      за тариф <strong>${params.planLabel}</strong>.</p>
      <p>Дата списания: <strong>${dateStr}</strong> (ориентировочно 06:00 МСК).</p>
      <p>Если вы не хотите продлевать подписку, отмените её в личном кабинете до этой даты:</p>
      <p><a href="${SUBSCRIPTION_PAGE_URL}" style="color: #4f46e5;">Отменить автопродление</a></p>
      <p style="color: #666; font-size: 13px;">QrStars.ru · support@qrstars.ru</p>
    </div>
    `
  );
}

export async function sendPriceChangeNoticeEmail(params: {
  to: string;
  previousAmount: number;
  newAmount: number;
  chargeDate: Date;
  planLabel: string;
}) {
  const dateStr = params.chargeDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return sendMail(
    params.to,
    `QrStars: изменение суммы списания — ${formatRub(params.newAmount)}`,
    `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Изменение суммы автоматического списания</h2>
      <p>
        Сумма очередного списания по тарифу <strong>${params.planLabel}</strong> изменится:
        <strong>${formatRub(params.previousAmount)}</strong> → <strong>${formatRub(params.newAmount)}</strong>.
      </p>
      <p>Дата списания: <strong>${dateStr}</strong> (ориентировочно 06:00 МСК).</p>
      <p>
        Если вы не согласны с новой суммой, отмените автопродление в личном кабинете до этой даты.
        Доступ к платным функциям сохранится до конца уже оплаченного периода.
      </p>
      <p><a href="${SUBSCRIPTION_PAGE_URL}" style="color: #4f46e5;">Управление подпиской</a></p>
      <p style="color: #666; font-size: 13px;">QrStars.ru · support@qrstars.ru</p>
    </div>
    `
  );
}

export async function sendPlatformTariffChangeEmail(params: {
  to: string;
  planLabel: string;
  amount: number;
  effectiveDate: Date;
  message?: string | null;
}) {
  const dateStr = params.effectiveDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const extra = params.message
    ? `<p>${params.message}</p>`
    : `<p>Актуальные цены опубликованы на странице тарифов в личном кабинете.</p>`;

  return sendMail(
    params.to,
    `QrStars: изменение тарифов с ${dateStr}`,
    `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Изменение стоимости тарифов</h2>
      <p>
        С <strong>${dateStr}</strong> изменяется стоимость тарифа <strong>${params.planLabel}</strong>.
        При следующем автоматическом списании будет списано <strong>${formatRub(params.amount)}</strong>.
      </p>
      ${extra}
      <p>Вы можете отменить автопродление до даты изменения:</p>
      <p><a href="${SUBSCRIPTION_PAGE_URL}" style="color: #4f46e5;">Управление подпиской</a></p>
      <p style="color: #666; font-size: 13px;">QrStars.ru · support@qrstars.ru</p>
    </div>
    `
  );
}

export async function sendRenewalFailedEmail(params: {
  to: string;
  planLabel: string;
}) {
  return sendMail(
    params.to,
    "QrStars: подписка отменена — не удалось списать оплату",
    `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Подписка ${params.planLabel} отменена</h2>
      <p>Не удалось списать оплату за продление после нескольких попыток. Доступ к платным функциям прекращён.</p>
      <p>Вы можете оформить подписку заново в любой момент:</p>
      <p><a href="${SUBSCRIPTION_PAGE_URL}" style="color: #4f46e5;">Перейти к тарифам</a></p>
    </div>
    `
  );
}
