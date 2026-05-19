"use client";

import { useState } from "react";
import { useSyncPropState } from "@/lib/sync-prop-state";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Loader2 } from "lucide-react";

interface WifiConfigData {
  id?: string;
  ssid: string;
  password: string | null;
  encryption: string;
  hidden: boolean;
}

const defaultConfig: WifiConfigData = {
  ssid: "",
  password: null,
  encryption: "WPA",
  hidden: false,
};

const encryptionOptions = [
  { value: "WPA", label: "WPA / WPA2" },
  { value: "WEP", label: "WEP" },
  { value: "nopass", label: "Без пароля" },
];

interface WifiConfigEditorProps {
  initialData?: WifiConfigData | null;
  onSave: (data: WifiConfigData) => Promise<void>;
  saving?: boolean;
}

export default function WifiConfigEditor({ initialData, onSave, saving }: WifiConfigEditorProps) {
  const configSyncKey = initialData?.id ?? "new";
  const [config, setConfig] = useSyncPropState(
    initialData ? { ...defaultConfig, ...initialData } : defaultConfig,
    configSyncKey
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof WifiConfigData, value: string | boolean | null) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSave = () => {
    if (!config.ssid.trim()) {
      setErrors({ ssid: "Название сети обязательно" });
      return;
    }
    if (config.encryption !== "nopass" && !config.password?.trim()) {
      setErrors({ password: "Пароль обязателен для выбранного типа шифрования" });
      return;
    }
    onSave(config);
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Настройки Wi-Fi</h3>
        <div className="space-y-4">
          <Input
            label="Название сети (SSID) *"
            value={config.ssid}
            onChange={(e) => updateField("ssid", e.target.value)}
            placeholder="MyWiFi"
            error={errors.ssid}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип шифрования
            </label>
            <select
              value={config.encryption}
              onChange={(e) => updateField("encryption", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {encryptionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {config.encryption !== "nopass" && (
            <Input
              label="Пароль *"
              value={config.password || ""}
              onChange={(e) => updateField("password", e.target.value || null)}
              placeholder="Введите пароль от Wi-Fi"
              type="password"
              error={errors.password}
            />
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="hidden"
              checked={config.hidden}
              onChange={(e) => updateField("hidden", e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="hidden" className="text-sm text-gray-700">
              Скрытая сеть (не транслирует SSID)
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">Предпросмотр</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Сеть</span>
            <span className="text-sm font-medium">{config.ssid || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Шифрование</span>
            <span className="text-sm font-medium">
              {encryptionOptions.find((o) => o.value === config.encryption)?.label || config.encryption}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Пароль</span>
            <span className="text-sm font-mono font-medium">
              {config.encryption === "nopass" ? "—" : config.password ? "••••••••" : "—"}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {"\ud83d\udca1"} При сканировании QR-кода гость увидит страницу с автоматически сгенерированным Wi-Fi QR-кодом для быстрого подключения.
        </p>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить настройки Wi-Fi"
          )}
        </Button>
      </div>
    </div>
  );
}
