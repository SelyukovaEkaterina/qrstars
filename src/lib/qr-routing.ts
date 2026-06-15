export type RoutingGroup = "LANDING" | "SECTION" | "REDIRECT";

export type BuiltinSectionTarget = "MENU" | "REVIEW" | "BUSINESS_CARD" | "WIFI" | "TIPS";

export type SectionTarget = BuiltinSectionTarget | `CUSTOM_${string}`;

export type QRMode =
  | "LANDING"
  | "REVIEW"
  | "REDIRECT"
  | "BUSINESS_CARD"
  | "WIFI"
  | "FILE"
  | "MENU"
  | "CUSTOM_SECTION"
  | "TIPS";

const BUILTIN_SECTION_MODES: BuiltinSectionTarget[] = [
  "MENU",
  "REVIEW",
  "BUSINESS_CARD",
  "WIFI",
  "TIPS",
];

export function isBuiltinSection(s: string): s is BuiltinSectionTarget {
  return BUILTIN_SECTION_MODES.includes(s as BuiltinSectionTarget);
}

/** QR ведёт на сбор отзывов (прямой раздел или микро-лендинг). */
export function isReviewCapableQrMode(mode: string): boolean {
  return mode === "REVIEW" || mode === "LANDING";
}

export function customSectionIdToTarget(pageId: string): `CUSTOM_${string}` {
  return `CUSTOM_${pageId}`;
}

export function targetToCustomPageId(target: string): string | null {
  if (target.startsWith("CUSTOM_")) return target.slice("CUSTOM_".length);
  return null;
}

export function modeToRouting(mode: QRMode): {
  group: RoutingGroup;
  section?: SectionTarget;
  customSectionId?: string;
  legacyFile?: boolean;
} {
  if (mode === "LANDING") return { group: "LANDING" };
  if (mode === "REDIRECT") return { group: "REDIRECT" };
  if (mode === "FILE") return { group: "SECTION", legacyFile: true };
  if (mode === "CUSTOM_SECTION") return { group: "SECTION", section: undefined, customSectionId: undefined };
  if (BUILTIN_SECTION_MODES.includes(mode as BuiltinSectionTarget)) {
    return { group: "SECTION", section: mode as BuiltinSectionTarget };
  }
  return { group: "SECTION", section: "REVIEW" };
}

export function routingToMode(
  group: RoutingGroup,
  section?: SectionTarget,
  customSectionId?: string
): QRMode {
  if (group === "LANDING") return "LANDING";
  if (group === "REDIRECT") return "REDIRECT";
  if (customSectionId) return "CUSTOM_SECTION";
  if (section && isBuiltinSection(section)) return section;
  return "REVIEW";
}

export const BUILTIN_SECTION_OPTIONS: { value: BuiltinSectionTarget; label: string }[] = [
  { value: "MENU", label: "QR-Меню" },
  { value: "REVIEW", label: "Оставить отзыв" },
  { value: "BUSINESS_CARD", label: "Визитка" },
  { value: "WIFI", label: "Wi-Fi" },
  { value: "TIPS", label: "Чаевые" },
];

export const ROUTING_GROUPS: {
  id: RoutingGroup;
  emoji: string;
  label: string;
  desc: string;
}[] = [
  {
    id: "LANDING",
    emoji: "📱",
    label: "Микро-лендинг",
    desc: "Гость увидит страницу со всеми вашими сервисами: меню, отзывы, Wi-Fi, контакты",
  },
  {
    id: "SECTION",
    emoji: "⚡",
    label: "Быстрый доступ к разделу",
    desc: "Гость сразу попадёт в выбранный раздел, минуя главную страницу. Работает даже если раздел скрыт на лендинге",
  },
  {
    id: "REDIRECT",
    emoji: "🔗",
    label: "Прямой редирект",
    desc: "Мгновенно перенаправить гостя на сторонний сайт (Instagram, доставка и т.д.)",
  },
];

export const SECTION_OPTIONS: { value: BuiltinSectionTarget; label: string }[] = BUILTIN_SECTION_OPTIONS;

export const MODE_LABELS: Record<QRMode, string> = {
  LANDING: "Микро-лендинг",
  REVIEW: "Отзывы",
  REDIRECT: "Редирект",
  BUSINESS_CARD: "Визитка",
  WIFI: "Wi-Fi",
  FILE: "Файл",
  MENU: "QR-Меню",
  CUSTOM_SECTION: "Кастомная страница",
  TIPS: "Чаевые",
};
