export type BuiltinModuleKey = "menu" | "review" | "businessCard" | "wifi" | "tips";

/** Блоки микро-лендинга (включая чаевые при pageModules.tips). */
export const LANDING_BUILTIN_MODULE_KEYS: BuiltinModuleKey[] = [
  "menu",
  "review",
  "businessCard",
  "wifi",
  "tips",
];

export type CustomModuleId = string;

export type ModuleKey = BuiltinModuleKey | `custom-${string}` | `menu-${string}` | `bizcard-${string}` | `wifi-${string}` | `form-${string}`;

export type PageModules = Record<BuiltinModuleKey, boolean>;

export const DEFAULT_PAGE_MODULES: PageModules = {
  menu: true,
  review: true,
  businessCard: true,
  wifi: true,
  tips: false,
};

/** Микро-лендинг без сбора отзывов (меню, визитка, Wi‑Fi). */
export const GUEST_PAGE_MODULES: PageModules = {
  ...DEFAULT_PAGE_MODULES,
  review: false,
};

export const PAGE_MODULE_LABELS: Record<BuiltinModuleKey, string> = {
  menu: "QR-Меню",
  review: "Оставить отзыв",
  businessCard: "Визитка",
  wifi: "Wi-Fi",
  tips: "Чаевые",
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
    tips: o.tips === true,
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
  const builtin: ModuleKey[] = LANDING_BUILTIN_MODULE_KEYS.filter((k) => pageModules[k]);
  const custom: ModuleKey[] = customPageIds.map((id) => `custom-${id}` as ModuleKey);
  return [...builtin, ...custom];
}

/** Включённые блоки в порядке отображения на микро-лендинге. */
export function resolveEnabledModuleOrder(
  pageModules: PageModules,
  customPages: { id: string; enabled: boolean }[],
  moduleOrder: ModuleKey[] | null,
  moduleTypes: ModuleTypes,
  forms?: { id: string; enabled: boolean }[]
): ModuleKey[] {
  const formEnabledById = new Map(forms?.map((f) => [f.id, f.enabled]) ?? []);
  const valid = new Set<ModuleKey>();
  LANDING_BUILTIN_MODULE_KEYS.forEach((k) => {
    if (pageModules[k]) valid.add(k);
  });
  customPages.forEach((p) => {
    if (p.enabled) valid.add(`custom-${p.id}`);
  });
  (Object.keys(moduleTypes) as ModuleKey[]).forEach((k) => {
    const info = moduleTypes[k];
    const formEnabled =
      info?.type === "form" ? formEnabledById.get(info.instanceId) : undefined;
    if (isTypedModuleLandingEnabled(k, moduleTypes, formEnabled)) valid.add(k);
  });

  if (moduleOrder && moduleOrder.length > 0) {
    const ordered = moduleOrder.filter((k) => valid.has(k));
    const seen = new Set(ordered);
    valid.forEach((k) => {
      if (!seen.has(k)) ordered.push(k);
    });
    return ordered;
  }

  const builtin = LANDING_BUILTIN_MODULE_KEYS.filter((k) => pageModules[k]);
  const custom = customPages
    .filter((p) => p.enabled)
    .map((p) => `custom-${p.id}` as ModuleKey);
  const typed = (Object.keys(moduleTypes) as ModuleKey[]).filter((k) => {
    const info = moduleTypes[k];
    const formEnabled =
      info?.type === "form" ? formEnabledById.get(info.instanceId) : undefined;
    return isTypedModuleLandingEnabled(k, moduleTypes, formEnabled);
  });
  return [...builtin, ...typed, ...custom];
}

export function customModuleKeyToId(key: string): string | null {
  if (key.startsWith("custom-")) return key.slice("custom-".length);
  return null;
}

export function isBuiltinModuleKey(key: string): key is BuiltinModuleKey {
  return key in PAGE_MODULE_LABELS;
}

export type TypedModuleType = "menu" | "businessCard" | "wifi" | "form";

export interface ModuleTypeInfo {
  type: TypedModuleType;
  instanceId: string;
  /** false — блок скрыт на микро-лендинге (по умолчанию при создании). undefined — виден (старые записи). */
  landingEnabled?: boolean;
}

export type ModuleTypes = Record<string, ModuleTypeInfo>;

export function parseModuleTypes(raw: unknown): ModuleTypes {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const result: ModuleTypes = {};
  for (const [key, val] of Object.entries(o)) {
    if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      if (typeof v.type === "string" && typeof v.instanceId === "string") {
        result[key] = {
          type: v.type as TypedModuleType,
          instanceId: v.instanceId,
          ...(v.landingEnabled === false ? { landingEnabled: false } : {}),
          ...(v.landingEnabled === true ? { landingEnabled: true } : {}),
        };
      }
    }
  }
  return result;
}

/** Включён ли типовой блок на микро-лендинге (меню / визитка / Wi‑Fi / форма). */
export function isTypedModuleLandingEnabled(
  key: string,
  moduleTypes: ModuleTypes,
  formLandingEnabled?: boolean
): boolean {
  const info = moduleTypes[key];
  if (!info) return false;
  if (info.type === "form") return formLandingEnabled ?? false;
  return info.landingEnabled !== false;
}

export function moduleTypesToJson(types: ModuleTypes): ModuleTypes {
  return { ...types };
}

export function menuModuleKey(menuId: string): `menu-${string}` {
  return `menu-${menuId}`;
}

export function bizcardModuleKey(cardId: string): `bizcard-${string}` {
  return `bizcard-${cardId}`;
}

export function wifiModuleKey(configId: string): `wifi-${string}` {
  return `wifi-${configId}`;
}

export function formModuleKey(formId: string): `form-${string}` {
  return `form-${formId}`;
}

export function getModuleTypeInfo(key: string, moduleTypes: ModuleTypes): ModuleTypeInfo | null {
  return moduleTypes[key] ?? null;
}

export function typedModuleKeyToInstanceId(key: string, moduleTypes: ModuleTypes): string | null {
  return moduleTypes[key]?.instanceId ?? null;
}

export function isTypedModuleKey(key: string, moduleTypes: ModuleTypes): boolean {
  return key in moduleTypes;
}

export function getModuleType(key: string, moduleTypes: ModuleTypes): TypedModuleType | null {
  return moduleTypes[key]?.type ?? null;
}

export function removeModuleType(key: string, types: ModuleTypes): ModuleTypes {
  const next = { ...types };
  delete next[key];
  return next;
}
