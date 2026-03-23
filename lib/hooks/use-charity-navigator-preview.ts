"use client";

import { useEffect, useState } from "react";
import type { CharityNavigatorPreviewResponse } from "@/lib/types";

/**
 * Auto-fetches a Charity Navigator preview when the given URL changes.
 * Returns null while loading or if the URL is empty/missing.
 */
export function useCharityNavigatorPreview(
  charityNavigatorUrl: string | null | undefined
): CharityNavigatorPreviewResponse | null {
  const [preview, setPreview] = useState<CharityNavigatorPreviewResponse | null>(null);

  useEffect(() => {
    const trimmed = charityNavigatorUrl?.trim() ?? "";
    if (!trimmed) {
      setPreview(null);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/charity-navigator/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ charityNavigatorUrl: trimmed })
        });
        if (!response.ok) {
          if (active) {
            setPreview(null);
          }
          return;
        }

        const payload = (await response.json()) as CharityNavigatorPreviewResponse;
        if (active) {
          setPreview(payload);
        }
      } catch {
        if (active) {
          setPreview(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [charityNavigatorUrl]);

  return preview;
}
