"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Button from "@/components/ui/Button";

function SurveyForm() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const urlEmail = searchParams.get("email") || "";

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0); // 0 = welcome, 1-4 = steps

  const [email, setEmail] = useState(urlEmail);
  const [answers, setAnswers] = useState({
    goal: "",
    collectingNow: "",
    qrPlaced: "",
    missingInDashboard: "",
    willingToPay: "",
    readyForCall: "",
    companyInfo: "",
    featuresAndFeedback: "",
  });

  useEffect(() => {
    if (session?.user?.email && !email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(session.user.email);
    }
  }, [session, email]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAnswers((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const nextStep = () => {
    if (step === 1 && (!answers.goal.trim() || !answers.companyInfo.trim())) {
      setError("Пожалуйста, заполните оба поля, чтобы мы могли лучше вас понять.");
      return;
    }
    if (step === 2 && !answers.qrPlaced.trim()) {
      setError("Пожалуйста, ответьте на второй вопрос.");
      return;
    }
    if (step === 3 && !answers.featuresAndFeedback.trim()) {
      setError("Пожалуйста, поделитесь мнением во втором поле.");
      return;
    }
    setError("");
    setStep((s) => s + 1);
  };

  const prevStep = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      setError("Укажите email, на который мы начислим тариф");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/promo-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка при отправке анкеты");
      }
      setDone(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Что-то пошло не так");
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">Спасибо! 🎉</h1>
          <p className="text-gray-600 text-lg">
            Ваши ответы успешно отправлены. Мы начислили вам <strong>PRO-тариф на 3 месяца</strong>!
          </p>
          <div className="pt-6">
            <Link href="/dashboard">
              <Button className="w-full h-12 text-lg">Перейти в личный кабинет</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalSteps = 4;
  const progressPercent = step === 0 ? 0 : Math.round((step / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-indigo-100 overflow-hidden relative transition-all duration-300">
        
        {/* Progress bar */}
        {step > 0 && (
          <div className="absolute top-0 left-0 right-0 h-2 bg-gray-100">
            <div 
              className="h-full bg-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {step === 0 && (
          <div className="px-8 py-16 text-center space-y-8">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto rotate-3">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-extrabold text-gray-900">Помогите нам стать лучше</h1>
              <p className="text-gray-600 text-lg max-w-md mx-auto leading-relaxed">
                Ответьте на несколько вопросов о вашем опыте работы с QrStars, и мы подарим вам <strong>PRO-тариф на 3 месяца</strong>.
              </p>
            </div>
            <Button onClick={() => setStep(1)} className="h-14 px-8 text-lg rounded-xl shadow-lg hover:shadow-indigo-200/50 hover:-translate-y-0.5 transition-all">
              Пройти опрос и получить PRO
            </Button>
            <p className="text-gray-400 text-sm mt-4">Займет около 2 минут</p>
          </div>
        )}

        {step > 0 && (
          <div className="p-8 md:p-12">
            <div className="mb-8">
              <span className="text-indigo-600 font-bold text-sm tracking-wider uppercase">
                Шаг {step} из {totalSteps}
              </span>
            </div>

            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* STEP 1 */}
              {step === 1 && (
                <>
                  <div className="space-y-3">
                    <label className="block text-lg font-bold text-gray-900">
                      Какую задачу хотели решить при регистрации? Что искали? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="goal"
                      value={answers.goal}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Например, хотел собирать отзывы на Яндекс Карты или сделать онлайн-меню..."
                      className="w-full rounded-2xl border-gray-200 bg-gray-50 px-5 py-4 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-lg font-bold text-gray-900">
                      Расскажите немного о вашей компании <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="companyInfo"
                      value={answers.companyInfo}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Сфера деятельности, примерное число сотрудников, город..."
                      className="w-full rounded-2xl border-gray-200 bg-gray-50 px-5 py-4 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                    />
                  </div>
                </>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <>
                  <div className="space-y-3">
                    <label className="block text-lg font-bold text-gray-900">
                      Собираете ли вы сейчас отзывы? Как именно?
                    </label>
                    <textarea
                      name="collectingNow"
                      value={answers.collectingNow}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Например: просим гостей устно, распечатали обычный QR-код, или пока никак..."
                      className="w-full rounded-2xl border-gray-200 bg-gray-50 px-5 py-4 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-lg font-bold text-gray-900">
                      Получилось ли поставить наш QR-код у гостей? Если нет — почему? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="qrPlaced"
                      value={answers.qrPlaced}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Да, распечатали тейбл-тенты / Нет, не поняли как скачать / Ждем доставку..."
                      className="w-full rounded-2xl border-gray-200 bg-gray-50 px-5 py-4 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                    />
                  </div>
                </>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <>
                  <div className="space-y-3">
                    <label className="block text-lg font-bold text-gray-900">
                      Чего вам не хватило в личном кабинете в первые 10 минут работы?
                    </label>
                    <textarea
                      name="missingInDashboard"
                      value={answers.missingInDashboard}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Было непонятно, как добавить логотип / Запутался в настройках ссылок / Все супер..."
                      className="w-full rounded-2xl border-gray-200 bg-gray-50 px-5 py-4 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-lg font-bold text-gray-900">
                      Какие фичи вам нужны? Что понравилось, а что нет? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="featuresAndFeedback"
                      value={answers.featuresAndFeedback}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Хотелось бы интеграцию с Yclients, классный дизайн визитки, но не хватает..."
                      className="w-full rounded-2xl border-gray-200 bg-gray-50 px-5 py-4 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                    />
                  </div>
                </>
              )}

              {/* STEP 4 */}
              {step === 4 && (
                <>
                  <div className="space-y-3">
                    <label className="block text-lg font-bold text-gray-900">
                      За что вы реально заплатили бы (и сколько), если бы отзывы шли каждую неделю?
                    </label>
                    <textarea
                      name="willingToPay"
                      value={answers.willingToPay}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Например: 1000р в месяц, если отзывы будут расти без моего участия..."
                      className="w-full rounded-2xl border-gray-200 bg-gray-50 px-5 py-4 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-lg font-bold text-gray-900">
                      Готовы ли вы на 20-минутный созвон с основателем для обратной связи?
                    </label>
                    <select
                      name="readyForCall"
                      value={answers.readyForCall}
                      onChange={handleChange}
                      className="w-full rounded-2xl border-gray-200 bg-gray-50 px-5 py-4 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base cursor-pointer"
                    >
                      <option value="">Выберите вариант...</option>
                      <option value="yes">Да, конечно, давайте спишемся</option>
                      <option value="no">Нет, спасибо, только текст</option>
                    </select>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <div className="space-y-3">
                      <label className="block text-lg font-bold text-gray-900">
                        Ваш Email в системе <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError("");
                        }}
                        placeholder="name@example.com"
                        className="w-full rounded-2xl border-gray-200 bg-gray-50 px-5 py-4 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base"
                      />
                      <p className="text-sm text-gray-500 pl-1">
                        Сюда мы начислим подарочный тариф.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-center gap-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={prevStep} className="h-14 px-6 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50">
                    Назад
                  </Button>
                )}
                
                {step < totalSteps ? (
                  <Button type="button" onClick={nextStep} className="h-14 flex-1 rounded-xl shadow-lg hover:shadow-indigo-200/50 hover:-translate-y-0.5 transition-all text-lg">
                    Далее
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={loading} className="h-14 flex-1 rounded-xl shadow-lg hover:shadow-indigo-200/50 hover:-translate-y-0.5 transition-all text-lg">
                    {loading ? "Отправляем..." : "Отправить и получить PRO"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PromoSurveyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">Загрузка...</p>
        </div>
      }
    >
      <SurveyForm />
    </Suspense>
  );
}
