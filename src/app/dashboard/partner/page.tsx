"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Sidebar from "@/components/dashboard/Sidebar";
import {
  Users,
  Wallet,
  TrendingUp,
  Clock,
  Copy,
  Check,
  Loader2,
  Gift,
  Shield,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Send,
  AlertCircle,
  UserPlus,
  HandCoins,
} from "lucide-react";

interface PartnerData {
  referralCode: string;
  referralLink: string;
  stats: {
    totalReferrals: number;
    totalEarned: number;
    availableBalance: number;
    pendingBalance: number;
    withdrawnTotal: number;
  };
  referredUsers: {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
    subscriptions: { plan: string; status: string }[];
  }[];
  earnings: {
    id: string;
    amount: number;
    paymentAmount: number;
    status: string;
    availableAt: string;
    description: string | null;
    referralUserId: string;
    createdAt: string;
  }[];
  withdrawals: {
    id: string;
    amount: number;
    status: string;
    recepientName: string;
    recepientType: string;
    createdAt: string;
    adminComment: string | null;
  }[];
}

function formatMoney(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU");
}

export default function PartnerPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PartnerData | null>(null);
  const [copied, setCopied] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    howItWorks: false,
    referredUsers: false,
    earnings: false,
    withdrawals: false,
  });

  const [form, setForm] = useState({
    amount: 10000,
    recepientType: "IP",
    recepientName: "",
    recepientInn: "",
    bankName: "",
    bankBik: "",
    bankAccount: "",
    corrAccount: "",
    comment: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch("/api/partner")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  const copyLink = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/partner/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Ошибка");
        return;
      }

      setSuccess("Заявка на вывод отправлена! Мы свяжемся с вами.");
      setShowWithdrawForm(false);
      setForm({
        amount: 10000,
        recepientType: "IP",
        recepientName: "",
        recepientInn: "",
        bankName: "",
        bankBik: "",
        bankAccount: "",
        corrAccount: "",
        comment: "",
      });

      const refresh = await fetch("/api/partner");
      setData(await refresh.json());
    } catch {
      setError("Произошла ошибка");
    } finally {
      setSubmitting(false);
    }
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

  if (!data) return null;

  const { stats } = data;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Партнёрская программа</h1>
            <p className="text-gray-500 mt-1">Приглашайте пользователей и получайте 15% от их платежей</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <HandCoins className="w-5 h-5" />
                <span className="text-indigo-100 text-sm font-medium">Ваша партнёрская ссылка</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3.5 font-mono text-sm truncate border border-white/20">
                  {data.referralLink}
                </div>
                <button
                  onClick={copyLink}
                  className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 shrink-0 px-5 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50"
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Скопировано!" : "Копировать"}
                </button>
              </div>
              <p className="text-indigo-200 text-xs mt-3">
                Код: <span className="font-mono font-bold text-white">{data.referralCode}</span>
                {" "}&middot; Поделитесь ссылкой с потенциальными клиентами QrStars
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
                  <p className="text-xs text-gray-500">Рефералов</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-50 rounded-xl">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalEarned > 0 ? formatMoney(stats.totalEarned) : "0 ₽"}</p>
                  <p className="text-xs text-gray-500">Всего заработано</p>
                </div>
              </div>
            </Card>
            <Card className="ring-2 ring-green-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{formatMoney(stats.availableBalance)}</p>
                  <p className="text-xs text-gray-500">Доступно к выводу</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{formatMoney(stats.pendingBalance)}</p>
                  <p className="text-xs text-gray-500">В ожидании (30 дней)</p>
                </div>
              </div>
            </Card>
          </div>

          {stats.availableBalance >= 10000 && (
            <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <Send className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Доступно для вывода: {formatMoney(stats.availableBalance)}</p>
                    <p className="text-sm text-gray-600">Минимальная сумма — 10 000 ₽. Выплата на расчётный счёт ИП/ООО.</p>
                  </div>
                </div>
                <Button onClick={() => setShowWithdrawForm(!showWithdrawForm)}>
                  Запросить вывод
                </Button>
              </div>
            </Card>
          )}

          {stats.availableBalance < 10000 && stats.totalEarned > 0 && (
            <Card className="bg-gray-50 border-gray-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-gray-400" />
                <p className="text-sm text-gray-500">
                  Для вывода средств необходимо накопить минимум 10 000 ₽. Сейчас доступно: {formatMoney(stats.availableBalance)}
                </p>
              </div>
            </Card>
          )}

          {showWithdrawForm && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Заявка на вывод средств</h3>
              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
              )}
              {success && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{success}</div>
              )}
              <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    id="wd-amount"
                    label="Сумма вывода (₽)"
                    type="number"
                    min={10000}
                    max={stats.availableBalance}
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                  />
                  <div className="space-y-1">
                    <label htmlFor="wd-type" className="block text-sm font-medium text-gray-700">
                      Тип получателя
                    </label>
                    <select
                      id="wd-type"
                      value={form.recepientType}
                      onChange={(e) => setForm({ ...form, recepientType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="IP">ИП</option>
                      <option value="OOO">ООО</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    id="wd-name"
                    label={form.recepientType === "IP" ? "ФИО ИП" : "Название ООО"}
                    required
                    value={form.recepientName}
                    onChange={(e) => setForm({ ...form, recepientName: e.target.value })}
                    placeholder={form.recepientType === "IP" ? "Иванов Иван Иванович" : "ООО «Ромашка»"}
                  />
                  <Input
                    id="wd-inn"
                    label="ИНН"
                    required
                    value={form.recepientInn}
                    onChange={(e) => setForm({ ...form, recepientInn: e.target.value })}
                    placeholder="7712345678"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    id="wd-bank"
                    label="Название банка"
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder="ПАО «Сбербанк»"
                  />
                  <Input
                    id="wd-bik"
                    label="БИК"
                    value={form.bankBik}
                    onChange={(e) => setForm({ ...form, bankBik: e.target.value })}
                    placeholder="044525225"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    id="wd-account"
                    label="Расчётный счёт"
                    value={form.bankAccount}
                    onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                    placeholder="40702810123450001234"
                  />
                  <Input
                    id="wd-corr"
                    label="Корреспондентский счёт"
                    value={form.corrAccount}
                    onChange={(e) => setForm({ ...form, corrAccount: e.target.value })}
                    placeholder="30101810400000000225"
                  />
                </div>
                <Input
                  id="wd-comment"
                  label="Комментарий (необязательно)"
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  placeholder="Дополнительная информация"
                />
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Отправляем..." : "Отправить заявку"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowWithdrawForm(false)}>
                    Отмена
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card className="bg-gradient-to-br from-slate-50 to-gray-50">
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setExpandedSections((s) => ({ ...s, howItWorks: !s.howItWorks }))}
            >
              <div className="flex items-center gap-3">
                <Gift className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Как это работает</h3>
              </div>
              {expandedSections.howItWorks ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {expandedSections.howItWorks && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-indigo-600">1</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Поделитесь ссылкой</h4>
                    <p className="text-sm text-gray-500">Отправьте партнёрскую ссылку коллегам, друзьям или опубликуйте в соцсетях</p>
                  </div>
                  <div className="text-center">
                    <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-purple-600">2</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Пользователь регистрируется</h4>
                    <p className="text-sm text-gray-500">По вашей ссылке пользователь создаёт аккаунт и привязывается к вам</p>
                  </div>
                  <div className="text-center">
                    <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-pink-600">3</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Получайте 15%</h4>
                    <p className="text-sm text-gray-500">От каждого платежа реферала вы получаете 15% комиссии. Средства доступны через 30 дней</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Вывод на ИП/ООО</p>
                      <p className="text-xs text-gray-500">Средства выводятся на расчётный счёт ИП или ООО. Минимальная сумма — 10 000 ₽.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Удержание 30 дней</p>
                      <p className="text-xs text-gray-500">Комиссия становится доступной для вывода через 30 дней после оплаты клиентом.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Пожизненная привязка</p>
                      <p className="text-xs text-gray-500">Пользователь привязывается навсегда — вы получаете 15% от каждого его платежа.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Пример заработка</p>
                      <p className="text-xs text-gray-500">10 рефералов × 690 ₽/мес × 15% = 1 035 ₽/мес пассивного дохода.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setExpandedSections((s) => ({ ...s, referredUsers: !s.referredUsers }))}
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Ваши рефералы ({stats.totalReferrals})
                </h3>
              </div>
              {expandedSections.referredUsers ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {expandedSections.referredUsers && (
              <div className="mt-4">
                {data.referredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Пока нет рефералов</p>
                    <p className="text-sm text-gray-400 mt-1">Поделитесь партнёрской ссылкой, чтобы начать зарабатывать</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {data.referredUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-indigo-700">
                              {(u.name || u.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {u.name || u.email.split("@")[0]}
                            </p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={u.subscriptions.length > 0 ? "success" : "default"}>
                            {u.subscriptions.length > 0 ? "PRO" : "FREE"}
                          </Badge>
                          <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setExpandedSections((s) => ({ ...s, earnings: !s.earnings }))}
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  История начислений ({data.earnings.length})
                </h3>
              </div>
              {expandedSections.earnings ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {expandedSections.earnings && (
              <div className="mt-4">
                {data.earnings.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Пока нет начислений</p>
                    <p className="text-sm text-gray-400 mt-1">Начисления появятся, когда ваши рефералы оплатят подписку PRO</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 text-gray-500 font-medium">Дата</th>
                          <th className="text-left py-2 text-gray-500 font-medium">Описание</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Платёж</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Ваша комиссия</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.earnings.map((e) => {
                          const isNowAvailable = e.status === "PENDING" && new Date(e.availableAt) <= new Date();
                          const statusLabel =
                            e.status === "WITHDRAWN"
                              ? "Выведено"
                              : e.status === "AVAILABLE" || isNowAvailable
                              ? "Доступно"
                              : `Доступно ${formatDate(e.availableAt)}`;
                          const statusVariant =
                            e.status === "WITHDRAWN"
                              ? "default"
                              : e.status === "AVAILABLE" || isNowAvailable
                              ? "success"
                              : "warning";
                          return (
                            <tr key={e.id}>
                              <td className="py-2.5 text-gray-600">{formatDate(e.createdAt)}</td>
                              <td className="py-2.5 text-gray-600 max-w-[200px] truncate">
                                {e.description || "—"}
                              </td>
                              <td className="py-2.5 text-gray-600 text-right">
                                {e.paymentAmount.toFixed(2)} ₽
                              </td>
                              <td className="py-2.5 font-semibold text-green-700 text-right">
                                +{e.amount.toFixed(2)} ₽
                              </td>
                              <td className="py-2.5 text-right">
                                <Badge variant={statusVariant as "default" | "success" | "warning"}>
                                  {statusLabel}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setExpandedSections((s) => ({ ...s, withdrawals: !s.withdrawals }))}
            >
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Заявки на вывод ({data.withdrawals.length})
                </h3>
              </div>
              {expandedSections.withdrawals ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {expandedSections.withdrawals && (
              <div className="mt-4">
                {data.withdrawals.length === 0 ? (
                  <div className="text-center py-8">
                    <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Нет заявок на вывод</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {data.withdrawals.map((w) => (
                      <div key={w.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatMoney(w.amount)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {w.recepientType === "IP" ? "ИП" : "ООО"} &middot; {w.recepientName} &middot; {formatDate(w.createdAt)}
                          </p>
                          {w.adminComment && (
                            <p className="text-xs text-gray-500 mt-1">Комментарий: {w.adminComment}</p>
                          )}
                        </div>
                        <Badge
                          variant={
                            w.status === "PAID"
                              ? "success"
                              : w.status === "PENDING"
                              ? "warning"
                              : w.status === "APPROVED"
                              ? "info"
                              : "danger"
                          }
                        >
                          {w.status === "PENDING"
                            ? "На рассмотрении"
                            : w.status === "APPROVED"
                            ? "Одобрена"
                            : w.status === "PAID"
                            ? "Выплачено"
                            : "Отклонена"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold mb-1">Начните зарабатывать прямо сейчас</h3>
                <p className="text-indigo-200">
                  Поделитесь ссылкой с владельцами ресторанов, салонов, автосервисов и получайте стабильный доход
                </p>
              </div>
              <button
                onClick={copyLink}
                className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 shrink-0 px-6 py-3 text-base bg-white text-indigo-700 hover:bg-indigo-50"
              >
                <Copy className="w-4 h-4 mr-2" />
                Скопировать ссылку
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
