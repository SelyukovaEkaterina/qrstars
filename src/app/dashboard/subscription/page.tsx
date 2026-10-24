"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import PlanBadge from "@/components/dashboard/PlanBadge";
import {
  Check,
  Crown,
  Loader2,
  Building2,
  Sparkles,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import {
  formatRub,
  formatPlanLabel,
  PLANS,
  CUSTOM_PLAN_HINT,
  calcSubscriptionAmount,
  type PlanId,
} from "@/lib/plans";
import { LEGAL_OFFER_URL } from "@/lib/legal-urls";

interface SubscriptionState {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface SubscriptionResponse {
  subscription: SubscriptionState | null;
  plan: PlanId;
  planLabel: string;
  hasPaidFeatures: boolean;
  establishmentCount: number;
  establishmentLimit: number | null;
  canAddEstablishment: boolean;
  renewalPriceChange?: {
    previousAmount: number;
    newAmount: number;
    chargeDate: string;
    planLabel: string;
    daysUntilCharge: number;
  } | null;
  platformTariffChange?: {
    effectiveAt: string;
    message: string | null;
    daysUntilEffective: number;
  } | null;
  introOffer?: {
    code: string;
    amountRub: number;
    listAmountRub: number;
    expiresAt: string;
    discountPercent: number;
  } | null;
}

interface HistoryItem {
  id: string;
  invId: number;
  kind: "INITIAL" | "RENEWAL";
  plan: string;
  billing: string;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED";
  paidAt: string | null;
  createdAt: string;
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [recurringConsent, setRecurringConsent] = useState(false);
  const [consentErrorPlan, setConsentErrorPlan] = useState<"PRO" | "NETWORK" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = () =>
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  const loadHistory = () =>
    fetch("/api/subscription/history")
      .then((r) => r.json())
      .then((json) => {
        setHistory(json.history || []);
        setHistoryLoading(false);
      })
      .catch(() => setHistoryLoading(false));

  // Авторизацию проверяет dashboard/layout.tsx, здесь только загрузка данных.
  useEffect(() => {
    load();
    loadHistory();
    const params = new URLSearchParams(window.location.search);
    const st = params.get("status");
    if (st === "success") setStatusMessage("Оплата прошла успешно. Подписка активируется в течение минуты.");
    if (st === "fail") setStatusMessage("Оплата не завершена. Попробуйте снова или выберите другой способ.");
  }, []);

  const handleSubscribe = async (plan: "PRO" | "NETWORK") => {
    if (!recurringConsent) {
      setConsentErrorPlan(plan);
      document
        .getElementById(`recurring-consent-${plan}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setConsentErrorPlan(null);
    setNotice(null);
    setSubscribing(plan);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", plan, billing: "yearly", recurringConsent: true }),
      });

      const json = await res.json();
      if (json.paymentRedirectUrl) {
        window.location.href = json.paymentRedirectUrl;
      } else if (json.paymentPost?.action && json.paymentPost?.fields) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = json.paymentPost.action;
        form.acceptCharset = "utf-8";
        for (const [name, value] of Object.entries(
          json.paymentPost.fields as Record<string, string>
        )) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      } else if (json.paymentUrl) {
        window.location.href = json.paymentUrl;
      } else if (json.success) {
        if (json.message) setNotice({ tone: "success", text: json.message });
        await load();
      } else {
        setNotice({ tone: "error", text: json.error || "Не удалось оформить подписку" });
      }
    } catch {
      setNotice({ tone: "error", text: "Не удалось оформить подписку. Проверьте интернет и попробуйте ещё раз." });
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (
      !confirm(
        "Отменить подписку? Доступ к платным функциям сохранится до конца оплаченного периода."
      )
    )
      return;
    setNotice(null);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setNotice({ tone: "error", text: json.error || "Не удалось отменить подписку. Попробуйте ещё раз." });
        return;
      }
      setNotice({
        tone: "success",
        text: "Автопродление отключено. Платные функции работают до конца оплаченного периода.",
      });
      await load();
    } catch {
      setNotice({ tone: "error", text: "Не удалось отменить подписку. Проверьте интернет и попробуйте ещё раз." });
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <main className="flex min-w-0 flex-1 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  const subscription = data.subscription;
  const currentPlan = data.plan;
  const isPaidActive =
    data.hasPaidFeatures && subscription?.status === "ACTIVE";
  const estCount = data.establishmentCount;
  const networkActive = currentPlan === "NETWORK" && isPaidActive;

  const introOffer = data.introOffer;
  const priceFor = (planId: "PRO" | "NETWORK") => {
    const p = PLANS[planId].pricing;
    if (planId === "PRO" && introOffer) {
      return {
        main: introOffer.amountRub,
        suffix: "первый год",
        note: `далее ${formatRub(introOffer.listAmountRub)}/год`,
        compareAt: introOffer.listAmountRub,
      };
    }
    return { main: p.yearlyRub, suffix: "/ год", note: p.yearlyNote, compareAt: undefined as number | undefined };
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Тариф и оплата</h1>
            <p className="text-gray-500 mt-1">
              Ядро продукта бесплатно навсегда. Платные тарифы — усиление, не разблокировка.
            </p>
          </div>

          <Card className="bg-gradient-to-r from-indigo-50 to-white border-indigo-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Ваш текущий тариф</p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                  <PlanBadge plan={currentPlan} />
                  {isPaidActive && <Badge variant="success">Активна</Badge>}
                  {subscription?.cancelAtPeriodEnd && (
                    <Badge variant="default">Отмена в конце периода</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Проектов: {estCount}
                  {data.establishmentLimit != null
                    ? ` / лимит ${data.establishmentLimit}`
                    : ""}
                </p>
                {subscription?.currentPeriodEnd && isPaidActive && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Действует до{" "}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString("ru-RU")}
                  </p>
                )}
              </div>
              {isPaidActive && !subscription?.cancelAtPeriodEnd && (
                <Button variant="outline" size="sm" className="min-h-10 self-start sm:self-auto" onClick={handleCancel}>
                  Отменить подписку
                </Button>
              )}
            </div>
          </Card>

          {statusMessage && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              {statusMessage}
            </div>
          )}

          {notice && (
            <div
              role={notice.tone === "error" ? "alert" : "status"}
              className={`rounded-lg border px-4 py-3 text-sm ${
                notice.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-green-200 bg-green-50 text-green-900"
              }`}
            >
              {notice.text}
            </div>
          )}

          {data.platformTariffChange && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">Изменение тарифов</p>
              <p className="mt-1">
                С{" "}
                {new Date(data.platformTariffChange.effectiveAt).toLocaleDateString(
                  "ru-RU",
                  { day: "numeric", month: "long", year: "numeric" }
                )}{" "}
                изменяется стоимость подписки.
                {data.platformTariffChange.message
                  ? ` ${data.platformTariffChange.message}`
                  : " Актуальные цены — на этой странице."}
              </p>
            </div>
          )}

          {data.renewalPriceChange && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">Изменение суммы списания</p>
              <p className="mt-1">
                {new Date(data.renewalPriceChange.chargeDate).toLocaleDateString(
                  "ru-RU",
                  { day: "numeric", month: "long", year: "numeric" }
                )}{" "}
                будет списано{" "}
                <strong>{formatRub(data.renewalPriceChange.newAmount)}</strong> вместо{" "}
                {formatRub(data.renewalPriceChange.previousAmount)} (тариф{" "}
                {data.renewalPriceChange.planLabel}). Отменить автопродление можно до этой
                даты.
              </p>
            </div>
          )}

          {introOffer && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
              <p className="font-medium">
                Персональная цена на первый год PRO: {formatRub(introOffer.amountRub)} вместо{" "}
                {formatRub(introOffer.listAmountRub)}
              </p>
              <p className="mt-1">
                Код {introOffer.code} действует до{" "}
                {new Date(introOffer.expiresAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  timeZone: "Europe/Moscow",
                })}
                . Со следующего года списывается обычная цена, сейчас это{" "}
                {formatRub(introOffer.listAmountRub)} в год.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PlanCard
              planId="FREE"
              currentPlan={currentPlan}
              isPaidActive={isPaidActive}
              price={{ main: 0, suffix: "", note: "навсегда" }}
              onSubscribe={() => {}}
              subscribing={null}
              disabled
            />
            <PlanCard
              planId="PRO"
              currentPlan={currentPlan}
              isPaidActive={isPaidActive}
              price={priceFor("PRO")}
              onSubscribe={() => handleSubscribe("PRO")}
              subscribing={subscribing}
              disabled={(currentPlan === "PRO" && isPaidActive) || networkActive}
              disabledReason={
                networkActive
                  ? "У вас активен тариф «Сеть» — в нём уже есть всё из PRO."
                  : undefined
              }
              consent={recurringConsent}
              onConsentChange={(v) => {
                setRecurringConsent(v);
                if (v) setConsentErrorPlan(null);
              }}
              consentError={consentErrorPlan === "PRO"}
              chargeNote={
                introOffer
                  ? `Спишем ${formatRub(introOffer.amountRub)} сейчас, затем ${formatRub(introOffer.listAmountRub)} раз в год.`
                  : `Спишем ${formatRub(calcSubscriptionAmount("PRO", "yearly", estCount))} сейчас и далее раз в год.`
              }
            />
            <PlanCard
              planId="NETWORK"
              currentPlan={currentPlan}
              isPaidActive={isPaidActive}
              price={priceFor("NETWORK")}
              onSubscribe={() => handleSubscribe("NETWORK")}
              subscribing={subscribing}
              disabled={networkActive}
              consent={recurringConsent}
              onConsentChange={(v) => {
                setRecurringConsent(v);
                if (v) setConsentErrorPlan(null);
              }}
              consentError={consentErrorPlan === "NETWORK"}
              chargeNote={`Спишем ${formatRub(calcSubscriptionAmount("NETWORK", "yearly", estCount))} сейчас и далее раз в год.`}
            />
          </div>

          <p className="text-xs text-gray-500 text-center">
            QR-кодов внутри проекта — без лимита на всех тарифах. Тарификация идёт по числу
            проектов, не по QR. PRO и «Сеть» оплачиваются только на год.
          </p>
          <p className="text-xs text-gray-500 text-center -mt-4">
            * {CUSTOM_PLAN_HINT}{" "}
            <Link href="/dashboard/support" className="text-indigo-600 hover:underline">
              Написать в поддержку
            </Link>
          </p>

          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-500" />
                История платежей
              </h2>
              <ul className="space-y-2 sm:hidden">
                {history.map((item) => {
                  const sc = paymentStatusConfig[item.status] || paymentStatusConfig.PENDING;
                  const StatusIcon = sc.icon;
                  return (
                    <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {formatPlanLabel(item.plan)} ·{" "}
                            {item.kind === "RENEWAL" ? "Продление" : "Подключение"}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {formatPaymentDate(item.paidAt ?? item.createdAt)} ·{" "}
                            {item.billing === "yearly" ? "1 год" : "1 месяц"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                          {formatRub(item.amount)}
                        </span>
                      </div>
                      <Badge variant={sc.variant} className="mt-2 flex w-fit items-center gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {sc.label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto rounded-xl border border-gray-200 sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Дата
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Тариф
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Тип
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Период
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Сумма
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => {
                      const sc =
                        paymentStatusConfig[item.status] || paymentStatusConfig.PENDING;
                      const StatusIcon = sc.icon;
                      const date = item.paidAt ?? item.createdAt;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50"
                        >
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-700">
                              {formatPaymentDate(date)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900">
                              {formatPlanLabel(item.plan)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-600">
                              {item.kind === "RENEWAL" ? "Продление" : "Подключение"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-600">
                              {item.billing === "yearly" ? "1 год" : "1 месяц"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-gray-900 tabular-nums">
                              {formatRub(item.amount)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={sc.variant} className="flex items-center gap-1 w-fit">
                              <StatusIcon className="w-3 h-3" />
                              {sc.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function formatPaymentDate(date: string): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const paymentStatusConfig: Record<
  string,
  { variant: "success" | "warning" | "danger"; label: string; icon: typeof CheckCircle }
> = {
  PAID: { variant: "success", label: "Оплачен", icon: CheckCircle },
  PENDING: { variant: "warning", label: "Ожидает", icon: Clock },
  FAILED: { variant: "danger", label: "Не прошёл", icon: XCircle },
};

function PlanCard({
  planId,
  currentPlan,
  isPaidActive,
  price,
  priceHint,
  onSubscribe,
  subscribing,
  disabled,
  disabledReason,
  consent,
  onConsentChange,
  consentError,
  chargeNote,
}: {
  planId: PlanId;
  currentPlan: PlanId;
  isPaidActive: boolean;
  price: { main: number; suffix: string; note: string; compareAt?: number };
  priceHint?: string;
  onSubscribe: () => void;
  subscribing: string | null;
  disabled: boolean;
  disabledReason?: string;
  consent?: boolean;
  onConsentChange?: (value: boolean) => void;
  consentError?: boolean;
  chargeNote?: string;
}) {
  const plan = PLANS[planId];
  const isCurrent = currentPlan === planId;
  const isPaidPlan = planId === "PRO" || planId === "NETWORK";

  return (
    <Card
      className={`flex flex-col h-full ${
        isCurrent ? "ring-2 ring-indigo-500" : plan.highlighted ? "ring-2 ring-indigo-200" : ""
      } ${isCurrent && planId === "FREE" ? "opacity-90" : ""}`}
    >
      <div className="space-y-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          {planId === "FREE" ? (
            <Badge variant="default">
              <Sparkles className="w-3 h-3 mr-1" /> FREE
            </Badge>
          ) : planId === "PRO" ? (
            <Badge variant="info">
              <Crown className="w-3 h-3 mr-1" /> PRO
            </Badge>
          ) : (
            <Badge variant="info">
              <Building2 className="w-3 h-3 mr-1" /> Сеть
            </Badge>
          )}
          {isCurrent && (
            <span className="text-xs font-medium text-indigo-600">Ваш тариф</span>
          )}
        </div>

        <p className="text-sm text-gray-500">{plan.tagline}</p>

        <div>
          {price.compareAt != null && price.compareAt !== price.main && (
            <p className="text-sm text-gray-400 line-through">{formatRub(price.compareAt)}</p>
          )}
          <p className="text-3xl font-bold text-gray-900">
            {price.main === 0 ? "0 ₽" : formatRub(price.main)}
          </p>
          {price.suffix && (
            <p className="text-sm text-gray-500">{price.suffix}</p>
          )}
          {price.note && (
            <p className="text-xs text-green-600 mt-1">{price.note}</p>
          )}
          {priceHint && (
            <p className="text-xs text-gray-500 mt-1">{priceHint}</p>
          )}
        </div>

        <p className="text-xs text-gray-500">{plan.establishmentLimitNote}</p>

        <hr />

        <ul className="space-y-2 flex-1">
          {plan.features.map((text) => (
            <li key={text} className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {isPaidPlan && (
          <div className="pt-2">
            {isCurrent && isPaidActive ? (
              <Badge variant="success" className="w-full justify-center py-2">
                Подписка активна
              </Badge>
            ) : (
              <div className="space-y-3">
                {disabledReason ? (
                  <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    {disabledReason}
                  </p>
                ) : (
                  <div
                    id={`recurring-consent-${planId}`}
                    className={`rounded-lg border p-3 transition-colors ${
                      consentError ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={consent ?? false}
                        onChange={(e) => onConsentChange?.(e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs leading-relaxed text-gray-700">
                        Согласен на автоматические списания по{" "}
                        <a
                          href={LEGAL_OFFER_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          условиям оферты
                        </a>
                        . {chargeNote} Следующее списание — в дату окончания периода (около 06:00
                        МСК), отменить можно в один клик на этой странице.
                      </span>
                    </label>
                    {consentError && (
                      <p role="alert" className="mt-2 pl-8 text-xs font-medium text-amber-800">
                        Отметьте согласие, чтобы перейти к оплате
                      </p>
                    )}
                  </div>
                )}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={onSubscribe}
                  disabled={disabled || subscribing !== null}
                >
                  {subscribing === planId
                    ? "Перенаправляем..."
                    : planId === "PRO"
                      ? price.compareAt
                        ? `Оформить PRO за ${formatRub(price.main)}`
                        : "Оформить PRO"
                      : "Оформить «Сеть»"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
