"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import type { FeedbackSurveyConfig } from "@/lib/feedback-surveys";
import { FEEDBACK_SURVEY_CONFIG } from "@/lib/feedback-surveys";

function npsColor(score: number): string {
  if (score <= 6) return "bg-red-100 text-red-700 border-red-200 hover:bg-red-200";
  if (score <= 8) return "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200";
}

function FeedbackForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [survey, setSurvey] = useState<FeedbackSurveyConfig>(FEEDBACK_SURVEY_CONFIG.d7);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`/api/feedback?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setValid(true);
          setAlreadySubmitted(!!data.alreadySubmitted);
          if (data.survey) setSurvey(data.survey);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (npsScore === null || !token) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        npsScore,
        comment,
        contactOk: survey.showContact ? contactOk : false,
        contactPhone: survey.showContact && contactOk ? contactPhone : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Ошибка отправки");
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <p className="text-gray-500">Загрузка…</p>
      </div>
    );
  }

  if (!token || !valid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Ссылка недействительна</h1>
          <p className="text-gray-500 text-sm">
            Ссылка на опрос устарела или уже использована. Войдите в кабинет — мы рады обратной связи
            через раздел поддержки.
          </p>
          <Link href="/dashboard/support" className="text-indigo-600 hover:underline text-sm">
            Написать в поддержку
          </Link>
        </div>
      </div>
    );
  }

  if (alreadySubmitted || done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Спасибо!</h1>
          <p className="text-gray-600">{survey.thanksMessage}</p>
          <Link href="/dashboard">
            <Button>Перейти в кабинет</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{survey.title}</h1>
        <p className="text-gray-500 text-sm mb-8">{survey.description}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">{survey.npsLabel}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setNpsScore(i)}
                  className={`w-11 h-11 rounded-xl border text-sm font-semibold transition-colors ${
                    npsScore === i ? "ring-2 ring-indigo-500 ring-offset-1 " + npsColor(i) : npsColor(i)
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              {survey.commentLabel}
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={survey.commentPlaceholder}
            />
          </div>

          {survey.showContact && (
            <>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactOk}
                  onChange={(e) => setContactOk(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600">{survey.contactLabel}</span>
              </label>

              {contactOk && (
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Телефон или Telegram"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <Button type="submit" disabled={npsScore === null || submitting} className="w-full">
            {submitting ? "Отправка…" : survey.submitLabel}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
          <p className="text-gray-500">Загрузка…</p>
        </div>
      }
    >
      <FeedbackForm />
    </Suspense>
  );
}
