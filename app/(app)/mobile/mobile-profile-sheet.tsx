"use client";

import { BookOpen, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth/auth-provider";
import { useMobileWalkthrough } from "@/components/mobile-walkthrough-context";
import { RolePill } from "@/components/ui/role-pill";
import {
  ResponsiveModal,
  ResponsiveModalContent,
} from "@/components/ui/responsive-modal";
import { AppRole } from "@/lib/types";

interface MobileProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userRole: AppRole;
}

export function MobileProfileSheet({
  open,
  onOpenChange,
  userName,
  userRole,
}: MobileProfileSheetProps) {
  const { signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { startWalkthrough } = useMobileWalkthrough();

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        dialogClassName="sm:max-w-sm"
        showCloseButton={false}
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-base font-semibold">
              {getInitials(userName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
              <div className="mt-1">
                <RolePill role={userRole} />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              )}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setTimeout(() => startWalkthrough(), 300);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <BookOpen className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              Walkthrough Guide
            </button>

            <div className="my-1 border-t" />

            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                void signOut();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-muted dark:text-rose-400"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
              Sign out
            </button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}
