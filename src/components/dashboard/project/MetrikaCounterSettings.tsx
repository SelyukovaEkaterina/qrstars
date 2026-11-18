"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Check, ChevronDown, Crown, ExternalLink } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { MICROSITE_HOST_SUFFIX } from "@/lib/microsite-host";
import { METRIKA_COUNTER_INPUT_ERROR, parseMetrikaCounterInput } from "@/lib/owner-metrika";
import { PLAN_PRICING } from "@/lib/plans";

interface MetrikaCounterSettingsProps {
  projectId: string;
  hasPaidFeatures: boolean;
  initialCounterId: string | null;
  /** Короткий адрес проекта — подсказываем его как адрес сайта в Метрике. */
  shortSlug?: string | null;
  /** «микросайт» или «визитка» — только для текстов. */
  kind?: "microsite" | "card";
}

/**
 * Своя Яндекс Метрика на страницах проекта (PRO / «Сеть»): номер счётчика и инструкция.
 * Счётчик ставится на `/q/{code}` всех QR проекта и на короткий адрес (`OwnerMetrika`).
 */
export default function MetrikaCounterSettings({
  projectId,
  hasPaidFeatures,
  initialCounterId,
  shortSlug = null,
  kind = "microsite",
}: MetrikaCounterSettingsProps) {
  const [value, setValue] = useState(initialCounterId ?? "");
  const [saved, setSaved] = useState(initialCounterId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [helpOpen, setHelpOpen] = useState(!initialCounterId);

  const pageWord = kind === "card" ? "визитки" : "микросайта";

  // Без PRO — промо. Счётчик, подключённый на PRO, остаётся виден: его можно только отключить.
  if (!hasPaidFeatures && !initialCounterId) {
    const price = PLAN_PRICING.PRO.halfYearRub.toLocaleString("ru-RU");
    return (
      <Card className="border-indigo-200 bg-indigo-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-indigo-900">
              <Crown className="h-4 w-4 text-amber-500" />
              Своя Яндекс Метрика
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Подключите свой счётчик и смотрите в Метрике посещаемость {pageWord}: сколько пришло со сканов QR, сколько по
              прямой ссылке, какие разделы открывают. PRO — от {price} ₽ за полгода.
            </p>
          </div>
          <Link
            href="/dashboard/subscription"
            data-upsell="metrika"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Подключить PRO
          </Link>
        </div>
      </Card>
    );
  }

  const save = async (next: string) => {
    setError("");
    setJustSaved(false);
    const parsed = parseMetrikaCounterInput(next);
    if (parsed === undefined) {
      setError(METRIKA_COUNTER_INPUT_ERROR);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/establishments/${projectId}/page`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrikaCounterId: parsed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Не удалось сохранить счётчик");
        return;
      }
      const stored: string | null = json.establishment?.metrikaCounterId ?? parsed;
      setSaved(stored);
      setValue(stored ?? "");
      setJustSaved(true);
      if (stored) setHelpOpen(false);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  const siteHost = shortSlug ? `${shortSlug}${MICROSITE_HOST_SUFFIX}` : null;
  const dirty = value.trim() !== (saved ?? "");

  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <BarChart3 className="h-4 w-4 text-indigo-600" />
        Своя Яндекс Метрика
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Счётчик будет на всех страницах проекта: по QR-кодам и по короткому адресу. Сканы и заходы по ссылке и так видны в
        разделе «Статистика», Метрика нужна для подробных отчётов.
      </p>

      {!hasPaidFeatures && saved && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Тариф PRO закончился, поэтому счётчик сейчас не работает. Он включится сам после продления.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
            setJustSaved(false);
          }}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
          placeholder="Номер счётчика, например 12345678"
          aria-label="Номер счётчика Яндекс Метрики"
          inputMode="text"
          disabled={!hasPaidFeatures}
        />
        {hasPaidFeatures && (
          <Button size="sm" onClick={() => void save(value)} disabled={saving || !dirty}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
        )}
        {saved && (
          <Button variant="outline" size="sm" onClick={() => void save("")} disabled={saving}>
            Отключить
          </Button>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : justSaved ? (
        <p className="mt-2 flex items-center gap-1 text-sm text-green-700">
          <Check className="h-4 w-4" />
          {saved ? `Счётчик ${saved} подключён. Первые данные в Метрике — через 5–10 минут.` : "Счётчик отключён."}
        </p>
      ) : saved && hasPaidFeatures ? (
        <p className="mt-2 text-sm text-gray-500">
          Подключён счётчик {saved}.{" "}
          <a
            href={`https://metrika.yandex.ru/dashboard?id=${saved}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-indigo-600 hover:underline"
          >
            Открыть отчёты <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        className="mt-3 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
        aria-expanded={helpOpen}
      >
        Как подключить
        <ChevronDown className={`h-4 w-4 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
      </button>
      {helpOpen && (
        <div className="mt-2 space-y-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Откройте{" "}
              <a
                href="https://metrika.yandex.ru/add"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:underline"
              >
                metrika.yandex.ru
              </a>{" "}
              и нажмите «Добавить счётчик».
            </li>
            <li>
              Имя — любое, например название проекта. В поле «Адрес сайта» укажите{" "}
              <span className="font-mono">{siteHost ?? "app.qrstars.ru"}</span>
              {siteHost ? (
                <>
                  , а в «Дополнительные адреса» — <span className="font-mono">app.qrstars.ru</span> (с него открываются
                  QR-коды)
                </>
              ) : (
                " (с него открываются QR-коды)"
              )}
              . Галочку «Принимать данные только с указанных адресов» не ставьте.
            </li>
            <li>Вебвизор не включайте: мы его не запускаем, потому что гости вводят телефоны и тексты обращений.</li>
            <li>
              Создайте счётчик. Номер — цифры рядом с названием счётчика (например, 12345678). Вставьте его в поле выше и
              нажмите «Сохранить». Можно вставить и код счётчика целиком — номер мы найдём сами.
            </li>
          </ol>
          <div>
            <p className="font-medium text-gray-900">Где смотреть</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>«Сводка» и «Посещаемость» — визиты, посетители, устройства, города.</li>
              <li>
                «Параметры визитов»: <b>Источник</b> — «QR-код» или «Прямая ссылка», <b>QR-код</b> — с какого именно кода
                пришли.
              </li>
              <li>
                «Популярное» — какие разделы открывают: адреса вида <span className="font-mono">…?s=menu</span>.
              </li>
            </ul>
            <p className="mt-2 text-gray-500">
              Ваши собственные открытия QR из кабинета в Метрику не попадают. Если тариф PRO закончится, счётчик перестанет
              загружаться и включится сам после продления.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
