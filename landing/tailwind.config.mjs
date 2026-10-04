/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        ozon: '#005BFF',
        ozonPink: '#F91155',
        yandex: '#FFCC00',
        dgis: '#A3D200',
        primary: '#4F46E5',
      },
    },
  },
  plugins: [typography],
}
