"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lightbulb, Send } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function ProductIdeasPage() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("sending");
    try {
      const response = await fetch("/api/product-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, pageUrl: window.location.href }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить сообщение");
      setMessage("");
      setStatus("sent");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось отправить сообщение");
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" /> Назад в кабинет
        </Link>
        <div className="mt-3 flex">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
            <Lightbulb className="h-4 w-4" /> Влияем на продукт
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-gray-950">Есть идея или что-то не работает?</h1>
        <p className="mt-2 text-gray-600">
          Напишите, чего вам не хватает или где возникла сложность. Мы читаем все сообщения и используем их, чтобы делать QrStars удобнее.
        </p>
      </div>

      <Card className="p-4 sm:p-6">
        {status === "sent" ? (
          <div className="space-y-3 text-center py-5">
            <div className="text-3xl">Спасибо!</div>
            <p className="text-gray-600">Идея отправлена команде. Мы читаем все сообщения.</p>
            <Button variant="outline" onClick={() => setStatus("idle")}>Отправить ещё одну</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label htmlFor="product-feedback" className="block text-sm font-semibold text-gray-800">
              Идея, проблема или пожелание
            </label>
            <textarea
              id="product-feedback"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4000}
              required
              rows={8}
              placeholder="Например: хотелось бы видеть отдельно отзывы из 2GIS, или на такой-то странице не получается сохранить изменения…"
              className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-base sm:text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500">{message.length}/4000</p>
              <Button type="submit" className="min-h-10" disabled={status === "sending"}>
                <Send className="mr-2 h-4 w-4" />
                {status === "sending" ? "Отправляем…" : "Отправить команде"}
              </Button>
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </form>
        )}
      </Card>
    </div>
  );
}
