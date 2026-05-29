"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Sidebar from "@/components/dashboard/Sidebar";
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
  PLANS,
  calcNetworkMonthlyPrice,
  type PlanId,
  type BillingPeriod,
} from "@/lib/plans";

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
}

interface HistoryItem {
  id: string;
  plan: string;
  status: string;
  yookassaPaymentId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export default function SubscriptionPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

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

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;
    load();
    loadHistory();
  }, [status, router]);

  const handleSubscribe = async (plan: "PRO" | "NETWORK") => {
    setSubscribing(plan);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", plan, billing }),
      });

      const json = await res.json();
      if (json.paymentUrl) {
        window.location.href = json.paymentUrl;
      } else if (json.success) {
        await load();
      } else if (json.error) {
        alert(json.error);
      }
    } catch {
      alert("Не удалось оформить подписку");
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
    try {
      await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      await load();
    } catch {}
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
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
  const networkMonthly = calcNetworkMonthlyPrice(Math.max(estCount, 2));

  const priceFor = (planId: "PRO" | "NETWORK") => {
    const p = PLANS[planId].pricing;
    if (billing === "yearly") {
      return { main: p.yearlyRub, suffix: "/ год", note: p.yearlyNote };
    }
    const monthly =
      planId === "NETWORK" ? networkMonthly : p.monthlyRub;
    return { main: monthly, suffix: "/ мес", note: "" };
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Тарифы</h1>
            <p className="text-gray-500 mt-1">
              Ядро продукта бесплатно навсегда. Платные тарифы — усиление, не разблокировка.
            </p>
          </div>

          <Card className="bg-gradient-to-r from-indigo-50 to-white border-indigo-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Ваш текущий тариф</p>
                <div className="flex items-center gap-3 mt-1">
                  <PlanBadge plan={currentPlan} />
                  {isPaidActive && (
                    <Badge variant="success">Активна</Badge>
                  )}
                  {subscription?.cancelAtPeriodEnd && (
                    <Badge variant="default">Отмена в конце периода</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Заведений: {estCount}
                  {data.establishmentLimit != null
                    ? ` / лимит ${data.establishmentLimit}`
                    : " · тарификация по точкам"}
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
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Отменить подписку
                </Button>
              )}
            </div>
          </Card>

          <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billing === "monthly"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Помесячно
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billing === "yearly"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Годовая оплата
              <span className="ml-1.5 text-xs text-green-600 font-normal">
                2 мес. в подарок
              </span>
            </button>
          </div>

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
              disabled={currentPlan === "PRO" && isPaidActive}
            />
            <PlanCard
              planId="NETWORK"
              currentPlan={currentPlan}
              isPaidActive={isPaidActive}
              price={priceFor("NETWORK")}
              priceHint={
                billing === "monthly" && estCount > 2
                  ? `При ${estCount} заведениях: ${formatRub(networkMonthly)}/мес`
                  : billing === "monthly"
                    ? "База: 2 заведения, +350 ₽/мес за каждую доп. точку"
                    : undefined
              }
              onSubscribe={() => handleSubscribe("NETWORK")}
              subscribing={subscribing}
              disabled={currentPlan === "NETWORK" && isPaidActive}
            />
          </div>

          <p className="text-xs text-gray-500 text-center">
            QR-кодов внутри заведения — без лимита на всех тарифах. Тарификация идёт по числу
            заведений, не по QR.
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
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Тариф
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Статус
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Период
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                        Дата
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => {
                      const sc = historyStatusConfig[item.status] || historyStatusConfig.ACTIVE;
                      const StatusIcon = sc.icon;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50"
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900">
                              {item.plan === "PRO"
                                ? "PRO"
                                : item.plan === "NETWORK"
                                  ? "Сеть"
                                  : "FREE"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={sc.variant} className="flex items-center gap-1 w-fit">
                              <StatusIcon className="w-3 h-3" />
                              {sc.label}
                            </Badge>
                            {item.cancelAtPeriodEnd && item.status === "ACTIVE" && (
                              <p className="text-[11px] text-orange-500 mt-1">
                                Отменена в конце периода
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.currentPeriodStart && item.currentPeriodEnd ? (
                              <div>
                                <p className="text-xs text-gray-700">
                                  {new Date(item.currentPeriodStart).toLocaleDateString("ru-RU")}
                                </p>
                                <p className="text-[10px] text-gray-400">—</p>
                                <p className="text-xs text-gray-700">
                                  {new Date(item.currentPeriodEnd).toLocaleDateString("ru-RU")}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500">
                              {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                            </span>
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

const historyStatusConfig: Record<string, { variant: "success" | "warning" | "danger"; label: string; icon: typeof CheckCircle }> = {
  ACTIVE: { variant: "success", label: "Активна", icon: CheckCircle },
  PAST_DUE: { variant: "warning", label: "Просрочена", icon: Clock },
  CANCELED: { variant: "danger", label: "Отменена", icon: XCircle },
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
}: {
  planId: PlanId;
  currentPlan: PlanId;
  isPaidActive: boolean;
  price: { main: number; suffix: string; note: string };
  priceHint?: string;
  onSubscribe: () => void;
  subscribing: string | null;
  disabled: boolean;
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
              <Button
                size="lg"
                className="w-full"
                onClick={onSubscribe}
                disabled={disabled || subscribing !== null}
              >
                {subscribing === planId
                  ? "Перенаправляем..."
                  : planId === "PRO"
                    ? "Оформить PRO"
                    : "Оформить «Сеть»"}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
