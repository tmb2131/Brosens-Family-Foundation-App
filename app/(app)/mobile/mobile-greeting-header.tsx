"use client";

import { useMemo } from "react";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string): string {
  return fullName.split(/\s+/)[0] || fullName;
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

interface MobileGreetingHeaderProps {
  userName: string | null;
  onAvatarPress: () => void;
}

export function MobileGreetingHeader({ userName, onAvatarPress }: MobileGreetingHeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const firstName = userName ? getFirstName(userName) : null;
  const initials = userName ? getInitials(userName) : null;

  return (
    <div className="flex items-center justify-between" data-walkthrough="mobile-header">
      <div>
        {firstName ? (
          <p className="text-base font-semibold text-foreground">
            {greeting}, {firstName}
          </p>
        ) : (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Today&apos;s Focus
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onAvatarPress}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Open profile menu"
      >
        {initials ?? "?"}
      </button>
    </div>
  );
}
