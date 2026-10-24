import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

/** Дубли и каноникализированные страницы — canonical на основной URL, не в sitemap */
const NOINDEX_PATHS = [
  '/generator-qr-kodov',
  '/sozdat-qr-kod',
  '/dinamicheskiy-qr-kod',
];

export default defineConfig({
  site: 'https://qrstars.ru',
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) =>
        !page.includes('/politika-konfidencialnosti') &&
        !page.includes('/soglasie-pd') &&
        !NOINDEX_PATHS.some((path) => page.includes(path)),
      serialize(item) {
        // Добавляем .html ко всем URL кроме главной (site имеет trailingSlash: 'never')
        const raw = item.url.replace(/\/$/, '');
        const isHome = raw === 'https://qrstars.ru';
        const url = isHome ? 'https://qrstars.ru/' : raw + '.html';

        if (isHome) {
          return { ...item, url, priority: 1.0, changefreq: 'weekly' };
        }
        if (url.includes('/blog/')) {
          return { ...item, url, priority: 0.7, changefreq: 'monthly' };
        }
        return { ...item, url, priority: 0.8, changefreq: 'monthly' };
      },
    }),
  ],
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  vite: {
    // Генератор QR берёт общий движок из кабинета (../src/lib/qr-engine) — dev-серверу нужен доступ.
    server: { fs: { allow: ['..'] } },
  },
});
