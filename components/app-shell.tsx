"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
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
import { PropsWithChildren, ReactNode, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { RolePill } from "@/components/ui/role-pill";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AppRole, FoundationSnapshot, WorkspaceSnapshot } from "@/lib/types";

type NavItem = {
  href: Route;
  label: string;
  icon: ReactNode;
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
  { href: "/dashboard", label: "Dashboard", icon: <Home className="h-4 w-4" /> },
  {
    href: "/workspace",
    label: "My Workspace",
    icon: <ListChecks className="h-4 w-4" />,
    roles: ["member", "oversight", "manager"]
  },
  {
    href: "/meeting",
    label: "Meeting",
    icon: <Vote className="h-4 w-4" />,
    roles: ["oversight", "manager"]
  },
  {
    href: "/reports" as Route,
    label: "Reports",
    icon: <FileText className="h-4 w-4" />,
    roles: ["oversight", "manager"]
  },
  {
    href: "/mandate" as Route,
    label: "Mandate",
    icon: <ScrollText className="h-4 w-4" />,
    roles: ["member", "oversight", "manager", "admin"]
  },
  {
    href: "/admin",
    label: "Admin Queue",
    icon: <ShieldCheck className="h-4 w-4" />,
    roles: ["admin"]
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
    roles: ["member", "oversight", "manager", "admin"]
  }
];

const focusNavItems: NavItem[] = [
  { href: "/mobile" as Route, label: "Home", icon: <Home className="h-4 w-4" /> },
  {
    href: "/proposals/new",
    label: "New Proposal",
    icon: <Plus className="h-4 w-4" />,
    roles: ["member", "oversight", "manager"]
  },
  { href: "/dashboard", label: "Full Details", icon: <FileText className="h-4 w-4" /> }
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isSmallViewport, setIsSmallViewport] = useState(false);

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

  const showMobileFocusNav = pathname.startsWith("/mobile") && isSmallViewport;
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
    { refreshInterval: 15_000 }
  );
  const { data: workspaceData } = useSWR<WorkspaceSnapshot>(
    shouldLoadWorkspace ? "/api/workspace" : null,
    { refreshInterval: 15_000 }
  );
  const { data: meetingData } = useSWR<MeetingResponse>(
    shouldLoadMeeting ? "/api/meeting" : null,
    { refreshInterval: 15_000 }
  );
  const { data: policyNotificationSummary } = useSWR<PolicyNotificationSummaryResponse>(
    shouldLoadPolicySummary ? "/api/policy/notifications/summary" : null,
    { refreshInterval: 15_000 }
  );
  const { data: adminData } = useSWR<AdminQueueResponse>(
    shouldLoadAdmin ? "/api/admin" : null,
    { refreshInterval: 15_000 }
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
      className="page-enter mx-auto flex min-h-screen max-w-6xl flex-col px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-20"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
    >
      <header className="glass-card mb-4 rounded-3xl p-4 print:hidden">
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

      <main className="flex-1">{children}</main>

      <nav
        className="fixed inset-x-3 bottom-2 z-20 rounded-2xl border bg-card/95 px-2 py-2 shadow-soft backdrop-blur print:hidden sm:inset-x-auto sm:bottom-3 sm:left-1/2 sm:w-[calc(100%-1.5rem)] sm:max-w-2xl sm:-translate-x-1/2"
        style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <ul
          className="grid gap-1 sm:flex sm:justify-around"
          style={{ gridTemplateColumns: `repeat(${Math.max(renderedNav.length, 1)}, minmax(0, 1fr))` }}
        >
          {renderedNav.map((item) => {
            const active = pathname.startsWith(item.href);
            const outstandingCount = outstandingByHref[item.href] ?? 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold sm:px-3 sm:text-xs",
                    active
                      ? "bg-accent text-white"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  )}
                >
                  <span className="relative inline-flex">
                    {item.icon}
                    {outstandingCount > 0 ? (
                      <span className="absolute -right-2 -top-2 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                        {outstandingCount > 99 ? "99+" : outstandingCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="max-w-[4.5rem] truncate text-[10px] leading-tight sm:max-w-none sm:text-xs">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
