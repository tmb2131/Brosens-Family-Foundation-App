"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState, type ComponentType } from "react";
import { useTheme } from "next-themes";
import {
  ChevronRight,
  FileText,
  Home,
  ListChecks,
  LogOut,
  Moon,
  ScrollText,
  Settings,
  Sun,
  Vote
} from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { DEFAULT_MOBILE_DRAWER_PROPS } from "@/components/ui/responsive-modal";
import { RolePill } from "@/components/ui/role-pill";
import type { AppRole, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MoreLink {
  href: Route;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  roles: AppRole[];
}

const ALL_ROLES: AppRole[] = ["member", "oversight", "manager", "admin"];

/**
 * Pages that are not in a role's mobile bottom bar. Without this sheet a phone
 * user had no way to reach Settings (push notifications, password, budget) or
 * the Mandate page whose policy changes they are asked to acknowledge.
 */
const MORE_LINKS: MoreLink[] = [
  {
    href: "/workspace",
    label: "My Workspace",
    description: "Your budget, votes and gifts",
    icon: ListChecks,
    roles: ["member", "oversight"]
  },
  {
    href: "/meeting",
    label: "Meeting",
    description: "Reveal votes and record decisions",
    icon: Vote,
    roles: ["manager"]
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Budget and grant tracker",
    icon: Home,
    roles: ["admin"]
  },
  {
    href: "/reports" as Route,
    label: "Reports",
    description: "Annual giving report",
    icon: FileText,
    roles: ALL_ROLES
  },
  {
    href: "/mandate" as Route,
    label: "Mandate",
    description: "Foundation policy and recent changes",
    icon: ScrollText,
    roles: ALL_ROLES
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Password, notifications and more",
    icon: Settings,
    roles: ALL_ROLES
  }
];

export function getMoreLinks(role: AppRole | undefined): MoreLink[] {
  if (!role) return [];
  return MORE_LINKS.filter((link) => link.roles.includes(role));
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  pathname: string;
  countsByHref: Partial<Record<string, number>>;
  onSignOut: () => void;
}

export function MobileMoreSheet({
  open,
  onOpenChange,
  user,
  pathname,
  countsByHref,
  onSignOut
}: MobileMoreSheetProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const links = getMoreLinks(user?.role);

  // Close once a link has taken the user somewhere else.
  useEffect(() => {
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to navigation
  }, [pathname]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} {...DEFAULT_MOBILE_DRAWER_PROPS}>
      <DrawerContent className="sm:hidden">
        <div className="overflow-y-auto px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 pb-3">
            <div className="min-w-0 flex-1">
              <DrawerTitle className="truncate text-base font-semibold">{user?.name ?? "Menu"}</DrawerTitle>
              <DrawerDescription className="sr-only">More pages and account options</DrawerDescription>
            </div>
            {user ? <RolePill role={user.role} /> : null}
          </div>

          <nav aria-label="More pages">
            <ul className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-card">
              {links.map((link) => {
                const active = isActive(pathname, link.href);
                const count = countsByHref[link.href] ?? 0;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => {
                        if (active) onOpenChange(false);
                      }}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-14 items-center gap-3 px-3 py-2.5 text-sm transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/60",
                        active && "bg-[hsl(var(--accent)/0.08)]"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70",
                          active && "bg-[hsl(var(--accent)/0.14)] text-[hsl(var(--accent))]"
                        )}
                      >
                        <link.icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-foreground">{link.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{link.description}</span>
                      </span>
                      {count > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                          {count > 99 ? "99+" : count}
                          <span className="sr-only"> needing your attention</span>
                        </span>
                      ) : null}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/70 bg-card">
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="flex min-h-12 w-full items-center gap-3 rounded-t-2xl px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/60"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              )}
              {isDark ? "Light mode" : "Dark mode"}
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onSignOut();
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-b-2xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-muted/60 dark:text-rose-400"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
