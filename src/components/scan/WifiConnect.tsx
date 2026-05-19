"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Check, Copy, Settings, Wifi } from "lucide-react";

/** Opens system Wi-Fi settings on Android (Chrome). No-op on iOS. */
const ANDROID_WIFI_SETTINGS_INTENT =
  "intent:#Intent;action=android.settings.WIFI_SETTINGS;end";

interface WifiConfigData {
  id: string;
  ssid: string;
  password: string | null;
  encryption: string;
  hidden: boolean;
}

function encryptionLabel(encryption: string): string {
  switch (encryption) {
    case "WPA":
      return "WPA / WPA2";
    case "WEP":
      return "WEP";
    case "nopass":
      return "Без пароля";
    default:
      return encryption;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
}

export default function WifiConnect({ wifiConfig }: { wifiConfig: WifiConfigData }) {
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState<"password" | "ssid" | null>(null);
  const [copyError, setCopyError] = useState(false);

  const hasPassword =
    Boolean(wifiConfig.password) && wifiConfig.encryption !== "nopass";

  useEffect(() => {
    setIsAndroid(/Android/i.test(navigator.userAgent));
  }, []);

  const handleCopy = useCallback(async (text: string, kind: "password" | "ssid") => {
    setCopyError(false);
    const ok = await copyText(text);
    if (ok) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } else {
      setCopyError(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-indigo-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-100 text-cyan-600 mb-1">
            <Wifi className="w-8 h-8" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Гостевой Wi‑Fi</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {hasPassword
              ? "Скопируйте пароль и подключитесь к сети в настройках телефона"
              : "Откройте настройки Wi‑Fi и выберите сеть без пароля"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-cyan-100 overflow-hidden">
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-500 shrink-0">Сеть</span>
                <span className="text-sm font-semibold text-gray-900 text-right break-all">
                  {wifiConfig.ssid}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-500 shrink-0">Шифрование</span>
                <span className="text-sm font-semibold text-gray-900">
                  {encryptionLabel(wifiConfig.encryption)}
                </span>
              </div>
              {hasPassword && wifiConfig.password && (
                <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-500 shrink-0">Пароль</span>
                  <span className="text-sm font-mono font-semibold text-gray-900 text-right break-all">
                    {wifiConfig.password}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {hasPassword && wifiConfig.password && (
                <Button
                  type="button"
                  size="lg"
                  className="w-full gap-2"
                  onClick={() => handleCopy(wifiConfig.password!, "password")}
                >
                  {copied === "password" ? (
                    <>
                      <Check className="w-4 h-4" />
                      Пароль скопирован
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Скопировать пароль
                    </>
                  )}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full gap-2"
                onClick={() => handleCopy(wifiConfig.ssid, "ssid")}
              >
                {copied === "ssid" ? (
                  <>
                    <Check className="w-4 h-4" />
                    Название скопировано
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Скопировать название сети
                  </>
                )}
              </Button>

              {isAndroid && (
                <a
                  href={ANDROID_WIFI_SETTINGS_INTENT}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-gray-300 px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" />
                  Открыть настройки Wi‑Fi
                </a>
              )}

              {copyError && (
                <p className="text-sm text-red-600 text-center">
                  Не удалось скопировать — выделите и скопируйте вручную
                </p>
              )}
            </div>

            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-left space-y-2">
              <p className="text-sm font-medium text-indigo-900">Как подключиться</p>
              <ol className="text-sm text-indigo-800/90 space-y-1.5 list-decimal list-inside">
                {hasPassword && (
                  <li>
                    Нажмите «Скопировать пароль»
                    {isAndroid ? " (или запомните его ниже)" : ""}
                  </li>
                )}
                <li>
                  {isAndroid ? (
                    <>
                      Нажмите «Открыть настройки Wi‑Fi» или откройте{" "}
                      <span className="font-medium">Настройки → Сеть и интернет → Wi‑Fi</span>
                    </>
                  ) : (
                    <>
                      Откройте <span className="font-medium">Настройки → Wi‑Fi</span>
                    </>
                  )}
                </li>
                <li>
                  Выберите сеть{" "}
                  <span className="font-semibold">&laquo;{wifiConfig.ssid}&raquo;</span>
                  {wifiConfig.hidden && " (скрытая — добавьте вручную)"}
                </li>
                {hasPassword && (
                  <li>
                    {isAndroid ? "Вставьте" : "Нажмите на поле пароля и выберите «Вставить»"} скопированный
                    пароль
                  </li>
                )}
              </ol>
            </div>

            {!isAndroid && hasPassword && (
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                На iPhone после копирования перейдите в Настройки — Safari не может подключить Wi‑Fi
                автоматически.
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">QrStars.ru</p>
      </div>
    </div>
  );
}
