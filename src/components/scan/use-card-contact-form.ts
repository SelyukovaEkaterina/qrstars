"use client";

import { useState } from "react";
import { useConsentGate } from "@/components/scan/use-consent-gate";
import { guestPdPolicyUrl, type PdConsent } from "@/lib/pd-consent";

/**
 * Форма «Оставить заявку» с визитки: общая для мобильной визитки
 * (`BusinessCardView`) и сайта-визитки для компьютера (`DesktopCardSite`).
 */
export function useCardContactForm(qrCode: string | undefined, pdConsent: PdConsent | undefined) {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Согласие — когда гость оставляет телефон или у владельца опубликована своя политика.
  const needsConsent = !!pdConsent?.ready || guestPhone.trim() !== "";
  const policyUrl = guestPdPolicyUrl(pdConsent);
  const consent = useConsentGate(needsConsent);

  const send = async () => {
    if (!qrCode) return;

    if (!guestName.trim()) {
      setError("Укажите ваше имя");
      return;
    }
    if (!message.trim() || message.trim().length < 2) {
      setError("Напишите сообщение (минимум 2 символа)");
      return;
    }
    if (!consent.ensureConsent()) return;

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/business-cards/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCode,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim() || undefined,
          message: message.trim(),
          pdConsentGiven: consent.consentChecked,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Не удалось отправить");
        return;
      }

      setSuccess(true);
      setGuestName("");
      setGuestPhone("");
      setMessage("");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSending(false);
    }
  };

  return {
    guestName,
    setGuestName,
    guestPhone,
    setGuestPhone,
    message,
    setMessage,
    sending,
    error,
    setError,
    success,
    setSuccess,
    needsConsent,
    policyUrl,
    consent,
    send,
  };
}
