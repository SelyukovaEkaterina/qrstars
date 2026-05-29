"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { generateQRWithCenter } from "@/lib/qr-generator";
import { scanUrlForCode } from "@/lib/utils";
import {
  Store,
  MapPin,
  QrCode,
  CheckCircle2,
  ExternalLink,
  Download,
  ArrowRight,
  Sparkles,
  Star,
  LayoutGrid,
  ChevronLeft,
} from "lucide-react";

export type SetupIntent = "reviews" | "landing";

type Step = "intent" | "form" | "success";

export default function SetupStartWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intent");
  const [intent, setIntent] = useState<SetupIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");

  const [form, setForm] = useState({
    name: "",
    yandexMapsUrl: "",
    twoGisUrl: "",
    phone: "",
  });

  const [result, setResult] = useState<{
    establishment: { id: string; name: string };
    qrcode: { id: string; code: string };
    intent: SetupIntent;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/setup/quick-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, intent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось создать заведение");
        return;
      }

      setResult({ ...data, intent });
      const img = await generateQRWithCenter(scanUrlForCode(data.qrcode.code), { isPro: false }, 320);
      setQrImageUrl(img);
      setStep("success");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const chooseIntent = (value: SetupIntent) => {
    setIntent(value);
    setError("");
    setStep("form");
  };

  if (step === "success" && result) {
    const scanUrl = scanUrlForCode(result.qrcode.code);
    const isReviews = result.intent === "reviews";
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Готово! QR работает</h1>
            <p className="text-gray-600">
              {isReviews ? (
                <>
                  QR сразу открывает сбор отзывов для «{result.establishment.name}». Оценки 1–3★ — жалоба
                  вам, 4★ — 2GIS, 5★ — Яндекс.Карты. Меню, Wi‑Fi и визитку настроите в «Моя страница».
                </>
              ) : (
                <>
                  QR ведёт на страницу заведения «{result.establishment.name}». Какие блоки показывать
                  (отзывы, меню, Wi‑Fi) — в «Моя страница».
                </>
              )}
            </p>
          </div>

          <Card className="text-center space-y-4">
            {qrImageUrl && (
              <img
                src={qrImageUrl}
                alt="QR-код"
                className="w-56 h-56 mx-auto rounded-xl border border-gray-100 shadow-sm"
              />
            )}
            <p className="font-mono text-sm text-gray-500">{result.qrcode.code}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <a href={qrImageUrl} download={`qr-${result.qrcode.code}.png`}>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Скачать PNG
                </Button>
              </a>
              <a href={scanUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Открыть как гость
                </Button>
              </a>
            </div>
          </Card>

          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() => router.push(`/dashboard/qrcodes/${result.qrcode.id}?welcome=1`)}
            >
              Настроить QR и скачать табличку
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => router.push("/dashboard/my-page")}
            >
              Оформить страницу заведения
            </Button>
            <p className="text-center text-sm text-gray-500">
              <button
                type="button"
                className="text-indigo-600 hover:text-indigo-800 font-medium"
                onClick={() => {
                  router.refresh();
                  router.push("/dashboard");
                }}
              >
                Перейти в обзор
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "intent") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Первый запуск
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Что хотите настроить?</h1>
            <p className="text-gray-600 max-w-md mx-auto">
              Выберите сценарий — поля на следующем шаге подстроятся под вашу задачу.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseIntent("reviews")}
              className="text-left rounded-xl border-2 border-gray-200 bg-white p-5 transition hover:border-indigo-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Star className="w-5 h-5" />
                </span>
                <span className="font-semibold text-gray-900">Сбор отзывов</span>
              </div>
              <p className="text-sm text-gray-600">
                QR сразу на оценки 1–5★. Меню, Wi‑Fi и визитку добавите в личном кабинете.
              </p>
            </button>

            <button
              type="button"
              onClick={() => chooseIntent("landing")}
              className="text-left rounded-xl border-2 border-gray-200 bg-white p-5 transition hover:border-indigo-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <LayoutGrid className="w-5 h-5" />
                </span>
                <span className="font-semibold text-gray-900">Страница заведения</span>
              </div>
              <p className="text-sm text-gray-600">
                QR на общий лендинг. Отзывы, меню и блоки — настроите в «Моя страница».
              </p>
            </button>
          </div>

          <p className="text-center text-sm text-gray-500">
            Уже активировали табличку?{" "}
            <Link href="/dashboard/activate" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Ввести мастер-код
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const isReviews = intent === "reviews";

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex items-center justify-center px-4 py-10">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Первый запуск
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isReviews ? "Запустите сбор отзывов" : "Создайте страницу заведения"}
          </h1>
          <p className="text-gray-600 max-w-md mx-auto">
            {isReviews
              ? "Название и ссылка на Яндекс.Карты — QR сразу откроет сбор отзывов для гостей."
              : "Достаточно названия — QR на страницу заведения. Ссылки на карты и блоки — в личном кабинете."}
          </p>
        </div>

        <div className="flex justify-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border text-gray-400">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
              1
            </span>
            Цель
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            Заведение
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
              3
            </span>
            QR-код
          </span>
        </div>

        <Card>
          <button
            type="button"
            onClick={() => {
              setStep("intent");
              setError("");
            }}
            className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Изменить сценарий
          </button>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <div>
              <Input
                label="Название заведения *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Кафе, салон, клиника, автосервис…"
                required
              />
            </div>

            {isReviews && (
              <>
                <div>
                  <Input
                    label="Ссылка на Яндекс.Карты *"
                    type="url"
                    value={form.yandexMapsUrl}
                    onChange={(e) => setForm({ ...form, yandexMapsUrl: e.target.value })}
                    placeholder="https://yandex.ru/maps/org/..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Гости с оценкой 5★ перейдут сюда оставить отзыв (на бесплатном тарифе — автоматически).
                  </p>
                </div>

                <Input
                  label="Ссылка на 2GIS (необязательно)"
                  type="url"
                  value={form.twoGisUrl}
                  onChange={(e) => setForm({ ...form, twoGisUrl: e.target.value })}
                  placeholder="https://2gis.ru/..."
                />
              </>
            )}

            <Input
              label="Телефон заведения (необязательно)"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+7 (999) 123-45-67"
            />

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                "Создаём..."
              ) : (
                <>
                  <QrCode className="w-5 h-5 mr-2" />
                  Создать заведение и QR-код
                </>
              )}
            </Button>
          </form>
        </Card>

        <div className="rounded-xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-600 space-y-2">
          <p className="font-medium text-gray-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-indigo-600" />
            Что получится
          </p>
          {isReviews ? (
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>QR сразу открывает оценки 1–5★ (не общий лендинг)</li>
              <li>Негативные оценки — жалоба вам на email (Telegram — в настройках)</li>
              <li>Меню, Wi‑Fi и визитку на странице заведения — в «Моя страница»</li>
            </ul>
          ) : (
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-indigo-500 shrink-0" />
                QR на страницу заведения со всеми блоками
              </li>
              <li className="flex items-center gap-2">
                <Star className="w-4 h-4 text-indigo-500 shrink-0" />
                Отзывы, меню, Wi‑Fi — включите нужное в «Моя страница»
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                Ссылки на Яндекс и 2GIS — когда подключите отзывы
              </li>
            </ul>
          )}
        </div>

        <p className="text-center text-sm text-gray-500">
          Уже активировали табличку?{" "}
          <Link href="/dashboard/activate" className="text-indigo-600 hover:text-indigo-800 font-medium">
            Ввести мастер-код
          </Link>
        </p>
      </div>
    </div>
  );
}
