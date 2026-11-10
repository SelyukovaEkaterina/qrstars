"use client";

import { useEffect } from "react";
import { PENDING_RESTORE_CODE_KEY } from "@/lib/incident";

/** Запоминает код до входа/регистрации (переживает OAuth VK / Яндекс). */
export default function RememberRestoreCode({ code }: { code: string | null }) {
  useEffect(() => {
    if (code) localStorage.setItem(PENDING_RESTORE_CODE_KEY, code);
  }, [code]);
  return null;
}
