import { PLANS } from "@/lib/plans";
import { renderEmailLayout, featureBlock, bulletList } from "@/lib/email-layout";
import { createSignedFeedbackToken, getBaseUrl } from "@/lib/signed-user-token";
import type { LifecycleUserState } from "@/lib/lifecycle-email-state";

function greeting(state: LifecycleUserState): string {
  return state.name ? `${state.name}, здравствуйте!` : "Здравствуйте!";
}

export function renderWelcomeEmail(state: LifecycleUserState): string {
  const base = getBaseUrl();
  const freeFeatures = PLANS.FREE.features.slice(0, 5);
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Сбор отзывов, микролендинг и QR-меню — бесплатно навсегда",
    title: "Добро пожаловать в QrStars!",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        <strong>QrStars</strong> помогает перехватывать негатив до его публикации на Яндекс Картах и направлять довольных гостей оставлять отзывы.
      </p>
      ${featureBlock("⭐ Сбор отзывов 1–5★", "При низких оценках жалоба отправляется вам, а при высоких — гость направляется на Яндекс или 2GIS. Всё настраивается под ваш бизнес.")}
      ${featureBlock("📱 Микролендинг", "Меню, Wi‑Fi, визитка и формы обратной связи — всё на одной удобной странице по QR-коду.")}
      ${featureBlock("🖨 Шаблоны для печати", "Готовые макеты тейбл-тентов и наклеек — скачайте PDF, распечатайте и поставьте на стол.")}
      <p style="margin:20px 0 8px;font-weight:600;color:#111827;">На бесплатном тарифе FREE вам уже доступны:</p>
      ${bulletList(freeFeatures)}
    `,
    cta: { label: "Создать первый QR-код", href: `${base}/dashboard/start` },
  });
}

export function renderNoEstablishmentD1Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  return renderEmailLayout({
    userId: state.userId,
    preheader: "3 минуты — и первый QR-код готов",
    title: "3 минуты до первого QR-кода — начнём?",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Вы зарегистрировались в QrStars, но ещё не добавили своё заведение. Мастер быстрого старта поможет всё настроить буквально за пару минут:
      </p>
      ${bulletList([
        "Указать название заведения и ссылку на Яндекс Карты",
        "Создать первый QR-код для сбора отзывов или микролендинга",
        "Скачать готовый PNG-файл для печати",
      ])}
    `,
    cta: { label: "Запустить мастер настройки", href: `${base}/dashboard/start` },
  });
}

export function renderNoEstablishmentD3Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Узнавайте о негативе до его публикации на картах",
    title: "Гости уходят недовольными, а вы об этом даже не узнаете",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        По статистике, большинство недовольных клиентов не жалуются лично — они сразу пишут негативные отзывы на Яндекс Картах или в 2GIS.
        QrStars помогает перехватывать негатив на месте: если гость ставит оценку 1–3★, жалоба приходит лично вам, а не публикуется в интернете.
      </p>
      <p style="font-size:16px;color:#374151;">
        Настройка заведения занимает всего 3 минуты. На бесплатном тарифе нет ограничений по количеству создаваемых QR-кодов.
      </p>
    `,
    cta: { label: "Настроить QrStars за 3 минуты", href: `${base}/dashboard/start` },
  });
}

export function renderNoQrD1Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Создайте первый QR-код, чтобы гости могли его сканировать",
    title: "Заведение готово — создайте первый QR-код",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Заведение успешно создано — осталось добавить первый QR-код. Выберите подходящий режим работы:
      </p>
      ${featureBlock("⭐ Сбор отзывов", "Фильтрация оценок 1–5★ — классическое решение QrStars для кафе, ресторанов и салонов красоты.")}
      ${featureBlock("📱 Микролендинг", "Меню, Wi‑Fi, визитка и контакты — всё на одной удобной странице.")}
      ${featureBlock("🔗 Редирект", "Прямая ссылка на любой ваш ресурс — для акций, соцсетей или онлайн-записи.")}
    `,
    cta: { label: "Создать первый QR-код", href: `${base}/dashboard/qrcodes` },
  });
}

export function renderNoQrD4Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Отзывы, меню или микролендинг — что выбрать?",
    title: "Какой QR-код вам нужен: отзывы, меню или микролендинг?",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Не уверены, с чего начать? Вот три самых популярных сценария использования:
      </p>
      ${bulletList([
        "<strong>Кафе или ресторан</strong> — QR-код «Сбор отзывов» на каждый стол",
        "<strong>Салон красоты или клиника</strong> — микролендинг со списком услуг и онлайн-записью",
        "<strong>Любой бизнес</strong> — QR-код для подключения к Wi‑Fi и контактов в зоне ожидания",
      ])}
      <p style="font-size:16px;color:#374151;">Вы можете создать несколько разных QR-кодов — ограничений по их количеству нет даже на бесплатном тарифе FREE.</p>
    `,
    cta: { label: "Выбрать тип QR-кода", href: `${base}/dashboard/start?rerun=1` },
  });
}

export function renderNoScansD2Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Скачайте готовый QR-код и разместите его на видном месте",
    title: "Распечатайте QR-код и поставьте его на стол",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        QR-код успешно создан! Следующий шаг — распечатать его и разместить там, где гость точно его заметит:
      </p>
      ${bulletList([
        "Скачайте изображение в формате PNG из личного кабинета",
        "Используйте наши готовые шаблоны тейбл-тентов — просто вставьте ваш QR-код в макет",
        "Разместите готовый печатный материал на столах, стойке ресепшена или зеркале в зоне ожидания",
      ])}
    `,
    cta: { label: "Посмотреть шаблоны для печати", href: `${base}/dashboard/templates/table-tents` },
  });
}

export function renderNoScansD5Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Стол, стойка, чек, зона ожидания…",
    title: "5 мест, где QR-код работает эффективнее всего",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">Если сканирований пока нет, попробуйте разместить QR-код в других зонах:</p>
      ${bulletList([
        "<strong>На столах</strong> — тейбл-тент с призывом «Оцените визит»",
        "<strong>У кассы или на стойке ресепшена</strong> — гость легко заметит его, пока ждёт расчёт",
        "<strong>На чеках или упаковке</strong> — отлично работает для заказов на вынос и доставки",
        "<strong>В туалетных комнатах</strong> — неожиданная локация, которая показывает отличную конверсию (серьёзно)",
        "<strong>На визитках у входа</strong> — для привлечения внимания прохожих",
      ])}
    `,
    cta: { label: "Открыть шаблоны печатных форм", href: `${base}/dashboard/templates` },
  });
}

export function renderNoReviewsD3Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Настройте сценарии распределения отзывов за 2 минуты",
    title: "Ваш QR-код уже сканируют — настройте сбор отзывов",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Гости уже начали сканировать ваш QR-код — отличный старт! Теперь проверьте сценарии распределения отзывов в разделе «Моя страница»:
      </p>
      ${bulletList([
        "При оценке 1–3★ — жалоба отправляется вам (на email в тарифе FREE, в Telegram — на тарифе PRO)",
        "При оценке 4–5★ — гость направляется на Яндекс Карты или 2GIS",
        "Вы можете настроить собственные тексты до и после отправки отзыва",
      ])}
      <p style="font-size:16px;color:#374151;">Обязательно укажите ссылку на Яндекс Карты в настройках заведения, иначе гостей с высокими оценками будет некуда направлять.</p>
    `,
    cta: { label: "Настроить сценарии отзывов", href: `${base}/dashboard/my-page` },
  });
}

export function renderConnectTelegramD2Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Получайте жалобы гостей прямо в мессенджер",
    title: "Подключите Telegram, чтобы получать жалобы за секунды",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Ваш QR-код уже работает! На бесплатном тарифе FREE жалобы приходят на email — это надёжно, но не всегда оперативно.
        Подключите Telegram-уведомления в настройках, чтобы мгновенно узнавать о недовольстве гостей, пока они ещё находятся у вас в заведении.
      </p>
      ${featureBlock("Тариф PRO", "Уведомления в Telegram и MAX для моментального реагирования на жалобы + умная ротация площадок для оценок 4–5★. Попробуйте, когда будете готовы.")}
    `,
    cta: { label: "Подключить Telegram-бота", href: `${base}/dashboard/settings` },
  });
}

export function renderFeedbackD7Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  const token = createSignedFeedbackToken(state.userId, "d7");
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Всего 30 секунд, чтобы помочь нам стать лучше",
    title: "Как вам QrStars?",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Вы пользуетесь QrStars уже неделю — спасибо, что выбрали нас! Пожалуйста, поделитесь своими впечатлениями: это займет всего 30 секунд и очень поможет нам сделать сервис лучше.
      </p>
      <p style="font-size:16px;color:#374151;">Оцените по шкале от 0 до 10: насколько вероятно, что вы порекомендуете QrStars своим коллегам или знакомым?</p>
    `,
    cta: { label: "Пройти опрос", href: `${base}/feedback?token=${token}` },
  });
}

/** Одноразовое письмо legacy-юзерам при выливке lifecycle. */
export function renderFeedbackLaunchEmail(state: LifecycleUserState): string {
  const base = getBaseUrl();
  const token = createSignedFeedbackToken(state.userId, "d7");
  return renderEmailLayout({
    userId: state.userId,
    preheader: "2 минуты — и мы сделаем QrStars удобнее для вас",
    title: "Помогите нам стать лучше",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Мы развиваем QrStars и хотим услышать ваше мнение — что уже работает, а что мешает в ежедневной работе.
      </p>
      <p style="font-size:16px;color:#374151;">
        Короткий опрос займёт 1–2 минуты: оценка 0–10 и пара строк текста по желанию. Это напрямую влияет на то, что мы улучшим в ближайших обновлениях.
      </p>
    `,
    cta: { label: "Пройти опрос", href: `${base}/feedback?token=${token}` },
  });
}

export function renderFeedbackD90Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  const token = createSignedFeedbackToken(state.userId, "d90");
  return renderEmailLayout({
    userId: state.userId,
    preheader: "3 месяца с QrStars — как сервис работает у вас?",
    title: "QrStars через 3 месяца — ваш опыт",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Вы с QrStars уже около трёх месяцев — видим, что сервис работает в вашем заведении. Нам важно понять, помогает ли он перехватывать негатив и чего не хватает в ежедневной работе.
      </p>
      ${bulletList([
        "Помогает ли QrStars узнавать о проблемах до публикации на картах?",
        "Что улучшить в первую очередь?",
        "Короткий опрос — 1–2 минуты",
      ])}
    `,
    cta: { label: "Поделиться опытом", href: `${base}/feedback?token=${token}` },
  });
}

export function renderFeedbackD365Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  const token = createSignedFeedbackToken(state.userId, "d365");
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Год вместе — расскажите, как QrStars повлиял на отзывы",
    title: "Год с QrStars — спасибо, что остаётесь!",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Прошёл год с момента регистрации — спасибо, что остаётесь с QrStars! Мы хотим услышать, как изменилась работа с отзывами и что сделать лучше в следующем году.
      </p>
      <p style="font-size:16px;color:#374151;">
        Если готовы — можем оформить ваш опыт как кейс (только с вашего согласия).
      </p>
    `,
    cta: { label: "Ответить на опрос", href: `${base}/feedback?token=${token}` },
  });
}

export function renderProHintD14Email(state: LifecycleUserState): string {
  const base = getBaseUrl();
  return renderEmailLayout({
    userId: state.userId,
    preheader: "Мгновенные уведомления в Telegram и умная ротация для высоких оценок",
    title: "Получайте жалобы в Telegram вместо email с тарифом PRO",
    bodyHtml: `
      <p style="font-size:16px;color:#374151;">${greeting(state)}</p>
      <p style="font-size:16px;color:#374151;">
        Мы видим, что QrStars уже активно работает в вашем заведении — у вас есть первые сканирования и отзывы. Перейдя на тариф PRO, вы получите:
      </p>
      ${bulletList([
        "Моментальные уведомления о жалобах в Telegram и MAX",
        "Умную ротацию площадок для высоких оценок (Яндекс Карты, 2GIS, Авито, Flamp)",
        "Белую этикетку (White Label) — ваш собственный логотип на странице вместо вотермарки QrStars",
        "Расширенную аналитику сканирований и возможность дарить промокоды за отзывы",
      ])}
      <p style="font-size:16px;color:#374151;">Стоимость тарифа PRO — всего 690 ₽/мес. Это значительно дешевле, чем отрабатывать даже один негативный отзыв на картах!</p>
    `,
    cta: { label: "Подключить тариф PRO", href: `${base}/dashboard/subscription` },
  });
}

export type LifecycleTemplateRenderer = (state: LifecycleUserState) => string;

export const LIFECYCLE_TEMPLATE_RENDERERS: Record<string, LifecycleTemplateRenderer> = {
  welcome: renderWelcomeEmail,
  no_establishment_d1: renderNoEstablishmentD1Email,
  no_establishment_d3: renderNoEstablishmentD3Email,
  no_qr_d1: renderNoQrD1Email,
  no_qr_d4: renderNoQrD4Email,
  no_scans_d2: renderNoScansD2Email,
  no_scans_d5: renderNoScansD5Email,
  no_reviews_d3: renderNoReviewsD3Email,
  connect_telegram_d2: renderConnectTelegramD2Email,
  feedback_d7: renderFeedbackD7Email,
  feedback_d90: renderFeedbackD90Email,
  feedback_d365: renderFeedbackD365Email,
  pro_hint_d14: renderProHintD14Email,
};

export const LIFECYCLE_EMAIL_SUBJECTS: Record<string, string> = {
  welcome: "Добро пожаловать в QrStars — умные QR-коды для вашего бизнеса",
  no_establishment_d1: "3 минуты до первого QR-кода — начнём?",
  no_establishment_d3: "Гости уходят недовольными, а вы об этом даже не узнаете",
  no_qr_d1: "Заведение готово — создайте первый QR-код",
  no_qr_d4: "Какой QR-код вам нужен: отзывы, меню или микролендинг?",
  no_scans_d2: "Распечатайте QR-код и поставьте его на стол",
  no_scans_d5: "5 мест, где QR-код работает эффективнее всего",
  no_reviews_d3: "Ваш QR-код уже сканируют — настройте сбор отзывов",
  connect_telegram_d2: "Подключите Telegram, чтобы получать жалобы гостей за секунды",
  feedback_d7: "Как вам QrStars? Опрос займет всего 30 секунд",
  feedback_d90: "3 месяца с QrStars — поделитесь опытом",
  feedback_d365: "Год с QrStars — как изменилась работа с отзывами?",
  feedback_launch: "Помогите нам сделать QrStars лучше — короткий опрос",
  pro_hint_d14: "Получайте жалобы в Telegram вместо email с тарифом PRO",
};
