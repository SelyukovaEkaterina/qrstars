"use client";

import { useCallback, useState } from "react";
import Button from "@/components/ui/Button";
import { Check, Copy, Wifi } from "lucide-react";
import { getLandingTheme, isDarkLandingTheme } from "@/lib/landing-themes";

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

export default function WifiConnect({ wifiConfig, landingTheme: themeId }: { wifiConfig: WifiConfigData; landingTheme?: string | null }) {
  const [copied, setCopied] = useState<"password" | "ssid" | null>(null);
  const [copyError, setCopyError] = useState(false);

  const theme = getLandingTheme(themeId);
  const dark = isDarkLandingTheme(themeId);

  const hasPassword =
    Boolean(wifiConfig.password) && wifiConfig.encryption !== "nopass";

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
    <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center px-4 py-10`}>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${theme.iconBg} ${theme.iconText} mb-1`}>
            <Wifi className="w-8 h-8" aria-hidden />
          </div>
          <h1 className={`text-2xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>Гостевой Wi‑Fi</h1>
          <p className={`text-sm leading-relaxed ${dark ? "text-slate-400" : "text-gray-500"}`}>
            {hasPassword
              ? "Скопируйте пароль и подключитесь к сети в настройках телефона"
              : "Откройте настройки Wi‑Fi и выберите сеть без пароля"}
          </p>
        </div>

        <div className={`${theme.cardBg} rounded-2xl shadow-xl border ${theme.cardBorder} overflow-hidden`}>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2 text-left">
              <div className={`flex items-center justify-between gap-3 p-3 rounded-xl ${dark ? "bg-slate-700" : "bg-gray-50"}`}>
                <span className={`text-sm shrink-0 ${dark ? "text-slate-400" : "text-gray-500"}`}>Сеть</span>
                <span className={`text-sm font-semibold text-right break-all ${dark ? "text-white" : "text-gray-900"}`}>
                  {wifiConfig.ssid}
                </span>
              </div>
              <div className={`flex items-center justify-between gap-3 p-3 rounded-xl ${dark ? "bg-slate-700" : "bg-gray-50"}`}>
                <span className={`text-sm shrink-0 ${dark ? "text-slate-400" : "text-gray-500"}`}>Шифрование</span>
                <span className={`text-sm font-semibold ${dark ? "text-white" : "text-gray-900"}`}>
                  {encryptionLabel(wifiConfig.encryption)}
                </span>
              </div>
              {hasPassword && wifiConfig.password && (
                <div className={`flex items-center justify-between gap-3 p-3 rounded-xl ${dark ? "bg-slate-700" : "bg-gray-50"}`}>
                  <span className={`text-sm shrink-0 ${dark ? "text-slate-400" : "text-gray-500"}`}>Пароль</span>
                  <span className={`text-sm font-mono font-semibold text-right break-all ${dark ? "text-white" : "text-gray-900"}`}>
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

              {copyError && (
                <p className="text-sm text-red-600 text-center">
                  Не удалось скопировать — выделите и скопируйте вручную
                </p>
              )}
            </div>

            <div className={`rounded-xl ${theme.infoBoxBg} border ${theme.infoBoxBorder} p-4 text-left space-y-2`}>
              <p className={`text-sm font-medium ${theme.infoBoxTitle}`}>Как подключиться</p>
              <ol className={`text-sm space-y-1.5 list-decimal list-inside ${theme.infoBoxText}`}>
                {hasPassword && <li>Нажмите «Скопировать пароль»</li>}
                <li>
                  Откройте <span className="font-medium">Настройки → Wi‑Fi</span>
                </li>
                <li>
                  Выберите сеть{" "}
                  <span className="font-semibold">&laquo;{wifiConfig.ssid}&raquo;</span>
                  {wifiConfig.hidden && " (скрытая — добавьте вручную)"}
                </li>
                {hasPassword && (
                  <li>Вставьте скопированный пароль при подключении</li>
                )}
              </ol>
            </div>
          </div>
        </div>

        <p className={`text-xs text-center ${dark ? "text-slate-500" : "text-gray-400"}`}>QrStars.ru</p>
      </div>
    </div>
  );
}
