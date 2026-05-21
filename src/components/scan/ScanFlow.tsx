"use client";

import { useState } from "react";
import StarRating from "@/components/ui/StarRating";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ratingToLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  type ReviewRoutingConfig,
  type PlatformUrls,
  getStarStep,
  isComplaintAction,
  resolveActionUrl,
} from "@/lib/review-routing";
import { getLandingTheme, isDarkLandingTheme } from "@/lib/landing-themes";

type FlowStep = "rating" | "action" | "convince" | "thanks";

interface ScanFlowProps {
  establishmentName: string;
  establishmentId: string;
  qrCodeId: string;
  reviewRouting: ReviewRoutingConfig;
  platformUrls: PlatformUrls;
  watermarkEnabled: boolean;
  showPromo: boolean;
  promoCode?: string;
  isDemo?: boolean;
  landingTheme?: string | null;
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
  reviewRouting,
  platformUrls,
  watermarkEnabled,
  showPromo,
  promoCode,
  isDemo = false,
  landingTheme: landingThemeId,
}: ScanFlowProps) {
  const [step, setStep] = useState<FlowStep>("rating");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [skippedAction, setSkippedAction] = useState(false);

  const theme = getLandingTheme(landingThemeId);
  const dark = isDarkLandingTheme(landingThemeId);

  const starStep = rating > 0 ? getStarStep(reviewRouting, rating) : null;
  const actionUrl = starStep ? resolveActionUrl(starStep.action, platformUrls) : null;
  const isComplaint = starStep ? isComplaintAction(starStep.action) : false;

  const handleRatingSelect = (r: number) => {
    setRating(r);
    setSkippedAction(false);
    setStep("action");
  };

  const submitReview = async (isNegative: boolean, reviewComment?: string) => {
    setSubmitting(true);
    try {
      if (isDemo) {
        setStep("thanks");
        return;
      }
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId,
          qrCodeId,
          rating,
          comment: reviewComment ?? "",
          guestName: guestName || undefined,
          guestPhone: guestPhone || undefined,
          isNegative,
        }),
      });
      setStep("thanks");
    } catch {
      setStep("thanks");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (!starStep) return;
    if (isComplaint) {
      await submitReview(true, comment);
      return;
    }
    await submitReview(false);
  };

  return (
    <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center px-4 py-8`}>
      <div className="w-full max-w-md">
        {watermarkEnabled && (
          <p className={`text-center text-xs mb-6 ${dark ? "text-slate-500" : "text-gray-400"}`}>Сделано в QrStars.ru</p>
        )}

        {isDemo && (
          <p className={`text-center text-xs font-medium rounded-full px-3 py-1 mb-4 mx-auto w-fit ${theme.demoBadgeBg} ${theme.demoBadgeText}`}>
            Демо-режим — отзыв не сохраняется
          </p>
        )}

        <h1 className={`text-2xl font-bold text-center mb-2 ${dark ? "text-white" : "text-gray-900"}`}>{establishmentName}</h1>

        {step === "rating" && (
          <div className="text-center space-y-6 mt-8">
            <p className={`text-lg ${dark ? "text-slate-300" : "text-gray-600"}`}>Как вам всё понравилось?</p>
            <div className="flex justify-center">
              <StarRating value={rating} onChange={handleRatingSelect} />
            </div>
            {rating > 0 && (
              <p
                className={cn(
                  "text-xl font-semibold",
                  isComplaint ? "text-orange-600" : "text-green-600"
                )}
              >
                {ratingToLabel(rating)}
              </p>
            )}
          </div>
        )}

        {step === "action" && starStep && isComplaint && (
          <div className="space-y-4 mt-8">
            <div className="text-center">
              <div className="text-4xl">😔</div>
              <p className={`text-lg font-semibold mt-2 ${dark ? "text-white" : "text-gray-900"}`}>{starStep.promptTitle}</p>
              <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-gray-500"}`}>{starStep.promptSubtitle}</p>
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
              <label className={`block text-sm font-medium ${dark ? "text-slate-300" : "text-gray-700"}`}>Комментарий</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
                  dark
                    ? "bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-indigo-400"
                    : `border-gray-300 focus:ring-indigo-500`
                }`}
                placeholder="Что пошло не так? Мы хотим исправиться."
              />
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={handlePrimaryAction}
              disabled={submitting || !comment}
            >
              {submitting ? "Отправляем..." : starStep.ctaLabel}
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

        {step === "action" && starStep && !isComplaint && (
          <div className="text-center space-y-6 mt-8">
            <div className="text-5xl">😊</div>
            <p className="text-xl font-semibold text-green-600">{starStep.promptTitle}</p>
            <p className={dark ? "text-slate-400" : "text-gray-500"}>{starStep.promptSubtitle}</p>
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full"
                onClick={handlePrimaryAction}
                disabled={submitting}
              >
                {submitting ? "Отправляем..." : starStep.ctaLabel}
              </Button>
              {starStep.action !== "THANKS" && (
                <Button variant="ghost" className="w-full" onClick={() => { setSkippedAction(true); setStep("convince"); }}>
                  Нет, спасибо
                </Button>
              )}
            </div>
          </div>
        )}

        {step === "convince" && starStep && !isComplaint && actionUrl && (
          <div className="text-center space-y-6 mt-8">
            <div className="text-5xl">🥺</div>
            <p className={`text-xl font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Нам очень важен ваш отзыв!</p>
            <p className={dark ? "text-slate-400" : "text-gray-500"}>
              Ваша оценка помогает другим гостям найти нас, а нам — становиться лучше. Это займёт всего пару минут.
            </p>
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full"
                onClick={() => { setSkippedAction(false); setStep("action"); }}
              >
                Хорошо, оставлю отзыв
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep("thanks")}>
                Нет, правда спасибо
              </Button>
            </div>
          </div>
        )}

        {step === "thanks" && starStep && (
          <div className="text-center space-y-4 mt-8">
            <div className="text-5xl">{isComplaint ? "🙏" : "🎉"}</div>
            <p className={`text-xl font-semibold ${dark ? "text-white" : "text-gray-900"}`}>{starStep.thanksTitle}</p>
            <p className={dark ? "text-slate-400" : "text-gray-500"}>{starStep.thanksSubtitle}</p>
            {actionUrl && !isComplaint && !skippedAction && (
              <Button size="lg" className="w-full" onClick={() => safeRedirect(actionUrl)}>
                {starStep.ctaLabel}
              </Button>
            )}
            {showPromo && promoCode && !isComplaint && (
              <div className={`mt-4 p-4 rounded-lg border ${dark ? "bg-green-900/30 border-green-700" : "bg-green-50 border-green-200"}`}>
                <p className={`text-sm font-medium ${dark ? "text-green-400" : "text-green-700"}`}>Ваш промокод:</p>
                <p className={`text-2xl font-bold mt-1 ${dark ? "text-green-300" : "text-green-800"}`}>{promoCode}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
