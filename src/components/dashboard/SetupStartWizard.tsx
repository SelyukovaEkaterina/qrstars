"use client";

import { useState, type ReactNode } from "react";
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
  Check,
  ExternalLink,
  Download,
  ArrowRight,
  Sparkles,
  Star,
  LayoutGrid,
  ChevronLeft,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

export type SetupIntent = "reviews" | "landing" | "redirect";

const INTENT_OPTIONS: {
  id: SetupIntent;
  title: string;
  tagline: string;
  icon: LucideIcon;
  accent: string;
  iconWrap: string;
  features: string[];
  popular?: boolean;
}[] = [
  {
    id: "reviews",
    title: "Умный сбор отзывов",
    tagline: "Защита репутации на картах",
    icon: Star,
    accent: "hover:border-amber-300 hover:shadow-amber-100/80 group-hover:ring-amber-200",
    iconWrap: "bg-gradient-to-br from-amber-100 to-orange-50 text-amber-700 ring-amber-200/60",
    features: [
      "Гость ставит оценку 1–5★ сразу после скана",
      "4–5★ — переход на Яндекс.Карты для отзыва",
      "1–3★ — жалоба вам на почту, не в открытый доступ",
      "На PRO — свои сценарии и площадки (2GIS, Flamp)",
      "Позже можно добавить меню и визитку к тому же QR",
    ],
  },
  {
    id: "landing",
    title: "Сайт-визитка заведения",
    tagline: "Всё заведение в одном QR",
    icon: LayoutGrid,
    accent: "hover:border-indigo-400 hover:shadow-indigo-100/80 group-hover:ring-indigo-300",
    iconWrap: "bg-gradient-to-br from-indigo-100 to-violet-50 text-indigo-700 ring-indigo-200/60",
    popular: true,
    features: [
      "Мобильная страница с брендингом заведения",
      "Меню, контакты, соцсети и Wi‑Fi в одном месте",
      "Сбор отзывов можно включить в том же QR",
      "Редактор блоков без программиста",
      "Отдельные QR на разделы — когда понадобится",
    ],
  },
  {
    id: "redirect",
    title: "Редирект на мой сайт",
    tagline: "Одна ссылка — без лишних страниц",
    icon: ArrowUpRight,
    accent: "hover:border-emerald-300 hover:shadow-emerald-100/80 group-hover:ring-emerald-200",
    iconWrap: "bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 ring-emerald-200/60",
    features: [
      "Мгновенный переход по вашему URL",
      "Смена ссылки в кабинете — без перепечатки QR",
      "Сайт, Telegram, соцсеть или приложение",
      "Конструктор дизайна: цвета, логотип, форма",
      "Позже можно переключить на визитку или отзывы",
    ],
  },
];

function SetupWizardShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 flex items-center justify-center px-4 py-10 sm:py-14">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-x-1/3 rounded-full bg-violet-200/30 blur-3xl"
        aria-hidden
      />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

function IntentOptionCard({
  option,
  onSelect,
}: {
  option: (typeof INTENT_OPTIONS)[number];
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white/90 p-6 text-left shadow-sm backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${option.accent}`}
    >
      {option.popular && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
          Популярный
        </span>
      )}
      <div className="mb-4 flex items-start gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ${option.iconWrap}`}
        >
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-base font-bold text-slate-900 leading-snug">{option.title}</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{option.tagline}</p>
        </div>
      </div>
      <ul className="mb-5 flex-1 space-y-2">
        {option.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" strokeWidth={2.5} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition group-hover:gap-2">
        Выбрать
        <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

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
    phone: "",
    redirectUrl: "",
  });

  const [result, setResult] = useState<{
    establishment?: { id: string; name: string };
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
    const isRedirect = result.intent === "redirect";
    return (
      <SetupWizardShell>
        <div className="max-w-lg mx-auto w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Готово! QR-код успешно создан</h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              {isReviews ? (
                <>
                  Ваш QR-код для заведения <strong className="text-gray-950 font-semibold">«{result.establishment?.name}»</strong> настроен на сбор отзывов. 
                  Теперь при сканировании гости смогут поставить оценку: 4–5★ переведут их на Яндекс.Карты для публикации отзыва, а оценки 1–3★ отправятся в виде жалобы на вашу почту, не попадая в сеть.
                </>
              ) : isRedirect ? (
                <>
                  Ваш динамический QR-код готов! При сканировании гости будут автоматически перенаправляться по указанной ссылке.
                  Следующий шаг — оформить дизайн QR-кода в визуальном конструкторе и скачать PNG для печати.
                </>
              ) : (
                <>
                  QR-код ведет на мобильный сайт-визитку заведения <strong className="text-gray-950 font-semibold">«{result.establishment?.name}»</strong>. 
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
                className="max-w-56 max-h-64 w-auto h-auto mx-auto rounded-xl border border-gray-100 shadow-sm object-contain"
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
            {isRedirect ? (
              <Button
                size="lg"
                className="w-full"
                onClick={() =>
                  router.push(`/dashboard/templates?tab=qr&bindQr=${result.qrcode.id}`)
                }
              >
                Оформить дизайн QR-кода
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full"
                onClick={() => router.push("/dashboard/my-page")}
              >
                Оформить и наполнить сайт-визитку
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {isRedirect && (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/dashboard/qrcodes/${result.qrcode.id}?welcome=1`)}
              >
                Настройки редиректа и маршрутизация
              </Button>
            )}
            {!isRedirect && (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/dashboard/qrcodes/${result.qrcode.id}?welcome=1`)}
              >
                Настроить дизайн и скачать QR-код
              </Button>
            )}
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
      </SetupWizardShell>
    );
  }

  if (step === "intent") {
    return (
      <SetupWizardShell>
        <div className="mx-auto max-w-5xl w-full space-y-10">
          <div className="text-center space-y-4 px-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/80 px-4 py-1.5 text-sm font-medium text-indigo-800 shadow-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Первый запуск
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Что хотите настроить в первую очередь?
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Выберите стартовый сценарий — заведение, QR-код и личный кабинет создадутся автоматически.
              Сценарий и функции можно изменить в любой момент.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3 md:items-stretch">
            {INTENT_OPTIONS.map((option) => (
              <IntentOptionCard
                key={option.id}
                option={option}
                onSelect={() => chooseIntent(option.id)}
              />
            ))}
          </div>

          <p className="text-center text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
            Не уверены? Начните с сайта-визитки — в него проще всего добавить отзывы и редирект позже.
          </p>
        </div>
      </SetupWizardShell>
    );
  }

  const isReviews = intent === "reviews";
  const isRedirect = intent === "redirect";

  return (
    <SetupWizardShell>
      <div className="max-w-lg mx-auto w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Первый запуск
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isReviews ? "Настройка сбора отзывов" : isRedirect ? "Настройка редиректа" : "Настройка сайта-визитки"}
          </h1>
          <p className="text-gray-600 max-w-md mx-auto text-sm leading-relaxed">
            {isReviews
              ? "Заполните данные вашего заведения, чтобы автоматически перенаправлять гостей с хорошими оценками на Яндекс.Карты, а плохие получать напрямую."
              : isRedirect
                ? "Укажите ссылку, на которую будут перенаправляться гости при сканировании QR-кода. Вы сможете изменить её в любой момент."
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

            {!isRedirect && (
              <div>
                <Input
                  label="Название заведения *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Например: Кафе «Аромат», Салон красоты «Престиж»…"
                  required
                />
              </div>
            )}

            {isRedirect && (
              <div>
                <Input
                  label="Ссылка для перенаправления *"
                  type="url"
                  value={form.redirectUrl}
                  onChange={(e) => setForm({ ...form, redirectUrl: e.target.value })}
                  placeholder="https://example.com"
                  required
                />
                <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1 leading-relaxed">
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
                  Гости будут автоматически перенаправлены по этой ссылке при сканировании QR-кода.
                </p>
              </div>
            )}

            {isReviews && (
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
                  Гости с оценкой 4–5★ перейдут по этой ссылке, чтобы оставить отзыв на Яндекс.Картах.
                </p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Остальные площадки вы можете указать в разделе{" "}
                  <Link href="/dashboard/my-page" className="text-indigo-600 hover:text-indigo-800 font-medium">
                    «Моя страница»
                  </Link>
                  , блок «Сбор отзывов».
                </p>
              </div>
            )}

            {intent === "landing" && (
              <>
                <Input
                  label="Номер телефона заведения (необязательно)"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Например: +7 (999) 123-45-67"
                />
                <div>
                  <Input
                    label="Ссылка на Яндекс.Карты (необязательно)"
                    type="url"
                    value={form.yandexMapsUrl}
                    onChange={(e) => setForm({ ...form, yandexMapsUrl: e.target.value })}
                    placeholder="https://yandex.ru/maps/org/..."
                  />
                  <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                    Если указать ссылку, на странице сразу включится сбор отзывов: гости с оценкой 4–5★ перейдут на Яндекс.Карты.
                  </p>
                </div>
              </>
            )}

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
            {!isReviews && !isRedirect && (
              <p className="text-xs text-gray-500 text-center leading-relaxed pt-1">
                Всё можно изменить позже: добавить меню, Wi‑Fi, другие площадки для отзывов или переключить тип QR-кода в личном кабинете.
              </p>
            )}
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
              <li>Автоматическую фильтрацию отзывов: 4–5★ перенаправляют на Яндекс, плохие оценки — на вашу почту</li>
              <li>Возможность в любой момент добавить на страницу меню, контакты или Wi-Fi в личном кабинете</li>
            </ul>
          ) : isRedirect ? (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 leading-relaxed">
              <li>Готовый динамический QR-код, который мгновенно перенаправляет гостей по вашему URL</li>
              <li>Возможность менять ссылку перенаправления в личном кабинете — без перепечатки QR</li>
              <li>Полноценный редактор дизайна QR-кода с кастомными цветами, логотипом и формами</li>
            </ul>
          ) : (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-600 leading-relaxed">
              <li>Персональную мобильную мультистраницу вашего заведения со всеми блоками</li>
              <li>Простой визуальный редактор: легко добавить меню, Wi‑Fi, контакты и социальные сети</li>
              <li>
                Сбор отзывов — сразу, если укажете Яндекс.Карты; иначе включите позже в разделе «Моя страница»
              </li>
            </ul>
          )}
        </div>
      </div>
    </SetupWizardShell>
  );
}
