"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { formatMessengerContactLabel, messengerProviderLabel } from "@/lib/messenger-contact";

export interface MessengerContactItem {
  id: string;
  provider: "TELEGRAM" | "MAX" | "EMAIL";
  externalId: string;
  label: string | null;
  createdAt: string;
}

interface MessengerContactsManagerProps {
  compact?: boolean;
}

export default function MessengerContactsManager({ compact }: MessengerContactsManagerProps) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [contacts, setContacts] = useState<MessengerContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [maxPolling, setMaxPolling] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailLabel, setEmailLabel] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contactsCountRef = useRef(0);

  const fetchContacts = useCallback(() => {
    return fetch("/api/messenger-contacts")
      .then((r) => r.json())
      .then((res) => {
        const list = (res.contacts ?? []) as MessengerContactItem[];
        setContacts(list);
        contactsCountRef.current = list.length;
        return list;
      })
      .catch(() => [] as MessengerContactItem[]);
  }, []);

  useEffect(() => {
    fetchContacts().finally(() => setLoading(false));
  }, [fetchContacts]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (maxPollRef.current) clearInterval(maxPollRef.current);
    };
  }, []);

  const stopPolling = () => {
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const stopMaxPolling = () => {
    setMaxPolling(false);
    if (maxPollRef.current) clearInterval(maxPollRef.current);
  };

  const handleLinkTelegram = () => {
    if (!userId) return;
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (!botUsername) return;

    const countBefore = contactsCountRef.current;
    window.open(`https://t.me/${botUsername}?start=link_mc_${userId}`, "_blank");
    setPolling(true);
    pollRef.current = setInterval(async () => {
      const list = await fetchContacts();
      if (list.length > countBefore) stopPolling();
    }, 3000);
    setTimeout(stopPolling, 120000);
  };

  const handleCopyMaxCode = () => {
    if (!userId) return;
    navigator.clipboard.writeText(`MC-${userId}`).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleStartMaxPolling = () => {
    const maxBotUrl = process.env.NEXT_PUBLIC_MAX_BOT_URL;
    if (maxBotUrl) window.open(maxBotUrl, "_blank");

    const countBefore = contactsCountRef.current;
    setMaxPolling(true);
    maxPollRef.current = setInterval(async () => {
      const list = await fetchContacts();
      if (list.length > countBefore) stopMaxPolling();
    }, 3000);
    setTimeout(stopMaxPolling, 120000);
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
      await fetchContacts();
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

  const telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const telegramBotUrl =
    userId && telegramBotUsername
      ? `https://t.me/${telegramBotUsername}?start=link_mc_${userId}`
      : null;
  const maxBotUrl = process.env.NEXT_PUBLIC_MAX_BOT_URL;
  const maxLinkCode = userId ? `MC-${userId}` : "";

  if (loading) {
    return (
      <Card className={compact ? "p-4" : undefined}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Каналы для уведомлений</h2>
          <p className="text-sm text-gray-500 mt-1">
            Подключите Telegram, MAX или email — можно несколько каналов. Используются для формы
            «Написать человеку» на визитках и других уведомлений.
          </p>
        </div>
      )}

      {compact && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-1">Каналы для уведомлений</h3>
          <p className="text-sm text-gray-500">
            Подключите Telegram, MAX или email — можно несколько каналов на аккаунт.
          </p>
        </Card>
      )}

      {contacts.length > 0 && (
        <Card className={compact ? "p-4" : undefined}>
          <h3 className="font-semibold text-gray-900 mb-3">Подключённые каналы</h3>
          <ul className="space-y-2">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {contact.provider === "EMAIL" ? (
                    <Mail className="w-4 h-4 shrink-0 text-indigo-500" />
                  ) : (
                    <MessageCircle
                      className={`w-4 h-4 shrink-0 ${
                        contact.provider === "TELEGRAM" ? "text-blue-500" : "text-green-500"
                      }`}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {formatMessengerContactLabel(contact)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {messengerProviderLabel(contact.provider)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(contact.id)}
                  className="text-red-600 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className={compact ? "p-4" : undefined}>
        <h3 className="font-semibold text-gray-900 mb-3">Добавить канал</h3>
        <div className="space-y-4">
          <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-700">Электронная почта</span>
            </div>
            <div className="space-y-2">
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
              <Button size="sm" onClick={handleAddEmail} disabled={emailSaving}>
                {emailSaving ? "Добавляем..." : "Добавить email"}
              </Button>
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Telegram</span>
            </div>
            {polling ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ожидаем подтверждения в Telegram...
                </div>
                {telegramBotUrl && (
                  <a
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Открыть бота
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Button size="sm" onClick={handleLinkTelegram} disabled={!userId}>
                  <ExternalLink className="w-4 h-4 mr-1" />
                  {contacts.some((c) => c.provider === "TELEGRAM") ? "Подключить ещё" : "Привязать Telegram"}
                </Button>
                {telegramBotUrl && (
                  <a
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    @{telegramBotUsername}
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">MAX</span>
            </div>
            {maxPolling ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ожидаем код в MAX...
                </div>
                {maxBotUrl && (
                  <a
                    href={maxBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Открыть бота в MAX
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {maxBotUrl && (
                  <a
                    href={maxBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Написать боту в MAX
                  </a>
                )}
                <p className="text-xs text-gray-500">Отправьте код боту в MAX:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm font-mono select-all">
                    {maxLinkCode}
                  </code>
                  <Button size="sm" variant="ghost" onClick={handleCopyMaxCode} disabled={!userId}>
                    {codeCopied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {maxBotUrl && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(maxBotUrl, "_blank")}>
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Открыть бота в MAX
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={handleStartMaxPolling} disabled={!userId}>
                    Код отправлен — ждать подтверждения
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
