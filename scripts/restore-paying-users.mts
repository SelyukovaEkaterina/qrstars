#!/usr/bin/env tsx
/**
 * Авария Beget 2026-11-02: заводит платных клиентов в новую базу с действующим
 * PRO/«Сеть» и пишет файл с готовыми письмами (личная ссылка «задать пароль»
 * + инструкция по восстановлению QR). SMTP Beget лежит, поэтому письма владелец
 * рассылает вручную из своей почты.
 *
 * Вход — JSON без ПД в репозитории:
 *   [{ "email": "...", "name": "Имя Фамилия", "phone": "...", "plan": "PRO", "billing": "yearly", "paidAt": "2026-10-21" }]
 *
 * Запуск (внутри контейнера):
 *   npx tsx scripts/restore-paying-users.mts --in /tmp/paying-customers.json --out /tmp/restore-emails.txt
 *   --dry-run — без записи в базу, ссылки-заглушки (посмотреть текст писем)
 *   --link-days 14 — срок ссылки «задать пароль»
 *
 * Повторный запуск безопасен: пользователь и подписка не дублируются,
 * выдаётся новая ссылка (старые гасятся).
 */
import fs from "node:fs";
import crypto from "node:crypto";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}
const IN = arg("in");
const OUT = arg("out", "/tmp/restore-emails.txt")!;
const DRY = process.argv.includes("--dry-run");
const LINK_DAYS = parseInt(arg("link-days", "14")!, 10);
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "https://app.qrstars.ru").replace(/\/$/, "");
const NEWS_URL = "https://www.rbc.ru/technology_and_media/02/11/2026/6ae8876e2273f59e1557a612";

if (!IN) {
  console.error("Укажите --in путь к JSON со списком клиентов");
  process.exit(1);
}

type Payer = {
  email: string;
  name?: string | null;
  phone?: string | null;
  plan: "PRO" | "NETWORK";
  billing: "yearly" | "monthly";
  paidAt: string;
};

const payers: Payer[] = JSON.parse(fs.readFileSync(IN, "utf8"));

/** «8 октября 2027 года» — без «г.», чтобы не было двойной точки в конце предложения. */
const dateRu = (d: Date) =>
  d
    .toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" })
    .replace(/\s?г\.$/, " года");

function periodEnd(p: Payer): Date {
  const end = new Date(`${p.paidAt}T00:00:00+03:00`);
  if (p.billing === "monthly") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}

function renderEmail(p: Payer, resetUrl: string, linkExpires: Date): string {
  const firstName = p.name?.trim().split(/\s+/)[0];
  return `Кому: ${p.email}
Тема: QrStars: 3 шага, чтобы ваш QR снова заработал

${firstName ? `Здравствуйте, ${firstName}!` : "Здравствуйте!"}

2 ноября у нашего хостинг-провайдера Beget произошла крупная авария: ${NEWS_URL}
Вместе с серверами пропали данные личных кабинетов, в том числе настройки ваших QR-кодов. Поэтому сейчас при сканировании открывается страница «Редирект временно недоступен». Нам очень жаль, что так вышло.

Мы ждём от Beget доступ к резервным копиям, но до сих пор его не получили. Поэтому мы запустились в аварийном режиме — чтобы вы могли восстановить свои QR-коды, не дожидаясь Beget.

Хорошая новость: напечатанные таблички и QR-коды перепечатывать не нужно — они заработают, как только вы их восстановите.

ШАГ 1. Задайте пароль от кабинета
Откройте вашу личную ссылку и придумайте пароль:
${resetUrl}
Ссылка действует до ${dateRu(linkExpires)}. Логин — ${p.email}.
Если раньше вы входили через Яндекс ID или VK с этим же email, можно просто нажать соответствующую кнопку на ${BASE}/login.

ШАГ 2. Узнайте ID своего QR-кода
ID — это короткий ключ из 6 символов, например ab3k9z. Как его найти:
• Отсканируйте свою табличку или QR-код камерой телефона. Откроется страница «К сожалению, редирект временно недоступен», на ней крупно написано «ID кода: …».
• Таблички нет под рукой? Отсканируйте QR с экрана — из PDF, картинки или макета, который вы скачивали из кабинета.
• Если у вас сохранилась ссылка вида ${BASE}/q/ab3k9z — ID это часть после «/q/».

ШАГ 3. Восстановите QR в кабинете
Откройте ${BASE}/dashboard/restore — или нажмите оранжевую кнопку «Восстановить QR» в меню кабинета (она же есть на странице из шага 2).
1) Введите ID кода (можно вставить и всю ссылку целиком).
2) Укажите название проекта — например, название вашего заведения.
3) Если QR вёл на сайт или в соцсеть — вставьте эту ссылку. Если он показывал меню, визитку, отзывы или Wi-Fi — оставьте поле пустым.
4) Нажмите «Восстановить QR». Если ссылку вы не указали, нажмите «Выбрать, что показывать» и настройте QR заново.

Несколько QR-кодов? Повторите шаги 2 и 3 для каждого.

Логотипы, фото блюд и загруженные файлы, к сожалению, тоже не сохранились — их нужно будет загрузить заново.

Если что-то не получается или кабинет пишет, что код уже занят, — просто ответьте на это письмо, поможем вручную.

Ещё раз извините за неудобства.
Команда QrStars
`;
}

async function main() {
  const linkExpires = new Date(Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000);
  const letters: string[] = [];

  if (DRY) {
    for (const p of payers) {
      letters.push(renderEmail(p, `${BASE}/reset-password?token=ССЫЛКА-ПОЯВИТСЯ-ПОСЛЕ-ЗАПУСКА-НА-СЕРВЕРЕ`, linkExpires));
    }
  } else {
    const { prisma } = await import("../src/lib/prisma");
    const { ensureDefaultEmailContact } = await import("../src/lib/owner-messenger-notify");
    const { normalizeInviteEmail } = await import("../src/lib/establishment-access");

    for (const p of payers) {
      const email = normalizeInviteEmail(p.email);
      const start = new Date(`${p.paidAt}T00:00:00+03:00`);
      const end = periodEnd(p);

      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name: p.name || null,
          phone: p.phone || null,
          registrationSource: "beget_restore",
          firstPaidAccessAt: start,
        },
      });
      if (!user.firstPaidAccessAt) {
        await prisma.user.update({ where: { id: user.id }, data: { firstPaidAccessAt: start } });
      }
      await ensureDefaultEmailContact(user.id, email);

      const hasSub = await prisma.subscription.findFirst({
        // Любой активный платный тариф: владельцу могли поднять PRO до «Сети» вручную.
        where: { userId: user.id, status: "ACTIVE", plan: { in: ["PRO", "NETWORK"] } },
        select: { id: true },
      });
      if (!hasSub && end > new Date()) {
        // Без parentInvoiceId: крон не пытается списать, подписка гаснет в конце оплаченного периода.
        await prisma.subscription.create({
          data: {
            userId: user.id,
            status: "ACTIVE",
            plan: p.plan,
            billing: p.billing,
            currentPeriodStart: start,
            currentPeriodEnd: end,
          },
        });
      }

      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: { token, user: { connect: { id: user.id } }, expiresAt: linkExpires },
      });

      letters.push(renderEmail(p, `${BASE}/reset-password?token=${token}`, linkExpires));
      console.log(`ok ${email} ${p.plan} до ${end.toISOString().slice(0, 10)}${end <= new Date() ? " (период истёк — подписка не создана)" : ""}`);
    }
    await prisma.$disconnect();
  }

  const sep = "\n" + "=".repeat(72) + "\n\n";
  fs.writeFileSync(OUT, letters.join(sep));
  console.log(`Писем: ${letters.length} → ${OUT}${DRY ? " (dry-run, база не тронута)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
