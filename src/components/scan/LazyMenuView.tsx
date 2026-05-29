"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Coffee, Loader2, RefreshCw } from "lucide-react";
import MenuView from "@/components/scan/MenuView";
import type { MenuData } from "@/components/dashboard/MenuEditor";
import type { PdConsent } from "@/components/scan/ScanFlow";
import type { BrandThemeScanProps } from "@/components/scan/brand-theme-props";
import { useBrandThemeScan } from "@/components/scan/brand-theme-props";
import { headingColor, mutedColor, scanRootStyle } from "@/lib/brand-theme-ui";

type LoadStatus = "idle" | "loading" | "ready" | "error";

const menuCache = new Map<string, MenuData>();
const inFlight = new Map<string, Promise<MenuData>>();

function cacheKey(establishmentId: string, menuId: string) {
  return `${establishmentId}:${menuId}`;
}

async function fetchPublicMenu(establishmentId: string, menuId: string): Promise<MenuData> {
  const key = cacheKey(establishmentId, menuId);
  const cached = menuCache.get(key);
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const res = await fetch(
      `/api/public/menu?establishmentId=${encodeURIComponent(establishmentId)}&menuId=${encodeURIComponent(menuId)}`
    );
    const json = (await res.json()) as { menu?: MenuData; error?: string };
    if (!res.ok || !json.menu) {
      throw new Error(json.error ?? "Не удалось загрузить меню");
    }
    menuCache.set(key, json.menu);
    return json.menu;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

function MenuLoadingSkeleton({
  title,
  brandColor,
  pageAppearance,
  isBg,
  embedded,
}: BrandThemeScanProps & { title?: string | null; isBg?: boolean; embedded?: boolean }) {
  const { theme } = useBrandThemeScan({ brandColor, pageAppearance });
  const isBgResolved = !!isBg;

  return (
    <div
      className={`flex flex-col items-center justify-center ${embedded ? "py-10 px-4" : "min-h-[50vh] px-6 py-16"}`}
      style={embedded ? undefined : scanRootStyle(theme, { isBg: isBgResolved, embedded: false })}
      aria-busy="true"
      aria-label="Загрузка меню"
    >
      <div
        className="relative flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
        style={{ backgroundColor: "var(--brand-accent-soft)" }}
      >
        <Coffee className="w-8 h-8" style={{ color: "var(--brand-accent)" }} />
        <Loader2
          className="absolute -right-1 -bottom-1 w-6 h-6 animate-spin"
          style={{ color: "var(--brand-accent)" }}
        />
      </div>
      <p
        className="text-base font-semibold text-center mb-1"
        style={{ color: headingColor(isBgResolved) }}
      >
        {title?.trim() || "Меню"}
      </p>
      <p className="text-sm text-center mb-8" style={{ color: mutedColor(isBgResolved) }}>
        Подгружаем блюда и цены…
      </p>
      <div className="w-full max-w-sm space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex gap-3 rounded-xl p-3 animate-pulse"
            style={{
              backgroundColor: isBgResolved ? "rgba(255,255,255,0.12)" : "var(--brand-surface)",
              animationDelay: `${i * 120}ms`,
            }}
          >
            <div
              className="w-16 h-16 rounded-lg shrink-0"
              style={{ backgroundColor: isBgResolved ? "rgba(255,255,255,0.15)" : "var(--brand-border)" }}
            />
            <div className="flex-1 space-y-2 py-1">
              <div
                className="h-3.5 rounded-md w-3/4"
                style={{ backgroundColor: isBgResolved ? "rgba(255,255,255,0.2)" : "var(--brand-border)" }}
              />
              <div
                className="h-3 rounded-md w-1/2"
                style={{ backgroundColor: isBgResolved ? "rgba(255,255,255,0.12)" : "var(--brand-border)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuLoadError({
  message,
  onRetry,
  brandColor,
  pageAppearance,
  isBg,
}: BrandThemeScanProps & { message: string; onRetry: () => void; isBg?: boolean }) {
  const isBgResolved = !!isBg;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <p className="text-base font-medium mb-2" style={{ color: headingColor(isBgResolved) }}>
        Меню временно недоступно
      </p>
      <p className="text-sm mb-6 max-w-xs" style={{ color: mutedColor(isBgResolved) }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--brand-accent)", color: "#fff" }}
      >
        <RefreshCw className="w-4 h-4" />
        Повторить
      </button>
    </div>
  );
}

export interface LazyMenuViewProps extends BrandThemeScanProps {
  menuStub: MenuData;
  establishmentId: string;
  establishmentName: string;
  embedded?: boolean;
  isBg?: boolean;
  qrCodeId?: string;
  qrLabel?: string;
  isDemo?: boolean;
  pdConsent?: PdConsent;
  /** Начать загрузку сразу (для QR-режима «только меню»). */
  loadImmediately?: boolean;
  /** Активна ли секция (для лендинга — грузим при открытии). */
  active?: boolean;
  /** Подгрузить в фоне при монтировании лендинга. */
  prefetch?: boolean;
}

export default function LazyMenuView({
  menuStub,
  establishmentId,
  establishmentName,
  embedded,
  brandColor,
  pageAppearance,
  isBg,
  qrCodeId = "",
  qrLabel,
  isDemo,
  pdConsent,
  loadImmediately = false,
  active = true,
  prefetch = false,
}: LazyMenuViewProps) {
  const menuId = menuStub.id!;
  const key = cacheKey(establishmentId, menuId);
  const [menu, setMenu] = useState<MenuData | null>(() => menuCache.get(key) ?? null);
  const [status, setStatus] = useState<LoadStatus>(() => (menuCache.has(key) ? "ready" : "idle"));
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current || menuCache.has(key)) {
      if (menuCache.has(key)) {
        setMenu(menuCache.get(key)!);
        setStatus("ready");
      }
      return;
    }
    loadingRef.current = true;
    setStatus("loading");
    setError(null);
    try {
      const data = await fetchPublicMenu(establishmentId, menuId);
      setMenu(data);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setStatus("error");
    } finally {
      loadingRef.current = false;
    }
  }, [establishmentId, menuId, key]);

  const shouldLoad = loadImmediately || prefetch || (active && status === "idle");

  useEffect(() => {
    if (!shouldLoad || status === "ready" || status === "loading") return;
    void load();
  }, [shouldLoad, status, load]);

  if (status === "ready" && menu) {
    return (
      <MenuView
        menu={menu}
        establishmentName={establishmentName}
        embedded={embedded}
        brandColor={brandColor}
        pageAppearance={pageAppearance}
        isBg={isBg}
        establishmentId={establishmentId}
        qrCodeId={qrCodeId}
        qrLabel={qrLabel}
        isDemo={isDemo}
        pdConsent={pdConsent}
      />
    );
  }

  if (status === "error") {
    return (
      <MenuLoadError
        message={error ?? "Попробуйте позже"}
        onRetry={() => {
          menuCache.delete(key);
          loadingRef.current = false;
          setStatus("idle");
          void load();
        }}
        brandColor={brandColor}
        pageAppearance={pageAppearance}
        isBg={isBg}
      />
    );
  }

  return (
    <MenuLoadingSkeleton
      title={menuStub.title}
      brandColor={brandColor}
      pageAppearance={pageAppearance}
      isBg={isBg}
      embedded={embedded}
    />
  );
}

/** Предзагрузка меню на лендинге (не блокирует UI). */
export function prefetchPublicMenu(establishmentId: string, menuId: string) {
  if (!menuId || menuCache.has(cacheKey(establishmentId, menuId))) return;
  void fetchPublicMenu(establishmentId, menuId).catch(() => {});
}
