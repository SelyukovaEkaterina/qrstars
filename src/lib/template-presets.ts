import { TemplateLayout } from "@/types/template";

export interface TemplatePreset {
  name: string;
  description: string;
  thumbnail: { bg: string; accent: string };
  layout: TemplateLayout;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    name: "Полночный",
    description: "Глубокий индиго-градиент с белым QR-кодом",
    thumbnail: { bg: "linear-gradient(135deg, #1e1b4b, #312e81)", accent: "#818cf8" },
    layout: {
      width: 210,
      height: 148,
      background: { type: "gradient", gradientFrom: "#1e1b4b", gradientTo: "#312e81", gradientAngle: 135 },
      elements: [
        { id: "t1", type: "text", x: 10, y: 5, width: 80, height: 10, text: "ОСТАВЬТЕ ОТЗЫВ", fontSize: 7, fontWeight: "bold", color: "#ffffff", textAlign: "center" },
        { id: "s1", type: "shape", x: 35, y: 17, width: 30, height: 0.8, shape: "roundedRect", fill: "#818cf8", borderRadius: 50, opacity: 0.6 },
        { id: "qr1", type: "qr", x: 30, y: 22, width: 40, height: 50, qrColor: "#ffffff", qrBgColor: "#1e1b4b" },
        { id: "t2", type: "text", x: 10, y: 76, width: 80, height: 5, text: "Наведите камеру телефона", fontSize: 3.8, fontWeight: "normal", color: "#c7d2fe", textAlign: "center" },
        { id: "t3", type: "text", x: 25, y: 86, width: 50, height: 4, text: "★ ★ ★ ★ ★", fontSize: 3.5, fontWeight: "normal", color: "#fbbf24", textAlign: "center" },
        { id: "t4", type: "text", x: 30, y: 93, width: 40, height: 3, text: "QrStars.ru", fontSize: 2.2, fontWeight: "normal", color: "#818cf8", textAlign: "center" },
      ],
    },
  },
  {
    name: "Закат",
    description: "Тёплый оранжево-розовый градиент",
    thumbnail: { bg: "linear-gradient(135deg, #f97316, #ec4899)", accent: "#ffffff" },
    layout: {
      width: 210,
      height: 148,
      background: { type: "gradient", gradientFrom: "#f97316", gradientTo: "#ec4899", gradientAngle: 135 },
      elements: [
        { id: "t1", type: "shape", x: 5, y: 5, width: 90, height: 90, shape: "roundedRect", fill: "rgba(255,255,255,0.1)", borderRadius: 16 },
        { id: "t2", type: "text", x: 10, y: 8, width: 80, height: 9, text: "ВАШЕ МНЕНИЕ ВАЖНО", fontSize: 6.5, fontWeight: "bold", color: "#ffffff", textAlign: "center" },
        { id: "qr1", type: "qr", x: 30, y: 22, width: 40, height: 48, qrColor: "#ffffff", qrBgColor: "transparent" },
        { id: "t3", type: "text", x: 10, y: 74, width: 80, height: 5, text: "Отсканируйте QR-код", fontSize: 3.8, fontWeight: "normal", color: "rgba(255,255,255,0.85)", textAlign: "center" },
        { id: "t4", type: "text", x: 10, y: 82, width: 80, height: 4, text: "и оставьте оценку", fontSize: 3.2, fontWeight: "normal", color: "rgba(255,255,255,0.7)", textAlign: "center" },
        { id: "t5", type: "text", x: 30, y: 92, width: 40, height: 3, text: "QrStars.ru", fontSize: 2.2, fontWeight: "normal", color: "rgba(255,255,255,0.5)", textAlign: "center" },
      ],
    },
  },
  {
    name: "Тёмный премиум",
    description: "Чёрный с золотыми акцентами",
    thumbnail: { bg: "linear-gradient(135deg, #0f0f0f, #1a1a2e)", accent: "#fbbf24" },
    layout: {
      width: 210,
      height: 148,
      background: { type: "gradient", gradientFrom: "#0f0f0f", gradientTo: "#1a1a2e", gradientAngle: 180 },
      elements: [
        { id: "s1", type: "shape", x: 4, y: 3, width: 92, height: 94, shape: "roundedRect", stroke: "#fbbf24", strokeWidth: 0.5, borderRadius: 12, opacity: 0.4 },
        { id: "t1", type: "text", x: 10, y: 8, width: 80, height: 9, text: "КАК НАМ?", fontSize: 8, fontWeight: "bold", color: "#fbbf24", textAlign: "center" },
        { id: "s2", type: "shape", x: 25, y: 19, width: 50, height: 0.5, shape: "roundedRect", fill: "#fbbf24", borderRadius: 50, opacity: 0.3 },
        { id: "qr1", type: "qr", x: 30, y: 24, width: 40, height: 48, qrColor: "#ffffff", qrBgColor: "#0f0f0f" },
        { id: "t2", type: "text", x: 10, y: 76, width: 80, height: 5, text: "Оцените нас", fontSize: 3.8, fontWeight: "normal", color: "#a3a3a3", textAlign: "center" },
        { id: "t3", type: "text", x: 10, y: 84, width: 80, height: 4, text: "наведите камеру на QR-код", fontSize: 2.8, fontWeight: "normal", color: "#737373", textAlign: "center" },
        { id: "t4", type: "text", x: 30, y: 93, width: 40, height: 3, text: "QrStars.ru", fontSize: 2, fontWeight: "normal", color: "#525252", textAlign: "center" },
      ],
    },
  },
  {
    name: "Мятная свежесть",
    description: "Мятный градиент, чистый и современный",
    thumbnail: { bg: "linear-gradient(135deg, #0d9488, #059669)", accent: "#ffffff" },
    layout: {
      width: 210,
      height: 148,
      background: { type: "gradient", gradientFrom: "#0d9488", gradientTo: "#059669", gradientAngle: 135 },
      elements: [
        { id: "t1", type: "text", x: 10, y: 5, width: 80, height: 9, text: "НАМ ВАЖЕН ВАШ ОТЗЫВ", fontSize: 5.5, fontWeight: "bold", color: "#ffffff", textAlign: "center" },
        { id: "qr1", type: "qr", x: 30, y: 20, width: 40, height: 50, qrColor: "#064e3b", qrBgColor: "#ffffff" },
        { id: "s1", type: "shape", x: 29, y: 19, width: 42, height: 52, shape: "roundedRect", fill: "#ffffff", borderRadius: 12, opacity: 0.15 },
        { id: "t2", type: "text", x: 10, y: 76, width: 80, height: 5, text: "Отсканируйте код", fontSize: 3.8, fontWeight: "normal", color: "#d1fae5", textAlign: "center" },
        { id: "t3", type: "text", x: 25, y: 85, width: 50, height: 4, text: "★ ★ ★ ★ ★", fontSize: 3.5, fontWeight: "normal", color: "#fbbf24", textAlign: "center" },
        { id: "t4", type: "text", x: 30, y: 93, width: 40, height: 3, text: "QrStars.ru", fontSize: 2.2, fontWeight: "normal", color: "#a7f3d0", textAlign: "center" },
      ],
    },
  },
  {
    name: "Минимал",
    description: "Чистый белый фон с элегантным дизайном",
    thumbnail: { bg: "linear-gradient(135deg, #f8fafc, #e2e8f0)", accent: "#1e1b4b" },
    layout: {
      width: 210,
      height: 148,
      background: { type: "solid", color: "#ffffff" },
      elements: [
        { id: "s1", type: "shape", x: 3, y: 3, width: 94, height: 94, shape: "roundedRect", stroke: "#e2e8f0", strokeWidth: 0.5, borderRadius: 16 },
        { id: "t1", type: "text", x: 10, y: 7, width: 80, height: 8, text: "Оставьте отзыв", fontSize: 6, fontWeight: "bold", color: "#1e1b4b", textAlign: "center" },
        { id: "s2", type: "shape", x: 40, y: 17, width: 20, height: 0.5, shape: "roundedRect", fill: "#6366f1", borderRadius: 50 },
        { id: "qr1", type: "qr", x: 30, y: 22, width: 40, height: 48, qrColor: "#1e1b4b", qrBgColor: "#ffffff" },
        { id: "t2", type: "text", x: 10, y: 76, width: 80, height: 5, text: "Наведите камеру", fontSize: 3.5, fontWeight: "normal", color: "#64748b", textAlign: "center" },
        { id: "t3", type: "text", x: 30, y: 93, width: 40, height: 3, text: "QrStars.ru", fontSize: 2.2, fontWeight: "normal", color: "#94a3b8", textAlign: "center" },
      ],
    },
  },
  {
    name: "Океан",
    description: "Глубокий синий с бирюзовыми акцентами",
    thumbnail: { bg: "linear-gradient(135deg, #1e3a5f, #0e7490)", accent: "#22d3ee" },
    layout: {
      width: 210,
      height: 148,
      background: { type: "gradient", gradientFrom: "#1e3a5f", gradientTo: "#0e7490", gradientAngle: 135 },
      elements: [
        { id: "s1", type: "shape", x: 8, y: 6, width: 84, height: 88, shape: "roundedRect", fill: "rgba(255,255,255,0.05)", borderRadius: 20 },
        { id: "t1", type: "text", x: 10, y: 8, width: 80, height: 9, text: "СКАНИРУЙТЕ", fontSize: 7, fontWeight: "bold", color: "#22d3ee", textAlign: "center" },
        { id: "qr1", type: "qr", x: 30, y: 22, width: 40, height: 48, qrColor: "#ffffff", qrBgColor: "transparent" },
        { id: "t2", type: "text", x: 10, y: 76, width: 80, height: 5, text: "Оставьте отзыв о нас", fontSize: 3.8, fontWeight: "normal", color: "#a5f3fc", textAlign: "center" },
        { id: "t3", type: "text", x: 25, y: 85, width: 50, height: 4, text: "★ ★ ★ ★ ★", fontSize: 3.5, fontWeight: "normal", color: "#fbbf24", textAlign: "center" },
        { id: "t4", type: "text", x: 30, y: 93, width: 40, height: 3, text: "QrStars.ru", fontSize: 2.2, fontWeight: "normal", color: "#67e8f9", textAlign: "center" },
      ],
    },
  },
];

export function createBlankLayout(): TemplateLayout {
  return {
    width: 210,
    height: 148,
    background: { type: "solid", color: "#ffffff" },
    elements: [
      { id: `el-${Date.now()}-1`, type: "text", x: 10, y: 8, width: 80, height: 8, text: "ОСТАВЬТЕ ОТЗЫВ", fontSize: 6, fontWeight: "bold", color: "#1e1b4b", textAlign: "center" },
      { id: `el-${Date.now()}-2`, type: "qr", x: 30, y: 22, width: 40, height: 48, qrColor: "#1e1b4b", qrBgColor: "#ffffff" },
      { id: `el-${Date.now()}-3`, type: "text", x: 10, y: 76, width: 80, height: 5, text: "Наведите камеру телефона", fontSize: 3.5, fontWeight: "normal", color: "#64748b", textAlign: "center" },
    ],
  };
}
