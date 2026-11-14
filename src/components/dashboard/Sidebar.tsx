"use client";

import { useCallback, useEffect, useState } from "react";
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
  Network,
  X,
  Contact,
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
  projectCardPath,
  projectQrcodesPath,
  projectSettingsPath,
  projectStatsPath,
} from "@/lib/project-routes";
import { TEMPLATE_ROUTES } from "@/lib/template-routes";
import { useProjectScope } from "@/components/dashboard/ProjectScope";
import type { PlanId } from "@/lib/plans";

/** Диспатчить после создания / переименования / удаления проекта или QR без проекта. */
export const PROJECTS_CHANGED_EVENT = "qrstars:projects-changed";

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
  hasBusinessCard?: boolean;
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

type SidebarProps = {
  onNavigate?: () => void;
  /** Только в мобильном drawer: кнопка «Закрыть» в шапке меню. */
  onClose?: () => void;
  /** Имя активного проекта — для мобильной шапки кабинета. */
  onActiveProjectChange?: (name: string | null) => void;
  plan?: PlanId;
  /** Есть ли QR без проекта (считается на сервере в dashboard/layout). */
  initialHasOrphanQrs?: boolean;
};

export default function Sidebar({
  onNavigate,
  onClose,
  onActiveProjectChange,
  plan = "FREE",
  initialHasOrphanQrs = false,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = useProjectScope();
  const [submissionsUnread, setSubmissionsUnread] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);
  const [projects, setProjects] = useState<ProjectListItem[]>(scope?.projects ?? []);
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);
  const [hasOrphanQrs, setHasOrphanQrs] = useState(initialHasOrphanQrs);

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

  const unreadProjectId =
    activeProjectId && !isUnassignedProjectId(activeProjectId) ? activeProjectId : null;
  const activeProjectName = inUnassigned ? "Без проекта" : (activeProject?.name ?? null);

  useEffect(() => {
    onActiveProjectChange?.(activeProjectName);
  }, [activeProjectName, onActiveProjectChange]);

  // Свежее значение с сервера (router.refresh / новый layout) перекрывает локальное.
  const [orphanPropSeen, setOrphanPropSeen] = useState(initialHasOrphanQrs);
  if (orphanPropSeen !== initialHasOrphanQrs) {
    setOrphanPropSeen(initialHasOrphanQrs);
    setHasOrphanQrs(initialHasOrphanQrs);
  }

  const refreshSubmissionsUnread = useCallback(() => {
    if (!unreadProjectId) return;
    fetch(`/api/form-submissions/unread-count?establishmentId=${encodeURIComponent(unreadProjectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSubmissionsUnread(data.unreadCount || 0);
      })
      .catch(() => {});
  }, [unreadProjectId]);

  const refreshSupportUnread = useCallback(() => {
    fetch("/api/support/unread-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSupportUnread(data.unreadCount || 0);
      })
      .catch(() => {});
  }, []);

  // Список проектов — один раз при монтировании и по событию PROJECTS_CHANGED_EVENT
  // (раньше перезапрашивался на каждую смену pathname вместе с полным /api/qrcodes).
  useEffect(() => {
    setStoredProjectId(readStoredProjectId());
    const loadProjects = () =>
      fetch("/api/establishments")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.establishments) {
            setProjects(
              data.establishments.map((e: ProjectListItem) => ({
                id: e.id,
                name: e.name,
                shortSlug: e.shortSlug ?? null,
                hasBusinessCard: !!e.hasBusinessCard,
              })),
            );
          }
        })
        .catch(() => {});
    loadProjects();
    const onProjectsChanged = () => {
      loadProjects();
      fetch("/api/qrcodes")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const list = data?.qrcodes;
          if (Array.isArray(list)) {
            setHasOrphanQrs(list.some((q: { establishmentId: string | null }) => !q.establishmentId));
          }
        })
        .catch(() => {});
    };
    window.addEventListener(PROJECTS_CHANGED_EVENT, onProjectsChanged);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, onProjectsChanged);
  }, []);

  useEffect(() => {
    refreshSubmissionsUnread();
    const onUnread = (e: Event) => {
      const count = (e as CustomEvent<number>).detail;
      if (typeof count === "number") setSubmissionsUnread(count);
      else refreshSubmissionsUnread();
    };
    window.addEventListener("submissions-unread-changed", onUnread);
    return () => window.removeEventListener("submissions-unread-changed", onUnread);
  }, [refreshSubmissionsUnread]);

  useEffect(() => {
    refreshSupportUnread();
    const onSupportUnread = (e: Event) => {
      const count = (e as CustomEvent<number>).detail;
      if (typeof count === "number") setSupportUnread(count);
      else refreshSupportUnread();
    };
    window.addEventListener("support-unread-changed", onSupportUnread);
    return () => window.removeEventListener("support-unread-changed", onSupportUnread);
  }, [refreshSupportUnread]);

  const handleHelpClick = () => {
    // На мобильном закрываем drawer, иначе тур откроется под ним.
    onNavigate?.();
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
          ...(projects.find((p) => p.id === activeProjectId)?.hasBusinessCard
            ? [
                {
                  href: projectCardPath(activeProjectId),
                  label: "Визитка",
                  icon: Contact,
                  tourId: "tour-nav-card",
                } satisfies NavLink,
              ]
            : []),
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
    ...(plan === "NETWORK"
      ? [
          {
            href: "/dashboard/network",
            label: "Сеть: сводка",
            icon: Network,
            tourId: "tour-nav-network",
          } satisfies NavLink,
        ]
      : []),
    {
      href: "/dashboard/subscription",
      label: "Тариф и оплата",
      icon: CreditCard,
      tourId: "tour-nav-subscription",
    },
    {
      href: "/dashboard/settings",
      label: "Аккаунт и уведомления",
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
    if (item.badgeKey === "submissions" && unreadProjectId && submissionsUnread > 0) {
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
              "flex min-h-11 items-center gap-3 rounded-lg text-sm font-medium transition-colors px-3 py-2.5 lg:min-h-10",
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="min-w-0 flex-1">{item.label}</span>
            {renderBadge(item)}
          </Link>
        );
      })}
    </div>
  );

  return (
    <aside className="dash-drawer-safe-top w-64 max-w-full h-full bg-white border-r border-gray-200 lg:min-h-screen flex flex-col">
      <div
        id="tour-sidebar-logo"
        className="flex items-center justify-between gap-2 border-b border-gray-100 px-6 py-4 lg:p-6"
      >
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
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть меню"
            className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav id="tour-sidebar-nav" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {showProjectNav && (
          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Проект
              </p>
              <Link
                href="/dashboard/projects?create=1"
                onClick={onNavigate}
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 lg:-mr-1 lg:h-6 lg:w-6 lg:rounded-md"
                aria-label="Создать проект"
                title="Создать проект"
              >
                <Plus className="h-5 w-5 lg:h-4 lg:w-4" />
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
                    className="min-h-11 w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-8 text-sm font-medium text-gray-900 lg:min-h-0"
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
                className="mb-3 mx-1 flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 lg:min-h-0"
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

      <div className="space-y-1 border-t border-gray-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          id="tour-nav-help"
          onClick={handleHelpClick}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 lg:min-h-10"
        >
          <HelpCircle className="w-5 h-5" />
          Помощь
        </button>
        <button
          type="button"
          onClick={() => signOutTo("/login")}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 lg:min-h-10"
        >
          <LogOut className="w-5 h-5" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
