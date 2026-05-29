"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupportMessage {
  id: string;
  author: "USER" | "STAFF";
  body: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  createdAt: string;
}

interface SupportChatProps {
  className?: string;
}

function MessageAttachment({ m }: { m: SupportMessage }) {
  if (!m.attachmentUrl) return null;

  const isImage = m.attachmentMime?.startsWith("image/");

  return (
    <div className="mt-2">
      {isImage ? (
        <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.attachmentUrl}
            alt={m.attachmentName || "Изображение"}
            className="max-w-full rounded-lg max-h-48 object-contain"
          />
        </a>
      ) : (
        <a
          href={m.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1 text-sm underline",
            m.author === "USER" ? "text-indigo-100" : "text-indigo-600"
          )}
        >
          📎 {m.attachmentName || "Скачать файл"}
        </a>
      )}
    </div>
  );
}

export default function SupportChat({ className }: SupportChatProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/support");
      const data = await res.json();
      if (!res.ok) {
        const msg = [data.error, data.hint].filter(Boolean).join(" — ");
        throw new Error(msg || "Ошибка загрузки");
      }
      setMessages(data.messages || []);
      window.dispatchEvent(new CustomEvent("support-unread-changed", { detail: 0 }));
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if ((!text && !pendingFile) || sending) return;

    setSending(true);
    setError(null);
    try {
      let res: Response;
      if (pendingFile) {
        const formData = new FormData();
        if (text) formData.set("body", text);
        formData.set("file", pendingFile);
        res = await fetch("/api/support", { method: "POST", body: formData });
      } else {
        res = await fetch("/api/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось отправить");

      setDraft("");
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessages((prev) => [...prev, data.message]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-16", className)}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden", className)}>
      <div className="flex-1 min-h-[320px] max-h-[480px] overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            Напишите вопрос или прикрепите файл — ответим в рабочее время.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.author === "USER" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm break-words",
                m.author === "USER"
                  ? "bg-indigo-600 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-900 rounded-bl-md"
              )}
            >
              {m.author === "STAFF" && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Поддержка QrStars
                </p>
              )}
              {m.body && !m.body.startsWith("📎") && (
                <p className="whitespace-pre-wrap">{m.body}</p>
              )}
              {m.body.startsWith("📎") && !m.attachmentUrl && (
                <p className="whitespace-pre-wrap">{m.body}</p>
              )}
              <MessageAttachment m={m} />
              <p
                className={cn(
                  "text-[10px] mt-1",
                  m.author === "USER" ? "text-indigo-200" : "text-gray-400"
                )}
              >
                {new Date(m.createdAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="px-4 text-sm text-red-600 border-t border-gray-100 pt-2">{error}</p>
      )}

      {pendingFile && (
        <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600 bg-gray-50">
          <Paperclip className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1">{pendingFile.name}</span>
          <button
            type="button"
            onClick={() => {
              setPendingFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Убрать файл"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="border-t border-gray-100 p-3 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,audio/*,video/*"
          onChange={onFilePick}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="self-end shrink-0 p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          title="Прикрепить файл"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Сообщение или файл…"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button
          onClick={handleSend}
          disabled={sending || (!draft.trim() && !pendingFile)}
          className="self-end shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
