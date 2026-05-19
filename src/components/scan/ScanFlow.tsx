"use client";

import { useState } from "react";
import StarRating from "@/components/ui/StarRating";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ratingToLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

type FlowStep = "rating" | "positive" | "negative" | "thanks-positive" | "thanks-negative";

interface ScanFlowProps {
  establishmentName: string;
  establishmentId: string;
  qrCodeId: string;
  redirectUrl: string;
  watermarkEnabled: boolean;
  showPromo: boolean;
  promoCode?: string;
  /** Демо с лендинга: отзывы не пишутся в БД, уведомления не уходят */
  isDemo?: boolean;
}

function safeRedirect(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noreferrer noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function ScanFlow({
  establishmentName,
  establishmentId,
  qrCodeId,
  redirectUrl,
  watermarkEnabled,
  showPromo,
  promoCode,
  isDemo = false,
}: ScanFlowProps) {
  const [step, setStep] = useState<FlowStep>("rating");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRatingSelect = (r: number) => {
    setRating(r);
    if (r >= 4) {
      setStep("positive");
    } else {
      setStep("negative");
    }
  };

  const submitNegative = async () => {
    setSubmitting(true);
    try {
      if (isDemo) {
        setStep("thanks-negative");
        return;
      }
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId,
          qrCodeId,
          rating,
          comment,
          guestName: guestName || undefined,
          guestPhone: guestPhone || undefined,
          isNegative: true,
        }),
      });
      setStep("thanks-negative");
    } catch {
      setStep("thanks-negative");
    } finally {
      setSubmitting(false);
    }
  };

  const submitPositive = async () => {
    setSubmitting(true);
    try {
      if (isDemo) {
        setStep("thanks-positive");
        return;
      }
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId,
          qrCodeId,
          rating,
          comment: "",
          isNegative: false,
        }),
      });
    } catch {}
    setSubmitting(false);
    setStep("thanks-positive");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {watermarkEnabled && (
          <p className="text-center text-xs text-gray-400 mb-6">Сделано в QrStars.ru</p>
        )}

        {isDemo && (
          <p className="text-center text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-3 py-1 mb-4 mx-auto w-fit">
            Демо-режим — отзыв не сохраняется
          </p>
        )}

        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">{establishmentName}</h1>

        {step === "rating" && (
          <div className="text-center space-y-6 mt-8">
            <p className="text-lg text-gray-600">Как вам всё понравилось?</p>
            <div className="flex justify-center">
              <StarRating value={rating} onChange={handleRatingSelect} />
            </div>
            {rating > 0 && (
              <p className={cn("text-xl font-semibold", rating >= 4 ? "text-green-600" : "text-orange-600")}>
                {ratingToLabel(rating)}
              </p>
            )}
          </div>
        )}

        {step === "positive" && (
          <div className="text-center space-y-6 mt-8">
            <div className="text-5xl">&#x1F60A;</div>
            <p className="text-xl font-semibold text-green-600">
              Спасибо! Оставьте отзыв на карте?
            </p>
            <p className="text-gray-500">Это поможет нам стать лучше!</p>
            <div className="space-y-3">
              <Button size="lg" className="w-full" onClick={submitPositive}>
                Оставить отзыв на Яндекс.Картах
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep("thanks-positive")}>
                Нет, спасибо
              </Button>
            </div>
          </div>
        )}

        {step === "thanks-positive" && (
          <div className="text-center space-y-4 mt-8">
            <div className="text-5xl">&#x1F389;</div>
            <p className="text-xl font-semibold text-gray-900">Спасибо за вашу оценку!</p>
            {redirectUrl && (
              <Button
                size="lg"
                className="w-full"
                onClick={() => safeRedirect(redirectUrl)}
              >
                Перейти на Яндекс.Карты
              </Button>
            )}
            {showPromo && promoCode && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 font-medium">Ваш промокод:</p>
                <p className="text-2xl font-bold text-green-800 mt-1">{promoCode}</p>
              </div>
            )}
          </div>
        )}

        {step === "negative" && (
          <div className="space-y-4 mt-8">
            <div className="text-center">
              <div className="text-4xl">&#x1F614;</div>
              <p className="text-lg font-semibold text-gray-900 mt-2">
                Нам очень жаль! Расскажите подробнее
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Ваше сообщение попадёт лично руководству
              </p>
            </div>
            <Input
              label="Ваше имя (необязательно)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Как к вам обращаться?"
            />
            <Input
              label="Телефон (необязательно)"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              type="tel"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Комментарий</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Что пошло не так? Мы хотим исправиться."
              />
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={submitNegative}
              disabled={submitting || !comment}
            >
              {submitting ? "Отправляем..." : "Отправить"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("rating");
                setRating(0);
              }}
            >
              Изменить оценку
            </Button>
          </div>
        )}

        {step === "thanks-negative" && (
          <div className="text-center space-y-4 mt-8">
            <div className="text-5xl">&#x1F64F;</div>
            <p className="text-xl font-semibold text-gray-900">Спасибо за обратную связь!</p>
            <p className="text-gray-500">
              Мы уже работаем над улучшением. Руководство лично прочитает ваш отзыв.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
