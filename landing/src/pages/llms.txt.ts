import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  API_DOCS_URL,
  APP,
  KEY_PAGES,
  OPENAPI_URL,
  PRODUCT_SUMMARY,
  SITE,
} from '../lib/ai-docs';

/** Краткая карта сайта для ИИ-ассистентов (формат llmstxt.org). */
export const GET: APIRoute = async () => {
  // Дубли с canonical на другую страницу в карту не берём.
  const seo = (await getCollection('seo')).filter(
    (e) => !e.data.noindex && (!e.data.canonical || e.data.canonical === `${SITE}/${e.slug}.html`)
  );
  const blog = (await getCollection('blog')).filter((e) => !e.data.noindex && !e.data.canonical);

  const body = `# QrStars

> ${PRODUCT_SUMMARY}

Сайт: ${SITE} · Кабинет: ${APP} · Подробная версия для ИИ: ${SITE}/llms-full.txt

## Продукт

${KEY_PAGES.map((p) => `- [${p.title}](${p.href}): ${p.note}`).join('\n')}

## API для интеграций и ИИ-агентов

- [Документация API](${API_DOCS_URL}): REST API, авторизация по ключу \`Bearer qrs_…\`, примеры
- [OpenAPI 3.1](${OPENAPI_URL}): машиночитаемая спецификация

## Решения по задачам и отраслям

${seo.map((e) => `- [${e.data.h1}](${SITE}/${e.slug}.html): ${e.data.description}`).join('\n')}

## Блог

${blog.map((e) => `- [${e.data.title}](${SITE}/blog/${e.slug}.html): ${e.data.description}`).join('\n')}

## Optional

- [Публичная оферта](${SITE}/publichnaya-oferta.html)
- [Пользовательское соглашение](${SITE}/polzovatelskoe-soglashenie.html)
- [Условия оплаты и возврата](${SITE}/usloviya-oplaty-i-vozvrata.html)
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
