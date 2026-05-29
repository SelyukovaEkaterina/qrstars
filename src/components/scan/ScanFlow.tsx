"use client";

import { useState } from "react";
import StarRating from "@/components/ui/StarRating";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ratingToLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  type ReviewRoutingConfig,
  type ReviewStarStep,
  type PlatformUrls,
  type ResolvedPlatform,
  getStarStep,
  isComplaintAction,
  resolvePlatformUrls,
  platformButtonLabel,
} from "@/lib/review-routing";
import {
  headingColor,
  mutedColor,
  panelStyle,
  primaryButtonStyle,
  scanRootStyle,
  submutedColor,
} from "@/lib/brand-theme-ui";
import { useBrandThemeScan, type BrandThemeScanProps } from "@/components/scan/brand-theme-props";
import ConsentCheckbox from "@/components/scan/ConsentCheckbox";

type FlowStep = "rating" | "action" | "convince" | "thanks";

export interface PdConsent {
  ready: boolean;
  policyUrl: string;
}

interface ScanFlowProps extends BrandThemeScanProps {
  establishmentName: string;
  establishmentId: string;
  qrCodeId: string;
  reviewRouting: ReviewRoutingConfig;
  platformUrls: PlatformUrls;
  watermarkEnabled: boolean;
  showPromo: boolean;
  promoCode?: string;
  isDemo?: boolean;
  isBg?: boolean;
  pdConsent?: PdConsent;
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
  brandColor,
  pageAppearance,
  isBg,
  pdConsent,
}: ScanFlowProps) {
  const [step, setStep] = useState<FlowStep>("rating");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skippedAction, setSkippedAction] = useState(false);
  const [chosenPlatform, setChosenPlatform] = useState<string | null>(null);

  const phoneAllowed = isDemo || !pdConsent || pdConsent.ready;
  const needsConsent = !isDemo && !!pdConsent?.ready;

  const { theme, dark } = useBrandThemeScan({ brandColor, pageAppearance });

  const starStep = rating > 0 ? getStarStep(reviewRouting, rating) : null;
  const isComplaint = starStep ? isComplaintAction(starStep.action) : false;

  const platforms: ResolvedPlatform[] = starStep && !isComplaint && starStep.action !== "THANKS"
    ? resolvePlatformUrls(starStep, platformUrls).filter((p) => p.url)
    : [];
  const hasMultiplePlatforms = platforms.length > 1;

  const actionUrl = platforms[0]?.url ?? null;

  const handleRatingSelect = (r: number) => {
    setRating(r);
    setSkippedAction(false);
    setChosenPlatform(null);
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
          ...(consentChecked && guestPhone.trim() ? { pdConsentGiven: true } : {}),
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

  const handlePlatformClick = async (platform: ResolvedPlatform) => {
    setChosenPlatform(platform.id);
    await submitReview(false);
  };

  const thanksPlatform = chosenPlatform
    ? platforms.find((p) => p.id === chosenPlatform)
    : platforms[0];

  const btnWhite = isBg ? "bg-white text-gray-900 hover:bg-white/90" : "";
  const textWhite = isBg ? "text-white hover:bg-white/10" : "";

  return (
    <div
      className="flex-1 min-h-[inherit] flex flex-col items-center justify-center px-4 py-8 relative z-10"
      style={scanRootStyle(theme, { isBg })}
    >
      <div
        className={`w-full max-w-md ${isBg || theme.dark ? "" : "rounded-2xl p-6 shadow-xl border backdrop-blur-md"}`}
        style={isBg || theme.dark ? undefined : panelStyle(false)}
      >
        {isDemo && (
          <p
            className="text-center text-xs font-medium rounded-full px-3 py-1 mb-4 mx-auto w-fit"
            style={
              isBg
                ? { backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }
                : { backgroundColor: "var(--brand-50)", color: "var(--brand-600)" }
            }
          >
            Демо-режим — отзыв не сохраняется
          </p>
        )}

        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: headingColor(isBg) }}>
          {establishmentName}
        </h1>

        {step === "rating" && (
          <div className="text-center space-y-6 mt-8">
            <p className="text-lg" style={{ color: mutedColor(isBg) }}>
              Как вам всё понравилось?
            </p>
            <div className="flex justify-center">
              <StarRating value={rating} onChange={handleRatingSelect} />
            </div>
            {rating > 0 && (
              <p
                className={cn(
                  "text-xl font-semibold",
                  isComplaint ? (isBg ? "text-orange-400" : "text-orange-600") : (isBg ? "text-green-400" : "text-green-600")
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
              <div className="text-4xl">{starStep.emoji}</div>
              <p className={`text-lg font-semibold mt-2 ${isBg ? "text-white" : dark ? "text-white" : "text-gray-900"}`}>{starStep.promptTitle}</p>
              <p className={`text-sm mt-1 ${isBg ? "text-white/70" : dark ? "text-slate-400" : "text-gray-500"}`}>{starStep.promptSubtitle}</p>
            </div>
            <Input
              label="Ваше имя (необязательно)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Как к вам обращаться?"
            />
            {phoneAllowed ? (
              <Input
                label="Телефон (необязательно)"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+7 (___) ___-__-__"
                type="tel"
              />
            ) : (
              <div className={`text-xs px-3 py-2 rounded-lg border ${isBg ? "border-white/20 text-white/50" : dark ? "border-slate-600 text-slate-500" : "border-gray-200 text-gray-400 bg-gray-50"}`}>
                Поле телефона недоступно — владелец не заполнил реквизиты для обработки персональных данных.
              </div>
            )}
            <div className="space-y-1">
              <label className={`block text-sm font-medium ${isBg ? "text-white/80" : dark ? "text-slate-300" : "text-gray-700"}`}>Комментарий</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
                  isBg
                    ? "bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white/50"
                    : dark
                      ? "bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-indigo-400"
                      : `border-gray-300 focus:ring-indigo-500`
                }`}
                placeholder="Что пошло не так? Мы хотим исправиться."
              />
            </div>
            {needsConsent && phoneAllowed && (
              <ConsentCheckbox
                checked={consentChecked}
                onChange={setConsentChecked}
                policyUrl={pdConsent!.policyUrl}
                isBg={isBg}
                dark={dark}
              />
            )}
            <Button
              size="lg"
              className="w-full"
              style={!isBg ? primaryButtonStyle(false) : primaryButtonStyle(true)}
              onClick={handlePrimaryAction}
              disabled={submitting || !comment || (needsConsent && phoneAllowed && guestPhone.trim() !== "" && !consentChecked)}
            >
              {submitting ? "Отправляем..." : starStep.ctaLabel}
            </Button>
            <Button
              variant="ghost"
              className={`w-full ${textWhite}`}
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
            <div className="text-5xl">{starStep.emoji}</div>
            <p className={`text-xl font-semibold ${isBg ? "text-green-400" : "text-green-600"}`}>{starStep.promptTitle}</p>
            <p className={isBg ? "text-white/70" : dark ? "text-slate-400" : "text-gray-500"}>{starStep.promptSubtitle}</p>

            {hasMultiplePlatforms ? (
              <div className="space-y-3">
                <p className={`text-sm font-medium ${isBg ? "text-white/80" : dark ? "text-slate-300" : "text-gray-600"}`}>
                  Выберите площадку:
                </p>
                {platforms.map((p) => (
                  <Button
                    key={p.id}
                    size="lg"
                    className={`w-full ${btnWhite}`}
                    style={isBg ? primaryButtonStyle(true) : primaryButtonStyle(false)}
                    onClick={() => handlePlatformClick(p)}
                    disabled={submitting}
                  >
                    <PlatformButtonContent
                      platform={p}
                      step={starStep}
                      loading={submitting}
                    />
                  </Button>
                ))}
                <Button variant="ghost" className={`w-full ${textWhite}`} onClick={() => { setSkippedAction(true); setStep("convince"); }}>
                  Нет, спасибо
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  size="lg"
                  className={`w-full ${btnWhite}`}
                  style={isBg ? primaryButtonStyle(true) : primaryButtonStyle(false)}
                  onClick={actionUrl && platforms[0] ? () => handlePlatformClick(platforms[0]) : handlePrimaryAction}
                  disabled={submitting}
                >
                  {submitting ? "Отправляем..." : starStep.ctaLabel}
                </Button>
                {starStep.action !== "THANKS" && (
                  <Button variant="ghost" className={`w-full ${textWhite}`} onClick={() => { setSkippedAction(true); setStep("convince"); }}>
                    Нет, спасибо
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {step === "convince" && starStep && !isComplaint && (hasMultiplePlatforms ? platforms.length > 0 : actionUrl) && (
          <div className="text-center space-y-6 mt-8">
            <div className="text-5xl">🥺</div>
            <p className={`text-xl font-semibold ${isBg ? "text-white" : dark ? "text-white" : "text-gray-900"}`}>Нам очень важен ваш отзыв!</p>
            <p className={isBg ? "text-white/70" : dark ? "text-slate-400" : "text-gray-500"}>
              Ваша оценка помогает другим гостям найти нас, а нам — становиться лучше. Это займёт всего пару минут.
            </p>
            <div className="space-y-3">
              <Button
                size="lg"
                className={`w-full ${btnWhite}`}
                onClick={() => { setSkippedAction(false); setStep("action"); }}
              >
                Хорошо, оставлю отзыв
              </Button>
              <Button variant="ghost" className={`w-full ${textWhite}`} onClick={() => setStep("thanks")}>
                Нет, правда спасибо
              </Button>
            </div>
          </div>
        )}

        {step === "thanks" && starStep && (
          <div className="text-center space-y-4 mt-8">
            <div className="text-5xl">{isComplaint ? "🙏" : "🎉"}</div>
            <p className={`text-xl font-semibold ${isBg ? "text-white" : dark ? "text-white" : "text-gray-900"}`}>{starStep.thanksTitle}</p>
            <p className={isBg ? "text-white/70" : dark ? "text-slate-400" : "text-gray-500"}>{starStep.thanksSubtitle}</p>
            {!isComplaint && !skippedAction && platforms.length > 0 && (
              hasMultiplePlatforms ? (
                <div className="space-y-3 mt-2">
                  <p className={`text-sm font-medium ${isBg ? "text-white/80" : dark ? "text-slate-300" : "text-gray-600"}`}>
                    {chosenPlatform ? "Перейдите на площадку:" : "Выберите площадку для отзыва:"}
                  </p>
                  {(chosenPlatform ? platforms.filter((p) => p.id === chosenPlatform) : platforms).map((p) => (
                    <Button
                      key={p.id}
                      size="lg"
                      className={`w-full ${btnWhite}`}
                      onClick={() => safeRedirect(p.url!)}
                    >
                      <PlatformButtonContent platform={p} step={starStep} />
                    </Button>
                  ))}
                  {chosenPlatform && platforms.filter((p) => p.id !== chosenPlatform).length > 0 && (
                    <div className="pt-2">
                      <p className={`text-xs mb-2 ${isBg ? "text-white/50" : "text-gray-400"}`}>Или на другой площадке:</p>
                      {platforms.filter((p) => p.id !== chosenPlatform).map((p) => (
                        <Button
                          key={p.id}
                          variant="outline"
                          size="sm"
                          className="w-full mb-1"
                          onClick={() => safeRedirect(p.url!)}
                        >
                          <PlatformButtonContent platform={p} step={starStep} />
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                thanksPlatform?.url && (
                  <Button size="lg" className={`w-full ${btnWhite}`} onClick={() => safeRedirect(thanksPlatform.url!)}>
                    {starStep.ctaLabel}
                  </Button>
                )
              )
            )}
            {showPromo && promoCode && !isComplaint && (
              <div className={`mt-4 p-4 rounded-lg border ${isBg ? "bg-green-900/30 border-green-500/30" : dark ? "bg-green-900/30 border-green-700" : "bg-green-50 border-green-200"}`}>
                <p className={`text-sm font-medium ${isBg ? "text-green-300" : dark ? "text-green-400" : "text-green-700"}`}>Ваш промокод:</p>
                <p className={`text-2xl font-bold mt-1 ${isBg ? "text-green-200" : dark ? "text-green-300" : "text-green-800"}`}>{promoCode}</p>
              </div>
            )}
          </div>
        )}

        {watermarkEnabled && (
          <p className="text-center text-xs mt-8" style={{ color: submutedColor(isBg) }}>
            Сделано в QrStars.ru
          </p>
        )}
      </div>
    </div>
  );
}

function PlatformButtonContent({
  platform,
  step,
  loading = false,
}: {
  platform: ResolvedPlatform;
  step: ReviewStarStep;
  loading?: boolean;
}) {
  const label = loading ? "Отправляем..." : platformButtonLabel(platform, step);
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {platform.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={platform.iconUrl} alt="" className="w-5 h-5 rounded object-contain shrink-0" />
      ) : null}
      {label}
    </span>
  );
}
