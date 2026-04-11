"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ProposalDraft, ProposalDraftPayload } from "@/lib/proposal-draft-types";

export type { ProposalDraft, ProposalDraftPayload } from "@/lib/proposal-draft-types";

const DEBOUNCE_MS = 500;

function draftHasContent(draft: Pick<ProposalDraft, "organizationName" | "description" | "proposalType">): boolean {
  return Boolean(
    draft.organizationName.trim() || draft.description.trim() || draft.proposalType.trim()
  );
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
  skipRestore,
  initialServerDraft
}: UseDraftPersistenceOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (skipRestore) return;
    if (!initialServerDraft || !draftHasContent(initialServerDraft)) return;

    toast.info(`Draft restored from ${relativeTime(initialServerDraft.savedAt)}`, {
      duration: 4000,
      action: {
        label: "Discard",
        onClick: () => {
          clearServerDraft();
          window.location.reload();
        }
      }
    });
  }, [skipRestore, initialServerDraft]);

  const saveDraft = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const values = getValues();
      if (!draftHasContent(values)) {
        clearServerDraft();
        return;
      }
      persistServerDraft(values);
    }, DEBOUNCE_MS);
  }, [getValues]);

  const clearDraft = useCallback(() => {
    clearTimeout(timerRef.current);
    clearServerDraft();
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { saveDraft, clearDraft };
}
