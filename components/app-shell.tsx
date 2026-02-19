"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  HandCoins,
  Home,
  Leaf,
  ListChecks,
  LogOut,
  PanelLeftClose,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Vote
} from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";
import { ComponentType, PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { RolePill } from "@/components/ui/role-pill";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AppRole, NavigationSummarySnapshot, UserProfile } from "@/lib/types";
import { PwaIosInstallBanner } from "@/components/pwa-ios-install-banner";
import { RouteProgressBar } from "@/components/ui/route-progress-bar";
import { useDashboardWalkthrough } from "@/components/dashboard-walkthrough-context";
import { useWorkspaceWalkthrough } from "@/components/workspace-walkthrough-context";

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
type NavSectionId = "work" | "governance";

interface NavSection {
  id: NavSectionId;
  label: string;
  items: NavItem[];
}

const DESKTOP_SIDEBAR_STORAGE_KEY = "bf_desktop_sidebar_open";

/* Sidebar class constants (co-located with the component instead of globals.css) */
const sidebarLinkClass =
  "relative flex min-h-9 min-w-0 items-center rounded-[0.625rem] py-2 text-[0.8125rem] font-medium text-[hsl(var(--foreground)/0.65)] transition-[background-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[hsl(var(--muted)/0.7)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-[hsl(var(--accent)/0.45)] focus-visible:outline-offset-2";
const sidebarLinkExpanded = "gap-2.5 px-2.5 motion-safe:hover:translate-x-px";
const sidebarLinkCollapsed = "justify-center px-0";
const sidebarLinkActive =
  "bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))] font-semibold shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.08)] hover:bg-[hsl(var(--accent)/0.16)] hover:text-[hsl(var(--accent))] motion-safe:hover:translate-x-0";
const sidebarIndicatorClass =
  "absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[hsl(var(--accent))] transition-opacity duration-150 ease-in-out";
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
  { href: "/reports" as Route, label: "Reports", icon: FileText },
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

/** Mobile-only nav for admin: just Admin Queue and Full Details. */
const adminMobileNavItems: NavItem[] = [
  { href: "/admin", label: "Admin Queue", icon: ShieldCheck },
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
  "/reports": "governance",
  "/frank-deenie": "governance",
  "/mandate": "governance",
  "/admin": "work"
};

function groupFullNavItems(items: NavItem[]): NavSection[] {
  const grouped: Record<NavSectionId, NavItem[]> = {
    work: [],
    governance: []
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

interface SidebarHeaderProps {
  isOpen: boolean;
  onToggle: () => void;
}

function SidebarHeader({ isOpen, onToggle }: SidebarHeaderProps) {
  const shortcutHint = typeof navigator !== "undefined" && !/Mac/.test(navigator.platform) ? "Ctrl+B" : "⌘B";

  const brandMark = (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))] transition-[background-color] duration-200 hover:bg-[hsl(var(--accent)/0.18)]">
      <Leaf className="h-4 w-4" strokeWidth={2} />
    </span>
  );

  if (!isOpen) {
    return (
      <div className="flex items-center justify-center px-2 pt-2.5 pb-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggle}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))] transition-[background-color] duration-200 hover:bg-[hsl(var(--accent)/0.18)]"
              type="button"
              aria-label="Expand sidebar"
              aria-expanded={false}
              aria-controls="desktop-sidebar-navigation"
            >
              <Leaf className="h-4 w-4" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Expand sidebar <kbd className="ml-1 inline-flex items-center rounded border border-foreground/15 bg-foreground/5 px-1 py-0.5 font-mono text-[10px] leading-none">{shortcutHint}</kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 pl-3 pr-1 pt-2.5 pb-2">
      {brandMark}
      <span className="min-w-0 max-w-[200px] flex-1 truncate text-sm font-semibold tracking-tight text-foreground transition-[max-width,opacity] duration-200 delay-75 opacity-100">
        Brosens Foundation
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggle}
            className={cn(sidebarControlBtnClass, "shrink-0")}
            type="button"
            aria-label="Collapse sidebar"
            aria-expanded={true}
            aria-controls="desktop-sidebar-navigation"
          >
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Collapse sidebar <kbd className="ml-1 inline-flex items-center rounded border border-foreground/15 bg-foreground/5 px-1 py-0.5 font-mono text-[10px] leading-none">{shortcutHint}</kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/* ─── Sidebar: User Identity (footer placement) ─── */

interface SidebarUserCardProps {
  isOpen: boolean;
  user: UserProfile | null;
  pathname: string;
  onSignOut: () => void;
}

function SidebarUserCard({ isOpen, user, pathname, onSignOut }: SidebarUserCardProps) {
  const initials = user ? getInitials(user.name) : "?";
  const avatarClass = user ? roleAvatarClasses[user.role] : "bg-muted text-foreground/50";
  const tooltipText = user ? `${user.name} (${user.role})` : "Not signed in";
  const settingsActive = isRouteActive(pathname, "/settings");

  const avatar = (
    <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold tracking-[0.02em] transition-transform duration-200 group-hover:scale-105", avatarClass)}>
      {initials}
    </span>
  );

  if (!isOpen) {
    return (
      <div className="flex flex-col items-center gap-1 border-t border-[hsl(var(--border)/0.4)] pt-2.5 pb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="group flex cursor-default items-center justify-center px-2 py-1">
              {avatar}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>{tooltipText}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/settings"
              className={cn(sidebarControlBtnClass, settingsActive && "text-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)]")}
              aria-current={settingsActive ? "page" : undefined}
            >
              <Settings className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>Settings</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ThemeToggle className={sidebarControlBtnClass} />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>Toggle light / dark mode</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onSignOut}
              className={cn(sidebarControlBtnClass, "hover:bg-[hsl(var(--danger)/0.1)] hover:text-[hsl(var(--danger))]")}
              type="button"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>Sign out</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-[hsl(var(--border)/0.4)] pt-2.5 pb-1">
      <div className="group flex items-center gap-2.5 px-2.5 py-1.5">
        {avatar}
        <div className="min-w-0 flex-1 overflow-hidden transition-[max-width,opacity] duration-250 delay-100 max-w-[180px] opacity-100">
          {user && (
            <>
              <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{user.name}</p>
              <div className="mt-1">
                <RolePill role={user.role} />
              </div>
            </>
          )}
        </div>
        <Link
          href="/settings"
          className={cn(sidebarControlBtnClass, "shrink-0", settingsActive && "text-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)]")}
          aria-label="Settings"
          title="Settings"
          aria-current={settingsActive ? "page" : undefined}
        >
          <Settings className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      </div>
      <div className="flex items-center gap-0.5 px-1 mt-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <ThemeToggle className={sidebarControlBtnClass} />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>Toggle light / dark mode</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onSignOut}
              className={cn(sidebarControlBtnClass, "hover:bg-[hsl(var(--danger)/0.1)] hover:text-[hsl(var(--danger))]")}
              type="button"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>Sign out</TooltipContent>
        </Tooltip>
      </div>
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
      <span className={cn("truncate transition-opacity duration-200 delay-100", isOpen ? "opacity-100" : "opacity-0 sr-only")}>{item.label}</span>
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
    <nav id="desktop-sidebar-navigation" className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-2" aria-label="Primary">
      {sections.map((section, sectionIndex) => (
        <section key={section.id} className={cn(sectionIndex > 0 && "mt-5")}>
          {isOpen && (
            <span className="block mb-2 pl-2.5 text-[0.6875rem] font-semibold tracking-[0.06em] uppercase text-[hsl(var(--foreground)/0.38)]">
              {section.label}
            </span>
          )}
          {!isOpen && sectionIndex > 0 && (
            <div className="mx-auto mb-2 h-px w-4 rounded-full bg-[hsl(var(--border)/0.3)]" aria-hidden />
          )}
          <ul className="space-y-1">
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
  const { startWalkthrough } = useWorkspaceWalkthrough();
  const { startWalkthrough: startDashboardWalkthrough } = useDashboardWalkthrough();
  const isWorkspace = pathname === "/workspace";
  const isDashboard = pathname === "/dashboard";
  const showWalkthroughGuide = isWorkspace || isDashboard;
  const onStartWalkthrough = isWorkspace ? startWalkthrough : startDashboardWalkthrough;

  return (
    <aside
      className={cn(
        "sticky top-4 hidden h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] shrink-0 overflow-hidden print:hidden sm:flex sm:flex-col sm:transition-[width] sm:duration-300 sm:ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[width]",
        isOpen ? "w-60" : "w-16"
      )}
    >
      <div className="glass-card flex h-full min-h-0 w-full flex-col rounded-3xl p-2.5">
        {/* Zone 1: Brand header + collapse toggle */}
        <SidebarHeader isOpen={isOpen} onToggle={onToggle} />

        {/* Zone 2: Navigation sections (center stage) */}
        <DesktopSidebarNav
          pathname={pathname}
          isOpen={isOpen}
          sections={sections}
          outstandingByHref={outstandingByHref}
        />

        {/* Zone 3: User identity + utilities (footer) */}
        <SidebarUserCard
          isOpen={isOpen}
          user={user}
          pathname={pathname}
          onSignOut={onSignOut}
        />

        {/* Zone 4: Walkthrough guide (Workspace or Dashboard) */}
        {showWalkthroughGuide && (
          <div className="mt-auto border-t border-[hsl(var(--border)/0.4)] pt-2">
            {isOpen ? (
              <button
                type="button"
                onClick={onStartWalkthrough}
                className={cn(
                  sidebarLinkClass,
                  sidebarLinkExpanded,
                  "w-full justify-start"
                )}
                aria-label="Open walkthrough guide"
              >
                <BookOpen className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="truncate">Walkthrough Guide</span>
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onStartWalkthrough}
                    className={cn(sidebarControlBtnClass, "w-full")}
                    aria-label="Open walkthrough guide"
                  >
                    <BookOpen className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Walkthrough Guide
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
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

  const toggleSidebar = useCallback(() => {
    setIsDesktopSidebarOpen((current) => !current);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "b" && !e.shiftKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        toggleSidebar();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

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
  /** Home, + New Proposal, Full Details: constrain viewport so bottom nav always visible without scrolling. */
  const stickyBottomNavOnMobile =
    isSmallViewport &&
    (pathname.startsWith("/mobile") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/proposals/new"));
  const hideShellHeader =
    isSmallViewport &&
    (pathname.startsWith("/mobile") ||
      pathname.startsWith("/meeting") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/proposals/new") ||
      pathname.startsWith("/admin"));
  const renderedNav =
    isSmallViewport && user?.role === "admin"
      ? adminMobileNavItems
      : showMobileFocusNav
        ? availableFocusNav
        : availableFullNav;
  const { data: navigationSummary } = useSWR<NavigationSummarySnapshot>(
    user ? "/api/navigation/summary" : null,
    { refreshInterval: 30_000 }
  );

  // Revalidate navigation badges on every client-side route change so the
  // sidebar reflects the latest counts without waiting for the polling interval.
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      void globalMutate("/api/navigation/summary");
    }
  }, [pathname]);

  // Prefetch nav routes when the browser is idle so navigations feel instant.
  const router = useRouter();
  useEffect(() => {
    if (!user) return;
    const hrefs = [
      ...new Set([
        ...availableFullNav.map((item) => item.href),
        ...availableFocusNav.map((item) => item.href),
        "/settings" as Route
      ])
    ].filter((href) => href !== pathname);
    if (hrefs.length === 0) return;
    const prefetch = () => hrefs.forEach((href) => router.prefetch(href));
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(prefetch, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 500);
    return () => clearTimeout(id);
  }, [user, pathname, router, availableFullNav, availableFocusNav]);

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
      className={cn(
        "page-enter flex min-h-screen w-full flex-col px-3 pt-4 sm:flex-row sm:items-start sm:gap-4 sm:pl-0 sm:pr-6 sm:pb-8",
        stickyBottomNavOnMobile
          ? "h-[100dvh] max-h-[100dvh] overflow-hidden pb-0"
          : "pb-[calc(7.5rem+env(safe-area-inset-bottom))]"
      )}
      style={{
        paddingTop: isSmallViewport ? "max(1rem, env(safe-area-inset-top))" : "1rem"
      }}
    >
      <RouteProgressBar />
      <DesktopSidebar
        user={user}
        pathname={pathname}
        isOpen={isDesktopSidebarOpen}
        sections={desktopNavSections}
        outstandingByHref={outstandingByHref}
        onToggle={toggleSidebar}
        onSignOut={() => void signOut()}
      />

      <div
        className={cn(
          "min-w-0 flex-1",
          stickyBottomNavOnMobile &&
            "min-h-0 overflow-y-auto overflow-x-hidden pb-[calc(7.5rem+env(safe-area-inset-bottom))]"
        )}
      >
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
                <ThemeToggle className="h-8 w-8 shrink-0 rounded-lg border bg-card sm:h-9 sm:w-9" />
                <button
                  onClick={() => void signOut()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card hover:bg-muted focus:outline-none sm:h-9 sm:w-9"
                  type="button"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </header>
        )}

        <PwaIosInstallBanner />

        <main className="min-w-0 flex-1 sm:pt-4">
          {children}
        </main>
      </div>

      <MobileBottomNav pathname={pathname} navItems={renderedNav} outstandingByHref={outstandingByHref} />
    </div>
  );
}
