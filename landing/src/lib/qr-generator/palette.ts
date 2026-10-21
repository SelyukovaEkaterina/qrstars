/** Цвета для «Случайного оформления»: только сочетания, которые камера уверенно читает. */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Относительная яркость по WCAG 2.x. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Минимальный контраст точек к фону. 4.5 — уверенно читается и с печати, и с экрана. */
export const MIN_QR_CONTRAST = 4.5;

export interface RandomPalette {
  fg: string;
  bg: string;
  gradient: boolean;
  grad1: string;
  grad2: string;
  eyeColor: string;
}

/**
 * Тёмные точки на светлом фоне: инверсию (светлое на тёмном) часть камер
 * на старых Android не читает, поэтому в случайный режим она не попадает.
 */
export function randomReadablePalette(): RandomPalette {
  for (let attempt = 0; attempt < 30; attempt++) {
    const hue = rand(0, 360);
    const bg = Math.random() < 0.6 ? '#ffffff' : hslToHex((hue + rand(-30, 30) + 360) % 360, rand(30, 80), rand(94, 98));
    const fg = hslToHex(hue, rand(45, 90), rand(14, 34));
    const grad1 = hslToHex(hue, rand(55, 90), rand(18, 36));
    const grad2 = hslToHex((hue + rand(25, 70)) % 360, rand(55, 90), rand(18, 36));
    const eyeColor = hslToHex((hue + rand(150, 210)) % 360, rand(55, 90), rand(18, 34));
    const colors = [fg, grad1, grad2, eyeColor];
    if (colors.every((c) => contrastRatio(c, bg) >= MIN_QR_CONTRAST)) {
      return { fg, bg, gradient: Math.random() < 0.5, grad1, grad2, eyeColor };
    }
  }
  return { fg: '#1e293b', bg: '#ffffff', gradient: false, grad1: '#4f46e5', grad2: '#7c3aed', eyeColor: '#4f46e5' };
}
