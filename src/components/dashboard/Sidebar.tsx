"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Settings,
  BarChart3,
  QrCode,
  LogOut,
  Star,
  Layout,
  Users,
  HelpCircle,
  Headphones,
  CreditCard,
  Bell,
  ExternalLink,
  ChevronDown,
  Plus,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { signOutTo } from "@/lib/sign-out-client";
import {
  LAST_PROJECT_COOKIE,
  UNASSIGNED_PROJECT_ID,
  isUnassignedProjectId,
  micrositePublicUrl,
  parseProjectIdFromPath,
  projectHomePath,
  projectInboxPath,
  projectPagePath,
  projectQrcodesPath,
  projectSettingsPath,
  projectStatsPath,
} from "@/lib/project-routes";
import { TEMPLATE_ROUTES } from "@/lib/template-routes";
import { useProjectScope } from "@/components/dashboard/ProjectScope";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  tourId?: string;
  badgeKey?: "submissions" | "support";
  isActive?: (pathname: string, search?: string) => boolean;
};

type ProjectListItem = {
  id: string;
  name: string;
  shortSlug?: string | null;
};

function defaultIsActive(href: string, pathname: string): boolean {
  if (href === "/dashboard/projects") {
    return pathname === "/dashboard/projects";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readStoredProjectId(): string | null {
  try {
    const fromStorage = localStorage.getItem(LAST_PROJECT_COOKIE);
    if (fromStorage) return fromStorage;
  } catch {
    /* private mode */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${LAST_PROJECT_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = useProjectScope();
  const [submissionsUnread, setSubmissionsUnread] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);
  const [projects, setProjects] = useState<ProjectListItem[]>(scope?.projects ?? []);
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);
  const [hasOrphanQrs, setHasOrphanQrs] = useState(false);

  const urlProjectId = parseProjectIdFromPath(pathname);
  const storedProjectExists =
    Boolean(storedProjectId) &&
    (isUnassignedProjectId(storedProjectId)
      ? hasOrphanQrs
      : projects.some((p) => p.id === storedProjectId));
  const activeProjectId =
    urlProjectId ||
    scope?.projectId ||
    (storedProjectExists ? storedProjectId : null) ||
    projects[0]?.id ||
    (hasOrphanQrs ? UNASSIGNED_PROJECT_ID : null);
  const activeProject =
    projects.find((p) => p.id === activeProjectId) ||
    (scope && scope.projectId === activeProjectId
      ? { id: scope.projectId, name: scope.projectName, shortSlug: scope.shortSlug }
      : null);
  const inUnassigned = isUnassignedProjectId(activeProjectId);
  const showProjectNav = projects.length > 0 || hasOrphanQrs || Boolean(urlProjectId);
  const micrositeHref = micrositePublicUrl(activeProject?.shortSlug ?? scope?.shortSlug);

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
    setStoredProjectId(readStoredProjectId());
    fetch("/api/establishments")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.establishments) {
          setProjects(
            data.establishments.map((e: ProjectListItem) => ({
              id: e.id,
              name: e.name,
              shortSlug: e.shortSlug ?? null,
            })),
          );
        }
      })
      .catch(() => {});
    fetch("/api/qrcodes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = data?.qrcodes || [];
        setHasOrphanQrs(list.some((q: { establishmentId: string | null }) => !q.establishmentId));
      })
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

  const projectNav: NavLink[] = inUnassigned
    ? [
        {
          href: projectQrcodesPath(UNASSIGNED_PROJECT_ID),
          label: "QR-коды",
          icon: QrCode,
          tourId: "tour-nav-qrcodes",
        },
      ]
    : activeProjectId
      ? [
          {
            href: projectHomePath(activeProjectId),
            label: "Главная",
            icon: LayoutDashboard,
            tourId: "tour-nav-dashboard",
            isActive: (p) => p === projectHomePath(activeProjectId),
          },
          {
            href: projectQrcodesPath(activeProjectId),
            label: "QR-коды",
            icon: QrCode,
            tourId: "tour-nav-qrcodes",
          },
          {
            href: projectPagePath(activeProjectId),
            label: "Микросайт",
            icon: Layout,
            tourId: "tour-nav-my-page",
          },
          {
            href: projectInboxPath(activeProjectId),
            label: "Обратная связь",
            icon: Star,
            tourId: "tour-nav-reviews",
            badgeKey: "submissions",
          },
          {
            href: projectStatsPath(activeProjectId),
            label: "Статистика",
            icon: BarChart3,
            tourId: "tour-nav-analytics",
          },
          {
            href: projectSettingsPath(activeProjectId),
            label: "Настройки проекта",
            icon: Settings,
            tourId: "tour-nav-establishments",
          },
        ]
      : [];

  const accountNav: NavLink[] = [
    {
      href: "/dashboard/subscription",
      label: "Тариф и оплата",
      icon: CreditCard,
      tourId: "tour-nav-subscription",
    },
    {
      href: "/dashboard/settings",
      label: "Каналы уведомлений",
      icon: Bell,
      tourId: "tour-nav-settings",
      isActive: (p) => p === "/dashboard/settings",
    },
    {
      href: TEMPLATE_ROUTES.qr,
      label: "Шаблоны оформления",
      icon: Palette,
      tourId: "tour-nav-templates",
    },
    {
      href: "/dashboard/partner",
      label: "Партнёрская программа",
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
  ];

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

  const renderLinks = (items: NavLink[]) => (
    <div className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.isActive
          ? item.isActive(pathname, searchParams.toString())
          : defaultIsActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            id={item.tourId}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors px-3 py-2.5",
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {renderBadge(item)}
          </Link>
        );
      })}
    </div>
  );

  return (
    <aside className="w-64 h-full bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div id="tour-sidebar-logo" className="p-6 border-b border-gray-100">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center" aria-label="QrStars">
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
        {showProjectNav && (
          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Проект
              </p>
              <Link
                href="/dashboard/projects?create=1"
                onClick={onNavigate}
                className="-mr-1 flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
                aria-label="Создать проект"
                title="Создать проект"
              >
                <Plus className="h-4 w-4" />
              </Link>
            </div>
            {(projects.length > 1 || hasOrphanQrs) && (
              <div className="px-1 mb-3">
                <label className="relative block">
                  <select
                    value={activeProjectId || ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      onNavigate?.();
                      window.location.href = isUnassignedProjectId(next)
                        ? projectQrcodesPath(UNASSIGNED_PROJECT_ID)
                        : projectHomePath(next);
                    }}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-8 text-sm font-medium text-gray-900"
                    aria-label="Выбрать проект"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                    {hasOrphanQrs && (
                      <option value={UNASSIGNED_PROJECT_ID}>Без проекта</option>
                    )}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </label>
              </div>
            )}
            {activeProject && projects.length <= 1 && !hasOrphanQrs && (
              <p className="px-3 mb-3 text-sm font-semibold text-gray-900 truncate">
                {inUnassigned ? "Без проекта" : activeProject.name}
              </p>
            )}
            {micrositeHref && !inUnassigned && (
              <a
                href={micrositeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 mx-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                <ExternalLink className="h-4 w-4" />
                Открыть микросайт
              </a>
            )}
            {renderLinks(projectNav)}
          </div>
        )}

        <div className="mb-5">
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Аккаунт
          </p>
          {renderLinks(accountNav)}
        </div>
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-1">
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
