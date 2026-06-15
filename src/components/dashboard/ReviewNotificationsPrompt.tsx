"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { Bell, CheckCircle2, MessageCircle } from "lucide-react";

interface ReviewNotificationsPromptProps {
  establishmentId: string;
  settingsHref?: string;
  /** Демо-режим визарда (rerun) — UI без реальной привязки. */
  demo?: boolean;
}

export default function ReviewNotificationsPrompt({
  establishmentId,
  settingsHref = `/dashboard/settings#notification-channels`,
  demo = false,
}: ReviewNotificationsPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [linked, setLinked] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [settingsRes, contactsRes] = await Promise.all([
        fetch(`/api/settings?id=${establishmentId}`),
        fetch("/api/messenger-contacts"),
      ]);
      const settingsData = await settingsRes.json();
      const contactsData = await contactsRes.json();
      const est = settingsData.establishment;
      const contacts = (contactsData.contacts ?? []) as Array<{ provider: string }>;
      if (!est) return false;
      const hasChannel = contacts.some((c) => c.provider === "TELEGRAM" || c.provider === "MAX");
      const wantsNotify =
        est.notificationTelegramEnabled ||
        est.notificationMaxEnabled ||
        est.notificationEmailEnabled;
      const isLinked = hasChannel && wantsNotify;
      setLinked(isLinked);
      return isLinked;
    } catch {
      return false;
    }
  }, [establishmentId]);

  useEffect(() => {
    if (demo) return;
    fetchStatus();
  }, [fetchStatus, demo]);

  if (dismissed) return null;

  if (linked) {
    return (
      <Card className="p-4 border-green-200 bg-green-50/60">
        <div className="flex items-center gap-2 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Уведомления о негативных отзывах подключены</span>
        </div>
      </Card>
    );
  }

  const settingsLink = demo ? "/dashboard/settings" : settingsHref;

  return (
    <Card className="p-4 border-indigo-200 bg-indigo-50/40 space-y-3">
      {demo && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Демо-режим: интерфейс как у пользователя, привязка не выполняется.
        </p>
      )}
      <div className="flex gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
          <Bell className="w-4 h-4 text-indigo-600" />
        </div>
        <p className="text-sm text-gray-700 leading-relaxed pt-0.5">
          Хотите мгновенные уведомления о 1–3★? Подключите канал в настройках и включите галочку «Отзывы».
        </p>
      </div>

      <Link
        href={settingsLink}
        className="inline-flex items-center justify-center w-full sm:w-auto px-3 py-2 text-sm font-medium rounded-lg border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <MessageCircle className="w-4 h-4 mr-1 text-blue-500" />
        Настроить каналы
      </Link>

      <p className="text-xs text-gray-500">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="hover:text-indigo-600 transition-colors"
        >
          Позже
        </button>
      </p>
    </Card>
  );
}
