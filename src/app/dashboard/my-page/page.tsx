"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import MenuEditor, { type MenuData } from "@/components/dashboard/MenuEditor";
import BusinessCardConstructor from "@/components/dashboard/BusinessCardConstructor";
import WifiConfigEditor from "@/components/dashboard/WifiConfigEditor";
import ReviewRoutingEditor from "@/components/dashboard/ReviewRoutingEditor";
import CustomPageEditor from "@/components/dashboard/CustomPageEditor";
import FormEditor, { type FormEditState } from "@/components/dashboard/FormEditor";
import TipsSettingsEditor, { type TipsEmployeeItem } from "@/components/dashboard/TipsSettingsEditor";
import type { LandingTipsPayload, TipsMode } from "@/lib/tips-config";
import type { FormFieldType } from "@/lib/form-config";
import { FORM_PRESETS } from "@/lib/form-config";
import MicroLandingView from "@/components/scan/MicroLandingView";
import EmojiPicker from "@/components/ui/EmojiPicker";
import {
  parsePageModules,
  parseModuleOrder,
  parseModuleLabels,
  parseModuleIcons,
  parseModuleTypes,
  buildDefaultModuleOrder,
  PAGE_MODULE_LABELS,
  LANDING_BUILTIN_MODULE_KEYS,
  isBuiltinModuleKey,
  customModuleKeyToId,
  getModuleLabel as resolveModuleLabel,
  menuModuleKey,
  bizcardModuleKey,
  wifiModuleKey,
  formModuleKey,
  isTypedModuleKey,
  getModuleType,
  typedModuleKeyToInstanceId,
  removeModuleType,
  type PageModules,
  type BuiltinModuleKey,
  type ModuleKey,
  type ModuleLabels,
  type ModuleIcons,
  type ModuleTypes,
} from "@/lib/page-modules";
import { parseReviewRouting, type ReviewRoutingConfig } from "@/lib/review-routing";
import { DEFAULT_REVIEW_ROUTING } from "@/lib/review-routing";
import {
  BRAND_COLOR_PRESETS,
  DEFAULT_BRAND_COLOR,
  DEFAULT_PAGE_APPEARANCE,
  DEFAULT_LANDING_SUBTITLE,
  normalizeBrandColor,
  type PageAppearance,
} from "@/lib/brand-theme";
import { STANDARD_COVERS } from "@/lib/standard-covers";
import {
  Loader2,
  Layout,
  ExternalLink,
  Plus,
  GripVertical,
  Eye,
  Smartphone,
  ChevronUp,
  ChevronDown,
  Trash2,
  FileText,
  Pencil,
  Check,
  X,
  Palette,
  Image as ImageIcon,
  Upload,
  Coffee,
  CreditCard,
  Wifi,
  Star,
  ClipboardList,
  Banknote,
  EyeOff,
  ChevronRight,
  Cloud,
} from "lucide-react";
import Link from "next/link";

interface EstablishmentOption {
  id: string;
  name: string;
}

interface BusinessCardData {
  id?: string;
  fullName: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  about: string | null;
  avatarUrl: string | null;
  socialLinks: { type: string; url: string }[];
  accentColor: string;
  contactEnabled?: boolean;
  contactMessengerId?: string | null;
  tipsUrl?: string | null;
  tipsLabel?: string | null;
}

interface WifiConfigData {
  id?: string;
  ssid: string;
  password: string | null;
  encryption: string;
  hidden: boolean;
}

interface CustomPageItem {
  id: string;
  menuItemLabel: string;
  title: string;
  content: string;
  type: string;
  url?: string | null;
  icon?: string | null;
  enabled: boolean;
  fileAssetId?: string | null;
  fileAsset?: {
    id: string;
    title: string | null;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
  } | null;
}

interface FormApiShape {
  id: string;
  title: string;
  description: string | null;
  submitLabel: string;
  successMessage: string;
  enabled: boolean;
  fields: Array<{
    id: string;
    label: string;
    placeholder: string | null;
    helpText: string | null;
    type: string;
    required: boolean;
    options: unknown;
    order: number;
  }>;
}

function apiFormToState(f: FormApiShape): FormEditState {
  return {
    id: f.id,
    title: f.title,
    description: f.description,
    submitLabel: f.submitLabel,
    successMessage: f.successMessage,
    enabled: f.enabled,
    fields: f.fields.map((fld) => ({
      id: fld.id,
      label: fld.label,
      placeholder: fld.placeholder,
      helpText: fld.helpText,
      type: (fld.type as FormFieldType) ?? "text",
      required: fld.required,
      options: Array.isArray(fld.options) ? (fld.options as string[]) : null,
      order: fld.order,
    })),
  };
}

type EditorTab = BuiltinModuleKey | "custom-new" | `custom-${string}` | `menu-${string}` | `bizcard-${string}` | `wifi-${string}` | `form-${string}` | "add-menu" | "add-bizcard" | "add-wifi";

function editorTabToPreviewSection(
  tab: EditorTab | null,
  moduleTypes: ModuleTypes
): string {
  if (!tab || tab === "custom-new" || tab.startsWith("add-")) return "home";
  if (isBuiltinModuleKey(tab)) return tab;
  if (customModuleKeyToId(tab) || isTypedModuleKey(tab, moduleTypes)) return tab;
  return "home";
}

export default function MyPageDashboard() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [establishmentId, setEstablishmentId] = useState("");
  const [establishmentName, setEstablishmentName] = useState("");
  const [pageModules, setPageModules] = useState<PageModules>(parsePageModules(null));
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [businessCardData, setBusinessCardData] = useState<BusinessCardData | null>(null);
  const [wifiConfigData, setWifiConfigData] = useState<WifiConfigData | null>(null);
  const [reviewRouting, setReviewRouting] = useState<ReviewRoutingConfig>(DEFAULT_REVIEW_ROUTING);
  const [isPro, setIsPro] = useState(false);
  const [activeEditor, setActiveEditorState] = useState<EditorTab | null>(() => {
    const tab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
    return (tab as EditorTab) || "menu";
  });
  const setActiveEditor = useCallback((next: EditorTab | null) => {
    setActiveEditorState(next);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("tab", String(next));
    else params.delete("tab");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, []);
  const [customPages, setCustomPages] = useState<CustomPageItem[]>([]);
  const [moduleOrder, setModuleOrder] = useState<ModuleKey[] | null>(null);
  const [moduleLabels, setModuleLabels] = useState<ModuleLabels>({});
  const [moduleIcons, setModuleIcons] = useState<ModuleIcons>({});
  const [moduleTypes, setModuleTypes] = useState<ModuleTypes>({});
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [pageAppearance, setPageAppearance] = useState<PageAppearance>(DEFAULT_PAGE_APPEARANCE);
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [landingSubtitle, setLandingSubtitle] = useState("");
  const [shortSlug, setShortSlug] = useState("");
  const [shortSlugSaving, setShortSlugSaving] = useState(false);
  const [shortSlugError, setShortSlugError] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [extraMenus, setExtraMenus] = useState<MenuData[]>([]);
  /** Позиции iiko для предпросмотра лендинга (в БД items пустые). */
  const [iikoResolvedMenus, setIikoResolvedMenus] = useState<Record<string, MenuData>>({});
  const [extraBusinessCards, setExtraBusinessCards] = useState<BusinessCardData[]>([]);
  const [extraWifiConfigs, setExtraWifiConfigs] = useState<WifiConfigData[]>([]);
  const [forms, setForms] = useState<FormEditState[]>([]);
  const [landingTipsType, setLandingTipsType] = useState<TipsMode | null>(null);
  const [landingTipsPhone, setLandingTipsPhone] = useState("");
  const [landingTipsBankName, setLandingTipsBankName] = useState("");
  const [landingTipsUrl, setLandingTipsUrl] = useState("");
  const [tipsEmployees, setTipsEmployees] = useState<TipsEmployeeItem[]>([]);

  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavesRef = useRef(0);
  const trackSave = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    pendingSavesRef.current += 1;
    setAutoSaveState("saving");
    try {
      const r = await p;
      pendingSavesRef.current -= 1;
      if (pendingSavesRef.current <= 0) {
        pendingSavesRef.current = 0;
        setAutoSaveState("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setAutoSaveState("idle"), 1800);
      }
      return r;
    } catch (e) {
      pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
      if (pendingSavesRef.current <= 0) setAutoSaveState("idle");
      throw e;
    }
  }, []);

  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addMenuOpen]);

  useEffect(() => {
    if (!establishmentId) {
      setIikoResolvedMenus({});
      return;
    }
    const toFetch: MenuData[] = [];
    if (menuData?.source === "IIKO" && menuData.id) toFetch.push(menuData);
    for (const m of extraMenus) {
      if (m.source === "IIKO" && m.id) toFetch.push(m);
    }
    if (toFetch.length === 0) {
      setIikoResolvedMenus({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        toFetch.map(async (m) => {
          try {
            const res = await fetch("/api/menus/iiko/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ menuId: m.id, establishmentId }),
            });
            const data = await res.json();
            if (!res.ok || !data.menu) return null;
            return [m.id!, data.menu as MenuData] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const next: Record<string, MenuData> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setIikoResolvedMenus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [establishmentId, menuData?.id, menuData?.source, extraMenus]);

  const menuForLandingPreview = (m: MenuData | null): MenuData | null => {
    if (!m) return null;
    if (m.source === "IIKO" && m.id && iikoResolvedMenus[m.id]) {
      return { ...m, ...iikoResolvedMenus[m.id] };
    }
    return m;
  };

  const loadPage = useCallback(async (estId: string) => {
    const res = await fetch(`/api/establishments/${estId}/page`);
    if (!res.ok) throw new Error("load failed");
    const data = await res.json();
    const est = data.establishment;
    setEstablishmentName(est.name);
    setPageModules(parsePageModules(est.pageModules));
    setModuleOrder(parseModuleOrder(est.moduleOrder));
    setModuleLabels(parseModuleLabels(est.moduleLabels));
    setModuleIcons(parseModuleIcons(est.moduleIcons));
    setModuleTypes(parseModuleTypes(est.moduleTypes));
    setMenuData(est.menu);
    setBusinessCardData(est.businessCard);
    setWifiConfigData(est.wifiConfig);
    setReviewRouting(parseReviewRouting(est.reviewRouting));
    setIsPro(data.isPro || false);
    setCustomPages(est.customPages || []);
    const loadedColor = est.brandColor || DEFAULT_BRAND_COLOR;
    setBrandColor(loadedColor);
    setPageAppearance(
      est.pageAppearance === "dark" ? "dark" : DEFAULT_PAGE_APPEARANCE
    );
    setCustomColorOpen(!BRAND_COLOR_PRESETS.some((p) => p.hex === loadedColor));
    setLogoUrl(est.logoUrl || null);
    setCoverUrl(est.coverUrl || null);
    if (!est.logoUrl && !est.coverUrl) setAppearanceOpen(true);
    setLandingSubtitle(est.landingSubtitle || "");
    setShortSlug(est.shortSlug || "");
    setShortSlugError("");
    setExtraMenus(est.extraMenus || []);
    setExtraBusinessCards(est.extraBusinessCards || []);
    setExtraWifiConfigs(est.extraWifiConfigs || []);
    setForms((est.forms || []).map((f: FormApiShape) => apiFormToState(f)));
    const tipsType = est.landingTipsType as TipsMode | null;
    setLandingTipsType(
      tipsType === "REDIRECT" || tipsType === "PHONE" || tipsType === "EMPLOYEES" ? tipsType : null
    );
    setLandingTipsPhone(est.landingTipsPhone || "");
    setLandingTipsBankName(est.landingTipsBankName || "");
    setLandingTipsUrl(est.landingTipsUrl || "");
    setTipsEmployees(
      (est.tipsEmployees || []).map((e: Record<string, unknown>) => ({
        id: e.id as string,
        name: e.name as string,
        photoUrl: e.photoUrl as string | null,
        paymentType: (e.paymentType as "LINK" | "PHONE") || "PHONE",
        paymentUrl: (e.paymentUrl as string) || undefined,
        phone: (e.phone as string) || undefined,
        bankName: (e.bankName as string) || undefined,
        _localId: e.id as string,
      }))
    );
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch("/api/subscription")
      .then((r) => r.json())
      .then((data) => setIsPro(!!data.hasPaidFeatures))
      .catch(() => {});

    fetch("/api/establishments")
      .then((r) => r.json())
      .then((data) => {
        const list = data.establishments || [];
        setEstablishments(list);
        if (list.length === 0) {
          setLoading(false);
          return;
        }
        const firstId = list[0].id;
        setEstablishmentId(firstId);
        return loadPage(firstId).finally(() => setLoading(false));
      })
      .catch(() => {
        setError("Не удалось загрузить данные");
        setLoading(false);
      });
  }, [status, router, loadPage]);

  const handleEstablishmentChange = async (estId: string) => {
    setEstablishmentId(estId);
    setLoading(true);
    setError("");
    try {
      await loadPage(estId);
    } catch {
      setError("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  const savePageModules = async (next: PageModules) => {
    setPageModules(next);
    await trackSave(fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageModules: next }),
    }));
  };

  const toggleModule = (key: string) => {
    if (isBuiltinModuleKey(key)) {
      const turningOn = !pageModules[key];
      const next = { ...pageModules, [key]: turningOn };
      savePageModules(next);
      // Если порядок блоков уже сохранён, добавить новый включённый модуль (напр. tips)
      if (
        turningOn &&
        moduleOrder &&
        moduleOrder.length > 0 &&
        !moduleOrder.includes(key as ModuleKey)
      ) {
        saveModuleOrder([...moduleOrder, key as ModuleKey]);
      }
    }
  };

  const saveModuleLabels = async (next: ModuleLabels) => {
    setModuleLabels(next);
    await trackSave(fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleLabels: next }),
    }));
  };

  const saveModuleIcons = async (next: ModuleIcons) => {
    setModuleIcons(next);
    await trackSave(fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleIcons: next }),
    }));
  };

  const saveModuleTypes = async (next: ModuleTypes) => {
    setModuleTypes(next);
    await trackSave(fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleTypes: next }),
    }));
  };

  const saveModuleOrder = async (newOrder: ModuleKey[]) => {
    setModuleOrder(newOrder);
    await trackSave(fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleOrder: newOrder }),
    }));
  };

  const startEditLabel = (key: string) => {
    setEditLabelValue(getModuleLabel(key));
    setEditingLabel(key);
  };

  const confirmEditLabel = async () => {
    if (!editingLabel) return;
    const trimmed = editLabelValue.trim();
    if (isBuiltinModuleKey(editingLabel)) {
      const next: ModuleLabels = { ...moduleLabels };
      if (trimmed && trimmed !== PAGE_MODULE_LABELS[editingLabel]) {
        next[editingLabel] = trimmed;
      } else {
        delete next[editingLabel];
      }
      await saveModuleLabels(next);
    }
    setEditingLabel(null);
    setEditLabelValue("");
  };

  const cancelEditLabel = () => {
    setEditingLabel(null);
    setEditLabelValue("");
  };

  const toggleCustomPage = async (id: string) => {
    const page = customPages.find((p) => p.id === id);
    if (!page) return;
    const res = await fetch("/api/custom-pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !page.enabled }),
    });
    if (res.ok) {
      const data = await res.json();
      setCustomPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data.customPage } : p))
      );
    }
  };

  const deleteCustomPage = async (id: string) => {
    const res = await fetch(`/api/custom-pages?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setCustomPages((prev) => prev.filter((p) => p.id !== id));
      setModuleOrder((prev) =>
        prev ? prev.filter((k) => k !== `custom-${id}`) : null
      );
      if (activeEditor === `custom-${id}`) {
        setActiveEditor("menu");
      }
    }
  };

  const moveModule = (index: number, direction: "up" | "down") => {
    const order = getEffectiveOrder();
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= order.length) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    saveModuleOrder(newOrder);
  };

  const reorderModule = (from: number, to: number) => {
    if (from === to) return;
    const order = getEffectiveOrder();
    if (from < 0 || from >= order.length || to < 0 || to >= order.length) return;
    const newOrder = [...order];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    saveModuleOrder(newOrder);
  };

  const saveBrandSettings = async (color: string, appearance: PageAppearance) => {
    const normalized = normalizeBrandColor(color) ?? DEFAULT_BRAND_COLOR;
    setBrandColor(normalized);
    setPageAppearance(appearance);
    setBusinessCardData((prev) =>
      prev ? { ...prev, accentColor: normalized } : prev
    );
    await trackSave(fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandColor: normalized, pageAppearance: appearance }),
    }));
  };

  const saveCoverUrl = async (url: string | null) => {
    setCoverUrl(url);
    await trackSave(fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverUrl: url }),
    }));
  };

  const saveLogoUrl = async (url: string | null) => {
    setLogoUrl(url);
    await trackSave(fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: url }),
    }));
  };

  const saveLandingSubtitle = async (value: string) => {
    const trimmed = value.trim();
    const toSave =
      trimmed && trimmed !== DEFAULT_LANDING_SUBTITLE ? trimmed.slice(0, 120) : null;
    setLandingSubtitle(trimmed && trimmed !== DEFAULT_LANDING_SUBTITLE ? trimmed : "");
    await trackSave(fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landingSubtitle: toSave }),
    }));
  };

  const saveShortSlug = async (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(trimmed)) {
      setShortSlugError("Только строчные латинские буквы, цифры, дефис, подчёркивание (2–32 символа)");
      return;
    }
    setShortSlugSaving(true);
    setShortSlugError("");
    const res = await fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortSlug: trimmed || null }),
    });
    const json = await res.json();
    setShortSlugSaving(false);
    if (!res.ok) {
      setShortSlugError(json.error || "Ошибка сохранения");
    } else {
      setShortSlug(json.establishment.shortSlug || "");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "cover") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "logo") setUploadingLogo(true);
    else setUploadingCover(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/file-assets/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error((await res.json()).error || "Ошибка загрузки файла");
      }

      const data = await res.json();
      const url = data.fileAsset.fileUrl;

      if (type === "logo") {
        await saveLogoUrl(url);
      } else {
        await saveCoverUrl(url);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Неизвестная ошибка");
      }
    } finally {
      if (type === "logo") setUploadingLogo(false);
      else setUploadingCover(false);
      e.target.value = "";
    }
  };

  const getEffectiveOrder = (): ModuleKey[] => {
    const allKeys = new Set<ModuleKey>();
    (LANDING_BUILTIN_MODULE_KEYS as BuiltinModuleKey[]).forEach((k) => {
      allKeys.add(k);
    });
    customPages.forEach((p) => {
      allKeys.add(`custom-${p.id}` as ModuleKey);
    });
    Object.keys(moduleTypes).forEach((k) => {
      allKeys.add(k as ModuleKey);
    });
    if (moduleOrder && moduleOrder.length > 0) {
      const ordered = moduleOrder.filter((k) => allKeys.has(k));
      const seen = new Set(ordered);
      allKeys.forEach((k) => {
        if (!seen.has(k)) ordered.push(k);
      });
      return ordered;
    }
    return buildDefaultModuleOrder(
      pageModules,
      customPages.filter((p) => p.enabled).map((p) => p.id)
    );
  };

  const getModuleLabel = (key: string): string => {
    if (isBuiltinModuleKey(key)) return resolveModuleLabel(key, moduleLabels);
    const cId = customModuleKeyToId(key);
    if (cId) return customPages.find((p) => p.id === cId)?.menuItemLabel ?? "Страница";
    if (isTypedModuleKey(key, moduleTypes)) {
      const info = moduleTypes[key];
      const typeLabel =
        info.type === "menu" ? "Меню"
        : info.type === "businessCard" ? "Визитка"
        : info.type === "form" ? "Форма"
        : "Wi-Fi";
      if (info.type === "menu") {
        const m = extraMenus.find((m) => m.id === info.instanceId);
        return m?.title || `Доп. ${typeLabel}`;
      }
      if (info.type === "businessCard") {
        const bc = extraBusinessCards.find((bc) => bc.id === info.instanceId);
        return bc?.fullName || `Доп. ${typeLabel}`;
      }
      if (info.type === "wifi") {
        const wc = extraWifiConfigs.find((wc) => wc.id === info.instanceId);
        return wc?.ssid || `Доп. ${typeLabel}`;
      }
      if (info.type === "form") {
        const f = forms.find((f) => f.id === info.instanceId);
        return f?.title || `Доп. ${typeLabel}`;
      }
    }
    return key;
  };

  const handleSaveMenu = async (saveData: MenuData) => {
    setSaving(true);
    setError("");
    try {
      let mId = menuData?.id;
      if (!mId) {
        const res = await fetch("/api/menus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...saveData, establishmentId }),
        });
        if (!res.ok) {
          setError((await res.json()).error || "Ошибка");
          return;
        }
        const d = await res.json();
        mId = d.menu.id;
        setMenuData(d.menu);
      } else {
        const res = await fetch("/api/menus", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...saveData, id: mId }),
        });
        if (!res.ok) {
          setError((await res.json()).error || "Ошибка");
          return;
        }
        setMenuData((await res.json()).menu);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExtraMenu = async (saveData: MenuData, instanceId: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/menus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...saveData, id: instanceId }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Ошибка");
        return;
      }
      const updated = (await res.json()).menu;
      setExtraMenus((prev) => prev.map((m) => (m.id === instanceId ? updated : m)));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusinessCard = async (cardData: BusinessCardData) => {
    setSaving(true);
    setError("");
    const payload = { ...cardData, accentColor: brandColor };
    try {
      let bcId = businessCardData?.id;
      if (!bcId) {
        const res = await fetch("/api/business-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, establishmentId }),
        });
        if (!res.ok) {
          setError((await res.json()).error || "Ошибка");
          return;
        }
        bcId = (await res.json()).businessCard.id;
      } else {
        const res = await fetch("/api/business-cards", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: bcId }),
        });
        if (!res.ok) {
          setError((await res.json()).error || "Ошибка");
          return;
        }
      }
      await loadPage(establishmentId);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExtraBusinessCard = async (cardData: BusinessCardData, instanceId: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/business-cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cardData, id: instanceId }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Ошибка");
        return;
      }
      const updated = (await res.json()).businessCard;
      setExtraBusinessCards((prev) => prev.map((bc) => (bc.id === instanceId ? { ...bc, ...updated } : bc)));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTips = async (payload: LandingTipsPayload) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/establishments/${establishmentId}/page`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Ошибка сохранения чаевых");
        return;
      }
      await loadPage(establishmentId);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWifi = async (configData: WifiConfigData) => {
    setSaving(true);
    setError("");
    try {
      let wcId = wifiConfigData?.id;
      if (!wcId) {
        const res = await fetch("/api/wifi-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...configData, establishmentId }),
        });
        if (!res.ok) {
          setError((await res.json()).error || "Ошибка");
          return;
        }
        wcId = (await res.json()).wifiConfig.id;
      } else {
        const res = await fetch("/api/wifi-configs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...configData, id: wcId }),
        });
        if (!res.ok) {
          setError((await res.json()).error || "Ошибка");
          return;
        }
      }
      await loadPage(establishmentId);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExtraWifi = async (configData: WifiConfigData, instanceId: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/wifi-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...configData, id: instanceId }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Ошибка");
        return;
      }
      const updated = (await res.json()).wifiConfig;
      setExtraWifiConfigs((prev) => prev.map((wc) => (wc.id === instanceId ? { ...wc, ...updated } : wc)));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCustomPage = async (data: {
    id?: string;
    menuItemLabel: string;
    title: string;
    content: string;
    type: string;
    url?: string | null;
    icon?: string | null;
    fileAssetId?: string | null;
  }) => {
    setSaving(true);
    setError("");
    try {
      if (data.id) {
        const res = await fetch("/api/custom-pages", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          setError((await res.json()).error || "Ошибка");
          return;
        }
        const updated = (await res.json()).customPage;
        setCustomPages((prev) =>
          prev.map((p) => (p.id === data.id ? { ...p, ...updated } : p))
        );
      } else {
        const res = await fetch("/api/custom-pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, establishmentId }),
        });
        if (!res.ok) {
          setError((await res.json()).error || "Ошибка");
          return;
        }
        const newPage = (await res.json()).customPage;
        setCustomPages((prev) => [...prev, newPage]);
        setActiveEditor(`custom-${newPage.id}` as EditorTab);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddMenu = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Новое меню", items: [], establishmentId, linkAsPrimary: false }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Ошибка");
        return;
      }
      const { menu } = await res.json();
      const key = menuModuleKey(menu.id);
      const newTypes = { ...moduleTypes, [key]: { type: "menu" as const, instanceId: menu.id } };
      setExtraMenus((prev) => [...prev, menu]);
      const order = getEffectiveOrder();
      const newOrder = [...order, key as ModuleKey];
      await saveModuleOrder(newOrder);
      await saveModuleTypes(newTypes);
      setActiveEditor(key as EditorTab);
    } finally {
      setSaving(false);
    }
  };

  const handleAddBusinessCard = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/business-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Новая визитка",
          accentColor: brandColor,
          establishmentId,
          linkAsPrimary: false,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Ошибка");
        return;
      }
      const { businessCard } = await res.json();
      const key = bizcardModuleKey(businessCard.id);
      const newTypes = { ...moduleTypes, [key]: { type: "businessCard" as const, instanceId: businessCard.id } };
      setExtraBusinessCards((prev) => [...prev, { ...businessCard }]);
      const order = getEffectiveOrder();
      const newOrder = [...order, key as ModuleKey];
      await saveModuleOrder(newOrder);
      await saveModuleTypes(newTypes);
      setActiveEditor(key as EditorTab);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTips = () => {
    if (!pageModules.tips) {
      const next = { ...pageModules, tips: true };
      savePageModules(next);
      if (moduleOrder && moduleOrder.length > 0 && !moduleOrder.includes("tips")) {
        saveModuleOrder([...moduleOrder, "tips"]);
      }
    }
    setActiveEditor("tips");
  };

  const handleAddWifi = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/wifi-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssid: "Новая сеть",
          establishmentId,
          linkAsPrimary: false,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Ошибка");
        return;
      }
      const { wifiConfig } = await res.json();
      const key = wifiModuleKey(wifiConfig.id);
      const newTypes = { ...moduleTypes, [key]: { type: "wifi" as const, instanceId: wifiConfig.id } };
      setExtraWifiConfigs((prev) => [...prev, wifiConfig]);
      const order = getEffectiveOrder();
      const newOrder = [...order, key as ModuleKey];
      await saveModuleOrder(newOrder);
      await saveModuleTypes(newTypes);
      setActiveEditor(key as EditorTab);
    } finally {
      setSaving(false);
    }
  };

  const deleteTypedModule = async (key: string) => {
    const info = moduleTypes[key];
    if (!info) return;
    const label = getModuleLabel(key);
    if (!window.confirm(`Удалить «${label}»?`)) return;

    const endpoint =
      info.type === "menu" ? "/api/menus" :
      info.type === "businessCard" ? "/api/business-cards" :
      info.type === "form" ? "/api/forms" :
      "/api/wifi-configs";

    const res = await fetch(`${endpoint}?id=${info.instanceId}`, { method: "DELETE" });
    if (res.ok) {
      const newTypes = removeModuleType(key, moduleTypes);
      await saveModuleTypes(newTypes);
      setModuleOrder((prev) => prev ? prev.filter((k) => k !== key) : null);
      if (info.type === "menu") setExtraMenus((prev) => prev.filter((m) => m.id !== info.instanceId));
      if (info.type === "businessCard") setExtraBusinessCards((prev) => prev.filter((bc) => bc.id !== info.instanceId));
      if (info.type === "wifi") setExtraWifiConfigs((prev) => prev.filter((wc) => wc.id !== info.instanceId));
      if (info.type === "form") setForms((prev) => prev.filter((f) => f.id !== info.instanceId));
      if (activeEditor === key) setActiveEditor("menu");
    }
  };

  const handleAddForm = async (presetId: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ establishmentId, presetId }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Ошибка");
        return;
      }
      const { form } = await res.json();
      const state = apiFormToState(form);
      const key = formModuleKey(form.id);
      const newTypes = { ...moduleTypes, [key]: { type: "form" as const, instanceId: form.id } };
      setForms((prev) => [...prev, state]);
      const order = getEffectiveOrder();
      const newOrder = [...order, key as ModuleKey];
      await saveModuleOrder(newOrder);
      await saveModuleTypes(newTypes);
      setActiveEditor(key as EditorTab);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveForm = async (formId: string, data: Partial<FormEditState>) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/forms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: formId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Ошибка сохранения");
        return;
      }
      const { form } = await res.json();
      const state = apiFormToState(form);
      setForms((prev) => prev.map((f) => (f.id === formId ? state : f)));
    } finally {
      setSaving(false);
    }
  };

  if (loading && establishments.length === 0) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  const effectiveOrder = getEffectiveOrder();
  const landingOrder = effectiveOrder;

  const activeCustomPage = (() => {
    if (!activeEditor) return null;
    const cId = customModuleKeyToId(activeEditor);
    if (!cId) return null;
    return customPages.find((p) => p.id === cId) ?? null;
  })();

  const activeExtraMenu = (() => {
    if (!activeEditor) return null;
    const id = typedModuleKeyToInstanceId(activeEditor, moduleTypes);
    if (!id || getModuleType(activeEditor, moduleTypes) !== "menu") return null;
    return extraMenus.find((m) => m.id === id) ?? null;
  })();

  const activeExtraBusinessCard = (() => {
    if (!activeEditor) return null;
    const id = typedModuleKeyToInstanceId(activeEditor, moduleTypes);
    if (!id || getModuleType(activeEditor, moduleTypes) !== "businessCard") return null;
    return extraBusinessCards.find((bc) => bc.id === id) ?? null;
  })();

  const activeForm = (() => {
    if (!activeEditor) return null;
    const id = typedModuleKeyToInstanceId(activeEditor, moduleTypes);
    if (!id || getModuleType(activeEditor, moduleTypes) !== "form") return null;
    return forms.find((f) => f.id === id) ?? null;
  })();

  const activeExtraWifi = (() => {
    if (!activeEditor) return null;
    const id = typedModuleKeyToInstanceId(activeEditor, moduleTypes);
    if (!id || getModuleType(activeEditor, moduleTypes) !== "wifi") return null;
    return extraWifiConfigs.find((wc) => wc.id === id) ?? null;
  })();

  const previewSection = editorTabToPreviewSection(activeEditor, moduleTypes);

  const isModuleOn = (key: string): boolean => {
    if (isBuiltinModuleKey(key)) return pageModules[key];
    const cId = customModuleKeyToId(key);
    if (cId) return customPages.find((p) => p.id === cId)?.enabled ?? false;
    return true;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <MyPageHeader
          autoSaveState={autoSaveState}
          establishments={establishments}
          establishmentId={establishmentId}
          onChangeEstablishment={handleEstablishmentChange}
          shortSlug={shortSlug}
        />

        {establishments.length === 0 ? (
          <Card>
            <p className="text-gray-600 mb-4">
              Сначала создайте заведение, чтобы настроить страницу.
            </p>
            <Button onClick={() => router.push("/dashboard/establishments")}>
              Перейти к заведениям
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-gray-500 -mt-2">
              Ссылки на Яндекс / 2GIS — в{" "}
              <Link
                href={`/dashboard/establishments/${establishmentId}`}
                className="text-indigo-600 hover:underline inline-flex items-center gap-0.5"
              >
                настройках заведения
                <ExternalLink className="w-3 h-3" />
              </Link>
            </p>

            {/* APPEARANCE_START */}
            <Card>
              <button
                type="button"
                onClick={() => setAppearanceOpen((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Оформление</h3>
                  <span className="text-xs text-gray-400">логотип, обложка, цвет, тема</span>
                </div>
                <ChevronRight
                  className={`w-5 h-5 text-gray-400 transition-transform ${appearanceOpen ? "rotate-90" : ""}`}
                />
              </button>
            </Card>

            {appearanceOpen && (
            <>
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Брендирование (Логотип и Обложка)</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Загрузите логотип заведения и выберите красивую фотографию для шапки страницы.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Подзаголовок на лендинге
                </label>
                <input
                  type="text"
                  value={landingSubtitle}
                  onChange={(e) => setLandingSubtitle(e.target.value)}
                  onBlur={() => saveLandingSubtitle(landingSubtitle)}
                  placeholder={DEFAULT_LANDING_SUBTITLE}
                  maxLength={120}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Текст под названием заведения. Пустое поле — стандартная фраза «{DEFAULT_LANDING_SUBTITLE}».
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Короткий адрес страницы
                </label>
                <div className="flex items-center gap-2 max-w-md">
                  <span className="text-sm text-gray-500 shrink-0">qrstars.ru/a/</span>
                  <input
                    type="text"
                    value={shortSlug}
                    onChange={(e) => { setShortSlug(e.target.value.toLowerCase()); setShortSlugError(""); }}
                    onBlur={() => saveShortSlug(shortSlug)}
                    placeholder="my-cafe"
                    maxLength={32}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {shortSlugSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />}
                </div>
                {shortSlugError && (
                  <p className="text-xs text-red-500 mt-1">{shortSlugError}</p>
                )}
                {shortSlug && !shortSlugError && (
                  <p className="text-xs text-gray-500 mt-1">
                    Страница доступна по адресу:{" "}
                    <a
                      href={`/a/${shortSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      qrstars.ru/a/{shortSlug}
                    </a>
                  </p>
                )}
                {!shortSlug && (
                  <p className="text-xs text-gray-500 mt-1">
                    Необязательно. Задайте короткий адрес — латинские буквы, цифры, дефис или подчёркивание.
                  </p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Логотип заведения
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <label className="relative cursor-pointer bg-white border border-gray-300 rounded-md shadow-sm px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500">
                        <span>{uploadingLogo ? "Загрузка..." : "Загрузить логотип"}</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/png, image/jpeg, image/webp"
                          onChange={(e) => handleFileUpload(e, "logo")}
                          disabled={uploadingLogo}
                        />
                      </label>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => saveLogoUrl(null)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG до 5 МБ. Рекомендуется квадратное изображение.</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Обложка (Баннер)
                  </label>
                  <label className="relative cursor-pointer text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                    {uploadingCover ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Загрузить свою</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => handleFileUpload(e, "cover")}
                      disabled={uploadingCover}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => saveCoverUrl(null)}
                    className={`relative rounded-xl border-2 overflow-hidden aspect-video transition-all flex flex-col items-center justify-center bg-gray-50 ${
                      !coverUrl
                        ? "border-indigo-600 ring-2 ring-indigo-600/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <X className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs font-medium text-gray-500">Без обложки</span>
                    {!coverUrl && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center z-10">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>

                  {coverUrl && !STANDARD_COVERS.some(c => c.url === coverUrl) && (
                    <button
                      type="button"
                      className="relative rounded-xl border-2 overflow-hidden aspect-video transition-all group border-indigo-600 ring-2 ring-indigo-600/20"
                    >
                      <img
                        src={coverUrl}
                        alt="Своя обложка"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                        <span className="text-white text-xs font-medium truncate">Своя обложка</span>
                      </div>
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center z-10">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    </button>
                  )}

                  {STANDARD_COVERS.map((cover) => {
                    const selected = coverUrl === cover.url;
                    return (
                      <button
                        key={cover.id}
                        type="button"
                        onClick={() => saveCoverUrl(cover.url)}
                        className={`relative rounded-xl border-2 overflow-hidden aspect-video transition-all group ${
                          selected
                            ? "border-indigo-600 ring-2 ring-indigo-600/20"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <img
                          src={cover.url}
                          alt={cover.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <span className="text-white text-xs font-medium truncate">{cover.name}</span>
                        </div>
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center z-10">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Цвет бренда</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Акцент для микро-лендинга, меню, отзывов и визитки. Обложка настраивается отдельно выше.
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {BRAND_COLOR_PRESETS.map((preset) => {
                  const selected =
                    brandColor === preset.hex && !customColorOpen;
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      title={preset.label}
                      onClick={() => {
                        setCustomColorOpen(false);
                        saveBrandSettings(preset.hex, pageAppearance);
                      }}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        selected
                          ? "border-gray-900 scale-110 ring-2 ring-indigo-600/30"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: preset.hex }}
                    />
                  );
                })}
                <label
                  className={`relative w-10 h-10 rounded-full border-2 cursor-pointer overflow-hidden flex items-center justify-center text-xs font-medium transition-all ${
                    customColorOpen ||
                    !BRAND_COLOR_PRESETS.some((p) => p.hex === brandColor)
                      ? "border-gray-900 scale-110 ring-2 ring-indigo-600/30"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  title="Свой цвет"
                >
                  <span className="text-gray-600">Свой</span>
                  <input
                    type="color"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={brandColor}
                    onChange={(e) => {
                      setCustomColorOpen(true);
                      saveBrandSettings(e.target.value, pageAppearance);
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mb-2">Стиль страницы</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => saveBrandSettings(brandColor, "light")}
                  className={`flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    pageAppearance === "light"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Светлая
                </button>
                <button
                  type="button"
                  onClick={() => saveBrandSettings(brandColor, "dark")}
                  className={`flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    pageAppearance === "dark"
                      ? "border-indigo-600 bg-slate-800 text-white"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Тёмная
                </button>
              </div>
            </Card>
            </>
            )}
            {/* APPEARANCE_END */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">
                      Блоки на микро-лендинге
                    </h3>
                    <div className="relative" ref={addMenuRef}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setAddMenuOpen((v) => !v)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Добавить блок
                      </Button>
                      {addMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg w-[280px] py-1">
                          <button
                            type="button"
                            onClick={() => { setAddMenuOpen(false); handleAddMenu(); }}
                            className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                          >
                            <Coffee className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">Меню</div>
                              <div className="text-xs text-gray-500">Категории, позиции, цены</div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAddMenuOpen(false); handleAddBusinessCard(); }}
                            className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                          >
                            <CreditCard className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">Визитка</div>
                              <div className="text-xs text-gray-500">Контакты сотрудника</div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAddMenuOpen(false); handleAddWifi(); }}
                            className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                          >
                            <Wifi className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">Wi-Fi</div>
                              <div className="text-xs text-gray-500">SSID и пароль для гостя</div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAddMenuOpen(false); handleAddTips(); }}
                            className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                          >
                            <Banknote className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">Чаевые</div>
                              <div className="text-xs text-gray-500">CloudTips, ЮMoney, СБП или команда</div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAddMenuOpen(false); setActiveEditor("custom-new"); }}
                            className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                          >
                            <FileText className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">Произвольная страница</div>
                              <div className="text-xs text-gray-500">Текст, ссылка или файл</div>
                            </div>
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wide text-gray-400">Формы</div>
                          {FORM_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setAddMenuOpen(false); handleAddForm(p.id); }}
                              className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                            >
                              <ClipboardList className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                <div className="text-xs text-gray-500">{p.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Перемещайте, включайте и отключайте блоки. Гость увидит только
                    включённые.
                  </p>
                  <div className="space-y-1">
                    {landingOrder.map((key, idx) => {
                      const isCustom = !!customModuleKeyToId(key);
                      const isTyped = isTypedModuleKey(key, moduleTypes);
                      const label = getModuleLabel(key);
                      const isOn = isModuleOn(key);

                      const builtinFallback = (k: BuiltinModuleKey) => {
                        const IconMap = {
                          menu: Coffee,
                          review: Star,
                          businessCard: CreditCard,
                          wifi: Wifi,
                          tips: Banknote,
                        } as const;
                        const Ic = IconMap[k];
                        return Ic ? <Ic className="w-3.5 h-3.5" /> : null;
                      };

                      const getModuleIcon = () => {
                        if (isBuiltinModuleKey(key)) {
                          const emoji = moduleIcons[key];
                          if (emoji) return <span className="text-base">{emoji}</span>;
                          return builtinFallback(key);
                        }
                        if (isTyped) {
                          const info = moduleTypes[key];
                          if (info.type === "menu") return <Coffee className="w-3.5 h-3.5" />;
                          if (info.type === "businessCard") return <CreditCard className="w-3.5 h-3.5" />;
                          if (info.type === "wifi") return <Wifi className="w-3.5 h-3.5" />;
                          if (info.type === "form") return <ClipboardList className="w-3.5 h-3.5" />;
                        }
                        const cp = customPages.find((p) => p.id === customModuleKeyToId(key));
                        if (cp?.icon) return <span className="text-base">{cp.icon}</span>;
                        return <FileText className="w-3.5 h-3.5" />;
                      };

                      const iconBg = isTyped
                        ? "bg-green-100 text-green-600"
                        : isBuiltinModuleKey(key)
                          ? moduleIcons[key] ? "bg-indigo-100 text-base" : "bg-indigo-100 text-indigo-600"
                          : "bg-purple-100 text-purple-600";

                      const isActive = activeEditor === key;
                      const isDragging = dragIndex === idx;
                      const isDragOver = dragOverIndex === idx && dragIndex !== null && dragIndex !== idx;
                      return (
                        <div
                          key={key}
                          draggable
                          onDragStart={(e) => {
                            setDragIndex(idx);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dragOverIndex !== idx) setDragOverIndex(idx);
                          }}
                          onDragLeave={() => {
                            if (dragOverIndex === idx) setDragOverIndex(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragIndex !== null) reorderModule(dragIndex, idx);
                            setDragIndex(null);
                            setDragOverIndex(null);
                          }}
                          onDragEnd={() => {
                            setDragIndex(null);
                            setDragOverIndex(null);
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg border group transition-colors ${
                            isActive
                              ? "border-indigo-400 bg-indigo-50/60 ring-1 ring-indigo-200"
                              : isOn
                                ? "border-gray-200 hover:bg-gray-50"
                                : "border-gray-200 bg-gray-50"
                          } ${isDragging ? "opacity-40" : ""} ${isDragOver ? "border-indigo-500 border-dashed" : ""}`}
                        >
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveModule(idx, "up")}
                              disabled={idx === 0}
                              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveModule(idx, "down")}
                              disabled={idx === landingOrder.length - 1}
                              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <GripVertical className="w-4 h-4 text-gray-400 shrink-0 cursor-grab active:cursor-grabbing" />

                          <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${iconBg}`}>
                            {isBuiltinModuleKey(key) ? (
                              <EmojiPicker
                                value={moduleIcons[key] ?? null}
                                onChange={(e) => {
                                  const next: ModuleIcons = { ...moduleIcons };
                                  if (e) next[key] = e; else delete next[key];
                                  saveModuleIcons(next);
                                }}
                                fallback={builtinFallback(key)}
                                inline
                              />
                            ) : (
                              getModuleIcon()
                            )}
                          </div>

                          {isBuiltinModuleKey(key) && editingLabel === key ? (
                            <div className="flex-1 flex items-center gap-1 min-w-0">
                              <input
                                type="text"
                                value={editLabelValue}
                                onChange={(e) => setEditLabelValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") confirmEditLabel();
                                  if (e.key === "Escape") cancelEditLabel();
                                }}
                                autoFocus
                                className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <button type="button" onClick={confirmEditLabel} className="p-0.5 text-green-600 hover:text-green-800 shrink-0" title="Сохранить">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={cancelEditLabel} className="p-0.5 text-gray-400 hover:text-gray-700 shrink-0" title="Отмена">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveEditor(key as EditorTab)}
                              className={`flex-1 text-left text-sm font-medium transition-colors truncate flex items-center gap-1.5 ${
                                isActive ? "text-indigo-700" : "text-gray-800 hover:text-indigo-600"
                              } ${!isOn ? "text-gray-400" : ""}`}
                            >
                              <span className="truncate">{label}</span>
                              {!isOn && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                                  <EyeOff className="w-3 h-3" />
                                  скрыт
                                </span>
                              )}
                            </button>
                          )}

                          {isBuiltinModuleKey(key) && editingLabel !== key && (
                            <button
                              type="button"
                              onClick={() => startEditLabel(key)}
                              className="p-1 text-gray-400 hover:text-indigo-600 shrink-0"
                              title="Переименовать"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}

                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => {
                              if (isBuiltinModuleKey(key)) toggleModule(key);
                              else if (isCustom) toggleCustomPage(customModuleKeyToId(key)!);
                            }}
                            className="w-4 h-4 text-indigo-600 rounded shrink-0"
                          />

                          {(isCustom || isTyped) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isCustom) {
                                  const cId = customModuleKeyToId(key);
                                  if (cId && window.confirm("Удалить страницу «" + label + "»?")) deleteCustomPage(cId);
                                } else if (isTyped) {
                                  deleteTypedModule(key);
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Card>
                  {activeEditor && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Редактирование:</span>
                      <span className="font-medium text-gray-800">
                        {activeEditor === "custom-new"
                          ? "Новая страница"
                          : getModuleLabel(activeEditor as string)}
                      </span>
                    </div>
                  )}

                  {activeEditor === "menu" && (
                    <MenuEditor
                      initialData={menuData}
                      onSave={handleSaveMenu}
                      saving={saving}
                      establishmentName={establishmentName}
                      establishmentId={establishmentId}
                      isPro={isPro}
                    />
                  )}
                  {activeEditor === "review" && establishmentId && (
                    <ReviewRoutingEditor
                      establishmentId={establishmentId}
                      establishmentName={establishmentName}
                      initialRouting={reviewRouting}
                      isPro={isPro}
                      onSaved={() => loadPage(establishmentId)}
                    />
                  )}
                  {activeEditor === "businessCard" && (
                    <BusinessCardConstructor
                      brandColor={brandColor}
                      initialData={businessCardData}
                      onSave={handleSaveBusinessCard}
                      saving={saving}
                    />
                  )}
                  {activeEditor === "wifi" && (
                    <WifiConfigEditor
                      initialData={wifiConfigData}
                      onSave={handleSaveWifi}
                      saving={saving}
                    />
                  )}
                  {activeEditor === "tips" && establishmentId && (
                    <>
                      <TipsSettingsEditor
                        establishmentId={establishmentId}
                        initialType={landingTipsType}
                        initialPhone={landingTipsPhone}
                        initialBankName={landingTipsBankName}
                        initialUrl={landingTipsUrl}
                        initialEmployees={tipsEmployees}
                        onSave={handleSaveTips}
                        saving={saving}
                      />
                    </>
                  )}
                  {activeExtraMenu && (
                    <MenuEditor
                      key={activeExtraMenu.id}
                      initialData={activeExtraMenu}
                      onSave={(data) => handleSaveExtraMenu(data, activeExtraMenu.id!)}
                      saving={saving}
                      establishmentName={establishmentName}
                      establishmentId={establishmentId}
                      isPro={isPro}
                    />
                  )}
                  {activeExtraBusinessCard && (
                    <BusinessCardConstructor
                      key={activeExtraBusinessCard.id}
                      brandColor={brandColor}
                      initialData={activeExtraBusinessCard}
                      onSave={(data) => handleSaveExtraBusinessCard(data, activeExtraBusinessCard.id!)}
                      saving={saving}
                    />
                  )}
                  {activeExtraWifi && (
                    <WifiConfigEditor
                      key={activeExtraWifi.id}
                      initialData={activeExtraWifi}
                      onSave={(data) => handleSaveExtraWifi(data, activeExtraWifi.id!)}
                      saving={saving}
                    />
                  )}
                  {activeForm && (
                    <FormEditor
                      key={activeForm.id}
                      initialData={activeForm}
                      isPro={isPro}
                      saving={saving}
                      onSave={(data) => handleSaveForm(activeForm.id, data)}
                    />
                  )}
                  {(activeEditor === "custom-new" || activeCustomPage) && !activeExtraMenu && !activeExtraBusinessCard && !activeExtraWifi && !activeForm && (
                    <CustomPageEditor
                      key={activeEditor === "custom-new" ? "new" : activeCustomPage?.id}
                      initialData={activeCustomPage}
                      onSave={handleSaveCustomPage}
                      saving={saving}
                    />
                  )}
                </Card>

                {error && (
                  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <Card className="lg:sticky lg:top-8">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">
                      Предпросмотр лендинга
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Так гость увидит микро-лендинг при сканировании QR
                  </p>
                  {establishmentId && (
                    <div className="mx-auto w-full max-w-[360px] rounded-[2.25rem] border-[10px] border-gray-900 bg-gray-900 shadow-xl overflow-hidden">
                      <div className="bg-gray-900 h-5 flex items-center justify-center">
                        <div className="w-16 h-1 bg-gray-700 rounded-full" />
                      </div>
                      <div className="bg-white rounded-b-[1.5rem] overflow-hidden max-h-[640px] overflow-y-auto">
                    <MicroLandingView
                       establishmentName={establishmentName}
                       establishmentId={establishmentId}
                       qrCodeId="preview"
                       syncSection={previewSection}
                       pageModules={pageModules}
                       moduleOrder={effectiveOrder}
                        moduleLabels={moduleLabels}
                        moduleIcons={moduleIcons}
                       menu={menuForLandingPreview(menuData)}
                       businessCard={
                         businessCardData?.id
                           ? {
                               id: businessCardData.id,
                               fullName: businessCardData.fullName,
                               title: businessCardData.title,
                               company: businessCardData.company,
                               phone: businessCardData.phone,
                               email: businessCardData.email,
                               website: businessCardData.website,
                               address: businessCardData.address,
                               about: businessCardData.about,
                               avatarUrl: businessCardData.avatarUrl,
                               socialLinks: businessCardData.socialLinks || [],
                               accentColor: businessCardData.accentColor,
                             }
                           : null
                       }
                      wifiConfig={
                        wifiConfigData?.id
                          ? {
                              id: wifiConfigData.id,
                              ssid: wifiConfigData.ssid,
                              password: wifiConfigData.password,
                              encryption: wifiConfigData.encryption,
                              hidden: wifiConfigData.hidden,
                            }
                          : null
                      }
                      reviewRouting={reviewRouting}
                      customPages={customPages.filter((p) => p.enabled)}
                      moduleTypes={moduleTypes}
                      extraMenus={extraMenus.map((m) => menuForLandingPreview(m) ?? m)}
                      extraBusinessCards={extraBusinessCards.map((bc) => ({
                        id: bc.id!,
                        fullName: bc.fullName,
                        title: bc.title,
                        company: bc.company,
                        phone: bc.phone,
                        email: bc.email,
                        website: bc.website,
                        address: bc.address,
                        about: bc.about,
                        avatarUrl: bc.avatarUrl,
                        socialLinks: bc.socialLinks || [],
                        accentColor: bc.accentColor,
                        tipsUrl: bc.tipsUrl,
                        tipsLabel: bc.tipsLabel,
                      }))}
                      extraWifiConfigs={extraWifiConfigs.map((wc) => ({
                        id: wc.id!,
                        ssid: wc.ssid,
                        password: wc.password,
                        encryption: wc.encryption,
                        hidden: wc.hidden,
                      }))}
                      forms={forms.map((f) => ({
                        id: f.id,
                        title: f.title,
                        description: f.description,
                        submitLabel: f.submitLabel,
                        successMessage: f.successMessage,
                        enabled: f.enabled,
                        fields: f.fields
                          .filter((fl): fl is typeof fl & { id: string } => !!fl.id)
                          .map((fl) => ({
                            id: fl.id,
                            label: fl.label,
                            placeholder: fl.placeholder,
                            helpText: fl.helpText,
                            type: fl.type,
                            required: fl.required,
                            options: fl.options,
                            order: fl.order,
                          })),
                      }))}
                      platformUrls={{
                        yandexMapsUrl: null,
                        twoGisUrl: null,
                        avitoUrl: null,
                      }}
                      logoUrl={logoUrl}
                      coverUrl={coverUrl}
                      landingSubtitle={landingSubtitle || null}
                      tipsConfig={
                        landingTipsType
                          ? {
                              tipsType: landingTipsType,
                              tipsPhone: landingTipsPhone || null,
                              tipsBankName: landingTipsBankName || null,
                              tipsUrl: landingTipsUrl || null,
                              employees:
                                landingTipsType === "EMPLOYEES"
                                  ? tipsEmployees.map((e) => ({
                                      id: e.id || e._localId,
                                      name: e.name,
                                      photoUrl: e.photoUrl,
                                      paymentType: e.paymentType,
                                      paymentUrl: e.paymentUrl,
                                      phone: e.phone,
                                      bankName: e.bankName,
                                    }))
                                  : undefined,
                            }
                          : undefined
                      }
                       watermarkEnabled
                       embedded
                       brandColor={brandColor}
                       pageAppearance={pageAppearance}
                     />
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function MyPageHeader({
  autoSaveState,
  establishments,
  establishmentId,
  onChangeEstablishment,
  shortSlug,
}: {
  autoSaveState: "idle" | "saving" | "saved";
  establishments: EstablishmentOption[];
  establishmentId: string;
  onChangeEstablishment: (id: string) => void;
  shortSlug: string;
}) {
  const current = establishments.find((e) => e.id === establishmentId);
  return (
    <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Layout className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Моя страница</h1>
          {shortSlug && (
            <a
              href={`/a/${shortSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 text-gray-700"
              title="Открыть лендинг в новой вкладке"
            >
              <Eye className="w-4 h-4" />
              Открыть
            </a>
          )}
          {establishments.length > 1 && current && (
            <select
              value={establishmentId}
              onChange={(e) => onChangeEstablishment(e.target.value)}
              className="ml-2 px-2.5 py-1 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50"
            >
              {establishments.map((est) => (
                <option key={est.id} value={est.id}>{est.name}</option>
              ))}
            </select>
          )}
        </div>
        <p className="text-gray-500">
          Контент заведения: меню, отзывы, визитка, Wi-Fi, чаевые и произвольные страницы.
          Заполните один раз — используйте на любых QR-наклейках.
        </p>
      </div>
      <div className="min-h-[24px] flex items-center text-xs">
        {autoSaveState === "saving" && (
          <span className="flex items-center gap-1.5 text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Сохраняем…
          </span>
        )}
        {autoSaveState === "saved" && (
          <span className="flex items-center gap-1.5 text-green-600">
            <Check className="w-3.5 h-3.5" />
            Сохранено
          </span>
        )}
        {autoSaveState === "idle" && (
          <span className="flex items-center gap-1.5 text-gray-400">
            <Cloud className="w-3.5 h-3.5" />
            Все изменения сохраняются автоматически
          </span>
        )}
      </div>
    </div>
  );
}
