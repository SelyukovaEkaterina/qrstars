import { Manrope, Playfair_Display, Unbounded } from "next/font/google";

// preload: false — шрифты нужны только сайту для компьютера; на телефоне
// гость их не скачивает (браузер грузит начертание, только когда оно используется).
export const siteManrope = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: false,
  variable: "--site-font-manrope",
});

export const sitePlayfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: false,
  variable: "--site-font-playfair",
});

export const siteUnbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: false,
  variable: "--site-font-unbounded",
});

export const siteFontVariables = `${siteManrope.variable} ${sitePlayfair.variable} ${siteUnbounded.variable}`;
