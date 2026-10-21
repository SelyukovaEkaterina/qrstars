/**
 * Перенос дизайна из генератора в кабинет: стиль кладётся в `?qr_style=` ссылки регистрации
 * (base64url от JSON). Кабинет сохраняет его в «Шаблоны оформления» и применяет к первому QR.
 * Формат — `src/lib/generator-style.ts` в приложении; поля должны совпадать.
 */

export const STYLE_PARAM = 'qr_style';

export interface TransferStyle {
  v: 1;
  dotStyle: 'classic' | 'rounded';
  eyeStyle: 'square' | 'rounded' | 'circle' | 'leaf' | 'dot';
  fg: string;
  bg: string;
  bgTransparent: boolean;
  gradient: boolean;
  grad1: string;
  grad2: string;
  gradType: 'linear-tb' | 'linear-lr' | 'linear-diag' | 'radial';
  eyeCustom: boolean;
  eyeColor: string;
  /** Эмодзи-пресет; свой загруженный логотип не переносится (слишком большой для ссылки). */
  logoPreset: string | null;
  logoSrc: '/logo.svg' | null;
  logoFill: boolean;
  logoSize: number;
  frame: boolean;
  frameText: string;
  frameStyle: 'bottom' | 'rounded' | 'ribbon';
  ecc: 'L' | 'M' | 'Q' | 'H';
  margin: number;
  scatter: boolean;
  scatterDensity: number;
  scatterShape: string;
  centerMode: 'image' | 'text';
  /** До 3 строк через перевод строки, по 24 символа. */
  centerText: string;
  centerTextFont: string;
  centerTextColor: string;
  centerTextBold: boolean;
}

export function encodeTransferStyle(style: TransferStyle): string {
  const bytes = new TextEncoder().encode(JSON.stringify(style));
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Ссылка на регистрацию в кабинете (`app.qrstars.ru/register…`). */
export function isAppRegisterLink(href: string): boolean {
  try {
    const url = new URL(href);
    return url.hostname === 'app.qrstars.ru' && url.pathname.startsWith('/register');
  } catch {
    return false;
  }
}

export function withTransferStyle(href: string, encoded: string): string {
  try {
    const url = new URL(href);
    url.searchParams.set(STYLE_PARAM, encoded);
    return url.toString();
  } catch {
    return href;
  }
}
