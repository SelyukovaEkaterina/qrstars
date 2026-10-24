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
  lastEmailStatus?: string | null;
  lastEmailAt?: string | null;
  lastEmailError?: string | null;
  lastEmailKind?: string | null;
}

function formatLastEmailStatus(contact: MessengerContactItem): string {
  if (!contact.lastEmailAt || !contact.lastEmailStatus) {
    return "Ещё не отправляли";
  }
  const when = new Date(contact.lastEmailAt).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (contact.lastEmailStatus === "failed") {
    return `Ошибка отправки ${when}${contact.lastEmailError ? `: ${contact.lastEmailError}` : ""}`;
  }
  if (contact.lastEmailStatus === "bounced") {
    return `Не доставлено ${when}${contact.lastEmailError ? `: ${contact.lastEmailError}` : ""}`;
  }
  return `Отправлено ${when} (принято SMTP)`;
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
  /** Без проекта показываем только каналы аккаунта, без галочек типов уведомлений. */
  establishmentId?: string | null;
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
  const [emailTestBusy, setEmailTestBusy] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState("");
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
    if (!establishmentId) {
      setPrefs(null);
      return;
    }
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
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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

  const handleTestEmail = async (contactId: string) => {
    if (!establishmentId) return;
    setEmailTestBusy(true);
    setEmailTestStatus("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-email",
          establishmentId,
          contactId,
        }),
      });
      const data = await res.json();
      setEmailTestStatus(
        res.ok
          ? "Письмо принято почтовым сервером. Проверьте входящие (обычно до 2 минут) и папку «Спам»."
          : data.error || "Не удалось отправить тестовое письмо"
      );
      if (res.ok || res.status === 502) {
        await fetchContacts();
      }
    } catch {
      setEmailTestStatus("Ошибка соединения");
    } finally {
      setEmailTestBusy(false);
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
    if (!prefs || !establishmentId) return;
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

  const hasProject = !!establishmentId;

  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-1">Каналы для уведомлений</h3>
      <p className="text-sm text-gray-500 mb-4">
        Email аккаунта подключается автоматически. Telegram и MAX — один раз на аккаунт
        {!hasProject
          ? ". Какие уведомления куда слать, выберете после создания проекта"
          : establishmentName
            ? `; для проекта «${establishmentName}» выберите типы уведомлений`
            : "; выберите типы уведомлений для проекта"}
        .
      </p>

      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const connected = primaryContact(channel.provider);
          const linked = !!connected;
          const isLinking = linkingChannel === channel.provider;
          const reviewsChecked = prefs?.[channel.reviewsField] ?? false;
          const requestsChecked = prefs?.[channel.requestsField] ?? false;
          const toggleDisabled = !linked || savingToggle !== null;

          return (
            <li key={channel.provider} className="p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${channel.iconClass}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{channel.label}</p>
                    {linked ? (
                      <>
                        <p className="break-all text-sm text-gray-700">
                          {formatMessengerContactLabel(connected)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {messengerProviderLabel(channel.provider)} · подключён
                        </p>
                        {channel.provider === "EMAIL" && (
                          <p
                            className={`mt-1 break-words text-xs ${
                              connected.lastEmailStatus === "failed" ||
                              connected.lastEmailStatus === "bounced"
                                ? "text-red-600"
                                : "text-gray-500"
                            }`}
                          >
                            {formatLastEmailStatus(connected)}
                          </p>
                        )}
                      </>
                    ) : isLinking ? (
                      <div className="flex items-center gap-2 text-indigo-600">
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        <span className="text-xs">Ожидаем подтверждения…</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Не подключён</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pl-8 sm:shrink-0 sm:justify-end sm:pl-0">
                  {linked ? (
                    <>
                      {channel.provider === "EMAIL" && hasProject && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-10"
                          onClick={() => handleTestEmail(connected.id)}
                          disabled={emailTestBusy}
                        >
                          {emailTestBusy ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="mr-1 h-3.5 w-3.5" />
                          )}
                          Проверить
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(connected.id)}
                        className="min-h-10 text-red-600"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Отключить
                      </Button>
                    </>
                  ) : channel.provider === "EMAIL" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-10"
                      onClick={() => setShowEmailForm((v) => !v)}
                    >
                      Подключить
                    </Button>
                  ) : channel.provider === "TELEGRAM" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-10"
                      onClick={handleLinkTelegram}
                      disabled={!userId || !telegramBotUsername || isLinking}
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Подключить
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-10"
                      onClick={handleLinkMax}
                      disabled={!userId || !maxBotUrl || isLinking}
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Подключить
                    </Button>
                  )}
                </div>
              </div>

              {hasProject && (
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 pl-8">
                  <label
                    className={`flex min-h-10 items-center gap-2 text-sm ${
                      linked ? "cursor-pointer text-gray-700" : "text-gray-400"
                    }`}
                    title={linked ? "Жалобы 1–3★ и негативные отзывы" : "Сначала подключите канал"}
                  >
                    <input
                      type="checkbox"
                      checked={reviewsChecked}
                      disabled={toggleDisabled}
                      onChange={(e) => saveToggle(channel.reviewsField, e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                    />
                    Отзывы
                  </label>
                  <label
                    className={`flex min-h-10 items-center gap-2 text-sm ${
                      linked ? "cursor-pointer text-gray-700" : "text-gray-400"
                    }`}
                    title={linked ? "Заявки из форм и заказы из меню" : "Сначала подключите канал"}
                  >
                    <input
                      type="checkbox"
                      checked={requestsChecked}
                      disabled={toggleDisabled}
                      onChange={(e) => saveToggle(channel.requestsField, e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                    />
                    Заявки
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {hasProject && (
        <p className="text-xs text-gray-400 mt-3">
          Отзывы — жалобы 1–3★. Заявки — формы на странице и заказы из меню.
        </p>
      )}
      {emailTestStatus && (
        <p
          className={`mt-2 text-xs ${
            emailTestStatus.startsWith("Письмо принято") ? "text-green-700" : "text-red-600"
          }`}
        >
          {emailTestStatus}
        </p>
      )}

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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="min-h-10" onClick={handleAddEmail} disabled={emailSaving}>
              {emailSaving ? "Добавляем…" : "Сохранить"}
            </Button>
            <Button size="sm" variant="ghost" className="min-h-10" onClick={() => setShowEmailForm(false)}>
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
