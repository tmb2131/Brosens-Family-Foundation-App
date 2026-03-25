"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "proposal-draft";
const DEBOUNCE_MS = 500;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ProposalDraft {
  organizationName: string;
  description: string;
  website: string;
  charityNavigatorUrl: string;
  proposalType: string;
  proposedAmount: string;
  proposerAllocationAmount: string;
  savedAt: number;
}

function readDraft(): ProposalDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProposalDraft;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function relativeTime(ms: number): string {
  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

interface UseDraftPersistenceOptions {
  getValues: () => Omit<ProposalDraft, "savedAt">;
  setValues: (draft: ProposalDraft) => void;
  skipRestore?: boolean;
}

export function useDraftPersistence({ getValues, setValues, skipRestore }: UseDraftPersistenceOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (skipRestore) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const draft = readDraft();
    if (!draft) return;

    const hasContent =
      draft.organizationName.trim() ||
      draft.description.trim() ||
      draft.proposalType;

    if (!hasContent) return;

    setValues(draft);
    toast.info(`Draft restored from ${relativeTime(draft.savedAt)}`, {
      duration: 4000,
      action: {
        label: "Discard",
        onClick: () => {
          localStorage.removeItem(STORAGE_KEY);
          window.location.reload();
        }
      }
    });
  }, [setValues, skipRestore]);

  const saveDraft = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const values = getValues();
        const hasContent =
          values.organizationName.trim() ||
          values.description.trim() ||
          values.proposalType;
        if (!hasContent) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        const draft: ProposalDraft = { ...values, savedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // localStorage may be full or unavailable
      }
    }, DEBOUNCE_MS);
  }, [getValues]);

  const clearDraft = useCallback(() => {
    clearTimeout(timerRef.current);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { saveDraft, clearDraft };
}
