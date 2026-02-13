"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  ListChecks,
  LogOut,
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
import { AppRole, FoundationSnapshot, WorkspaceSnapshot } from "@/lib/types";

type NavItem = {
  href: Route;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles?: AppRole[];
};

interface MeetingResponse {
  proposals: FoundationSnapshot["proposals"];
}

interface AdminQueueResponse {
  proposals: FoundationSnapshot["proposals"];
}

interface PolicyNotificationSummaryResponse {
  pendingCount: number;
}

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
    href: "/mandate" as Route,
    label: "Mandate",
    icon: ScrollText,
    roles: ["member", "oversight", "manager", "admin"]
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
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
    roles: ["member", "oversight", "manager"]
  },
  { href: "/dashboard", label: "Full Details", icon: FileText }
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isSmallViewport, setIsSmallViewport] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

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
      pathname.startsWith("/proposals/new"));
  const renderedNav = showMobileFocusNav ? availableFocusNav : availableFullNav;

  const shouldLoadFoundation = Boolean(
    user &&
      (availableFullNav.some((item) => item.href === "/dashboard") ||
        availableFocusNav.some((item) => item.href === "/mobile"))
  );
  const shouldLoadWorkspace = Boolean(
    user &&
      (availableFullNav.some((item) => item.href === "/workspace") ||
        availableFocusNav.some((item) => item.href === "/mobile")) &&
      ["member", "oversight", "manager"].includes(user.role)
  );
  const shouldLoadMeeting = Boolean(user && availableFullNav.some((item) => item.href === "/meeting"));
  const shouldLoadPolicySummary = Boolean(
    user && availableFullNav.some((item) => item.href === "/mandate")
  );
  const shouldLoadAdmin = Boolean(user && availableFullNav.some((item) => item.href === "/admin"));

  const { data: foundationData } = useSWR<FoundationSnapshot>(
    shouldLoadFoundation ? "/api/foundation" : null,
    { refreshInterval: 60_000 }
  );
  const { data: workspaceData } = useSWR<WorkspaceSnapshot>(
    shouldLoadWorkspace ? "/api/workspace" : null,
    { refreshInterval: 60_000 }
  );
  const { data: meetingData } = useSWR<MeetingResponse>(
    shouldLoadMeeting ? "/api/meeting" : null,
    { refreshInterval: 60_000 }
  );
  const { data: policyNotificationSummary } = useSWR<PolicyNotificationSummaryResponse>(
    shouldLoadPolicySummary ? "/api/policy/notifications/summary" : null,
    { refreshInterval: 60_000 }
  );
  const { data: adminData } = useSWR<AdminQueueResponse>(
    shouldLoadAdmin ? "/api/admin" : null,
    { refreshInterval: 60_000 }
  );

  const outstandingByHref = useMemo(
    () =>
      ({
        "/dashboard":
          foundationData?.proposals.filter((proposal) => proposal.status === "to_review").length ?? 0,
        "/mobile": workspaceData?.actionItems.length ?? 0,
        "/workspace": workspaceData?.actionItems.length ?? 0,
        "/meeting": meetingData?.proposals.length ?? 0,
        "/reports": 0,
        "/mandate": policyNotificationSummary?.pendingCount ?? 0,
        "/admin": adminData?.proposals.length ?? 0,
        "/settings": 0,
        "/proposals/new": 0
      }) as Partial<Record<Route, number>>,
    [adminData, foundationData, meetingData, policyNotificationSummary, workspaceData]
  );

  return (
    <div
      className="page-enter flex min-h-screen w-full flex-col px-3 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:items-start sm:gap-4 sm:pl-0 sm:pr-6 sm:pb-8"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
    >
      <aside
        className={cn(
          "sticky top-4 hidden max-h-[calc(100vh-2rem)] shrink-0 print:hidden sm:flex sm:transition-[width]",
          isDesktopSidebarOpen ? "w-64" : "w-[4.75rem]"
        )}
      >
        <div className="glass-card flex h-full w-full flex-col rounded-3xl p-2">
          <section className={cn("mb-2 rounded-2xl border bg-card/70", isDesktopSidebarOpen ? "p-3" : "p-2")}>
            {isDesktopSidebarOpen ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  Brosens Family Foundation
                </p>
                <h1 className="mt-1 text-lg font-semibold leading-tight">Grant Management</h1>
                {user ? (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="truncate">{user.name}</span>
                    <RolePill role={user.role} />
                  </div>
                ) : null}
                <div className="mt-3 flex items-center gap-2">
                  <ThemeToggle />
                  <button
                    onClick={() => void signOut()}
                    className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-semibold"
                    type="button"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-card text-[11px] font-semibold tracking-wide"
                  title="Brosens Family Foundation"
                >
                  BF
                </span>
                <ThemeToggle />
                <button
                  onClick={() => void signOut()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-card"
                  type="button"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </section>

          <div
            className={cn(
              "mb-2 flex items-center",
              isDesktopSidebarOpen ? "justify-between" : "justify-center"
            )}
          >
            {isDesktopSidebarOpen ? (
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Navigation
              </p>
            ) : null}
            <button
              onClick={() => setIsDesktopSidebarOpen((current) => !current)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-card text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              type="button"
              aria-expanded={isDesktopSidebarOpen}
              aria-label={isDesktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isDesktopSidebarOpen ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
            <ul className="space-y-1">
              {renderedNav.map((item) => {
                const active = pathname.startsWith(item.href);
                const outstandingCount = outstandingByHref[item.href] ?? 0;
                return (
                  <li key={item.href} className="min-w-0">
                    <Link
                      href={item.href}
                      className={cn(
                        "flex min-h-11 min-w-0 items-center rounded-xl py-2 text-sm font-semibold transition-colors",
                        isDesktopSidebarOpen ? "gap-2 px-3" : "justify-center px-2",
                        active
                          ? "bg-accent text-white"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      )}
                      title={isDesktopSidebarOpen ? undefined : item.label}
                    >
                      <span className="relative inline-flex shrink-0">
                        <item.icon className="h-4 w-4" />
                        {outstandingCount > 0 ? (
                          <span className="absolute -right-2 -top-2 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                            {outstandingCount > 99 ? "99+" : outstandingCount}
                          </span>
                        ) : null}
                      </span>
                      <span className={cn("truncate", !isDesktopSidebarOpen && "sr-only")}>
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

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

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-card px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-soft print:hidden sm:hidden"
      >
        <ul
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(renderedNav.length, 1)}, minmax(0, 1fr))` }}
        >
          {renderedNav.map((item) => {
            const active = pathname.startsWith(item.href);
            const outstandingCount = outstandingByHref[item.href] ?? 0;
            const isNewProposalShortcut = item.href === "/proposals/new";
            const showNewProposalCta = isNewProposalShortcut && !active;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-200",
                    active
                      ? "bg-accent text-white"
                      : showNewProposalCta
                        ? "border border-[#316AD8]/50 bg-[#316AD8]/12 text-[#2154c2] shadow-[0_10px_20px_-16px_rgba(49,106,216,1)] hover:bg-[#316AD8]/18 dark:border-[#3F80DE]/60 dark:bg-[#3F80DE]/20 dark:text-[#D9E8FF] dark:shadow-[0_12px_22px_-16px_rgba(63,128,222,1)] dark:hover:bg-[#3F80DE]/28"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  )}
                >
                  <span
                    className={cn(
                      "relative inline-flex",
                      showNewProposalCta &&
                        "h-6 w-6 items-center justify-center rounded-full bg-[#316AD8] text-white shadow-[0_6px_12px_-8px_rgba(49,106,216,1)] motion-safe:animate-[pulse_900ms_ease-out_1] dark:bg-[#3F80DE] dark:shadow-[0_6px_12px_-8px_rgba(63,128,222,1)]"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {outstandingCount > 0 ? (
                      <span className="absolute -right-2 -top-2 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                        {outstandingCount > 99 ? "99+" : outstandingCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="max-w-[4.5rem] truncate text-[10px] leading-tight">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
