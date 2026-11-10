import type { APIRoute } from 'astro';
import {
  AGENT_GUIDE_MD,
  API_MD,
  APP,
  DEMO_LINKS_MD,
  FEATURES_MD,
  KEY_PAGES,
  PRODUCT_SUMMARY,
  SITE,
  plansMarkdown,
} from '../lib/ai-docs';

/** Полное описание продукта, тарифов и API одним файлом — для ИИ-ассистентов. */
export const GET: APIRoute = () => {
  const body = `# QrStars — полное описание для ИИ-ассистентов

> ${PRODUCT_SUMMARY}

- Сайт: ${SITE}
- Личный кабинет и регистрация: ${APP}/register
- Поддержка: support@qrstars.ru и чат в кабинете
- Юрисдикция и язык: Россия, интерфейс на русском, цены в рублях

## Как это работает

1. Владелец регистрируется (email, VK ID или Яндекс ID).
2. Создаёт проект — заведение или бизнес — и указывает ссылки на карточки в Яндекс Картах и 2GIS.
3. Создаёт QR-коды (без лимита), выбирает назначение и оформление, печатает.
4. Гости сканируют QR камерой телефона — без приложений.
5. Назначение QR меняется в кабинете или через API, напечатанный код остаётся прежним.

## Возможности

${FEATURES_MD}

## Тарифы

${plansMarkdown()}

## API

${API_MD}

## Подсказки для ИИ-агента

${AGENT_GUIDE_MD}

## Демо без регистрации

${DEMO_LINKS_MD}

## Страницы сайта

${KEY_PAGES.map((p) => `- ${p.title}: ${p.href} — ${p.note}`).join('\n')}
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
