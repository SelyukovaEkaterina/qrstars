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
            <h1 className="text-2xl font-bold text-gray-900">Готово! QR-код успешно создан</h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              {isReviews ? (
                <>
                  Ваш QR-код для заведения <strong className="text-gray-950 font-semibold">«{result.establishment.name}»</strong> настроен на сбор отзывов. 
                  Теперь при сканировании гости смогут поставить оценку: 5★ переведут их на Яндекс.Карты для публикации отзыва, а оценки 1–3★ отправятся в виде жалобы на вашу почту, не попадая в сеть.
                </>
              ) : (
                <>
                  QR-код ведет на мобильный сайт-визитку заведения <strong className="text-gray-950 font-semibold">«{result.establishment.name}»</strong>. 
                  Вы можете наполнить страницу (добавить меню, Wi-Fi, контакты) или настроить сценарии отзывов в разделе «Моя страница».
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
              Настроить дизайн и скачать QR-код
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => router.push("/dashboard/my-page")}
            >
              Оформить и наполнить сайт-визитку
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
                Перейти в личный кабинет
              </button>
            </p>
            <p className="text-center text-xs text-gray-400 max-w-sm mx-auto">
              Ошиблись со сценарием? Вы сможете легко переключить тип QR-кода, изменить ссылки или добавить новые разделы в любой момент из личного кабинета.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "intent") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex items-center justify-center px-4 py-10">
        <div className="max-w-xl w-full space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Первый запуск
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Что хотите настроить в первую очередь?</h1>
            <p className="text-gray-600 max-w-md mx-auto text-sm leading-relaxed">
              Выберите основной сценарий работы вашего QR-кода. Вы всегда сможете изменить настройки или объединить все функции позже в личном кабинете.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseIntent("reviews")}
              className="text-left rounded-xl border-2 border-gray-200 bg-white p-5 transition hover:border-indigo-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Star className="w-5 h-5" />
                </span>
                <span className="font-semibold text-gray-900">Умный сбор отзывов (QR-отзывик)</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Защита от негатива и рост рейтинга на картах. Гости ставят оценки: пятёрки ведут на Яндекс/2GIS, а плохие отзывы отправляются лично вам на почту, минуя публичные платформы.
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
                <span className="font-semibold text-gray-900">Сайт-визитка заведения</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Электронное меню, контакты, социальные сети, подключение к Wi-Fi и сбор отзывов — всё в одном месте по одному QR-коду на удобной мобильной мультистранице.
              </p>
            </button>
          </div>
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
            {isReviews ? "Настройка сбора отзывов" : "Настройка сайта-визитки"}
          </h1>
          <p className="text-gray-600 max-w-md mx-auto text-sm leading-relaxed">
            {isReviews
              ? "Заполните данные вашего заведения, чтобы автоматически перенаправлять гостей с хорошими оценками на Яндекс.Карты, а плохие получать напрямую."
              : "Введите название вашего заведения. Мы создадим для него персональную страницу и сгенерируем готовый к работе QR-код."}
          </p>
        </div>

        <div className="flex justify-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border text-gray-400">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
              1
            </span>
            Сценарий
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            Информация
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border text-gray-400">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
              3
            </span>
            Готовый QR
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
            Назад к выбору сценария
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
                placeholder="Например: Кафе «Аромат», Салон красоты «Престиж»…"
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
                  <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                    Гости с оценкой 5★ перейдут по этой ссылке, чтобы оставить отзыв на Яндекс.Картах.
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
              label="Номер телефона заведения (необязательно)"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Например: +7 (999) 123-45-67"
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("intent");
                  setError("");
                }}
                className="w-1/3"
              >
                <ChevronLeft className="w-4 h-4 mr-1 inline shrink-0" />
                Назад
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? (
                  "Создаём..."
                ) : (
                  <>
                    <QrCode className="w-5 h-5 mr-2" />
                    Создать QR-код
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        <div className="rounded-xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-600 space-y-2">
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-indigo-600" />
            Что вы получите в результате:
          </p>
          {isReviews ? (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 leading-relaxed">
              <li>Готовый QR-код, который при сканировании сразу открывает умную форму оценки 1–5★</li>
              <li>Автоматическую фильтрацию отзывов: 5★ перенаправляют на Яндекс, плохие оценки — на вашу почту</li>
              <li>Возможность в любой момент добавить на страницу меню, контакты или Wi-Fi в личном кабинете</li>
            </ul>
          ) : (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 leading-relaxed">
              <li>Персональную мобильную мультистраницу вашего заведения со всеми блоками</li>
              <li>Простой визуальный редактор: легко добавить меню, Wi‑Fi, контакты и социальные сети</li>
              <li>Уже встроенную форму сбора обратной связи и отзывов от ваших гостей</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
