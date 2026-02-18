"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getClientIsIOS, getClientIsStandalone } from "@/lib/device-detection";
import { cn } from "@/lib/utils";

const PWA_IOS_DISMISS_KEY = "pwa-ios-install-dismissed";

export function PwaIosInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (
      getClientIsIOS() &&
      !getClientIsStandalone() &&
      typeof window !== "undefined" &&
      window.localStorage.getItem(PWA_IOS_DISMISS_KEY) !== "1"
    ) {
      setShowBanner(true);
    }
  }, []);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PWA_IOS_DISMISS_KEY, "1");
    }
    setShowBanner(false);
  }

  if (!showBanner) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Add to Home Screen"
      className={cn(
        "glass-card mb-4 flex items-start gap-3 rounded-3xl p-4 print:hidden",
        "border border-[hsl(var(--border)/0.5)]"
      )}
    >
      <p className="min-w-0 flex-1 text-sm text-foreground">
        For a better experience, add this app to your Home Screen: tap the Share
        button (square with arrow), then <strong>Add to Home Screen</strong>.
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-[hsl(var(--accent)/0.45)] focus-visible:outline-offset-2"
        aria-label="Dismiss add to Home Screen prompt"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
