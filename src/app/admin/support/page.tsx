"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  Headphones,
  Loader2,
  ExternalLink,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface SupportTicketRow {
  id: string;
  status: string;
  subject: string | null;
  user: { id: string; email: string; name: string | null };
  messageCount: number;
  lastMessage: {
    author: string;
    body: string;
    createdAt: string;
  } | null;
  telegramTopicUrl: string | null;
  updatedAt: string;
}

interface SetupStatus {
  botConfigured: boolean;
  groupConfigured: boolean;
  maxMirrorConfigured: boolean;
}

export default function AdminSupportPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState("open");
  const [configured, setConfigured] = useState(true);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);

  const loadTickets = () => {
    setLoading(true);
    fetch(`/api/admin/support?page=${page}&status=${filter}`)
      .then((r) => r.json())
      .then((data) => {
        setTickets(data.tickets || []);
        setPages(data.pages || 1);
        setConfigured(data.configured !== false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
    if (status !== "authenticated") return;
    loadTickets();
  }, [status, router, page, filter]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/telegram/support-setup")
      .then((r) => r.json())
      .then(setSetup)
      .catch(() => {});
  }, [status]);

  const registerWebhook = async () => {
    setWebhookLoading(true);
    try {
      const res = await fetch("/api/telegram/support-setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      else alert(`Webhook: ${data.webhookUrl}`);
      const cfg = await fetch("/api/telegram/support-setup").then((r) => r.json());
      setSetup(cfg);
    } finally {
      setWebhookLoading(false);
    }
  };

  const closeTicket = async (id: string) => {
    setSetupLoading(true);
    await fetch(`/api/admin/support/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    setSetupLoading(false);
    loadTickets();
  };

  if (status !== "authenticated") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Headphones className="w-7 h-7 text-amber-400" />
            Поддержка
          </h1>
          <p className="text-gray-400 mt-1">
            Отвечайте в темах Telegram-форума — ответы уходят в личный кабинет клиента
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadTickets}
            className="border-gray-600 text-gray-300"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
          <Button
            onClick={registerWebhook}
            disabled={webhookLoading}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900"
          >
            {webhookLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Webhook бота"}
          </Button>
        </div>
      </div>

      {setup && (!setup.botConfigured || !setup.groupConfigured) && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 space-y-2">
          <p className="font-medium">Настройка Telegram-форума</p>
          <ol className="list-decimal list-inside space-y-1 text-amber-200/90">
            <li>Создайте супергруппу → включите «Темы» (Topics)</li>
            <li>Добавьте @QrStarsSupportBot админом (управление темами)</li>
            <li>
              Узнайте ID группы (перешлите любое сообщение из группы боту @RawDataBot или
              @getidsbot)
            </li>
            <li>
              Пропишите <code className="bg-gray-800 px-1 rounded">TELEGRAM_SUPPORT_GROUP_ID</code>{" "}
              в .env на сервере и перезапустите приложение
            </li>
            <li>Нажмите «Webhook бота» выше</li>
            <li>
              В @BotFather: <code className="bg-gray-800 px-1 rounded">/setprivacy</code> →{" "}
              <b>Disable</b> для @QrStarsSupportBot (иначе бот не видит ваши ответы в теме)
            </li>
          </ol>
          <p className="text-xs text-amber-300/80">
            Бот: {setup.botConfigured ? "✓ токен" : "✗ токен"} · Группа:{" "}
            {setup.groupConfigured ? "✓ ID" : "✗ ID"} · MAX-зеркало:{" "}
            {setup.maxMirrorConfigured ? "✓" : "— (опционально)"}
          </p>
        </div>
      )}

      {!configured && setup?.botConfigured && setup?.groupConfigured && (
        <p className="text-sm text-gray-400">Перезапустите контейнер после смены .env</p>
      )}

      <div className="flex gap-2">
        {(["open", "closed", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filter === s
                ? "bg-gray-700 text-amber-400"
                : "text-gray-400 hover:bg-gray-800"
            }`}
          >
            {s === "open" ? "Открытые" : s === "closed" ? "Закрытые" : "Все"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Тикетов пока нет</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white">
                    {t.user.name || t.user.email}
                  </span>
                  <Badge variant={t.status === "OPEN" ? "success" : "default"}>
                    {t.status === "OPEN" ? "Открыт" : "Закрыт"}
                  </Badge>
                  <span className="text-xs text-gray-500">{t.user.email}</span>
                </div>
                {t.lastMessage && (
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                    <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                    {t.lastMessage.author === "USER" ? "Клиент: " : "Вы: "}
                    {t.lastMessage.body}
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  {t.messageCount} сообщ. · обновлён{" "}
                  {new Date(t.updatedAt).toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {t.telegramTopicUrl && (
                  <a
                    href={t.telegramTopicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Тема в Telegram
                  </a>
                )}
                {t.status === "OPEN" && (
                  <Button
                    variant="outline"
                    disabled={setupLoading}
                    onClick={() => closeTicket(t.id)}
                    className="border-gray-600 text-gray-300"
                  >
                    Закрыть
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-400">
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
