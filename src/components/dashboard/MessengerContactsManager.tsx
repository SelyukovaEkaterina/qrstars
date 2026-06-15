"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import {
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { formatMessengerContactLabel, messengerProviderLabel } from "@/lib/messenger-contact";
import {
  getMaxBotUrl,
  messengerLinkCode,
  telegramDeepLink,
  telegramMessengerStartPayload,
} from "@/lib/messenger-linking";
import { maxMessengerDeepLink } from "@/lib/max-bot-link";
import MessengerBotLinkHelp from "@/components/dashboard/MessengerBotLinkHelp";

export interface MessengerContactItem {
  id: string;
  provider: "TELEGRAM" | "MAX" | "EMAIL";
  externalId: string;
  label: string | null;
  createdAt: string;
}

interface NotificationPrefs {
  notificationEmailEnabled: boolean;
  notificationEmailRequestsEnabled: boolean;
  notificationTelegramEnabled: boolean;
  notificationTelegramRequestsEnabled: boolean;
  notificationMaxEnabled: boolean;
  notificationMaxRequestsEnabled: boolean;
}

interface MessengerContactsManagerProps {
  establishmentId: string;
  establishmentName?: string;
}

type ChannelKind = "EMAIL" | "TELEGRAM" | "MAX";
type ToggleField = keyof NotificationPrefs;
type LinkingChannel = "TELEGRAM" | "MAX" | null;

const CHANNELS: {
  provider: ChannelKind;
  label: string;
  icon: typeof Mail;
  iconClass: string;
  reviewsField: ToggleField;
  requestsField: ToggleField;
}[] = [
  {
    provider: "EMAIL",
    label: "Email",
    icon: Mail,
    iconClass: "text-indigo-500",
    reviewsField: "notificationEmailEnabled",
    requestsField: "notificationEmailRequestsEnabled",
  },
  {
    provider: "TELEGRAM",
    label: "Telegram",
    icon: MessageCircle,
    iconClass: "text-blue-500",
    reviewsField: "notificationTelegramEnabled",
    requestsField: "notificationTelegramRequestsEnabled",
  },
  {
    provider: "MAX",
    label: "MAX",
    icon: MessageCircle,
    iconClass: "text-green-600",
    reviewsField: "notificationMaxEnabled",
    requestsField: "notificationMaxRequestsEnabled",
  },
];

export default function MessengerContactsManager({
  establishmentId,
  establishmentName,
}: MessengerContactsManagerProps) {
  const { data: session, status: sessionStatus } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [contacts, setContacts] = useState<MessengerContactItem[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkingChannel, setLinkingChannel] = useState<LinkingChannel>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailLabel, setEmailLabel] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [savingToggle, setSavingToggle] = useState<ToggleField | null>(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null);
  const [maxBotUrl, setMaxBotUrl] = useState(getMaxBotUrl());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contactsCountRef = useRef(0);

  const fetchContacts = useCallback(() => {
    return fetch("/api/messenger-contacts")
      .then(async (r) => {
        if (!r.ok) return [] as MessengerContactItem[];
        const res = await r.json();
        const list = (res.contacts ?? []) as MessengerContactItem[];
        setContacts(list);
        contactsCountRef.current = list.length;
        return list;
      })
      .catch(() => [] as MessengerContactItem[]);
  }, []);

  const fetchPrefs = useCallback(async () => {
    const r = await fetch(`/api/settings?id=${establishmentId}`);
    if (!r.ok) return;
    const data = await r.json();
    const est = data.establishment;
    if (!est) return;
    setPrefs({
      notificationEmailEnabled: !!est.notificationEmailEnabled,
      notificationEmailRequestsEnabled: !!est.notificationEmailRequestsEnabled,
      notificationTelegramEnabled: !!est.notificationTelegramEnabled,
      notificationTelegramRequestsEnabled: !!est.notificationTelegramRequestsEnabled,
      notificationMaxEnabled: !!est.notificationMaxEnabled,
      notificationMaxRequestsEnabled: !!est.notificationMaxRequestsEnabled,
    });
  }, [establishmentId]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    Promise.all([fetchContacts(), fetchPrefs()]).finally(() => setLoading(false));

    fetch("/api/messenger-linking/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.telegramBotUsername) setTelegramBotUsername(data.telegramBotUsername);
        if (data.maxBotUrl) setMaxBotUrl(data.maxBotUrl);
      })
      .catch(() => {});
  }, [fetchContacts, fetchPrefs, sessionStatus]);

  useEffect(() => {
    const refresh = () => {
      void fetchContacts();
      void fetchPrefs();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
    return () => window.removeEventListener("focus", refresh);
  }, [fetchContacts, fetchPrefs]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    setLinkingChannel(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const handleLinkTelegram = () => {
    if (!userId || !telegramBotUsername) return;

    const countBefore = contactsCountRef.current;
    window.open(
      telegramDeepLink(telegramBotUsername, telegramMessengerStartPayload(userId)),
      "_blank"
    );
    setLinkingChannel("TELEGRAM");
    pollRef.current = setInterval(async () => {
      const list = await fetchContacts();
      if (list.some((c) => c.provider === "TELEGRAM") && list.length > countBefore) {
        void fetchPrefs();
        stopPolling();
      }
    }, 3000);
    setTimeout(stopPolling, 120000);
  };

  const handleLinkMax = () => {
    if (!userId) return;
    const url = maxMessengerDeepLink(userId, maxBotUrl);
    if (!url) return;

    const countBefore = contactsCountRef.current;
    window.open(url, "_blank");
    setLinkingChannel("MAX");
    pollRef.current = setInterval(async () => {
      const list = await fetchContacts();
      if (list.some((c) => c.provider === "MAX") && list.length > countBefore) {
        void fetchPrefs();
        stopPolling();
      }
    }, 3000);
    setTimeout(stopPolling, 120000);
  };

  const handleAddEmail = async () => {
    const email = emailInput.trim();
    if (!email) {
      setEmailError("Укажите email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Некорректный email");
      return;
    }

    setEmailSaving(true);
    setEmailError("");
    try {
      const res = await fetch("/api/messenger-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "EMAIL",
          externalId: email,
          label: emailLabel.trim() || email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || "Не удалось добавить email");
        return;
      }
      setEmailInput("");
      setEmailLabel("");
      setShowEmailForm(false);
      await Promise.all([fetchContacts(), fetchPrefs()]);
    } catch {
      setEmailError("Ошибка соединения");
    } finally {
      setEmailSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/messenger-contacts?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setContacts((prev) => {
        const next = prev.filter((c) => c.id !== id);
        contactsCountRef.current = next.length;
        return next;
      });
    }
  };

  const handleCopyCode = () => {
    if (!userId) return;
    navigator.clipboard.writeText(messengerLinkCode(userId)).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const saveToggle = async (field: ToggleField, value: boolean) => {
    if (!prefs) return;
    setSavingToggle(field);
    setPrefs((prev) => (prev ? { ...prev, [field]: value } : prev));
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: establishmentId, [field]: value }),
      });
      if (!res.ok) {
        void fetchPrefs();
      }
    } catch {
      void fetchPrefs();
    } finally {
      setSavingToggle(null);
    }
  };

  const linkCode = userId ? messengerLinkCode(userId) : "";
  const telegramBotPageUrl =
    userId && telegramBotUsername
      ? telegramDeepLink(telegramBotUsername, telegramMessengerStartPayload(userId))
      : null;

  const contactsFor = (provider: ChannelKind) =>
    contacts.filter((c) => c.provider === provider);

  const primaryContact = (provider: ChannelKind) => contactsFor(provider)[0];

  if (sessionStatus === "loading" || loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      </Card>
    );
  }

  return (
    <Card id="notification-channels">
      <h3 className="font-semibold text-gray-900 mb-1">Каналы для уведомлений</h3>
      <p className="text-sm text-gray-500 mb-4">
        Подключите канал один раз на аккаунт
        {establishmentName ? (
          <>
            {" "}
            и выберите, что получать для заведения «{establishmentName}»
          </>
        ) : (
          " и выберите типы уведомлений для заведения"
        )}
        .
      </p>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="pb-2 pl-1 pr-3 font-medium">Канал</th>
              <th className="pb-2 pr-3 font-medium">Аккаунт</th>
              <th className="pb-2 pr-3 font-medium text-center w-24">Отзывы</th>
              <th className="pb-2 pr-3 font-medium text-center w-24">Заявки</th>
              <th className="pb-2 pr-1 font-medium text-right w-28">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {CHANNELS.map((channel) => {
              const Icon = channel.icon;
              const connected = primaryContact(channel.provider);
              const linked = !!connected;
              const isLinking = linkingChannel === channel.provider;
              const reviewsChecked = prefs?.[channel.reviewsField] ?? false;
              const requestsChecked = prefs?.[channel.requestsField] ?? false;
              const toggleDisabled = !linked || savingToggle !== null;

              return (
                <tr key={channel.provider} className="align-top">
                  <td className="py-3 pl-1 pr-3">
                    <div className="flex items-center gap-2 font-medium text-gray-800">
                      <Icon className={`w-4 h-4 shrink-0 ${channel.iconClass}`} />
                      {channel.label}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    {linked ? (
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {formatMessengerContactLabel(connected)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {messengerProviderLabel(channel.provider)} · подключён
                        </p>
                      </div>
                    ) : isLinking ? (
                      <div className="flex items-center gap-2 text-indigo-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span className="text-xs">Ожидаем подтверждения…</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Не подключён</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-center">
                    <input
                      type="checkbox"
                      checked={reviewsChecked}
                      disabled={toggleDisabled}
                      onChange={(e) => saveToggle(channel.reviewsField, e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-40"
                      title={
                        linked
                          ? "Жалобы 1–3★ и негативные отзывы"
                          : "Сначала подключите канал"
                      }
                    />
                  </td>
                  <td className="py-3 pr-3 text-center">
                    <input
                      type="checkbox"
                      checked={requestsChecked}
                      disabled={toggleDisabled}
                      onChange={(e) => saveToggle(channel.requestsField, e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-40"
                      title={
                        linked
                          ? "Заявки из форм и заказы из меню"
                          : "Сначала подключите канал"
                      }
                    />
                  </td>
                  <td className="py-3 pr-1 text-right whitespace-nowrap">
                    {linked ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(connected.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Отключить
                      </Button>
                    ) : channel.provider === "EMAIL" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowEmailForm((v) => !v)}
                      >
                        Подключить
                      </Button>
                    ) : channel.provider === "TELEGRAM" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleLinkTelegram}
                        disabled={!userId || !telegramBotUsername || isLinking}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Подключить
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleLinkMax}
                        disabled={!userId || !maxBotUrl || isLinking}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Подключить
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Отзывы — жалобы 1–3★. Заявки — формы на странице и заказы из меню.
      </p>

      {showEmailForm && !primaryContact("EMAIL") && (
        <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
          <Input
            label="Email"
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="manager@example.com"
          />
          <Input
            label="Подпись (необязательно)"
            value={emailLabel}
            onChange={(e) => setEmailLabel(e.target.value)}
            placeholder="Отдел продаж"
          />
          {emailError && <p className="text-xs text-red-600">{emailError}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddEmail} disabled={emailSaving}>
              {emailSaving ? "Добавляем…" : "Сохранить"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowEmailForm(false)}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      {linkingChannel === "TELEGRAM" && (
        <div className="mt-4 p-4 rounded-lg border border-indigo-100 bg-indigo-50/40">
          <MessengerBotLinkHelp
            botUrl={telegramBotPageUrl}
            linkCode={linkCode}
            codeCopied={codeCopied}
            onCopyCode={handleCopyCode}
            codeHint="Откройте бота и отправьте код одним сообщением:"
          />
        </div>
      )}

      {linkingChannel === "MAX" && (
        <div className="mt-4 p-4 rounded-lg border border-green-100 bg-green-50/40">
          <MessengerBotLinkHelp
            botUrl={maxBotUrl}
            linkCode={linkCode}
            codeCopied={codeCopied}
            onCopyCode={handleCopyCode}
            codeHint="Откройте бота в MAX и отправьте код одним сообщением:"
          />
        </div>
      )}

      {!telegramBotUsername && (
        <p className="text-xs text-amber-600 mt-3">
          Telegram-бот для уведомлений не настроен на сервере — используйте MAX или email.
        </p>
      )}
    </Card>
  );
}
