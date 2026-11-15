"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ReferralShareButtons } from "@/components/dashboard/ReferralInviteCard";
import { CalendarPlus, Gift, Loader2, UserPlus, Users, CreditCard } from "lucide-react";

interface ReferralData {
  referralCode: string;
  referralLink: string;
  bonusDays: number;
  stats: {
    totalReferrals: number;
    paidReferrals: number;
    bonusDaysEarned: number;
  };
  referredUsers: {
    emailMasked: string;
    createdAt: string;
    paid: boolean;
    rewardedAt: string | null;
    bonusDays: number;
  }[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU");
}

export default function ReferralPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralData | null>(null);

  // Авторизацию проверяет dashboard/layout.tsx.
  useEffect(() => {
    fetch("/api/partner")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <main className="flex min-w-0 flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </main>
      </div>
    );
  }

  if (!data) return null;

  const { stats, bonusDays } = data;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Приведи друга</h1>
            <p className="mt-1 text-gray-500">
              Месяц PRO вам и месяц PRO другу — за каждого, кто подключит платный тариф
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-5 text-white sm:p-8">
            <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/10" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                <span className="text-sm font-medium text-indigo-100">Ваша ссылка для приглашения</span>
              </div>
              <ReferralShareButtons
                link={data.referralLink}
                bonusDays={bonusDays}
                place="referral_page"
                tone="dark"
              />
              <p className="text-xs text-indigo-100">
                Отправьте коллегам, знакомым владельцам кафе, салонов, мастерам — всем, кому нужны
                отзывы, меню или визитка по QR.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-2.5">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
                  <p className="text-xs text-gray-500">Зарегистрировались</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.paidReferrals}</p>
                  <p className="text-xs text-gray-500">Подключили PRO</p>
                </div>
              </div>
            </Card>
            <Card className="ring-2 ring-emerald-200">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5">
                  <CalendarPlus className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{stats.bonusDaysEarned} дн.</p>
                  <p className="text-xs text-gray-500">PRO получено в подарок</p>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="mb-5 text-lg font-semibold text-gray-900">Как это работает</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                {
                  n: 1,
                  title: "Поделитесь ссылкой",
                  text: "Друг регистрируется по ней — бесплатно, карта не нужна.",
                },
                {
                  n: 2,
                  title: "Друг подключает PRO",
                  text: `К оплаченному периоду он получает ещё ${bonusDays} дней PRO.`,
                },
                {
                  n: 3,
                  title: `Вам — ${bonusDays} дней PRO`,
                  text: "Если PRO уже есть — продлим его, следующее списание сдвинется. Если нет — включим PRO на месяц без списаний.",
                },
              ].map((s) => (
                <div key={s.n}>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-lg font-bold text-indigo-600">
                    {s.n}
                  </div>
                  <h3 className="mb-1 font-semibold text-gray-900">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.text}</p>
                </div>
              ))}
            </div>
            <ul className="mt-6 space-y-1.5 border-t border-gray-100 pt-4 text-xs text-gray-500">
              <li>• Бонус начисляется один раз за каждого друга — при его первой оплате PRO или «Сети».</li>
              <li>• Количество друзей не ограничено: месяцы складываются.</li>
              <li>• Друг должен зарегистрироваться по вашей ссылке, привязку позже сделать нельзя.</li>
              <li>
                • Подарочный PRO не продлевается сам и ничего не списывает. Оплатите PRO в любой момент —{" "}
                оставшиеся подарочные дни добавятся к оплаченному периоду.{" "}
                <Link href="/dashboard/subscription" className="text-indigo-600 hover:underline">
                  Тариф и оплата
                </Link>
              </li>
            </ul>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Приглашённые ({stats.totalReferrals})
              </h2>
            </div>
            {data.referredUsers.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-gray-500">Пока никого</p>
                <p className="mt-1 text-sm text-gray-400">
                  Поделитесь ссылкой — здесь появятся те, кто зарегистрировался
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.referredUsers.map((u, i) => (
                  <div key={`${u.createdAt}-${i}`} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{u.emailMasked}</p>
                      <p className="text-xs text-gray-400">Регистрация {formatDate(u.createdAt)}</p>
                    </div>
                    {u.paid ? (
                      <Badge variant="success">+{u.bonusDays} дн. PRO вам</Badge>
                    ) : (
                      <Badge variant="default">Ещё не оплатил</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
