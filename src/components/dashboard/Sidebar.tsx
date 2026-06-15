"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import PlanBadge from "@/components/dashboard/PlanBadge";
import {
  LayoutDashboard,
  Settings,
  BarChart3,
  QrCode,
  LogOut,
  Store,
  Palette,
  LayoutTemplate,
  Star,
  Layout,
  Users,
  HelpCircle,
  Inbox,
  Headphones,
  type LucideIcon,
} from "lucide-react";
import { signOutTo } from "@/lib/sign-out-client";
import {
  isTableTentTemplateEditorPath,
  TEMPLATE_ROUTES,
} from "@/lib/template-routes";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  tourId?: string;
  badgeKey?: "submissions" | "support";
  sub?: boolean;
  featured?: boolean;
  isActive?: (pathname: string) => boolean;
};

type NavSection = {
  title: string;
  items: NavLink[];
};

function defaultIsActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const navSections: NavSection[] = [
  {
    title: "Обзор",
    items: [
      {
        href: "/dashboard",
        label: "Сводка",
        icon: LayoutDashboard,
        tourId: "tour-nav-dashboard",
        isActive: (p) => p === "/dashboard",
      },
      {
        href: "/dashboard/analytics",
        label: "Аналитика",
        icon: BarChart3,
        tourId: "tour-nav-analytics",
      },
    ],
  },
  {
    title: "Заведение",
    items: [
      {
        href: "/dashboard/establishments",
        label: "Заведения",
        icon: Store,
        tourId: "tour-nav-establishments",
      },
      {
        href: "/dashboard/my-page",
        label: "Моя страница",
        icon: Layout,
        tourId: "tour-nav-my-page",
      },
    ],
  },
  {
    title: "QR-коды",
    items: [
      {
        href: "/dashboard/qrcodes",
        label: "Все коды",
        icon: QrCode,
        tourId: "tour-nav-qrcodes",
        featured: true,
      },
    ],
  },
  {
    title: "Обратная связь",
    items: [
      {
        href: "/dashboard/reviews",
        label: "Отзывы",
        icon: Star,
        tourId: "tour-nav-reviews",
      },
      {
        href: "/dashboard/submissions",
        label: "Заявки",
        icon: Inbox,
        tourId: "tour-nav-submissions",
        badgeKey: "submissions",
      },
    ],
  },
  {
    title: "Инструменты",
    items: [
      {
        href: TEMPLATE_ROUTES.qr,
        label: "Шаблоны QR-кода",
        icon: Palette,
        tourId: "tour-nav-templates-qr",
        isActive: (p) =>
          p === TEMPLATE_ROUTES.qr || p.startsWith(`${TEMPLATE_ROUTES.qr}/`),
      },
      {
        href: TEMPLATE_ROUTES.tableTents,
        label: "Шаблоны табличек",
        icon: LayoutTemplate,
        tourId: "tour-nav-templates-table-tents",
        isActive: (p) =>
          p === TEMPLATE_ROUTES.tableTents ||
          p.startsWith(`${TEMPLATE_ROUTES.tableTents}/`) ||
          isTableTentTemplateEditorPath(p),
      },
    ],
  },
  {
    title: "Аккаунт",
    items: [
      {
        href: "/dashboard/settings",
        label: "Настройки",
        icon: Settings,
        tourId: "tour-nav-settings",
      },
      {
        href: "/dashboard/partner",
        label: "Партнёрка",
        icon: Users,
        tourId: "tour-nav-partner",
      },
      {
        href: "/dashboard/support",
        label: "Поддержка",
        icon: Headphones,
        tourId: "tour-nav-support",
        badgeKey: "support",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [currentPlan, setCurrentPlan] = useState<string>("FREE");
  const [submissionsUnread, setSubmissionsUnread] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);

  const refreshUnread = () => {
    fetch("/api/form-submissions/unread-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSubmissionsUnread(data.unreadCount || 0);
      })
      .catch(() => {});
    fetch("/api/support/unread-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSupportUnread(data.unreadCount || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((data) => setCurrentPlan(data.plan || "FREE"))
      .catch(() => {});
    refreshUnread();
    const onUnread = (e: Event) => {
      const count = (e as CustomEvent<number>).detail;
      if (typeof count === "number") setSubmissionsUnread(count);
      else refreshUnread();
    };
    const onSupportUnread = (e: Event) => {
      const count = (e as CustomEvent<number>).detail;
      if (typeof count === "number") setSupportUnread(count);
      else refreshUnread();
    };
    window.addEventListener("submissions-unread-changed", onUnread);
    window.addEventListener("support-unread-changed", onSupportUnread);
    return () => {
      window.removeEventListener("submissions-unread-changed", onUnread);
      window.removeEventListener("support-unread-changed", onSupportUnread);
    };
  }, [pathname]);

  const handleHelpClick = () => {
    window.dispatchEvent(new Event("start-onboarding-tour"));
  };

  const renderBadge = (item: NavLink) => {
    if (item.badgeKey === "submissions" && submissionsUnread > 0) {
      return (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">
          {submissionsUnread > 99 ? "99+" : submissionsUnread}
        </span>
      );
    }
    if (item.badgeKey === "support" && supportUnread > 0) {
      return (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">
          {supportUnread > 99 ? "99+" : supportUnread}
        </span>
      );
    }
    return null;
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div id="tour-sidebar-logo" className="p-6 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center" aria-label="QrStars">
          <img
            src="/logo.svg"
            alt="QrStars"
            width={138}
            height={34}
            className="select-none"
            draggable={false}
          />
        </Link>
      </div>

      <nav id="tour-sidebar-nav" className="flex-1 p-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.isActive
                  ? item.isActive(pathname)
                  : defaultIsActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    id={item.tourId}
                    className={cn(
                      "flex items-center gap-3 rounded-lg text-sm transition-colors",
                      item.sub ? "pl-9 pr-3 py-2" : "px-3 py-2.5",
                      item.featured
                        ? cn(
                            "font-semibold border shadow-sm",
                            isActive
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300"
                          )
                        : cn(
                            "font-medium",
                            isActive
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          )
                    )}
                  >
                    <Icon
                      className={cn(
                        "shrink-0",
                        item.sub ? "w-4 h-4" : "w-5 h-5",
                        item.featured && isActive && "text-white"
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {renderBadge(item)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-3">
        <div
          id="tour-nav-subscription"
          className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100"
        >
          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
            Тариф
          </p>
          <PlanBadge plan={currentPlan} showChangeLink compact />
        </div>
        <button
          id="tour-nav-help"
          onClick={handleHelpClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
          Помощь
        </button>
        <button
          onClick={() => signOutTo("/login")}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
