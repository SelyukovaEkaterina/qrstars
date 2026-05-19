"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Sidebar from "@/components/dashboard/Sidebar";
import BusinessCardConstructor from "@/components/dashboard/BusinessCardConstructor";
import WifiConfigEditor from "@/components/dashboard/WifiConfigEditor";
import FileAssetEditor, { type FileAssetData } from "@/components/dashboard/FileAssetEditor";
import MenuEditor, { type MenuData } from "@/components/dashboard/MenuEditor";
import {
  Loader2,
  ArrowLeft,
  Download,
  ExternalLink,
  Star,
  Save,
  Palette,
  CreditCard,
  Wifi,
  FileText,
  Type,
  X,
  Upload,
  Crown,
  Coffee,
} from "lucide-react";
import { generateQRWithCenter, type QRCenterOptions } from "@/lib/qr-generator";
import { scanUrlForCode } from "@/lib/utils";

type QRMode = "REVIEW" | "REDIRECT" | "BUSINESS_CARD" | "WIFI" | "FILE" | "MENU";

interface SocialLink {
  type: string;
  url: string;
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
  socialLinks: SocialLink[];
  theme: string;
  accentColor: string;
  contactEnabled?: boolean;
  contactMessengerId?: string | null;
  contactMessenger?: {
    id: string;
    provider: "TELEGRAM" | "MAX";
    label: string | null;
    externalId: string;
  } | null;
}

interface WifiConfigData {
  id?: string;
  ssid: string;
  password: string | null;
  encryption: string;
  hidden: boolean;
}

interface QRCodeData {
  id: string;
  code: string;
  label: string | null;
  isActive: boolean;
  mode: QRMode;
  redirectUrl: string | null;
  scansCount: number;
  establishmentId: string | null;
  templateId: string | null;
  centerText: string | null;
  centerLogoUrl: string | null;
  establishment: { name: string; id: string } | null;
  businessCard: BusinessCardData | null;
  wifiConfig: WifiConfigData | null;
  fileAsset: FileAssetData | null;
  menu: MenuData | null;
}

interface Establishment {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  layout: Record<string, unknown>;
}

const modeLabels: Record<QRMode, string> = {
  REVIEW: "Отзывы",
  REDIRECT: "Редирект",
  BUSINESS_CARD: "Визитка",
  WIFI: "Wi-Fi",
  FILE: "Файл",
  MENU: "QR-Меню",
};

export default function QRCodeSettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const qrId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");

  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<QRMode>("REVIEW");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [establishmentId, setEstablishmentId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const [businessCardData, setBusinessCardData] = useState<BusinessCardData | null>(null);
  const [wifiConfigData, setWifiConfigData] = useState<WifiConfigData | null>(null);
  const [fileAssetData, setFileAssetData] = useState<FileAssetData | null>(null);
  const [menuData, setMenuData] = useState<MenuData | null>(null);

  const [isPro, setIsPro] = useState(false);
  const [centerText, setCenterText] = useState("");
  const [centerLogoUrl, setCenterLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const generateQRImage = useCallback(async (code: string, centerOpts?: QRCenterOptions) => {
    const url = await generateQRWithCenter(
      scanUrlForCode(code),
      centerOpts || { isPro: false },
      512
    );
    setQrImageUrl(url);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    Promise.all([
      fetch(`/api/qrcodes?id=${qrId}`).then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      }),
      fetch("/api/establishments").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ])
      .then(([qrResponse, estData, tplData]) => {
        const qr = qrResponse.qrcode;
        const pro = qrResponse.isPro || false;
        setQrData(qr);
        setLabel(qr.label || "");
        setMode(qr.mode || "REVIEW");
        setRedirectUrl(qr.redirectUrl || "");
        setEstablishmentId(qr.establishmentId || "");
        setTemplateId(qr.templateId || "");
        setIsPro(pro);
        setCenterText(qr.centerText || "");
        setCenterLogoUrl(qr.centerLogoUrl || null);
        setEstablishments(estData.establishments || []);
        setTemplates(tplData.templates || []);
        if (qr.businessCard) setBusinessCardData(qr.businessCard);
        if (qr.wifiConfig) setWifiConfigData(qr.wifiConfig);
        if (qr.fileAsset) setFileAssetData(qr.fileAsset);
        if (qr.menu) setMenuData(qr.menu);
        generateQRImage(qr.code, {
          isPro: pro,
          centerText: qr.centerText,
          centerLogoUrl: qr.centerLogoUrl,
        });
        setLoading(false);
      })
      .catch(() => {
        setError("QR-код не найден");
        setLoading(false);
      });
  }, [status, router, qrId, generateQRImage]);

  useEffect(() => {
    if (!qrData) return;
    const timer = setTimeout(() => {
      generateQRImage(qrData.code, {
        isPro,
        centerText: isPro ? centerText : null,
        centerLogoUrl: isPro ? centerLogoUrl : null,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [centerText, centerLogoUrl, isPro, qrData, generateQRImage]);

  const handleSaveBasic = async () => {
    if (mode === "REDIRECT" && !redirectUrl.trim()) {
      setError("Укажите URL для редиректа");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const payload: Record<string, unknown> = {
        id: qrId,
        label: label || null,
        mode,
        redirectUrl: mode === "REDIRECT" ? redirectUrl : null,
        establishmentId: establishmentId || null,
        templateId: templateId || null,
        centerText: isPro ? (centerText || null) : null,
        centerLogoUrl: isPro ? centerLogoUrl : null,
      };

      if (establishmentId && !qrData?.establishmentId) {
        payload.isActive = true;
      }

      const res = await fetch("/api/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка сохранения");
        return;
      }

      const data = await res.json();
      setQrData(data.qrcode);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      generateQRImage(qrData!.code, {
        isPro,
        centerText: isPro ? centerText : null,
        centerLogoUrl: isPro ? centerLogoUrl : null,
      });
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusinessCard = async (cardData: BusinessCardData) => {
    setSaving(true);
    setError("");

    try {
      let bcId = businessCardData?.id;

      if (!bcId) {
        const res = await fetch("/api/business-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cardData),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || "Ошибка создания визитки");
          return;
        }
        const d = await res.json();
        bcId = d.businessCard.id;
        setBusinessCardData(d.businessCard);
      } else {
        const res = await fetch("/api/business-cards", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...cardData, id: bcId }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || "Ошибка обновления визитки");
          return;
        }
        const d = await res.json();
        setBusinessCardData(d.businessCard);
      }

      const qrRes = await fetch("/api/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: qrId,
          mode: "BUSINESS_CARD",
          businessCardId: bcId,
        }),
      });

      if (!qrRes.ok) {
        const d = await qrRes.json();
        setError(d.error || "Ошибка привязки визитки");
        return;
      }

      const qrResult = await qrRes.json();
      setQrData(qrResult.qrcode);
      setMode("BUSINESS_CARD");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWifiConfig = async (configData: WifiConfigData) => {
    setSaving(true);
    setError("");

    try {
      let wcId = wifiConfigData?.id;

      if (!wcId) {
        const res = await fetch("/api/wifi-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configData),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || "Ошибка создания Wi-Fi конфигурации");
          return;
        }
        const d = await res.json();
        wcId = d.wifiConfig.id;
        setWifiConfigData(d.wifiConfig);
      } else {
        const res = await fetch("/api/wifi-configs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...configData, id: wcId }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || "Ошибка обновления Wi-Fi");
          return;
        }
        const d = await res.json();
        setWifiConfigData(d.wifiConfig);
      }

      const qrRes = await fetch("/api/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: qrId,
          mode: "WIFI",
          wifiConfigId: wcId,
        }),
      });

      if (!qrRes.ok) {
        const d = await qrRes.json();
        setError(d.error || "Ошибка привязки Wi-Fi");
        return;
      }

      const qrResult = await qrRes.json();
      setQrData(qrResult.qrcode);
      setMode("WIFI");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFileAsset = async (assetData: FileAssetData) => {
    setSaving(true);
    setError("");

    try {
      if (!assetData.id) {
        setError("Сначала загрузите файл");
        return;
      }

      if (assetData.title !== fileAssetData?.title) {
        const res = await fetch("/api/file-assets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: assetData.id, title: assetData.title }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || "Ошибка обновления названия");
          return;
        }
        const d = await res.json();
        setFileAssetData(d.fileAsset);
      }

      const qrRes = await fetch("/api/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: qrId,
          mode: "FILE",
          fileAssetId: assetData.id,
        }),
      });

      if (!qrRes.ok) {
        const d = await qrRes.json();
        setError(d.error || "Ошибка привязки файла");
        return;
      }

      const qrResult = await qrRes.json();
      setQrData(qrResult.qrcode);
      setMode("FILE");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
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
          body: JSON.stringify(saveData),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || "Ошибка создания меню");
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
          const d = await res.json();
          setError(d.error || "Ошибка обновления меню");
          return;
        }
        const d = await res.json();
        setMenuData(d.menu);
      }

      const qrRes = await fetch("/api/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: qrId,
          mode: "MENU",
          menuId: mId,
        }),
      });

      if (!qrRes.ok) {
        const d = await qrRes.json();
        setError(d.error || "Ошибка привязки меню");
        return;
      }

      const qrResult = await qrRes.json();
      setQrData(qrResult.qrcode);
      setMode("MENU");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const handleFileDeleted = async () => {
    setFileAssetData(null);
    await fetch("/api/qrcodes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: qrId, fileAssetId: null }),
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-lg text-gray-500">{error || "QR-код не найден"}</p>
            <Button onClick={() => router.push("/dashboard/qrcodes")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к списку
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const modes: { value: QRMode; icon: typeof Star; label: string; desc: string }[] = [
    {
      value: "REVIEW",
      icon: Star,
      label: "Сбор отзывов",
      desc: "Гость оценивает заведение. Позитив — на карты, негатив — руководству",
    },
    {
      value: "REDIRECT",
      icon: ExternalLink,
      label: "Прямой редирект",
      desc: "Гость мгновенно перенаправляется на указанный URL",
    },
    {
      value: "BUSINESS_CARD",
      icon: CreditCard,
      label: "Визитка",
      desc: "Красивая мобильная страница с контактами, соцсетями и кнопкой сохранения",
    },
    {
      value: "WIFI",
      icon: Wifi,
      label: "Wi-Fi",
      desc: "Страница с QR-кодом для автоматического подключения к Wi-Fi",
    },
    {
      value: "FILE",
      icon: FileText,
      label: "Файл",
      desc: "Меню (PDF), прайс, презентация — гость скачает любой файл прямо на телефон",
    },
    {
      value: "MENU",
      icon: Coffee,
      label: "QR-Меню",
      desc: "Удобное мобильное меню с фотографиями, описанием и ценами блюд",
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard/qrcodes")}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Настройка QR-кода
              </h1>
              <p className="text-gray-500 mt-1 font-mono text-sm">
                {qrData.code}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <div className="text-center space-y-3">
                  {qrImageUrl && (
                    <img
                      src={qrImageUrl}
                      alt={`QR ${qrData.code}`}
                      className="w-48 h-48 mx-auto rounded-lg"
                    />
                  )}
                  <a
                    href={qrImageUrl}
                    download={`qr-${qrData.code}.png`}
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <Download className="w-3 h-3" />
                    Скачать PNG
                  </a>
                </div>
              </Card>

              <Card>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Статус</span>
                    <Badge variant={qrData.isActive ? "success" : "warning"}>
                      {qrData.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Режим</span>
                    <Badge variant={mode === "REDIRECT" ? "info" : mode === "BUSINESS_CARD" ? "success" : mode === "WIFI" ? "warning" : mode === "FILE" ? "warning" : "default"}>
                      {modeLabels[mode]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Сканирований</span>
                    <span className="font-medium">{qrData.scansCount}</span>
                  </div>
                  {qrData.establishment && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Заведение</span>
                      <span className="font-medium text-right truncate max-w-[140px]">
                        {qrData.establishment.name}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Основные настройки
                </h3>
                <div className="space-y-4">
                  <Input
                    label="Метка"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Стол 1, Бар, Вход..."
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Заведение
                    </label>
                    <select
                      value={establishmentId}
                      onChange={(e) => setEstablishmentId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Не привязан (неактивный)</option>
                      {establishments.map((est) => (
                        <option key={est.id} value={est.id}>
                          {est.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      Шаблон таблички
                    </label>
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Без шаблона</option>
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>
                    {templateId && (
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/templates/${templateId}`)}
                        className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Palette className="w-3 h-3" />
                        Открыть конструктор
                      </button>
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Центр QR-кода
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {isPro
                    ? "Настройте текст или логотип в центре QR-кода"
                    : "На бесплатном тарифе в центре отображается qrstars.ru"}
                </p>

                {!isPro ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">
                        Надпись: <span className="font-mono font-semibold text-indigo-600">qrstars.ru</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Доступно на PRO-тарифе: свой текст или логотип
                      </p>
                    </div>
                    <Crown className="w-5 h-5 text-amber-500 shrink-0" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Текст в центре
                      </label>
                      <input
                        value={centerText}
                        onChange={(e) => {
                          setCenterText(e.target.value);
                          if (e.target.value) setCenterLogoUrl(null);
                        }}
                        placeholder="Мой бренд"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Если указан логотип — текст игнорируется
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Логотип в центре
                      </label>
                      {centerLogoUrl ? (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                          <img
                            src={centerLogoUrl}
                            alt="Logo"
                            className="w-12 h-12 object-contain rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate">Логотип загружен</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCenterLogoUrl(null)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 cursor-pointer transition-colors">
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {uploading ? "Загрузка..." : "Загрузить логотип"}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            disabled={uploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploading(true);
                              try {
                                const fd = new FormData();
                                fd.append("file", file);
                                fd.append("qrId", qrId);
                                const res = await fetch("/api/upload", {
                                  method: "POST",
                                  body: fd,
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  setError(data.error || "Ошибка загрузки");
                                  return;
                                }
                                setCenterLogoUrl(data.logoUrl);
                                setCenterText("");
                              } catch {
                                setError("Ошибка загрузки файла");
                              } finally {
                                setUploading(false);
                              }
                            }}
                          />
                        </label>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        PNG, JPEG, WebP или SVG, до 2 МБ
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">Предпросмотр:</p>
                  <div className="flex justify-center">
                    {qrImageUrl && (
                      <img
                        src={qrImageUrl}
                        alt="QR preview"
                        className="w-32 h-32 rounded-lg"
                      />
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Режим работы
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Выберите, что произойдёт при сканировании QR-кода гостем
                </p>

                <div className="space-y-3">
                  {modes.map((m) => {
                    const Icon = m.icon;
                    const selected = mode === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMode(m.value)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          selected
                            ? "border-indigo-600 bg-indigo-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              selected
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p
                              className={`font-semibold ${
                                selected ? "text-indigo-900" : "text-gray-900"
                              }`}
                            >
                              {m.label}
                            </p>
                            <p
                              className={`text-sm mt-0.5 ${
                                selected ? "text-indigo-700" : "text-gray-500"
                              }`}
                            >
                              {m.desc}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {mode === "REDIRECT" && (
                  <div className="mt-4">
                    <Input
                      label="URL для редиректа"
                      value={redirectUrl}
                      onChange={(e) => setRedirectUrl(e.target.value)}
                      placeholder="https://example.com"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Гость будет перенаправлен на этот адрес сразу после сканирования
                    </p>
                  </div>
                )}
              </Card>

              {mode === "BUSINESS_CARD" && (
                <BusinessCardConstructor
                  qrId={qrId}
                  initialData={businessCardData}
                  onSave={handleSaveBusinessCard}
                  saving={saving}
                />
              )}

              {mode === "WIFI" && (
                <WifiConfigEditor
                  initialData={wifiConfigData}
                  onSave={handleSaveWifiConfig}
                  saving={saving}
                />
              )}

              {mode === "FILE" && (
                <FileAssetEditor
                  initialData={fileAssetData}
                  onSave={handleSaveFileAsset}
                  onDelete={handleFileDeleted}
                  saving={saving}
                />
              )}

              {mode === "MENU" && (
                <MenuEditor
                  initialData={menuData}
                  onSave={handleSaveMenu}
                  saving={saving}
                />
              )}

              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {mode !== "BUSINESS_CARD" && mode !== "WIFI" && mode !== "FILE" && mode !== "MENU" && (
                <>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSaveBasic} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Сохранить
                        </>
                      )}
                    </Button>
                    {saved && (
                      <span className="text-sm text-green-600 font-medium">
                        Сохранено!
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => router.push("/dashboard/qrcodes")}
                    >
                      Назад к списку
                    </Button>
                  </div>
                </>
              )}

              {(mode === "BUSINESS_CARD" || mode === "WIFI" || mode === "FILE" || mode === "MENU") && saved && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-green-600 font-medium">Сохранено!</span>
                  <Button
                    variant="ghost"
                    onClick={() => router.push("/dashboard/qrcodes")}
                  >
                    Назад к списку
                  </Button>
                </div>
              )}

              {(mode === "BUSINESS_CARD" || mode === "WIFI" || mode === "FILE" || mode === "MENU") && error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
