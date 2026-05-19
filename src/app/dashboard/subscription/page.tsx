"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Sidebar from "@/components/dashboard/Sidebar";
import { Check, Crown, Loader2, Zap, MessageSquare, BarChart3, Palette } from "lucide-react";

export default function SubscriptionPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch("/api/subscription")
      .then((r) => r.json())
      .then((data) => {
        setSubscription(data.subscription || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe" }),
      });

      const data = await res.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.success) {
        setSubscription({
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false,
        });
      }
    } catch {
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Отменить подписку? Доступ к PRO-функциям сохранится до конца периода.")) return;
    try {
      await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (subscription) {
        setSubscription({ ...subscription, cancelAtPeriodEnd: true });
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  const isPro = subscription?.plan === "PRO" && subscription?.status === "ACTIVE";

  const proFeatures = [
    { icon: Zap, text: "Умная ротация площадок (Яндекс / 2GIS / Авито)" },
    { icon: MessageSquare, text: "Мгновенные уведомления о жалобах (SMS + Email)" },
    { icon: Palette, text: "White-label — свой логотип на странице" },
    { icon: Zap, text: "Промокоды за 5★ для удержания гостей" },
    { icon: Zap, text: "Интеграция с чаевыми для персонала" },
    { icon: BarChart3, text: "Расширенная аналитика и дашборд" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <h1 className="text-2xl font-bold text-gray-900">Подписка</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className={isPro ? "opacity-60" : "ring-2 ring-gray-200"}>
              <div className="space-y-4">
                <Badge variant="default">FREE</Badge>
                <p className="text-3xl font-bold">0 ₽</p>
                <p className="text-sm text-gray-500">/ навсегда</p>
                <hr />
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" /> 1 площадка для отзывов
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" /> Email-уведомления о жалобах
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" /> Водяной знак QrStars.ru
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" /> Базовый счётчик сканирований
                  </li>
                </ul>
              </div>
            </Card>

            <Card className={isPro ? "ring-2 ring-indigo-500" : "ring-2 ring-indigo-200"}>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="info">
                    <Crown className="w-3 h-3 mr-1" /> PRO
                  </Badge>
                </div>
                <p className="text-3xl font-bold">990 ₽</p>
                <p className="text-sm text-gray-500">/ месяц</p>
                <hr />
                <ul className="space-y-2">
                  {proFeatures.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <f.icon className="w-4 h-4 text-indigo-500" /> {f.text}
                    </li>
                  ))}
                </ul>
                {isPro ? (
                  <div className="space-y-2">
                    <Badge variant="success">Подписка активна</Badge>
                    {subscription?.currentPeriodEnd && (
                      <p className="text-xs text-gray-500">
                        Действует до{" "}
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString("ru-RU")}
                      </p>
                    )}
                    {subscription?.cancelAtPeriodEnd ? (
                      <p className="text-xs text-orange-600">
                        Подписка будет отменена в конце периода
                      </p>
                    ) : (
                      <Button variant="outline" size="sm" onClick={handleCancel}>
                        Отменить подписку
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button size="lg" className="w-full" onClick={handleSubscribe} disabled={subscribing}>
                    {subscribing ? "Перенаправляем..." : "Оформить PRO"}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
