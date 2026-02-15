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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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

/* Sidebar class constants (co-located with the component instead of globals.css) */
const sidebarLinkClass =
  "relative flex min-h-9 min-w-0 items-center rounded-[0.625rem] py-1.5 text-[0.8125rem] font-medium text-[hsl(var(--foreground)/0.65)] transition-[background-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[hsl(var(--muted)/0.7)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-[hsl(var(--accent)/0.45)] focus-visible:outline-offset-2";
const sidebarLinkExpanded = "gap-2.5 px-2.5 motion-safe:hover:translate-x-px";
const sidebarLinkCollapsed = "justify-center px-0";
const sidebarLinkActive =
  "bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] font-semibold shadow-none hover:bg-[hsl(var(--accent)/0.15)] hover:text-[hsl(var(--accent))] motion-safe:hover:translate-x-0";
const sidebarIndicatorClass =
  "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-[hsl(var(--accent))] transition-opacity duration-150 ease-in-out";
const sidebarControlBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground/50 transition-[background-color,color] duration-200 hover:bg-[hsl(var(--muted)/0.85)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-[hsl(var(--accent)/0.45)] focus-visible:outline-offset-2";

const fullNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  {
    href: "/admin",
    label: "Admin Queue",
    icon: ShieldCheck,
    roles: ["admin"]
  },
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
  "/admin": "work"
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

  return (
    <span className="absolute -right-2 -top-2 inline-flex min-w-[1.125rem] h-[1.125rem] items-center justify-center rounded-full border-[1.5px] border-card bg-danger px-1 text-white text-[0.625rem] font-bold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/* ─── Sidebar: Brand Header ─── */

function SidebarHeader({ isOpen }: { isOpen: boolean }) {
  const inner = (
    <div className={cn("relative flex items-center gap-2.5 px-2 pt-2.5 pb-2", isOpen ? "pl-3" : "justify-center")}>
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))] transition-[background-color] duration-200 hover:bg-[hsl(var(--accent)/0.18)]">
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
    </div>
  );

  if (isOpen) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>Brosens Family Foundation</TooltipContent>
    </Tooltip>
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

  const inner = (
    <div className={cn("group flex items-center gap-2.5 border-b border-[hsl(var(--border)/0.4)] px-2 pt-2 pb-3 mb-1", isOpen ? "pl-3 pr-3" : "justify-center")}>
      <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold tracking-[0.02em] transition-transform duration-200 group-hover:scale-105", avatarClass)}>
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
    </div>
  );

  if (isOpen) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>{tooltipText}</TooltipContent>
    </Tooltip>
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
  const link = (
    <Link
      href={item.href}
      className={cn(
        sidebarLinkClass,
        isOpen ? sidebarLinkExpanded : sidebarLinkCollapsed,
        active && sidebarLinkActive
      )}
      aria-current={active ? "page" : undefined}
      data-nav-href={item.href}
    >
      <span
        className={cn(
          sidebarIndicatorClass,
          active ? "opacity-100" : "opacity-0"
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
    </Link>
  );

  if (isOpen) return link;

  const tooltipLabel = outstandingCount > 0 ? `${item.label} (${outstandingCount})` : item.label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>{tooltipLabel}</TooltipContent>
    </Tooltip>
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
            <div className={cn("h-px mb-3 bg-[hsl(var(--border)/0.4)]", !isOpen && "mx-auto w-6")} aria-hidden />
          )}
          {isOpen && <span className="block mb-2 pl-3 text-[0.6875rem] font-semibold tracking-[0.06em] uppercase text-[hsl(var(--foreground)/0.38)]">{section.label}</span>}
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
  const link = (
    <Link
      href={href}
      className={cn(
        sidebarLinkClass,
        isOpen ? sidebarLinkExpanded : sidebarLinkCollapsed,
        active && sidebarLinkActive
      )}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          sidebarIndicatorClass,
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <span className="relative inline-flex w-4 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <span className={cn("truncate", !isOpen && "sr-only")}>{label}</span>
    </Link>
  );

  if (isOpen) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
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
        <div className="flex flex-col gap-0.5 border-t border-[hsl(var(--border)/0.4)] pt-2">
          <SidebarFooterLink
            href="/settings"
            label="Settings"
            icon={Settings}
            isOpen={isOpen}
            active={isRouteActive(pathname, "/settings")}
          />

          <div className={cn("flex items-center gap-0.5", isOpen ? "px-1" : "flex-col items-center")}>
            <ThemeToggle className={sidebarControlBtnClass} />
            <button
              onClick={onToggle}
              className={sidebarControlBtnClass}
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
              className={cn(sidebarControlBtnClass, "hover:bg-[hsl(var(--danger)/0.1)] hover:text-[hsl(var(--danger))]")}
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
                className={cn(
                  "flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl p-2 text-[0.6875rem] font-semibold text-[hsl(var(--foreground)/0.72)] transition-[background-color,border-color,color,box-shadow,transform] duration-[180ms] ease-in-out hover:bg-[hsl(var(--muted)/0.8)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-[hsl(var(--accent)/0.45)] focus-visible:outline-offset-2 motion-safe:active:scale-95",
                  active && "bg-accent text-white shadow-[0_10px_20px_-14px_hsl(var(--accent)/1)] hover:bg-accent hover:text-white",
                  showNewProposalCta && "border border-[rgb(var(--proposal-cta-border)/0.56)] bg-[rgb(var(--proposal-cta)/0.12)] text-[rgb(var(--proposal-cta-hover))] shadow-[0_10px_20px_-16px_rgb(var(--proposal-cta)/0.95)] dark:border-[rgb(var(--proposal-cta-border)/0.62)] dark:bg-[rgb(var(--proposal-cta)/0.2)] dark:text-[rgb(var(--proposal-cta-foreground))] dark:shadow-[0_12px_22px_-16px_rgb(var(--proposal-cta)/1)]"
                )}
                aria-current={active ? "page" : undefined}
                data-nav-href={item.href}
              >
                <span className={cn("relative inline-flex", showNewProposalCta && "h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--proposal-cta))] text-[rgb(var(--proposal-cta-foreground))] shadow-[0_6px_12px_-8px_rgb(var(--proposal-cta)/1)] motion-safe:animate-[sidebar-cta-pulse_900ms_ease-out_1]")}>
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
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Brosens Family Foundation</p>
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
