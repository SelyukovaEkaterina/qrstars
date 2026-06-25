"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { Loader2, Mail, Send, MessageSquare } from "lucide-react";

interface ReportSettings {
  reportsEmailEnabled: boolean;
  reportsTelegramEnabled: boolean;
  reportsMaxEnabled: boolean;
  hasTelegramContact: boolean;
  hasMaxContact: boolean;
}

export default function MonthlyReportSettings() {
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.reportSettings) setSettings(data.reportSettings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function update(patch: Partial<ReportSettings>) {
    if (!settings) return;
    setSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-report-settings", ...patch }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.reportSettings) {
          setSettings({
            ...data.reportSettings,
            hasTelegramContact: settings.hasTelegramContact,
            hasMaxContact: settings.hasMaxContact,
          });
        } else {
          setSettings({ ...settings, ...patch });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
        </div>
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span>📋</span> Ежемесячный отчёт
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Каждый месяц будем присылать сводку по сканированиям, отзывам и заказам с
            сравнением с прошлым месяцем. Секции — только по тем типам QR, которые у вас есть.
          </p>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />}
      </div>

      <div className="mt-4 space-y-3">
        <ToggleRow
          icon={<Mail className="w-4 h-4" />}
          label="На почту"
          hint="Полная версия с графиками и рекомендациями"
          checked={settings.reportsEmailEnabled}
          onChange={(v) => update({ reportsEmailEnabled: v })}
        />
        <ToggleRow
          icon={<Send className="w-4 h-4" />}
          label="В Telegram"
          hint={
            settings.hasTelegramContact
              ? "Краткая сводка во все подключённые чаты"
              : "Сначала подключите Telegram в блоке «Каналы для уведомлений» выше"
          }
          disabled={!settings.hasTelegramContact}
          checked={settings.reportsTelegramEnabled && settings.hasTelegramContact}
          onChange={(v) => update({ reportsTelegramEnabled: v })}
        />
        <ToggleRow
          icon={<MessageSquare className="w-4 h-4" />}
          label="В MAX"
          hint={
            settings.hasMaxContact
              ? "Краткая сводка во все подключённые аккаунты"
              : "Сначала подключите MAX в блоке «Каналы для уведомлений» выше"
          }
          disabled={!settings.hasMaxContact}
          checked={settings.reportsMaxEnabled && settings.hasMaxContact}
          onChange={(v) => update({ reportsMaxEnabled: v })}
        />
      </div>
    </Card>
  );
}

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ icon, label, hint, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        disabled
          ? "opacity-60 cursor-not-allowed bg-gray-50"
          : "cursor-pointer hover:bg-gray-50"
      }`}
    >
      <div
        className={`mt-0.5 ${checked ? "text-indigo-600" : "text-gray-400"}`}
        aria-hidden
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{hint}</div>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
