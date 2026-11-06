"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

const DOCS_URL = "https://qrstars.ru/api.html";

function formatDate(iso: string | null): string {
  if (!iso) return "ещё не использовался";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ApiKeysSettings() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/account/api-keys")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setKeys(data.keys ?? []))
      .catch(() => setKeys([]));
  }, []);

  const createKey = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Мой ключ" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось создать ключ");
        return;
      }
      setKeys((prev) => [data.key, ...(prev ?? [])]);
      setSecret(data.secret);
      setCopied(false);
      setName("");
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  };

  const revokeKey = async (key: ApiKeyRow) => {
    if (!window.confirm(`Отозвать ключ «${key.name}»? Интеграции с ним перестанут работать.`)) return;
    const res = await fetch(`/api/account/api-keys/${key.id}`, { method: "DELETE" });
    if (res.ok) setKeys((prev) => (prev ?? []).filter((k) => k.id !== key.id));
    else setError("Не удалось отозвать ключ");
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card id="api-keys" className="scroll-mt-20">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">API-ключи</h3>
          <p className="mt-1 text-sm text-gray-500">
            Для своих интеграций, CRM и ИИ-агентов: создавать QR-коды, менять ссылку, забирать
            отзывы и статистику.{" "}
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener"
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              Документация API
            </a>
          </p>
        </div>
      </div>

      {secret && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">
            Скопируйте ключ сейчас — больше мы его не покажем.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 break-all rounded bg-white px-3 py-2 font-mono text-sm text-gray-900">
              {secret}
            </code>
            <Button type="button" variant="secondary" onClick={copySecret} className="min-h-10 shrink-0">
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Скопировано" : "Копировать"}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setSecret(null)}
            className="mt-2 text-xs font-medium text-amber-900 underline"
          >
            Я сохранил ключ
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            id="api-key-name"
            label="Название ключа"
            placeholder="Например, amoCRM или ИИ-ассистент"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="button" onClick={createKey} disabled={busy} className="min-h-10 shrink-0">
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Создать ключ
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        {keys === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-500">Ключей пока нет.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-500">
                    <span className="font-mono">{k.prefix}…</span> · {formatDate(k.lastUsedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeKey(k)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Отозвать
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
