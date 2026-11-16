#!/usr/bin/env tsx
/**
 * Рассылка о сайте для компьютера и сайте-визитке (2026-11-15).
 *
 * Сегменты (по проекту владельца):
 *   paying_microsite — PRO/«Сеть» с QR-микросайтом: «ваш микросайт теперь ещё и сайт»;
 *   paying_card      — PRO/«Сеть» с визиткой без микросайта: «ваша визитка теперь сайт»;
 *   paying_other     — остальные платящие: «в PRO появился сайт для компьютера»;
 *   free_card        — FREE с визиткой: «ваша визитка уже стала сайтом, бесплатно» + адрес и шаблоны на PRO;
 *   free_business    — FREE с заполненным проектом (≥2 из: адрес, телефон, часы, логотип/обложка,
 *                      меню ≥5 позиций, свои страницы): «посмотрите сайт вашего заведения» → превью.
 * Пустые FREE-проекты и отписавшиеся (`marketingEmailsEnabled = false`) не получают письмо.
 * FREE сортируются по числу сканов — сначала самые активные.
 *
 * По умолчанию — превью: ничего не отправляет, пишет счётчики и HTML писем в --out.
 *   npx tsx scripts/announce-desktop-site.mts                                  # превью всех сегментов
 *   npx tsx scripts/announce-desktop-site.mts --test you@mail.ru               # все варианты себе (примерные данные)
 *   npx tsx scripts/announce-desktop-site.mts --send --segments free_card,free_business --limit-per-segment 10
 *
 * Повторный запуск безопасен: отправленное помечается в UserLifecycleEmail (одна кампания на все сегменты).
 */
import fs from "node:fs";
import path from "node:path";

const CAMPAIGN = "announce_desktop_site_2026_11";
const SEGMENTS = ["paying_microsite", "paying_card", "paying_other", "free_card", "free_business"] as const;
type Segment = (typeof SEGMENTS)[number];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const SEND = process.argv.includes("--send");
const TEST_TO = arg("test");
const OUT = arg("out") ?? "/tmp/announce-desktop-site";
const LIMIT_PER_SEGMENT = arg("limit-per-segment") ? parseInt(arg("limit-per-segment")!, 10) : Infinity;
const ONLY = arg("segments")
  ? (arg("segments")!.split(",").map((s) => s.trim()) as Segment[])
  : [...SEGMENTS];
for (const s of ONLY) {
  if (!SEGMENTS.includes(s)) {
    console.error(`Неизвестный сегмент: ${s}. Доступны: ${SEGMENTS.join(", ")}`);
    process.exit(1);
  }
}

interface Recipient {
  userId: string;
  email: string;
  segment: Segment;
  projectId: string | null;
  projectName: string | null;
  shortSlug: string | null;
  /** Код QR микросайта / визитки — публичная ссылка, если нет короткого адреса. */
  publicCode: string | null;
  /** Имя мастера — для подсказки короткого адреса. */
  cardName: string | null;
  scans: number;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { renderEmailLayout, featureBlock, marketingUnsubscribeUrl } = await import("../src/lib/email-layout");
  const { sendMail } = await import("../src/lib/mailer");
  const { getBaseUrl } = await import("../src/lib/signed-user-token");
  const { PLAN_PRICING, formatRub } = await import("../src/lib/plans");
  const { suggestMicrositeSlug } = await import("../src/lib/microsite-host");
  const base = getBaseUrl();
  const proFrom = formatRub(PLAN_PRICING.PRO.halfYearRub);

  const subs = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      plan: { in: ["PRO", "NETWORK"] },
      isTrial: false,
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
    },
    select: { userId: true },
  });
  const payingIds = new Set(subs.map((s) => s.userId));

  // Все платящие и все, у кого есть хотя бы один свой проект с активным QR.
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: [...payingIds] } },
        { establishments: { some: { qrcodes: { some: { isActive: true } } } } },
      ],
    },
    select: {
      id: true,
      email: true,
      marketingEmailsEnabled: true,
      lifecycleEmails: { where: { campaignKey: CAMPAIGN }, select: { id: true } },
      establishments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          shortSlug: true,
          address: true,
          phone: true,
          workingHours: true,
          logoUrl: true,
          coverUrl: true,
          businessCard: { select: { fullName: true } },
          menu: { select: { _count: { select: { items: true } } } },
          _count: { select: { customPages: true } },
          qrcodes: {
            where: { isActive: true },
            select: { code: true, mode: true, scansCount: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  const stats = { users: users.length, paying: 0, optedOut: 0, alreadySent: 0, emptyFree: 0 };
  const all: Recipient[] = [];
  for (const u of users) {
    const paying = payingIds.has(u.id);
    if (paying) stats.paying++;
    if (!u.email) continue;
    if (!u.marketingEmailsEnabled) {
      stats.optedOut++;
      continue;
    }
    if (u.lifecycleEmails.length) {
      stats.alreadySent++;
      continue;
    }
    const scans = u.establishments.reduce((sum, e) => sum + e.qrcodes.reduce((s, q) => s + q.scansCount, 0), 0);
    const withLanding = u.establishments.find((e) => e.qrcodes.some((q) => q.mode === "LANDING"));
    const withCard = u.establishments.find((e) => e.businessCard && e.qrcodes.some((q) => q.mode === "BUSINESS_CARD"));
    const filled = (e: (typeof u.establishments)[number]) =>
      [
        !!e.address?.trim(),
        !!e.phone?.trim(),
        !!e.workingHours,
        !!(e.logoUrl || e.coverUrl),
        (e.menu?._count.items ?? 0) >= 5,
        e._count.customPages > 0,
      ].filter(Boolean).length;

    let segment: Segment;
    let project: (typeof u.establishments)[number] | undefined;
    if (paying) {
      project = withLanding ?? withCard ?? u.establishments[0];
      segment = withLanding ? "paying_microsite" : withCard ? "paying_card" : "paying_other";
    } else if (withCard && !withLanding) {
      project = withCard;
      segment = "free_card";
    } else {
      project = [...u.establishments].sort((a, b) => filled(b) - filled(a))[0];
      if (!project || filled(project) < 2) {
        stats.emptyFree++;
        continue;
      }
      segment = "free_business";
    }

    const publicMode = segment === "paying_microsite" ? "LANDING" : "BUSINESS_CARD";
    all.push({
      userId: u.id,
      email: u.email,
      segment,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      shortSlug: project?.shortSlug ?? null,
      publicCode: project?.qrcodes.find((q) => q.mode === publicMode)?.code ?? null,
      cardName: project?.businessCard?.fullName ?? null,
      scans,
    });
  }

  const linkStyle = "color:#4f46e5;font-weight:600;text-decoration:none;";

  function utm(url: string, segment: Segment, content: string): string {
    const u = new URL(url);
    u.searchParams.set("utm_source", "email");
    u.searchParams.set("utm_medium", "lifecycle");
    u.searchParams.set("utm_campaign", "desktop_site");
    u.searchParams.set("utm_content", `${segment}_${content}`);
    return u.toString();
  }

  function render(r: Recipient): { subject: string; html: string } {
    const seg = r.segment;
    const previewUrl = utm(
      r.projectId ? `${base}/site-preview/${r.projectId}` : `${base}/q/demo-landing`,
      seg,
      "preview"
    );
    const slugUrl = r.shortSlug ? utm(`https://${r.shortSlug}.qrstars.ru`, seg, "site") : null;
    // Владелец открывает свой QR — `owner=1`, чтобы переход не засчитался сканом.
    const codeUrl = r.publicCode ? utm(`${base}/q/${r.publicCode}?owner=1`, seg, "site") : null;
    const publicUrl = slugUrl ?? codeUrl;
    const address =
      r.shortSlug && slugUrl ? `<a href="${slugUrl}" style="${linkStyle}">${escapeHtml(r.shortSlug)}.qrstars.ru</a>` : null;
    const settingsLine = `<p style="margin:20px 0 0;font-size:14px;color:#6b7280;">Сменить шаблон и посмотреть версию для телефона: <a href="${previewUrl}" style="${linkStyle}">превью в кабинете</a>.</p>`;
    const examplesLine = `<p style="margin:20px 0 0;font-size:15px;color:#374151;">Посмотрите, как это выглядит, — откройте с компьютера пример:
      <a href="${utm(`${base}/q/demo-landing`, seg, "example")}" style="${linkStyle}">кофейня</a>,
      <a href="${utm(`${base}/q/demo2-landing`, seg, "example")}" style="${linkStyle}">шиномонтаж</a>,
      <a href="${utm(`${base}/q/demo3-landing`, seg, "example")}" style="${linkStyle}">стоматология</a>.
      Внизу страницы можно переключать шаблоны.</p>`;
    const cta = publicUrl
      ? { label: "Открыть свой сайт", href: publicUrl }
      : { label: "Посмотреть свой сайт", href: previewUrl };

    if (seg === "paying_microsite") {
      return {
        subject: "Ваш микросайт теперь открывается как сайт для компьютера",
        html: renderEmailLayout({
          userId: r.userId,
          preheader: "Тот же адрес, ничего настраивать не нужно — 4 шаблона на выбор",
          title: "Ваш микросайт — теперь ещё и сайт",
          bodyHtml: `
            <p>Здравствуйте!</p>
            <p>Мы добавили в PRO сайт для компьютера. На телефоне гости по-прежнему видят удобный микросайт, а если открыть ту же ссылку с компьютера — откроется полноценный сайт вашего бизнеса: первый экран с фото, меню, услуги, отзывы, контакты и часы работы.</p>
            <p>Сайт уже работает: он собран из того, что вы заполнили в микросайте. Делать ничего не нужно.</p>
            ${featureBlock("4 шаблона на выбор", "«Витрина», «Классика», «Журнал» и «Контраст». Сайт сам перекрашивается в ваш фирменный цвет, есть светлая и тёмная тема. Сравнить шаблоны на своих данных можно в превью.")}
            ${featureBlock(
              "Ссылку можно поставить в Яндекс Карты и 2ГИС",
              address
                ? `Ваш адрес ${address} подходит для поля «Сайт» в карточке на картах — клиенты с компьютера увидят нормальный сайт, а не страничку для телефона.`
                : "Задайте короткий адрес вида <b>vashe-kafe.qrstars.ru</b> в редакторе микросайта и поставьте его в поле «Сайт» в карточке на картах."
            )}
            <p style="margin:20px 0 0;">Откройте ссылку с компьютера — увидите сайт; с телефона — привычный микросайт.</p>
            ${publicUrl ? settingsLine : examplesLine}`,
          cta,
        }),
      };
    }

    if (seg === "paying_card") {
      return {
        subject: "Ваша визитка теперь открывается как сайт",
        html: renderEmailLayout({
          userId: r.userId,
          preheader: "Фото, услуги и цены, отзывы и форма заявки — на большом экране",
          title: "Ваша визитка — теперь сайт",
          bodyHtml: `
            <p>Здравствуйте!</p>
            <p>Ссылку на визитку часто открывают с компьютера — из Авито, ВКонтакте, Профи.ру. Теперь там открывается не маленькая карточка, а одностраничный сайт: фото, услуги и цены, отзывы, форма заявки и контакты.</p>
            <p>Сайт уже работает и собран из вашей визитки. Заявки с него приходят туда же, куда и раньше.</p>
            ${featureBlock("4 шаблона на PRO", "«Витрина», «Классика», «Журнал» и «Контраст» — выберите подачу в редакторе визитки. На вашем тарифе сайт без плашки QrStars.")}
            ${featureBlock(
              "Свой адрес",
              address
                ? `Ваш адрес ${address} — поставьте его в профиль на Авито и в соцсетях: с телефона откроется визитка, с компьютера — сайт.`
                : "Задайте короткий адрес вида <b>ivan-elektrik.qrstars.ru</b> в редакторе визитки — его удобно ставить в профиль на Авито и в соцсетях."
            )}
            ${publicUrl ? settingsLine : examplesLine}`,
          cta,
        }),
      };
    }

    if (seg === "free_card") {
      const suggestion = suggestMicrositeSlug(r.cardName);
      const suggested = suggestion && suggestion.length >= 2 ? suggestion : "ivan-elektrik";
      return {
        subject: "Ваша визитка теперь открывается как сайт — бесплатно",
        html: renderEmailLayout({
          userId: r.userId,
          preheader: "Та же ссылка: с телефона — визитка, с компьютера — сайт мастера",
          title: "Ваша визитка — теперь и сайт",
          bodyHtml: `
            <p>Здравствуйте!</p>
            <p>Ссылку на визитку часто открывают с компьютера — из Авито, ВКонтакте, Профи.ру. Теперь по ней открывается не маленькая карточка, а одностраничный сайт: фото, услуги и цены, отзывы, форма заявки и контакты.</p>
            <p>Это уже работает и бесплатно — по той же ссылке, что зашита в ваш QR-код. Заявки с сайта приходят туда же, куда и раньше.</p>
            ${featureBlock(
              "Свой адрес и 4 шаблона — на PRO",
              `Ваш адрес мог бы быть <b>${escapeHtml(suggested)}.qrstars.ru</b> — короче и солиднее, его легко продиктовать и поставить в профиль на Авито. Плюс 4 шаблона на выбор и сайт без плашки QrStars. PRO — от ${proFrom} за полгода.`
            )}
            ${publicUrl ? settingsLine : examplesLine}`,
          cta,
        }),
      };
    }

    if (seg === "free_business") {
      const projectName = r.projectName?.trim();
      // Название уже может быть в кавычках («Кофейня «Бобр»») — тогда не оборачиваем.
      const shown = projectName ? (/[«"]/.test(projectName) ? projectName : `«${projectName}»`) : null;
      return {
        subject: shown ? `${shown} — мы собрали ваш сайт` : "Мы собрали сайт вашего заведения",
        html: renderEmailLayout({
          userId: r.userId,
          preheader: "Из того, что вы уже заполнили, — 4 шаблона, ваш цвет, посмотрите за минуту",
          title: shown ? `${escapeHtml(shown)}: ваш сайт уже готов` : "Ваш сайт уже готов",
          bodyHtml: `
            <p>Здравствуйте!</p>
            <p>Из того, что вы уже заполнили в QrStars, — название, адрес, часы, меню — получился сайт для компьютера. Посмотрите его в превью: 4 шаблона, ваш фирменный цвет, светлая и тёмная тема.</p>
            ${featureBlock(
              "Что даёт PRO",
              `Микросайт по QR для телефона и полноценный сайт по той же ссылке для компьютера. Короткий адрес вида <b>vashe-kafe.qrstars.ru</b> — для поля «Сайт» в Яндекс Картах и 2ГИС. Без плашки QrStars. PRO — от ${proFrom} за полгода.`
            )}
            ${examplesLine}`,
          cta: { label: "Посмотреть свой сайт", href: previewUrl },
        }),
      };
    }

    return {
      subject: "В PRO появился сайт для компьютера",
      html: renderEmailLayout({
        userId: r.userId,
        preheader: "Микросайт по QR — и полноценный сайт по той же ссылке",
        title: "Сайт для вашего бизнеса — уже в вашем тарифе",
        bodyHtml: `
          <p>Здравствуйте!</p>
          <p>В PRO появился сайт для компьютера. Соберите микросайт — страницу со всеми разделами в одном QR: меню, контакты, отзывы, Wi‑Fi. С телефона гости увидят микросайт, а с компьютера та же ссылка откроет полноценный сайт вашего бизнеса.</p>
          ${featureBlock("Ничего не нужно заполнять дважды", "Сайт собирается сам из микросайта. 4 шаблона, ваш фирменный цвет и короткий адрес вида <b>vashe-kafe.qrstars.ru</b> — всё входит в тариф.")}
          ${examplesLine}`,
        cta: {
          label: "Собрать микросайт",
          href: utm(r.projectId ? `${base}/dashboard/projects/${r.projectId}/page` : `${base}/dashboard`, seg, "build"),
        },
      }),
    };
  }

  // Отбор: выбранные сегменты, самые активные первыми, лимит на сегмент.
  const available = Object.fromEntries(SEGMENTS.map((s) => [s, 0])) as Record<Segment, number>;
  all.forEach((r) => available[r.segment]++);
  const chosen: Recipient[] = [];
  for (const segment of ONLY) {
    chosen.push(
      ...all
        .filter((r) => r.segment === segment)
        .sort((a, b) => b.scans - a.scans)
        .slice(0, LIMIT_PER_SEGMENT)
    );
  }
  const chosenBySegment = Object.fromEntries(ONLY.map((s) => [s, chosen.filter((r) => r.segment === s).length]));
  console.log(
    JSON.stringify(
      { campaign: CAMPAIGN, ...stats, available, chosen: chosenBySegment, mode: SEND ? "send" : TEST_TO ? "test" : "preview" },
      null,
      2
    )
  );

  fs.mkdirSync(OUT, { recursive: true });
  for (const segment of ONLY) {
    // Тест — на примерных данных, без адреса и ссылки отписки реального клиента.
    const fake: Recipient = {
      userId: "test-preview",
      email: TEST_TO ?? "",
      segment,
      projectId: null,
      projectName: segment === "free_business" ? "Кофейня «Бобр»" : null,
      shortSlug: segment === "paying_microsite" ? "demo" : null,
      publicCode: segment === "paying_card" || segment === "free_card" ? "demo-master" : null,
      cardName: segment === "free_card" ? "Сергей Петров" : null,
      scans: 0,
    };
    // Файл превью — на первом реальном получателе сегмента (для просмотра на сервере).
    const sample = chosen.find((r) => r.segment === segment) ?? fake;
    const { subject, html } = render(sample);
    fs.writeFileSync(path.join(OUT, `${segment}.html`), html);
    console.log(`preview ${segment}: «${subject}» → ${path.join(OUT, `${segment}.html`)}`);
    if (TEST_TO) {
      const testMail = render(fake);
      const ok = await sendMail(TEST_TO, `[тест] ${testMail.subject}`, testMail.html, { kind: "lifecycle" });
      console.log(`test ${segment} → ${ok ? "sent" : "FAILED"}`);
    }
  }

  if (!SEND) {
    await prisma.$disconnect();
    return;
  }

  let sent = 0;
  let failed = 0;
  const sentBySegment: Record<string, number> = {};
  for (const r of chosen) {
    // Сначала помечаем — при повторном запуске письмо не уйдёт дважды.
    try {
      await prisma.userLifecycleEmail.create({ data: { userId: r.userId, campaignKey: CAMPAIGN } });
    } catch {
      continue;
    }
    const { subject, html } = render(r);
    const ok = await sendMail(r.email, subject, html, {
      kind: "lifecycle",
      listUnsubscribeUrl: marketingUnsubscribeUrl(r.userId),
    });
    if (ok) {
      sent++;
      sentBySegment[r.segment] = (sentBySegment[r.segment] ?? 0) + 1;
    } else {
      failed++;
      await prisma.userLifecycleEmail.deleteMany({ where: { userId: r.userId, campaignKey: CAMPAIGN } });
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  console.log(JSON.stringify({ sent, failed, sentBySegment }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
