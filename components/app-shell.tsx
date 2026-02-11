"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Home, ListChecks, LogOut, Settings, ShieldCheck, Vote } from "lucide-react";
import useSWR from "swr";
import { PropsWithChildren, ReactNode, useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { RolePill } from "@/components/ui/role-pill";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FoundationSnapshot, WorkspaceSnapshot } from "@/lib/types";

type NavItem = {
  href: Route;
  label: string;
  icon: ReactNode;
  roles?: string[];
};

interface MeetingResponse {
  proposals: FoundationSnapshot["proposals"];
}

interface AdminQueueResponse {
  proposals: FoundationSnapshot["proposals"];
}

const navItems: NavItem[] = [
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

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const availableNav = useMemo(() => {
    if (!user) {
      return [];
    }

    return navItems.filter((item) => !item.roles || item.roles.includes(user.role));
  }, [user]);

  const shouldLoadFoundation = Boolean(
    user && availableNav.some((item) => item.href === "/dashboard")
  );
  const shouldLoadWorkspace = Boolean(
    user && availableNav.some((item) => item.href === "/workspace")
  );
  const shouldLoadMeeting = Boolean(user && availableNav.some((item) => item.href === "/meeting"));
  const shouldLoadAdmin = Boolean(user && availableNav.some((item) => item.href === "/admin"));

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
  const { data: adminData } = useSWR<AdminQueueResponse>(
    shouldLoadAdmin ? "/api/admin" : null,
    { refreshInterval: 15_000 }
  );

  const outstandingByHref = useMemo(
    () =>
      ({
        "/dashboard":
          foundationData?.proposals.filter((proposal) => proposal.status === "to_review").length ?? 0,
        "/workspace": workspaceData?.actionItems.length ?? 0,
        "/meeting": meetingData?.proposals.length ?? 0,
        "/admin": adminData?.proposals.length ?? 0,
        "/settings": 0
      }) as Partial<Record<Route, number>>,
    [adminData, foundationData, meetingData, workspaceData]
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-3 pb-20 pt-4 sm:px-6 page-enter">
      <header className="glass-card mb-4 rounded-3xl p-4">
        <div className="flex items-start justify-between gap-3">
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

      <nav className="fixed bottom-3 left-1/2 z-20 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 rounded-2xl border bg-card/95 px-2 py-2 shadow-soft backdrop-blur">
        <ul className="grid grid-cols-5 gap-1 sm:flex sm:justify-around">
          {availableNav.map((item) => {
            const active = pathname.startsWith(item.href);
            const outstandingCount = outstandingByHref[item.href] ?? 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold",
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
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
