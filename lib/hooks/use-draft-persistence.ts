"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ProposalDraft, ProposalDraftPayload } from "@/lib/proposal-draft-types";

export type { ProposalDraft, ProposalDraftPayload } from "@/lib/proposal-draft-types";

const STORAGE_KEY = "proposal-draft";
const DEBOUNCE_MS = 500;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function draftHasContent(draft: Pick<ProposalDraft, "organizationName" | "description" | "proposalType">): boolean {
  return Boolean(
    draft.organizationName.trim() || draft.description.trim() || draft.proposalType.trim()
  );
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
  getValues: () => ProposalDraftPayload;
  setValues: (draft: ProposalDraft) => void;
  skipRestore?: boolean;
  /** Draft loaded on the server (SSR); form state already reflects it unless null. */
  initialServerDraft?: ProposalDraft | null;
}

function clearServerDraft() {
  void fetch("/api/proposals/draft", { method: "DELETE" }).catch(() => {
    // ignore network errors
  });
}

function persistServerDraft(payload: ProposalDraftPayload) {
  void fetch("/api/proposals/draft", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {
    // ignore network errors
  });
}

export function useDraftPersistence({
  getValues,
  setValues,
  skipRestore,
  initialServerDraft
}: UseDraftPersistenceOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (skipRestore) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (initialServerDraft && draftHasContent(initialServerDraft)) {
      toast.info(`Draft restored from ${relativeTime(initialServerDraft.savedAt)}`, {
        duration: 4000,
        action: {
          label: "Discard",
          onClick: () => {
            localStorage.removeItem(STORAGE_KEY);
            clearServerDraft();
            window.location.reload();
          }
        }
      });
      return;
    }

    const draft = readDraft();
    if (!draft || !draftHasContent(draft)) return;

    setValues(draft);
    toast.info(`Draft restored from ${relativeTime(draft.savedAt)}`, {
      duration: 4000,
      action: {
        label: "Discard",
        onClick: () => {
          localStorage.removeItem(STORAGE_KEY);
          clearServerDraft();
          window.location.reload();
        }
      }
    });
    persistServerDraft({
      organizationName: draft.organizationName,
      description: draft.description,
      website: draft.website,
      charityNavigatorUrl: draft.charityNavigatorUrl,
      proposalType: draft.proposalType,
      proposedAmount: draft.proposedAmount,
      proposerAllocationAmount: draft.proposerAllocationAmount
    });
  }, [setValues, skipRestore, initialServerDraft]);

  const saveDraft = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const values = getValues();
        if (!draftHasContent(values)) {
          localStorage.removeItem(STORAGE_KEY);
          clearServerDraft();
          return;
        }
        const draft: ProposalDraft = { ...values, savedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        persistServerDraft(values);
      } catch {
        // localStorage may be full or unavailable
      }
    }, DEBOUNCE_MS);
  }, [getValues]);

  const clearDraft = useCallback(() => {
    clearTimeout(timerRef.current);
    localStorage.removeItem(STORAGE_KEY);
    clearServerDraft();
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { saveDraft, clearDraft };
}
