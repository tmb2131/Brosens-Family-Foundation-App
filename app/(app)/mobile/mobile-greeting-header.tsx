"use client";

import { useMemo } from "react";
import { getProposerDisplayName } from "@/lib/proposer-display-names";

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

/** Resolve display name: email mapping first (e.g. thomas.brosens@gmail.com → Tom), else first name from full name. */
function getDisplayName(userEmail: string | null | undefined, userName: string | null): string | null {
  const fromMapping = userEmail ? getProposerDisplayName(userEmail) : null;
  if (fromMapping && fromMapping !== "—") return fromMapping;
  return userName ? getFirstName(userName) : null;
}

interface MobileGreetingHeaderProps {
  userName: string | null;
  userEmail?: string | null;
  onAvatarPress: () => void;
}

export function MobileGreetingHeader({ userName, userEmail, onAvatarPress }: MobileGreetingHeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const displayName = getDisplayName(userEmail ?? null, userName);
  const initials = userName ? getInitials(userName) : null;

  return (
    <div className="flex items-center justify-between" data-walkthrough="mobile-header">
      <div>
        {displayName ? (
          <p className="text-base font-semibold text-foreground">
            {greeting}, {displayName}
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
