export type BuiltinModuleKey = "menu" | "review" | "businessCard" | "wifi";

export type CustomModuleId = string;

export type ModuleKey = BuiltinModuleKey | `custom-${string}`;

export type PageModules = Record<BuiltinModuleKey, boolean>;

export const DEFAULT_PAGE_MODULES: PageModules = {
  menu: true,
  review: true,
  businessCard: true,
  wifi: true,
};

export const PAGE_MODULE_LABELS: Record<BuiltinModuleKey, string> = {
  menu: "QR-Меню",
  review: "Сбор отзывов",
  businessCard: "Визитка",
  wifi: "Wi-Fi",
};

export type ModuleLabels = Partial<Record<BuiltinModuleKey, string>>;

export type ModuleIcons = Partial<Record<BuiltinModuleKey, string>>;

export const DEFAULT_MODULE_LABELS: Record<BuiltinModuleKey, string> = { ...PAGE_MODULE_LABELS };

export function parseModuleLabels(raw: unknown): ModuleLabels {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const result: ModuleLabels = {};
  for (const key of Object.keys(DEFAULT_MODULE_LABELS) as BuiltinModuleKey[]) {
    if (typeof o[key] === "string" && o[key].trim().length > 0) {
      result[key] = o[key].trim();
    }
  }
  return result;
}

export function getModuleLabel(key: BuiltinModuleKey, labels: ModuleLabels): string {
  return labels[key] ?? PAGE_MODULE_LABELS[key];
}

export function moduleLabelsToJson(labels: ModuleLabels): ModuleLabels {
  return { ...labels };
}

export function parseModuleIcons(raw: unknown): ModuleIcons {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const result: ModuleIcons = {};
  for (const key of Object.keys(DEFAULT_MODULE_LABELS) as BuiltinModuleKey[]) {
    if (typeof o[key] === "string" && o[key].trim().length > 0) {
      result[key] = o[key].trim();
    }
  }
  return result;
}

export function moduleIconsToJson(icons: ModuleIcons): ModuleIcons {
  return { ...icons };
}

export function parsePageModules(raw: unknown): PageModules {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PAGE_MODULES };
  const o = raw as Record<string, unknown>;
  return {
    menu: o.menu !== false,
    review: o.review !== false,
    businessCard: o.businessCard !== false,
    wifi: o.wifi !== false,
  };
}

export function pageModulesToJson(modules: PageModules): PageModules {
  return { ...modules };
}

export function parseModuleOrder(raw: unknown): ModuleKey[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((v): v is ModuleKey => typeof v === "string" && v.length > 0);
}

export function buildDefaultModuleOrder(
  pageModules: PageModules,
  customPageIds: string[]
): ModuleKey[] {
  const builtin: ModuleKey[] = (
    Object.keys(pageModules) as BuiltinModuleKey[]
  ).filter((k) => pageModules[k]);
  const custom: ModuleKey[] = customPageIds.map((id) => `custom-${id}` as ModuleKey);
  return [...builtin, ...custom];
}

export function customModuleKeyToId(key: string): string | null {
  if (key.startsWith("custom-")) return key.slice("custom-".length);
  return null;
}

export function isBuiltinModuleKey(key: string): key is BuiltinModuleKey {
  return key in PAGE_MODULE_LABELS;
}
