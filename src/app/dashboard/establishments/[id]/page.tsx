"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Sidebar from "@/components/dashboard/Sidebar";
import { Save, Loader2, ArrowLeft, Send, Mail, CheckCircle2, ExternalLink, Copy, MessageCircle } from "lucide-react";

interface EstablishmentSettings {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  yandexMapsUrl: string | null;
  twoGisUrl: string | null;
  avitoUrl: string | null;
  platformRotation: boolean;
  notificationEmail: string | null;
  notificationEmailEnabled: boolean;
  notificationTelegramChatId: string | null;
  notificationTelegramEnabled: boolean;
  notificationMaxUserId: string | null;
  notificationMaxEnabled: boolean;
}

export default function EstablishmentSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [data, setData] = useState<EstablishmentSettings | null>(null);
  const [polling, setPolling] = useState(false);
  const [maxPolling, setMaxPolling] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(() => {
    fetch(`/api/settings?id=${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.establishment) {
          setData(res.establishment);
          if (res.establishment.notificationTelegramChatId && polling) {
            setPolling(false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
          if (res.establishment.notificationMaxUserId && maxPolling) {
            setMaxPolling(false);
            if (maxPollRef.current) clearInterval(maxPollRef.current);
          }
        }
      })
      .catch(() => {});
  }, [id, polling, maxPolling]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch(`/api/settings?id=${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.establishment) {
          setData(res.establishment);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router, id]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (maxPollRef.current) clearInterval(maxPollRef.current);
    };
  }, []);

  const updateField = (field: keyof EstablishmentSettings, value: string | boolean) => {
    setData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setMessage("Настройки сохранены");
      } else {
        setMessage("Ошибка сохранения");
      }
    } catch {
      setMessage("Ошибка соединения");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleTestTelegram = async () => {
    if (!data?.notificationTelegramChatId) return;
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-telegram", chatId: data.notificationTelegramChatId }),
      });
      const result = await res.json();
      if (result.ok) {
        setMessage("Тестовое сообщение отправлено в Telegram");
      } else {
        setMessage(result.error || "Ошибка отправки в Telegram");
      }
    } catch {
      setMessage("Ошибка соединения");
    }
    setTimeout(() => setMessage(""), 4000);
  };

  const handleTestEmail = async () => {
    if (!data?.notificationEmail) return;
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-email", email: data.notificationEmail, establishmentName: data.name }),
      });
      const result = await res.json();
      if (result.ok) {
        setMessage("Тестовое письмо отправлено");
      } else {
        setMessage(result.error || "Ошибка отправки email");
      }
    } catch {
      setMessage("Ошибка соединения");
    }
    setTimeout(() => setMessage(""), 4000);
  };

  const handleTestMax = async () => {
    if (!data?.notificationMaxUserId) return;
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-max", userId: data.notificationMaxUserId }),
      });
      const result = await res.json();
      if (result.ok) {
        setMessage("Тестовое сообщение отправлено в MAX");
      } else {
        setMessage(result.error || "Ошибка отправки в MAX");
      }
    } catch {
      setMessage("Ошибка соединения");
    }
    setTimeout(() => setMessage(""), 4000);
  };

  const handleLinkTelegram = () => {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (!botUsername) {
      setMessage("Telegram-бот не настроен (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME)");
      setTimeout(() => setMessage(""), 4000);
      return;
    }

    window.open(
      `https://t.me/${botUsername}?start=link_${id}`,
      "_blank"
    );

    setPolling(true);
    pollRef.current = setInterval(fetchData, 3000);

    setTimeout(() => {
      setPolling(false);
      if (pollRef.current) clearInterval(pollRef.current);
    }, 120000);
  };

  const handleUnlinkTelegram = () => {
    if (!data) return;
    setData((prev) =>
      prev
        ? { ...prev, notificationTelegramChatId: null, notificationTelegramEnabled: false }
        : prev
    );
  };

  const handleCopyMaxCode = () => {
    const code = `SR-${id}`;
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleStartMaxPolling = () => {
    const maxBotUrl = process.env.NEXT_PUBLIC_MAX_BOT_URL;
    if (maxBotUrl) {
      window.open(maxBotUrl, "_blank");
    }

    setMaxPolling(true);
    maxPollRef.current = setInterval(fetchData, 3000);

    setTimeout(() => {
      setMaxPolling(false);
      if (maxPollRef.current) clearInterval(maxPollRef.current);
    }, 120000);
  };

  const handleUnlinkMax = () => {
    if (!data) return;
    setData((prev) =>
      prev
        ? { ...prev, notificationMaxUserId: null, notificationMaxEnabled: false }
        : prev
    );
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

  if (!data) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="text-center py-12 px-8">
            <p className="text-gray-500">Заведение не найдено</p>
            <Button variant="ghost" className="mt-4" onClick={() => router.push("/dashboard/establishments")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к заведениям
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  const telegramLinked = !!data.notificationTelegramChatId;
  const maxLinked = !!data.notificationMaxUserId;
  const maxLinkCode = `SR-${id}`;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard/establishments")}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
              <p className="text-gray-500 text-sm mt-0.5">Настройки заведения</p>
            </div>
          </div>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Основное</h3>
            <div className="space-y-4">
              <Input
                label="Название заведения"
                value={data.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Кофейня «Бобр»"
              />
              <Input
                label="Адрес"
                value={data.address || ""}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="г. Москва, ул. Примерная, 42"
              />
              <Input
                label="Телефон"
                value={data.phone || ""}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Площадки для отзывов</h3>
            <p className="text-sm text-gray-500 mb-4">
              Ссылки используются в сценариях «Сбор отзывов» при выборе действия «Яндекс.Карты», «2GIS» или «Авито».
            </p>
            <div className="space-y-4">
              <Input
                label="Яндекс.Карты"
                type="url"
                value={data.yandexMapsUrl || ""}
                onChange={(e) => updateField("yandexMapsUrl", e.target.value)}
                placeholder="https://yandex.ru/maps/org/..."
              />
              <Input
                label="2GIS"
                type="url"
                value={data.twoGisUrl || ""}
                onChange={(e) => updateField("twoGisUrl", e.target.value)}
                placeholder="https://2gis.ru/..."
              />
              <Input
                label="Авито"
                type="url"
                value={data.avitoUrl || ""}
                onChange={(e) => updateField("avitoUrl", e.target.value)}
                placeholder="https://avito.ru/..."
              />
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.platformRotation}
                  onChange={(e) => updateField("platformRotation", e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">Умная ротация площадок (PRO)</p>
                  <p className="text-xs text-gray-400">
                    При ротации ссылка выбирается автоматически, если в сценарии не задана конкретная площадка
                  </p>
                </div>
              </label>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-1">Уведомления о негативных отзывах</h3>
            <p className="text-sm text-gray-500 mb-4">
              Настройте, куда будут приходить уведомления при оценке 1–3 звезды
            </p>
            <div className="space-y-5">
              <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-medium text-gray-700">Email</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.notificationEmailEnabled}
                      onChange={(e) => updateField("notificationEmailEnabled", e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-600">Включено</span>
                  </label>
                </div>
                <Input
                  label="Email для уведомлений"
                  type="email"
                  value={data.notificationEmail || ""}
                  onChange={(e) => updateField("notificationEmail", e.target.value)}
                  placeholder="owner@example.com"
                  disabled={!data.notificationEmailEnabled}
                />
                {data.notificationEmailEnabled && data.notificationEmail && (
                  <Button size="sm" variant="ghost" onClick={handleTestEmail}>
                    <Send className="w-3 h-3 mr-1" />
                    Отправить тестовое письмо
                  </Button>
                )}
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Telegram</span>
                </div>

                {telegramLinked ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Telegram привязан</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={handleTestTelegram}>
                        <Send className="w-3 h-3 mr-1" />
                        Тестовое сообщение
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleUnlinkTelegram} className="text-red-600 hover:text-red-700">
                        Отвязать
                      </Button>
                    </div>
                  </div>
                ) : polling ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-indigo-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Ожидаем подтверждения в Telegram...</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Откройте Telegram и нажмите «Start» в боте. Страница обновится автоматически.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Нажмите кнопку ниже, чтобы открыть Telegram-бота. После нажатия «Start» уведомления привяжутся автоматически.
                    </p>
                    <Button onClick={handleLinkTelegram}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Привязать Telegram
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">MAX</span>
                </div>

                {maxLinked ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>MAX привязан</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={handleTestMax}>
                        <Send className="w-3 h-3 mr-1" />
                        Тестовое сообщение
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleUnlinkMax} className="text-red-600 hover:text-red-700">
                        Отвязать
                      </Button>
                    </div>
                  </div>
                ) : maxPolling ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-indigo-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Ожидаем код привязки в MAX...</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Отправьте код привязки в чат с ботом MAX. Страница обновится автоматически.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Отправьте код привязки в чат с ботом QrStars.ru в MAX:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm font-mono select-all">
                        {maxLinkCode}
                      </code>
                      <Button size="sm" variant="ghost" onClick={handleCopyMaxCode}>
                        {codeCopied ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      {process.env.NEXT_PUBLIC_MAX_BOT_URL && (
                        <Button variant="ghost" onClick={() => window.open(process.env.NEXT_PUBLIC_MAX_BOT_URL!, "_blank")}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Открыть MAX
                        </Button>
                      )}
                      <Button variant="ghost" onClick={handleStartMaxPolling}>
                        Код отправлен — ждать подтверждения
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {message && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                message.includes("Ошибка")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {message}
            </div>
          )}

          <Button size="lg" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Сохраняем..." : "Сохранить настройки"}
          </Button>
        </div>
      </main>
    </div>
  );
}
