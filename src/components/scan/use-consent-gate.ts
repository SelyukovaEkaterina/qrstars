"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Галочка согласия на ПД не блокирует кнопку отправки: на смартфонах из-за
 * клавиатуры чекбокс уезжает из зоны видимости, и заблокированная кнопка
 * выглядит как поломка. Вместо disabled — скролл к чекбоксу и подсветка.
 */
export function useConsentGate(needsConsent: boolean) {
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentHighlight, setConsentHighlight] = useState(false);
  const consentRef = useRef<HTMLLabelElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const updateConsent = useCallback(
    (value: boolean) => {
      setConsentChecked(value);
      if (value) {
        clearTimers();
        setConsentHighlight(false);
      }
    },
    [clearTimers]
  );

  /** `true` — можно отправлять; `false` — согласия нет, гостю уже подсветили чекбокс. */
  const ensureConsent = useCallback(() => {
    if (!needsConsent || consentChecked) return true;

    // Клавиатура перекрывает чекбокс — сначала убираем её, потом скроллим.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    clearTimers();
    setConsentHighlight(true);
    timers.current.push(
      setTimeout(() => {
        consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120),
      setTimeout(() => setConsentHighlight(false), 4000)
    );
    return false;
  }, [needsConsent, consentChecked, clearTimers]);

  return {
    consentChecked,
    setConsentChecked: updateConsent,
    consentHighlight,
    consentRef,
    ensureConsent,
  };
}
