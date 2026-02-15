"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  FileText,
  HandCoins,
  Home,
  Leaf,
  ListChecks,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Vote
} from "lucide-react";
import useSWR from "swr";
import { ComponentType, PropsWithChildren, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { RolePill } from "@/components/ui/role-pill";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AppRole, NavigationSummarySnapshot, UserProfile } from "@/lib/types";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const roleAvatarClasses: Record<AppRole, string> = {
  member: "bg-[hsl(var(--role-member)/0.14)] text-[hsl(var(--role-member))]",
  oversight: "bg-[hsl(var(--role-oversight)/0.14)] text-[hsl(var(--role-oversight))]",
  admin: "bg-[hsl(var(--role-admin)/0.14)] text-[hsl(var(--role-admin))]",
  manager: "bg-[hsl(var(--role-manager)/0.14)] text-[hsl(var(--role-manager))]"
};

type NavItem = {
  href: Route;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  roles?: AppRole[];
};

type NavOutstandingCounts = Partial<Record<Route, number>>;
type NavSectionId = "work" | "governance" | "system";

interface NavSection {
  id: NavSectionId;
  label: string;
  items: NavItem[];
}

const DESKTOP_SIDEBAR_STORAGE_KEY = "bf_desktop_sidebar_open";

const fullNavItems: NavItem[] = [
  {
    href: "/admin",
    label: "Admin Queue",
    icon: ShieldCheck,
    roles: ["admin"]
  },
  { href: "/dashboard", label: "Dashboard", icon: Home },
  {
    href: "/workspace",
    label: "My Workspace",
    icon: ListChecks,
    roles: ["member", "oversight", "manager"]
  },
  {
    href: "/meeting",
    label: "Meeting",
    icon: Vote,
    roles: ["oversight", "manager"]
  },
  {
    href: "/reports" as Route,
    label: "Reports",
    icon: FileText,
    roles: ["oversight", "manager"]
  },
  {
    href: "/frank-deenie" as Route,
    label: "Frank & Deenie",
    icon: HandCoins,
    roles: ["oversight", "admin", "manager"]
  },
  {
    href: "/mandate" as Route,
    label: "Mandate",
    icon: ScrollText,
    roles: ["member", "oversight", "manager", "admin"]
  }
];

const focusNavItems: NavItem[] = [
  { href: "/mobile" as Route, label: "Home", icon: Home },
  {
    href: "/meeting" as Route,
    label: "Meeting",
    icon: Vote,
    roles: ["oversight"]
  },
  {
    href: "/proposals/new",
    label: "New Proposal",
    icon: Plus,
    roles: ["member", "oversight", "manager", "admin"]
  },
  { href: "/dashboard", label: "Full Details", icon: FileText }
];

const fullNavSections: Array<{ id: NavSectionId; label: string }> = [
  { id: "work", label: "Work" },
  { id: "governance", label: "Governance" }
];

const fullNavSectionByHref: Record<string, NavSectionId> = {
  "/dashboard": "work",
  "/workspace": "work",
  "/meeting": "work",
  "/reports": "work",
  "/frank-deenie": "governance",
  "/mandate": "governance",
  "/admin": "governance"
};

function groupFullNavItems(items: NavItem[]): NavSection[] {
  const grouped = {
    work: [] as NavItem[],
    governance: [] as NavItem[],
    system: [] as NavItem[]
  };

  for (const item of items) {
    const section = fullNavSectionByHref[item.href] ?? "work";
    grouped[section].push(item);
  }

  return fullNavSections
    .map((section) => ({
      ...section,
      items: grouped[section.id]
    }))
    .filter((section) => section.items.length > 0);
}

function isRouteActive(pathname: string, href: Route) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function OutstandingBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return <span className="nav-outstanding-badge">{count > 99 ? "99+" : count}</span>;
}

/* ─── Sidebar: Brand Header ─── */

function SidebarHeader({ isOpen }: { isOpen: boolean }) {
  return (
    <div className={cn("sidebar-header", isOpen ? "sidebar-header--expanded" : "sidebar-header--collapsed")}>
      <span className="sidebar-header__monogram">
        <Leaf className="h-4 w-4" strokeWidth={2} />
      </span>
      <span
        className={cn(
          "min-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold tracking-tight text-foreground transition-all duration-300",
          isOpen ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"
        )}
      >
        Brosens Foundation
      </span>
      {!isOpen && (
        <span className="sidebar-link__tooltip" aria-hidden>
          Brosens Family Foundation
        </span>
      )}
    </div>
  );
}

/* ─── Sidebar: User Identity ─── */

interface SidebarUserCardProps {
  isOpen: boolean;
  user: UserProfile | null;
}

function SidebarUserCard({ isOpen, user }: SidebarUserCardProps) {
  const initials = user ? getInitials(user.name) : "?";
  const avatarClass = user ? roleAvatarClasses[user.role] : "bg-muted text-foreground/50";
  const tooltipText = user ? `${user.name} (${user.role})` : "Not signed in";

  return (
    <div className={cn("sidebar-user-card", isOpen ? "sidebar-user-card--expanded" : "sidebar-user-card--collapsed")}>
      <span
        className={cn("sidebar-user-avatar", avatarClass)}
        title={isOpen ? undefined : tooltipText}
      >
        {initials}
      </span>
      <div
        className={cn(
          "min-w-0 overflow-hidden transition-all duration-300",
          isOpen ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"
        )}
      >
        {user && (
          <>
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{user.name}</p>
            <div className="mt-1">
              <RolePill role={user.role} />
            </div>
          </>
        )}
      </div>
      {!isOpen && user && (
        <span className="sidebar-link__tooltip" aria-hidden>
          {user.name}
        </span>
      )}
    </div>
  );
}

/* ─── Sidebar: Nav Link ─── */

interface DesktopNavLinkProps {
  item: NavItem;
  isOpen: boolean;
  active: boolean;
  outstandingCount: number;
}

function DesktopNavLink({ item, isOpen, active, outstandingCount }: DesktopNavLinkProps) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      className={cn(
        "sidebar-link",
        isOpen ? "sidebar-link--expanded" : "sidebar-link--collapsed",
        active && "sidebar-link--active"
      )}
      title={isOpen ? undefined : item.label}
      aria-current={active ? "page" : undefined}
      data-nav-href={item.href}
    >
      <span
        className={cn(
          "sidebar-link__active-indicator",
          active ? "sidebar-link__active-indicator--visible" : "sidebar-link__active-indicator--hidden"
        )}
      />
      <span className="relative inline-flex w-4 shrink-0 items-center justify-center">
        <item.icon className="h-4 w-4" strokeWidth={1.5} />
        {!isOpen && <OutstandingBadge count={outstandingCount} />}
      </span>
      <span className={cn("truncate", !isOpen && "sr-only")}>{item.label}</span>
      {isOpen && outstandingCount > 0 && (
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger/15 px-1.5 text-[10px] font-bold text-danger">
          {outstandingCount > 99 ? "99+" : outstandingCount}
        </span>
      )}
      {!isOpen ? (
        <span className="sidebar-link__tooltip" aria-hidden>
          {item.label}
          {outstandingCount > 0 && ` (${outstandingCount})`}
        </span>
      ) : null}
    </Link>
  );
}

/* ─── Sidebar: Navigation Sections ─── */

interface DesktopSidebarNavProps {
  pathname: string;
  isOpen: boolean;
  sections: NavSection[];
  outstandingByHref: NavOutstandingCounts;
}

function DesktopSidebarNav({ pathname, isOpen, sections, outstandingByHref }: DesktopSidebarNavProps) {
  return (
    <nav id="desktop-sidebar-navigation" className="min-h-0 flex-1 overflow-y-auto px-1 pb-2" aria-label="Primary">
      {sections.map((section, sectionIndex) => (
        <section key={section.id} className={cn(sectionIndex > 0 && "mt-4")}>
          {sectionIndex > 0 && (
            <div className={cn("sidebar-section-divider", !isOpen && "mx-auto w-6")} aria-hidden />
          )}
          {isOpen && <span className="sidebar-section-label">{section.label}</span>}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isRouteActive(pathname, item.href);
              const outstandingCount = outstandingByHref[item.href] ?? 0;
              return (
                <li key={item.href} className="min-w-0">
                  <DesktopNavLink
                    item={item}
                    isOpen={isOpen}
                    active={active}
                    outstandingCount={outstandingCount}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

/* ─── Sidebar: Footer Link ─── */

function SidebarFooterLink({
  href,
  label,
  icon: Icon,
  isOpen,
  active
}: {
  href: Route;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  isOpen: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "sidebar-link",
        isOpen ? "sidebar-link--expanded" : "sidebar-link--collapsed",
        active && "sidebar-link--active"
      )}
      title={isOpen ? undefined : label}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          "sidebar-link__active-indicator",
          active ? "sidebar-link__active-indicator--visible" : "sidebar-link__active-indicator--hidden"
        )}
      />
      <span className="relative inline-flex w-4 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <span className={cn("truncate", !isOpen && "sr-only")}>{label}</span>
      {!isOpen && (
        <span className="sidebar-link__tooltip" aria-hidden>
          {label}
        </span>
      )}
    </Link>
  );
}

/* ─── Sidebar: Desktop Sidebar Shell ─── */

interface DesktopSidebarProps {
  user: UserProfile | null;
  pathname: string;
  isOpen: boolean;
  sections: NavSection[];
  outstandingByHref: NavOutstandingCounts;
  onToggle: () => void;
  onSignOut: () => void;
}

function DesktopSidebar({
  user,
  pathname,
  isOpen,
  sections,
  outstandingByHref,
  onToggle,
  onSignOut
}: DesktopSidebarProps) {
  return (
    <aside
      className={cn(
        "sticky top-4 hidden max-h-[calc(100vh-2rem)] shrink-0 overflow-hidden print:hidden sm:flex sm:transition-[width] sm:duration-300 sm:ease-[cubic-bezier(0.4,0,0.2,1)]",
        isOpen ? "w-60" : "w-16"
      )}
    >
      <div className="glass-card flex h-full w-full flex-col rounded-3xl p-2">
        {/* Zone 1: Brand header */}
        <SidebarHeader isOpen={isOpen} />

        {/* Zone 2: User identity */}
        <SidebarUserCard isOpen={isOpen} user={user} />

        {/* Zone 3: Navigation sections */}
        <DesktopSidebarNav
          pathname={pathname}
          isOpen={isOpen}
          sections={sections}
          outstandingByHref={outstandingByHref}
        />

        {/* Zone 4: Footer utilities */}
        <div className="sidebar-footer">
          <SidebarFooterLink
            href="/settings"
            label="Settings"
            icon={Settings}
            isOpen={isOpen}
            active={isRouteActive(pathname, "/settings")}
          />

          <div className={cn("sidebar-footer__controls", isOpen ? "sidebar-footer__controls--expanded" : "sidebar-footer__controls--collapsed")}>
            <ThemeToggle className="sidebar-control-button" />
            <button
              onClick={onToggle}
              className="sidebar-control-button"
              type="button"
              aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={isOpen}
              aria-controls="desktop-sidebar-navigation"
            >
              {isOpen ? (
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
            <button
              onClick={onSignOut}
              className="sidebar-control-button sidebar-control-button--danger"
              type="button"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

interface MobileBottomNavProps {
  pathname: string;
  navItems: NavItem[];
  outstandingByHref: NavOutstandingCounts;
}

function MobileBottomNav({ pathname, navItems, outstandingByHref }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-card px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-soft print:hidden sm:hidden"
      aria-label="Mobile primary navigation"
    >
      <ul
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(navItems.length, 1)}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const active = isRouteActive(pathname, item.href);
          const outstandingCount = outstandingByHref[item.href] ?? 0;
          const isNewProposalShortcut = item.href === "/proposals/new";
          const showNewProposalCta = isNewProposalShortcut && !active;
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                prefetch={false}
                className={cn(
                  "mobile-nav-link",
                  active && "mobile-nav-link--active",
                  showNewProposalCta && "mobile-nav-link--cta"
                )}
                aria-current={active ? "page" : undefined}
                data-nav-href={item.href}
              >
                <span className={cn("mobile-nav-link__icon", showNewProposalCta && "mobile-nav-link__icon--cta")}>
                  <item.icon className="h-4 w-4" strokeWidth={1.5} />
                  <OutstandingBadge count={outstandingCount} />
                </span>
                <span className="max-w-[4.25rem] truncate text-[10px] leading-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isSmallViewport, setIsSmallViewport] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const syncViewport = () => setIsSmallViewport(mediaQuery.matches);

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY);

    if (storedPreference === "0") {
      setIsDesktopSidebarOpen(false);
    }

    if (storedPreference === "1") {
      setIsDesktopSidebarOpen(true);
    }

    setHasLoadedSidebarPreference(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSidebarPreference) {
      return;
    }

    window.localStorage.setItem(DESKTOP_SIDEBAR_STORAGE_KEY, isDesktopSidebarOpen ? "1" : "0");
  }, [hasLoadedSidebarPreference, isDesktopSidebarOpen]);

  const availableFullNav = useMemo(() => {
    if (!user) {
      return [];
    }

    return fullNavItems.filter((item) => !item.roles || item.roles.includes(user.role));
  }, [user]);

  const availableFocusNav = useMemo(() => {
    if (!user) {
      return [];
    }

    return focusNavItems.filter((item) => !item.roles || item.roles.includes(user.role));
  }, [user]);
  const desktopNavSections = useMemo(() => groupFullNavItems(availableFullNav), [availableFullNav]);

  const showMobileFocusNav =
    isSmallViewport &&
    (pathname.startsWith("/mobile") ||
      pathname.startsWith("/meeting") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/proposals/new"));
  const hideShellHeader =
    isSmallViewport &&
    (pathname.startsWith("/mobile") ||
      pathname.startsWith("/meeting") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/proposals/new"));
  const renderedNav = showMobileFocusNav ? availableFocusNav : availableFullNav;
  const { data: navigationSummary } = useSWR<NavigationSummarySnapshot>(
    user ? "/api/navigation/summary" : null,
    { refreshInterval: 120_000 }
  );

  const outstandingByHref = useMemo(
    () =>
      ({
        "/dashboard": navigationSummary?.dashboardToReviewCount ?? 0,
        "/mobile": navigationSummary?.workspaceActionItemsCount ?? 0,
        "/workspace": navigationSummary?.workspaceActionItemsCount ?? 0,
        "/meeting": navigationSummary?.meetingToReviewCount ?? 0,
        "/reports": 0,
        "/frank-deenie": 0,
        "/mandate": navigationSummary?.pendingPolicyNotificationsCount ?? 0,
        "/admin": navigationSummary?.adminApprovedCount ?? 0,
        "/settings": 0,
        "/proposals/new": 0
      }) as NavOutstandingCounts,
    [navigationSummary]
  );

  return (
    <div
      className="page-enter flex min-h-screen w-full flex-col px-3 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:items-start sm:gap-4 sm:pl-0 sm:pr-6 sm:pb-8"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
    >
      <DesktopSidebar
        user={user}
        pathname={pathname}
        isOpen={isDesktopSidebarOpen}
        sections={desktopNavSections}
        outstandingByHref={outstandingByHref}
        onToggle={() => setIsDesktopSidebarOpen((current) => !current)}
        onSignOut={() => void signOut()}
      />

      <div className="min-w-0 flex-1">
        {hideShellHeader ? null : (
          <header className="glass-card mb-4 rounded-3xl p-4 print:hidden sm:hidden">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Brosens Family Foundation</p>
                <h1 className="text-xl font-semibold">Grant Management</h1>
                {user ? (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span>{user.name}</span>
                    <RolePill role={user.role} />
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-semibold"
                  type="button"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            </div>
          </header>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <MobileBottomNav pathname={pathname} navItems={renderedNav} outstandingByHref={outstandingByHref} />
    </div>
  );
}
