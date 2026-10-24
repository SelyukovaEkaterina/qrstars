import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, Network } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { sessionUserId } from "@/lib/session-user";
import { effectivePlan, findActiveSubscription } from "@/lib/subscription-utils";
import { PLANS, PLAN_PRICING, isNetworkPlan } from "@/lib/plans";
import EnhancedAnalytics from "@/components/dashboard/EnhancedAnalytics";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Сводка по сети — QrStars",
};

export default async function NetworkDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = sessionUserId(session);
  if (!userId) redirect("/login?session=expired");

  const plan = effectivePlan(await findActiveSubscription(userId));
  const network = PLANS.NETWORK;
  const price = PLAN_PRICING.NETWORK;

  return (
    <div className="flex bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Сводка по сети</h1>
            <p className="text-gray-500 mt-1">
              Сканирования, оценки и динамика по всем проектам в одном месте
            </p>
          </div>

          {isNetworkPlan(plan) ? (
            <EnhancedAnalytics title={null} />
          ) : (
            <Card className="border-indigo-100" id="network-upsell">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                    <Network className="h-4 w-4" />
                    Тариф «{network.name}»
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Сводный дашборд — для нескольких проектов
                  </h2>
                  <p className="text-sm text-gray-600">{network.tagline}. Все проекты в одной сводке:
                    рейтинг, сканирования и выгрузка CSV.</p>
                  <ul className="space-y-2">
                    {network.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="shrink-0 rounded-xl bg-gray-50 p-5 text-center md:w-64">
                  <p className="text-3xl font-bold text-gray-900">
                    {price.yearlyRub.toLocaleString("ru-RU")} ₽
                    <span className="text-base font-medium text-gray-500">/год</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-500">{price.yearlyNote}</p>
                  <Link
                    href="/dashboard/subscription"
                    className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Подключить «{network.name}»
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
