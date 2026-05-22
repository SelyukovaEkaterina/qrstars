"use client";

import { useState, useEffect, useCallback } from "react";
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
import MicroLandingView from "@/components/scan/MicroLandingView";
import EmojiPicker from "@/components/ui/EmojiPicker";
import {
  parsePageModules,
  parseModuleOrder,
  parseModuleLabels,
  parseModuleIcons,
  buildDefaultModuleOrder,
  PAGE_MODULE_LABELS,
  isBuiltinModuleKey,
  customModuleKeyToId,
  getModuleLabel as resolveModuleLabel,
  type PageModules,
  type BuiltinModuleKey,
  type ModuleKey,
  type ModuleLabels,
  type ModuleIcons,
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
}

type EditorTab = BuiltinModuleKey | "custom-new" | `custom-${string}`;

export default function MyPageDashboard() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [establishmentId, setEstablishmentId] = useState("");
  const [establishmentName, setEstablishmentName] = useState("");
  const [pageModules, setPageModules] = useState<PageModules>(
    parsePageModules(null)
  );
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [businessCardData, setBusinessCardData] = useState<BusinessCardData | null>(null);
  const [wifiConfigData, setWifiConfigData] = useState<WifiConfigData | null>(null);
  const [reviewRouting, setReviewRouting] = useState<ReviewRoutingConfig>(
    DEFAULT_REVIEW_ROUTING
  );
  const [isPro, setIsPro] = useState(false);
  const [activeEditor, setActiveEditor] = useState<EditorTab | null>("menu");
  const [customPages, setCustomPages] = useState<CustomPageItem[]>([]);
  const [moduleOrder, setModuleOrder] = useState<ModuleKey[] | null>(null);
  const [moduleLabels, setModuleLabels] = useState<ModuleLabels>({});
  const [moduleIcons, setModuleIcons] = useState<ModuleIcons>({});
  const [editingLabel, setEditingLabel] = useState<BuiltinModuleKey | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [pageAppearance, setPageAppearance] = useState<PageAppearance>(DEFAULT_PAGE_APPEARANCE);
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [landingSubtitle, setLandingSubtitle] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

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
    setCustomColorOpen(
      !BRAND_COLOR_PRESETS.some((p) => p.hex === loadedColor)
    );
    setLogoUrl(est.logoUrl || null);
    setCoverUrl(est.coverUrl || null);
    setLandingSubtitle(est.landingSubtitle || "");
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

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
    await fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageModules: next }),
    });
  };

  const toggleModule = (key: BuiltinModuleKey) => {
    const next = { ...pageModules, [key]: !pageModules[key] };
    savePageModules(next);
  };

  const saveModuleLabels = async (next: ModuleLabels) => {
    setModuleLabels(next);
    await fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleLabels: next }),
    });
  };

  const saveModuleIcons = async (next: ModuleIcons) => {
    setModuleIcons(next);
    await fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleIcons: next }),
    });
  };

  const startEditLabel = (key: BuiltinModuleKey) => {
    setEditLabelValue(moduleLabels[key] ?? PAGE_MODULE_LABELS[key]);
    setEditingLabel(key);
  };

  const confirmEditLabel = async () => {
    if (!editingLabel) return;
    const trimmed = editLabelValue.trim();
    const next: ModuleLabels = { ...moduleLabels };
    if (trimmed && trimmed !== PAGE_MODULE_LABELS[editingLabel]) {
      next[editingLabel] = trimmed;
    } else {
      delete next[editingLabel];
    }
    await saveModuleLabels(next);
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
        prev.map((p) => (p.id === id ? { ...p, enabled: data.customPage.enabled } : p))
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

  const saveModuleOrder = async (newOrder: ModuleKey[]) => {
    setModuleOrder(newOrder);
    await fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleOrder: newOrder }),
    });
  };

  const moveModule = (index: number, direction: "up" | "down") => {
    const order = getEffectiveOrder();
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= order.length) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    saveModuleOrder(newOrder);
  };

  const saveBrandSettings = async (
    color: string,
    appearance: PageAppearance
  ) => {
    const normalized =
      normalizeBrandColor(color) ?? DEFAULT_BRAND_COLOR;
    setBrandColor(normalized);
    setPageAppearance(appearance);
    setBusinessCardData((prev) =>
      prev ? { ...prev, accentColor: normalized } : prev
    );
    await fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandColor: normalized,
        pageAppearance: appearance,
      }),
    });
  };

  const saveCoverUrl = async (url: string | null) => {
    setCoverUrl(url);
    await fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverUrl: url }),
    });
  };

  const saveLogoUrl = async (url: string | null) => {
    setLogoUrl(url);
    await fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: url }),
    });
  };

  const saveLandingSubtitle = async (value: string) => {
    const trimmed = value.trim();
    const toSave =
      trimmed && trimmed !== DEFAULT_LANDING_SUBTITLE ? trimmed.slice(0, 120) : null;
    setLandingSubtitle(trimmed && trimmed !== DEFAULT_LANDING_SUBTITLE ? trimmed : "");
    await fetch(`/api/establishments/${establishmentId}/page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landingSubtitle: toSave }),
    });
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
      // Reset input
      e.target.value = "";
    }
  };

  const getEffectiveOrder = (): ModuleKey[] => {
    const allKeys = new Set<ModuleKey>();
    (Object.keys(pageModules) as BuiltinModuleKey[]).forEach((k) => {
      allKeys.add(k);
    });
    customPages.forEach((p) => {
      if (p.enabled) allKeys.add(`custom-${p.id}` as ModuleKey);
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

  const handleSaveCustomPage = async (data: {
    id?: string;
    menuItemLabel: string;
    title: string;
    content: string;
    type: string;
    url?: string | null;
    icon?: string | null;
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

  const getModuleLabel = (key: string): string => {
    if (isBuiltinModuleKey(key)) return resolveModuleLabel(key, moduleLabels);
    const cId = customModuleKeyToId(key);
    if (cId) return customPages.find((p) => p.id === cId)?.menuItemLabel ?? "Страница";
    return key;
  };

  const editorTabs: { key: EditorTab; label: string }[] = [
    ...(Object.keys(PAGE_MODULE_LABELS) as BuiltinModuleKey[]).map((k) => ({
      key: k,
      label: resolveModuleLabel(k, moduleLabels),
    })),
    ...customPages.map((p) => ({
      key: `custom-${p.id}` as EditorTab,
      label: p.menuItemLabel,
    })),
  ];

  const activeCustomPage = (() => {
    if (!activeEditor) return null;
    const cId = customModuleKeyToId(activeEditor);
    if (!cId) return null;
    return customPages.find((p) => p.id === cId) ?? null;
  })();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <MyPageHeader />

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
            <Card>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Заведение
              </label>
              <select
                value={establishmentId}
                onChange={(e) => handleEstablishmentChange(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {establishments.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2">
                Ссылки на Яндекс / 2GIS — в{" "}
                <Link
                  href={`/dashboard/establishments/${establishmentId}`}
                  className="text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                >
                  настройках заведения
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </p>
            </Card>

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
                  
                  {/* Показываем кастомную обложку, если она загружена и не из стандартных */}
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

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-4">
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">
                      Блоки на микро-лендинге
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveEditor("custom-new")}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Добавить страницу
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Перемещайте, включайте и отключайте блоки. Гость увидит только
                    включённые.
                  </p>
                  <div className="space-y-1">
                    {effectiveOrder.map((key, idx) => {
                      const isCustom = !isBuiltinModuleKey(key);
                      const label = getModuleLabel(key);
                      const isOn = isBuiltinModuleKey(key)
                        ? pageModules[key]
                        : customPages.find((p) => p.id === customModuleKeyToId(key))
                            ?.enabled ?? false;

                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-2 p-2 rounded-lg border border-gray-200 group ${
                            isOn ? "hover:bg-gray-50" : "opacity-50 bg-gray-50"
                          }`}
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
                              disabled={idx === effectiveOrder.length - 1}
                              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />

                          {isBuiltinModuleKey(key) ? (
                            (() => {
                              const emoji = moduleIcons[key];
                              return emoji ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...moduleIcons };
                                    delete next[key];
                                    saveModuleIcons(next);
                                  }}
                                  className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-indigo-100 text-base hover:opacity-70 transition-opacity"
                                  title="Убрать иконку"
                                >
                                  {emoji}
                                </button>
                              ) : (
                                <EmojiPicker
                                  value={null}
                                  onChange={(e) => {
                                    const next: ModuleIcons = { ...moduleIcons };
                                    if (e) next[key] = e; else delete next[key];
                                    saveModuleIcons(next);
                                  }}
                                  inline
                                />
                              );
                            })()
                          ) : (() => {
                            const cp = customPages.find((p) => p.id === customModuleKeyToId(key));
                            return cp?.icon ? (
                              <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-purple-100 text-base">
                                {cp.icon}
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-purple-100 text-purple-600">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                            );
                          })()}

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
                              <button
                                type="button"
                                onClick={confirmEditLabel}
                                className="p-0.5 text-green-600 hover:text-green-800 shrink-0"
                                title="Сохранить"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditLabel}
                                className="p-0.5 text-gray-400 hover:text-gray-700 shrink-0"
                                title="Отмена"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveEditor(key as EditorTab)}
                              className={`flex-1 text-left text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors truncate ${
                                !isOn ? "line-through text-gray-400" : ""
                              }`}
                            >
                              {label}
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
                            onChange={() =>
                              isBuiltinModuleKey(key)
                                ? toggleModule(key)
                                : toggleCustomPage(customModuleKeyToId(key)!)
                            }
                            className="w-4 h-4 text-indigo-600 rounded shrink-0"
                          />

                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => {
                                const cId = customModuleKeyToId(key);
                                if (cId && window.confirm("Удалить страницу «" + label + "»?")) {
                                  deleteCustomPage(cId);
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
                  <div className="flex flex-wrap gap-2 mb-4">
                    {editorTabs.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveEditor(key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          activeEditor === key
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setActiveEditor("custom-new")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-dashed ${
                        activeEditor === "custom-new"
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-gray-300 text-gray-500 hover:border-gray-400"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 inline mr-1" />
                      Новая
                    </button>
                  </div>

                  {activeEditor === "menu" && (
                    <MenuEditor
                      initialData={menuData}
                      onSave={handleSaveMenu}
                      saving={saving}
                      establishmentName={establishmentName}
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
                  {(activeEditor === "custom-new" || activeCustomPage) && (
                    <CustomPageEditor
                      key={activeEditor === "custom-new" ? "new" : activeCustomPage?.id}
                      initialData={activeCustomPage}
                      onSave={handleSaveCustomPage}
                      onDelete={deleteCustomPage}
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

              <div className="xl:col-span-1">
                <Card className="sticky top-8">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Предпросмотр лендинга
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Так гость увидит микро-лендинг при сканировании QR
                  </p>
                  {establishmentId && (
                    <MicroLandingView
                       establishmentName={establishmentName}
                       establishmentId={establishmentId}
                       qrCodeId="preview"
                       pageModules={pageModules}
                       moduleOrder={effectiveOrder}
                        moduleLabels={moduleLabels}
                        moduleIcons={moduleIcons}
                       menu={menuData}
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
                      platformUrls={{
                        yandexMapsUrl: null,
                        twoGisUrl: null,
                        avitoUrl: null,
                      }}
                      logoUrl={logoUrl}
                      coverUrl={coverUrl}
                      landingSubtitle={landingSubtitle || null}
                       watermarkEnabled
                       embedded
                       brandColor={brandColor}
                       pageAppearance={pageAppearance}
                     />
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

function MyPageHeader() {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Layout className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Моя страница</h1>
      </div>
      <p className="text-gray-500">
        Контент заведения: меню, отзывы, визитка, Wi-Fi и произвольные страницы.
        Заполните один раз — используйте на любых QR-наклейках.
      </p>
    </div>
  );
}
