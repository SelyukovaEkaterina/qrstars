"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import UxCheckPromoBanner from "@/components/dashboard/UxCheckPromoBanner";
import type { PlanId } from "@/lib/plans";

const START_PATH = "/dashboard/start";
const DESKTOP_QUERY = "(min-width: 1024px)";

/** Событие для внешнего открытия мобильного меню (например, из мобильного тура). */
export const OPEN_DASHBOARD_MENU_EVENT = "qrstars:open-dashboard-menu";

/** Заголовок для мобильной шапки на страницах аккаунта (на страницах проекта — имя проекта). */
const ACCOUNT_TITLES: Array<[string, string]> = [
  ["/dashboard/projects", "Проекты"],
  ["/dashboard/subscription", "Тариф и оплата"],
  ["/dashboard/settings/templates", "Шаблоны оформления"],
  ["/dashboard/settings", "Аккаунт и уведомления"],
  ["/dashboard/partner", "Партнёрская программа"],
  ["/dashboard/support", "Поддержка"],
  ["/dashboard/network", "Сеть: сводка"],
];

function accountTitle(pathname: string): string | null {
  if (pathname.startsWith("/dashboard/projects/")) return null;
  for (const [prefix, title] of ACCOUNT_TITLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title;
  }
  return null;
}

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** На сервере считаем desktop: сайдбар в потоке, без inert. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

export default function DashboardChrome({
  children,
  plan = "FREE",
  hasOrphanQrs = false,
}: {
  children: React.ReactNode;
  plan?: PlanId;
  hasOrphanQrs?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const [projectName, setProjectName] = useState<string | null>(null);
  const isDesktop = useIsDesktop();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  // Переход на другую страницу закрывает меню (подстройка состояния во время рендера).
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    if (menuOpen) setOpen(false);
  }
  // На desktop drawer не используется: сайдбар всегда в потоке.
  const open = menuOpen && !isDesktop;

  useEffect(() => {
    const onOpen = () => {
      if (!window.matchMedia(DESKTOP_QUERY).matches) setOpen(true);
    };
    window.addEventListener(OPEN_DASHBOARD_MENU_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DASHBOARD_MENU_EVENT, onOpen);
  }, []);

  // Escape, блокировка прокрутки страницы и фокус внутри открытого меню.
  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        toggleRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    wasOpenRef.current = true;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const drawer = drawerRef.current;
    const focusables = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);
    focusables()[0]?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (pathname === START_PATH) {
    return <div className="dash-shell-start">{children}</div>;
  }

  const headerTitle = accountTitle(pathname) ?? projectName;
  const drawerHidden = !isDesktop && !open;

  return (
    <div className="dash-shell flex min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="dash-header lg:hidden fixed inset-x-0 z-40 bg-white border-b border-gray-200 flex items-center gap-2 px-2">
        <button
          ref={toggleRef}
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          aria-controls="dashboard-drawer"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <Link href="/dashboard" className="flex shrink-0 items-center" aria-label="QrStars">
          <img
            src="/logo.svg"
            alt="QrStars"
            width={104}
            height={26}
            className="select-none"
            draggable={false}
          />
        </Link>
        {headerTitle && (
          <span
            className="min-w-0 flex-1 truncate border-l border-gray-200 pl-2 pr-2 text-sm font-semibold text-gray-900"
            title={headerTitle}
          >
            {headerTitle}
          </span>
        )}
      </header>

      {open && (
        <div
          aria-hidden
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={close}
        />
      )}

      <div
        id="dashboard-drawer"
        ref={drawerRef}
        inert={drawerHidden}
        role={!isDesktop ? "dialog" : undefined}
        aria-modal={!isDesktop && open ? true : undefined}
        aria-label={!isDesktop ? "Меню кабинета" : undefined}
        className={`dash-drawer fixed lg:static z-50 left-0 w-64 max-w-[85vw] shrink-0 transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Suspense
          fallback={<aside className="w-64 h-full bg-white border-r border-gray-200 lg:min-h-screen" />}
        >
          <Sidebar
            onNavigate={close}
            onClose={!isDesktop ? close : undefined}
            onActiveProjectChange={setProjectName}
            plan={plan}
            initialHasOrphanQrs={hasOrphanQrs}
          />
        </Suspense>
      </div>

      <div className="dash-main flex-1 min-w-0">
        <UxCheckPromoBanner />
        {children}
      </div>
    </div>
  );
}
