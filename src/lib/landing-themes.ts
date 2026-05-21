export type LandingThemeId =
  | "default"
  | "ocean"
  | "sunset"
  | "emerald"
  | "rose"
  | "dark";

export interface LandingTheme {
  id: LandingThemeId;
  label: string;
  accentHex: string;
  bg: string;
  bgEmbedded: string;
  iconBg: string;
  iconText: string;
  hoverBorder: string;
  backText: string;
  demoBadgeBg: string;
  demoBadgeText: string;
  starFocusRing: string;
  activePillBg: string;
  activePillText: string;
  priceBg: string;
  priceText: string;
  sectionBar: string;
  cardBg: string;
  cardBorder: string;
  inputBorder: string;
  headerGradientFrom: string;
  headerGradientTo: string;
  downloadBtnBg: string;
  downloadBtnShadow: string;
  infoBoxBg: string;
  infoBoxBorder: string;
  infoBoxTitle: string;
  infoBoxText: string;
}

const THEMES: Record<LandingThemeId, LandingTheme> = {
  default: {
    id: "default",
    label: "Индиго",
    accentHex: "#4f46e5",
    bg: "bg-gradient-to-b from-indigo-50 to-white",
    bgEmbedded: "bg-gray-50",
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-600",
    hoverBorder: "hover:border-indigo-300",
    backText: "text-indigo-600 hover:text-indigo-800",
    demoBadgeBg: "bg-indigo-50",
    demoBadgeText: "text-indigo-600",
    starFocusRing: "focus:ring-indigo-500",
    activePillBg: "bg-indigo-600",
    activePillText: "text-white",
    priceBg: "bg-indigo-50",
    priceText: "text-indigo-600",
    sectionBar: "bg-indigo-500",
    cardBg: "bg-white",
    cardBorder: "border-gray-100",
    inputBorder: "border-gray-200 focus:ring-indigo-500 focus:border-indigo-500",
    headerGradientFrom: "from-indigo-500",
    headerGradientTo: "to-indigo-600",
    downloadBtnBg: "bg-indigo-600 hover:bg-indigo-700",
    downloadBtnShadow: "shadow-indigo-200",
    infoBoxBg: "bg-indigo-50",
    infoBoxBorder: "border-indigo-100",
    infoBoxTitle: "text-indigo-900",
    infoBoxText: "text-indigo-800/90",
  },
  ocean: {
    id: "ocean",
    label: "Океан",
    accentHex: "#0369a1",
    bg: "bg-gradient-to-b from-sky-50 to-white",
    bgEmbedded: "bg-sky-50/40",
    iconBg: "bg-sky-100",
    iconText: "text-sky-600",
    hoverBorder: "hover:border-sky-300",
    backText: "text-sky-600 hover:text-sky-800",
    demoBadgeBg: "bg-sky-50",
    demoBadgeText: "text-sky-600",
    starFocusRing: "focus:ring-sky-500",
    activePillBg: "bg-sky-600",
    activePillText: "text-white",
    priceBg: "bg-sky-50",
    priceText: "text-sky-600",
    sectionBar: "bg-sky-500",
    cardBg: "bg-white",
    cardBorder: "border-sky-100",
    inputBorder: "border-gray-200 focus:ring-sky-500 focus:border-sky-500",
    headerGradientFrom: "from-sky-500",
    headerGradientTo: "to-sky-600",
    downloadBtnBg: "bg-sky-600 hover:bg-sky-700",
    downloadBtnShadow: "shadow-sky-200",
    infoBoxBg: "bg-sky-50",
    infoBoxBorder: "border-sky-100",
    infoBoxTitle: "text-sky-900",
    infoBoxText: "text-sky-800/90",
  },
  sunset: {
    id: "sunset",
    label: "Закат",
    accentHex: "#ea580c",
    bg: "bg-gradient-to-b from-orange-50 via-amber-50 to-white",
    bgEmbedded: "bg-orange-50/40",
    iconBg: "bg-orange-100",
    iconText: "text-orange-600",
    hoverBorder: "hover:border-orange-300",
    backText: "text-orange-600 hover:text-orange-800",
    demoBadgeBg: "bg-orange-50",
    demoBadgeText: "text-orange-600",
    starFocusRing: "focus:ring-orange-500",
    activePillBg: "bg-orange-600",
    activePillText: "text-white",
    priceBg: "bg-orange-50",
    priceText: "text-orange-600",
    sectionBar: "bg-orange-500",
    cardBg: "bg-white",
    cardBorder: "border-orange-100",
    inputBorder: "border-gray-200 focus:ring-orange-500 focus:border-orange-500",
    headerGradientFrom: "from-amber-500",
    headerGradientTo: "to-orange-500",
    downloadBtnBg: "bg-amber-500 hover:bg-amber-600",
    downloadBtnShadow: "shadow-amber-200",
    infoBoxBg: "bg-orange-50",
    infoBoxBorder: "border-orange-100",
    infoBoxTitle: "text-orange-900",
    infoBoxText: "text-orange-800/90",
  },
  emerald: {
    id: "emerald",
    label: "Изумруд",
    accentHex: "#059669",
    bg: "bg-gradient-to-b from-emerald-50 to-white",
    bgEmbedded: "bg-emerald-50/40",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
    hoverBorder: "hover:border-emerald-300",
    backText: "text-emerald-600 hover:text-emerald-800",
    demoBadgeBg: "bg-emerald-50",
    demoBadgeText: "text-emerald-600",
    starFocusRing: "focus:ring-emerald-500",
    activePillBg: "bg-emerald-600",
    activePillText: "text-white",
    priceBg: "bg-emerald-50",
    priceText: "text-emerald-600",
    sectionBar: "bg-emerald-500",
    cardBg: "bg-white",
    cardBorder: "border-emerald-100",
    inputBorder: "border-gray-200 focus:ring-emerald-500 focus:border-emerald-500",
    headerGradientFrom: "from-emerald-500",
    headerGradientTo: "to-emerald-600",
    downloadBtnBg: "bg-emerald-600 hover:bg-emerald-700",
    downloadBtnShadow: "shadow-emerald-200",
    infoBoxBg: "bg-emerald-50",
    infoBoxBorder: "border-emerald-100",
    infoBoxTitle: "text-emerald-900",
    infoBoxText: "text-emerald-800/90",
  },
  rose: {
    id: "rose",
    label: "Роза",
    accentHex: "#e11d48",
    bg: "bg-gradient-to-b from-rose-50 via-pink-50 to-white",
    bgEmbedded: "bg-rose-50/40",
    iconBg: "bg-rose-100",
    iconText: "text-rose-600",
    hoverBorder: "hover:border-rose-300",
    backText: "text-rose-600 hover:text-rose-800",
    demoBadgeBg: "bg-rose-50",
    demoBadgeText: "text-rose-600",
    starFocusRing: "focus:ring-rose-500",
    activePillBg: "bg-rose-600",
    activePillText: "text-white",
    priceBg: "bg-rose-50",
    priceText: "text-rose-600",
    sectionBar: "bg-rose-500",
    cardBg: "bg-white",
    cardBorder: "border-rose-100",
    inputBorder: "border-gray-200 focus:ring-rose-500 focus:border-rose-500",
    headerGradientFrom: "from-rose-500",
    headerGradientTo: "to-pink-600",
    downloadBtnBg: "bg-rose-600 hover:bg-rose-700",
    downloadBtnShadow: "shadow-rose-200",
    infoBoxBg: "bg-rose-50",
    infoBoxBorder: "border-rose-100",
    infoBoxTitle: "text-rose-900",
    infoBoxText: "text-rose-800/90",
  },
  dark: {
    id: "dark",
    label: "Тёмный",
    accentHex: "#818cf8",
    bg: "bg-gradient-to-b from-slate-900 to-slate-800",
    bgEmbedded: "bg-slate-900",
    iconBg: "bg-slate-700",
    iconText: "text-indigo-400",
    hoverBorder: "hover:border-slate-500",
    backText: "text-indigo-400 hover:text-indigo-300",
    demoBadgeBg: "bg-slate-700",
    demoBadgeText: "text-indigo-400",
    starFocusRing: "focus:ring-indigo-400",
    activePillBg: "bg-indigo-600",
    activePillText: "text-white",
    priceBg: "bg-slate-700",
    priceText: "text-indigo-400",
    sectionBar: "bg-indigo-500",
    cardBg: "bg-slate-800",
    cardBorder: "border-slate-700",
    inputBorder: "border-slate-600 focus:ring-indigo-400 focus:border-indigo-400",
    headerGradientFrom: "from-indigo-600",
    headerGradientTo: "to-indigo-800",
    downloadBtnBg: "bg-indigo-600 hover:bg-indigo-700",
    downloadBtnShadow: "shadow-indigo-900/50",
    infoBoxBg: "bg-slate-800",
    infoBoxBorder: "border-slate-700",
    infoBoxTitle: "text-indigo-300",
    infoBoxText: "text-slate-400",
  },
};

export const LANDING_THEMES = THEMES;

export const LANDING_THEME_LIST = Object.values(THEMES);

export const DEFAULT_LANDING_THEME: LandingThemeId = "default";

export function getLandingTheme(id: string | null | undefined): LandingTheme {
  if (id && id in THEMES) return THEMES[id as LandingThemeId];
  return THEMES.default;
}

export function isDarkLandingTheme(id: string | null | undefined): boolean {
  return id === "dark";
}
