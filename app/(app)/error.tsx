"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Production builds replace server error messages with a generic sentence
  // meant for developers, so show plain words and keep the reference code.
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold text-rose-600">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        The page couldn’t load. Check your connection and try again.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
        </Button>
        {/* A full load, not a client navigation: whatever broke may be in this page's client state. */}
        <Button type="button" variant="outline" onClick={() => window.location.assign("/")}>
          Go to home
        </Button>
      </div>
      {error.digest ? (
        <p className="text-[11px] text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
