"use client";

import { createPortal } from "react-dom";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { MessageSquarePlus, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MandateComment,
  MandatePolicyContent,
  MandatePolicyPageData,
  MandateSectionKey,
  PolicyChangeNotification,
  PolicyVersionWithReviews
} from "@/lib/types";
import { MANDATE_SECTION_LABELS, MANDATE_SECTION_ORDER } from "@/lib/mandate-policy";
import { formatNumber } from "@/lib/utils";

const STATUS_STYLES: Record<PolicyChangeNotification["status"], string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  acknowledged:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  flagged: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
};

const SECTION_EMPHASIS_PATTERNS: Record<MandateSectionKey, RegExp[]> = {
  missionStatement: [
    /Brosens Family Foundation/gi,
    /left out of economic opportunity/gi,
    /education/gi,
    /long-term pathways to social equity\./gi
  ],
  structure: [
    /non-operating entity/gi,
    /75% joint pool/gi,
    /25% discretionary pool/gi,
    /yearly rollover settings/gi
  ],
  jointGivingPolicy: [
    /blind/gi,
    /sum of eligible allocation votes \(not an average\)/gi,
    /To Review -> Approved\/Declined -> Sent/gi
  ],
  discretionaryGivingPolicy: [
    /To Review/gi,
    /Oversight admin/gi,
    /approved or rejected/gi,
    /proposer-set/gi,
    /\$5,000,000/gi
  ],
  process: [
    /Create a proposal/gi,
    /Notify members/gi,
    /Collect blind votes/gi,
    /Meeting stage/gi,
    /Brynn's Admin queue/gi
  ],
  annualCycle: [
    /January/gi,
    /February 1/gi,
    /December 31/gi,
    /annual budget cycle/gi,
    /year-end allocations/gi
  ],
  rolesAndResponsibilities: [
    /Brynn \(Admin\)/gi,
    /Tom \(Oversight\)/gi,
    /Dad \(Manager\)/gi,
    /approved donations/gi,
    /budget direction/gi
  ],
  references: [
    /Master Document/gi,
    /working documents/gi,
    /grants master tracking sheets/gi
  ]
};

type SectionSegment =
  | { type: "plain"; text: string }
  | { type: "highlight"; text: string; comment: MandateComment };

type CommentRange = { start: number; end: number; comment: MandateComment };

function getCommentRanges(
  sectionText: string,
  comments: MandateComment[]
): CommentRange[] {
  const roots = comments.filter(
    (c): c is MandateComment & { quotedText: string; startOffset: number } =>
      c.parentId == null && c.quotedText != null && c.startOffset != null
  );
  if (!roots.length) return [];

  const sorted = [...roots].sort((a, b) => a.startOffset - b.startOffset);
  let searchStart = 0;
  const ranges: CommentRange[] = [];

  for (const comment of sorted) {
    const quoted = comment.quotedText;
    const idx = sectionText.indexOf(quoted, searchStart);
    if (idx === -1) continue;
    const end = idx + quoted.length;
    ranges.push({ start: idx, end, comment });
    searchStart = end;
  }
  return ranges;
}

function buildSectionSegments(
  sectionText: string,
  comments: MandateComment[]
): SectionSegment[] {
  const ranges = getCommentRanges(sectionText, comments);
  if (!ranges.length) {
    return [{ type: "plain", text: sectionText }];
  }

  const segments: SectionSegment[] = [];
  let pos = 0;
  for (const { start, end, comment } of ranges) {
    if (start > pos) {
      segments.push({ type: "plain", text: sectionText.slice(pos, start) });
    }
    segments.push({ type: "highlight", text: comment.quotedText ?? "", comment });
    pos = end;
  }
  if (pos < sectionText.length) {
    segments.push({ type: "plain", text: sectionText.slice(pos) });
  }
  return segments;
}

function prettyDate(value: string) {
  return new Date(value).toLocaleString();
}

function emphasizePattern(parts: ReactNode[], pattern: RegExp, keyPrefix: string) {
  return parts.flatMap((part, partIndex) => {
    if (typeof part !== "string") {
      return [part];
    }

    const matches = Array.from(part.matchAll(pattern));
    if (!matches.length) {
      return [part];
    }

    const emphasized: ReactNode[] = [];
    let cursor = 0;

    matches.forEach((match, matchIndex) => {
      const matched = match[0];
      const start = match.index ?? 0;
      if (!matched || start < cursor) {
        return;
      }

      if (start > cursor) {
        emphasized.push(part.slice(cursor, start));
      }

      emphasized.push(
        <strong
          key={`${keyPrefix}-${partIndex}-${matchIndex}-${start}`}
          className="font-semibold text-foreground"
        >
          {matched}
        </strong>
      );
      cursor = start + matched.length;
    });

    if (cursor < part.length) {
      emphasized.push(part.slice(cursor));
    }

    return emphasized;
  });
}

function emphasizeImportantText(line: string, sectionKey: MandateSectionKey, keyPrefix: string) {
  const patterns = [/"[^"]+"/g, ...SECTION_EMPHASIS_PATTERNS[sectionKey]];
  return patterns.reduce(
    (parts, pattern, patternIndex) =>
      emphasizePattern(parts, pattern, `${keyPrefix}-pattern-${patternIndex}`),
    [line] as ReactNode[]
  );
}

function renderReadableLine(line: string, sectionKey: MandateSectionKey, keyPrefix: string) {
  const colonIndex = line.indexOf(":");
  const shouldEmphasizeLead = colonIndex > 0 && colonIndex <= 60;

  if (!shouldEmphasizeLead) {
    return emphasizeImportantText(line, sectionKey, keyPrefix);
  }

  const lead = line.slice(0, colonIndex + 1);
  const rest = line.slice(colonIndex + 1);

  return (
    <>
      <strong className="font-semibold text-foreground">{lead}</strong>
      {emphasizeImportantText(rest, sectionKey, `${keyPrefix}-rest`)}
    </>
  );
}

function renderSectionContent(value: string, sectionKey: MandateSectionKey) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return (
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
        {renderReadableLine(lines[0] ?? value, sectionKey, "single")}
      </p>
    );
  }

  const isNumberedList = lines.every((line) => /^\d+[.)]\s+/.test(line));

  if (isNumberedList) {
    return (
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        {lines.map((line, index) => (
          <li key={`${line}-${index}`}>
            {renderReadableLine(line.replace(/^\d+[.)]\s+/, ""), sectionKey, `numbered-${index}`)}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`}>
          {renderReadableLine(line.replace(/^[-*]\s+/, ""), sectionKey, `bullet-${index}`)}
        </li>
      ))}
    </ul>
  );
}

type LineSegment = { type: "plain"; text: string } | { type: "highlight"; text: string; comment: MandateComment };

function getLineSegments(
  displayLine: string,
  lineStart: number,
  lineEnd: number,
  ranges: CommentRange[],
  sectionKey: MandateSectionKey
): LineSegment[] {
  const overlapping = ranges
    .filter((r) => r.end > lineStart && r.start < lineEnd)
    .map((r) => ({
      start: Math.max(0, r.start - lineStart),
      end: Math.min(displayLine.length, r.end - lineStart),
      comment: r.comment
    }))
    .sort((a, b) => a.start - b.start);

  if (!overlapping.length) {
    return [{ type: "plain", text: displayLine }];
  }

  const segments: LineSegment[] = [];
  let pos = 0;
  for (const { start, end, comment } of overlapping) {
    if (start > pos) {
      segments.push({ type: "plain", text: displayLine.slice(pos, start) });
    }
    segments.push({ type: "highlight", text: displayLine.slice(start, end), comment });
    pos = end;
  }
  if (pos < displayLine.length) {
    segments.push({ type: "plain", text: displayLine.slice(pos) });
  }
  return segments;
}

function renderSectionContentWithHighlights(
  sectionText: string,
  sectionKey: MandateSectionKey,
  comments: MandateComment[],
  onCommentClick: (comment: MandateComment) => void
) {
  const ranges = getCommentRanges(sectionText, comments);
  const rawLines = sectionText.split("\n");
  let offset = 0;
  const lineInfos: { displayLine: string; start: number; end: number }[] = [];
  for (const raw of rawLines) {
    const displayLine = raw.trim();
    if (displayLine) {
      lineInfos.push({ displayLine, start: offset, end: offset + raw.length });
    }
    offset += raw.length + 1;
  }

  if (lineInfos.length <= 1) {
    const line = lineInfos[0]?.displayLine ?? sectionText.trim();
    const start = lineInfos[0]?.start ?? 0;
    const end = lineInfos[0]?.end ?? sectionText.length;
    const segments = getLineSegments(line, start, end, ranges, sectionKey);
    return (
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
        {segments.map((seg, i) =>
          seg.type === "plain" ? (
            <span key={i}>{emphasizeImportantText(seg.text, sectionKey, `single-${i}`)}</span>
          ) : (
            <span
              key={i}
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded bg-amber-200/80 text-foreground underline decoration-amber-500/80 decoration-2 underline-offset-1 hover:bg-amber-300/80 dark:bg-amber-600/40 dark:hover:bg-amber-600/50"
              onClick={(e) => {
                e.preventDefault();
                onCommentClick(seg.comment);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCommentClick(seg.comment);
                }
              }}
            >
              {emphasizeImportantText(seg.text, sectionKey, `highlight-${i}`)}
            </span>
          )
        )}
      </p>
    );
  }

  const isNumberedList = lineInfos.every((info) => /^\d+[.)]\s+/.test(info.displayLine));
  const stripPrefix = (line: string) =>
    isNumberedList ? line.replace(/^\d+[.)]\s+/, "") : line.replace(/^[-*]\s+/, "");
  const prefixLen = (line: string) => line.length - stripPrefix(line).length;

  const listClassName = "mt-2 space-y-1 pl-5 text-sm text-muted-foreground";

  return isNumberedList ? (
    <ol className={`${listClassName} list-decimal`}>
      {lineInfos.map((info, index) => {
        const contentLine = stripPrefix(info.displayLine);
        const lineStart = info.start + prefixLen(info.displayLine);
        const segments = getLineSegments(contentLine, lineStart, info.end, ranges, sectionKey);
        return (
          <li key={`${info.displayLine}-${index}`}>
            {segments.map((seg, i) =>
              seg.type === "plain" ? (
                <span key={i}>{emphasizeImportantText(seg.text, sectionKey, `line-${index}-${i}`)}</span>
              ) : (
                <span
                  key={i}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer rounded bg-amber-200/80 text-foreground underline decoration-amber-500/80 decoration-2 underline-offset-1 hover:bg-amber-300/80 dark:bg-amber-600/40 dark:hover:bg-amber-600/50"
                  onClick={(e) => {
                    e.preventDefault();
                    onCommentClick(seg.comment);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCommentClick(seg.comment);
                    }
                  }}
                >
                  {emphasizeImportantText(seg.text, sectionKey, `line-${index}-hl-${i}`)}
                </span>
              )
            )}
          </li>
        );
      })}
    </ol>
  ) : (
    <ul className={`${listClassName} list-disc`}>
      {lineInfos.map((info, index) => {
        const contentLine = stripPrefix(info.displayLine);
        const lineStart = info.start + prefixLen(info.displayLine);
        const segments = getLineSegments(contentLine, lineStart, info.end, ranges, sectionKey);
        return (
          <li key={`${info.displayLine}-${index}`}>
            {segments.map((seg, i) =>
              seg.type === "plain" ? (
                <span key={i}>{emphasizeImportantText(seg.text, sectionKey, `line-${index}-${i}`)}</span>
              ) : (
                <span
                  key={i}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer rounded bg-amber-200/80 text-foreground underline decoration-amber-500/80 decoration-2 underline-offset-1 hover:bg-amber-300/80 dark:bg-amber-600/40 dark:hover:bg-amber-600/50"
                  onClick={(e) => {
                    e.preventDefault();
                    onCommentClick(seg.comment);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCommentClick(seg.comment);
                    }
                  }}
                >
                  {emphasizeImportantText(seg.text, sectionKey, `line-${index}-hl-${i}`)}
                </span>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}

function OversightVersionCard({ versionReview }: { versionReview: PolicyVersionWithReviews }) {
  return (
    <article className="rounded-xl border p-3">
      <div>
        <p className="text-sm font-semibold">
          Version {formatNumber(versionReview.version)} changes
        </p>
        <p className="text-xs text-muted-foreground">
          Changed {prettyDate(versionReview.changedAt)}
          {versionReview.changedByName ? ` by ${versionReview.changedByName}` : ""}
        </p>
      </div>
      {versionReview.diffs.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No section-level diff available.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {versionReview.diffs.map((diff) => (
            <details key={diff.key} className="rounded-lg border p-2">
              <summary className="cursor-pointer text-sm font-medium">{diff.label}</summary>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Previous
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {diff.before || "(empty)"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Updated
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {diff.after || "(empty)"}
                  </p>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
      <div className="mt-3 border-t pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Reviewer status
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {versionReview.reviews.length === 0 ? (
            <li className="text-xs text-muted-foreground">No reviewers for this version.</li>
          ) : (
            versionReview.reviews.map((review, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-foreground">
                  {review.userName ?? "Unknown"}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[review.status]}`}
                >
                  {review.status}
                </span>
                {review.status === "flagged" && review.flagReason ? (
                  <span className="text-rose-600">— {review.flagReason}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </article>
  );
}

export default function MandatePage() {
  const { user } = useAuth();
  const canEdit = user?.role === "oversight";

  const { data, isLoading, error, mutate } = useSWR<MandatePolicyPageData>(
    user ? "/api/policy/mandate" : null,
    { refreshInterval: 60_000 }
  );

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<MandatePolicyContent | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [flagReasons, setFlagReasons] = useState<Record<string, string>>({});

  const [pendingComment, setPendingComment] = useState<{
    sectionKey: MandateSectionKey;
    quotedText: string;
  } | null>(null);
  const [addCommentBody, setAddCommentBody] = useState("");
  const [addCommentSubmitting, setAddCommentSubmitting] = useState(false);
  const [addCommentError, setAddCommentError] = useState<string | null>(null);
  const [viewingComment, setViewingComment] = useState<MandateComment | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [resolvingThread, setResolvingThread] = useState(false);
  const [floatingButtonPosition, setFloatingButtonPosition] = useState<{ x: number; y: number } | null>(null);
  const [addCommentOpen, setAddCommentOpen] = useState(false);

  const sections = useMemo(
    () =>
      MANDATE_SECTION_ORDER.map((key) => ({
        key,
        label: MANDATE_SECTION_LABELS[key]
      })),
    []
  );

  useEffect(() => {
    if (!data?.policy.content || isEditing) {
      return;
    }

    setDraft(data.policy.content);
  }, [data, isEditing]);

  const handleSelectionOrMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel) return;
    const text = sel.toString().trim();
    if (!text) {
      setFloatingButtonPosition(null);
      return;
    }
    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    let node: Node | null = sel.anchorNode;
    while (node && node !== document.body) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const sectionKey = el.getAttribute?.("data-mandate-section");
        if (sectionKey) {
          const rect = range.getBoundingClientRect();
          setPendingComment({ sectionKey: sectionKey as MandateSectionKey, quotedText: text });
          setFloatingButtonPosition({ x: rect.left + rect.width / 2, y: rect.top });
          return;
        }
      }
      node = node.parentNode;
    }
    setFloatingButtonPosition(null);
    setPendingComment(null);
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelectionOrMouseUp);
    return () => document.removeEventListener("mouseup", handleSelectionOrMouseUp);
  }, [handleSelectionOrMouseUp]);

  const openAddCommentDialog = useCallback(() => {
    setAddCommentBody("");
    setAddCommentError(null);
    setFloatingButtonPosition(null);
    window.getSelection()?.removeAllRanges();
    setAddCommentOpen(true);
  }, []);

  if (!user) {
    return <p className="text-sm text-muted-foreground">Loading mandate...</p>;
  }

  if (error) {
    return (
      <GlassCard>
        <CardLabel>Mandate Error</CardLabel>
        <p className="mt-2 text-sm text-rose-600">
          We could not load the mandate: {error.message}
        </p>
        <Button variant="outline" size="lg" className="mt-3" onClick={() => void mutate()}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </GlassCard>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading mandate...</p>;
  }

  const updateDraftField = (key: MandateSectionKey, value: string) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    if (saveMessage) {
      setSaveMessage(null);
    }
  };

  const savePolicy = async () => {
    if (!draft) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/policy/mandate", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: draft })
      });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));

      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to save policy."));
      }

      const notifiedUsersCount = Number(payload.notifiedUsersCount ?? 0);
      setSaveMessage({
        tone: "success",
        text: `Mandate saved. A new version was created and ${formatNumber(notifiedUsersCount)} users were notified.`
      });
      setIsEditing(false);
      await mutate();
    } catch (err) {
      setSaveMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to save policy."
      });
    } finally {
      setSaving(false);
    }
  };

  const submitNewComment = async () => {
    if (!pendingComment || !addCommentBody.trim()) return;
    setAddCommentSubmitting(true);
    setAddCommentError(null);
    try {
      const response = await fetch("/api/policy/mandate/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sectionKey: pendingComment.sectionKey,
          quotedText: pendingComment.quotedText,
          body: addCommentBody.trim()
        })
      });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to add comment."));
      }
      setPendingComment(null);
      setAddCommentOpen(false);
      setAddCommentBody("");
      await mutate();
    } catch (err) {
      setAddCommentError(err instanceof Error ? err.message : "Failed to add comment.");
    } finally {
      setAddCommentSubmitting(false);
    }
  };

  const submitReply = async () => {
    if (!viewingComment?.id || !replyBody.trim()) return;
    setReplySubmitting(true);
    setReplyError(null);
    try {
      const response = await fetch("/api/policy/mandate/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parentId: viewingComment.id, body: replyBody.trim() })
      });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to add reply."));
      }
      setReplyBody("");
      await mutate();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to add reply.");
    } finally {
      setReplySubmitting(false);
    }
  };

  const markThreadResolved = async () => {
    if (!viewingComment?.id) return;
    setResolvingThread(true);
    try {
      const response = await fetch(`/api/policy/mandate/comments/${viewingComment.id}/resolve`, {
        method: "PATCH"
      });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to mark as resolved."));
      }
      setViewingComment(null);
      setReplyBody("");
      setReplyError(null);
      await mutate();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to mark as resolved.");
    } finally {
      setResolvingThread(false);
    }
  };

  const updateNotificationStatus = async (
    notificationId: string,
    action: "acknowledge" | "flag"
  ) => {
    setActiveNotificationId(notificationId);
    setNotificationMessage(null);

    try {
      const response = await fetch(`/api/policy/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "flag" ? flagReasons[notificationId] ?? "" : undefined
        })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to update notification."));
      }

      setNotificationMessage(
        action === "acknowledge"
          ? "Update acknowledged."
          : "Update flagged for discussion."
      );
      await mutate();
      void globalMutate("/api/navigation/summary");
    } catch (err) {
      setNotificationMessage(err instanceof Error ? err.message : "Failed to update notification.");
    } finally {
      setActiveNotificationId(null);
    }
  };

  return (
    <div className="page-stack pb-6">
      <GlassCard className="rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>Foundation Mandate</CardLabel>
            <CardValue>{data.policy.title}</CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Version {formatNumber(data.policy.version)} | Last updated {prettyDate(data.policy.updatedAt)}
              {data.policy.updatedByName ? ` by ${data.policy.updatedByName}` : ""}
            </p>
            {!canEdit ? (
              <p className="mt-1 text-xs text-muted-foreground">
                You have {formatNumber(data.pendingNotificationsCount)} update(s) waiting for review.
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              Highlight any text and click &ldquo;Add comment&rdquo; to leave a note for the group.
            </p>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {isEditing ? (
                <>
                  <Button
                    size="lg"
                    disabled={saving}
                    onClick={() => void savePolicy()}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={saving}
                    onClick={() => {
                      setIsEditing(false);
                      setDraft(data.policy.content);
                      setSaveMessage(null);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setIsEditing(true);
                    setDraft(data.policy.content);
                    setSaveMessage(null);
                  }}
                >
                  Edit Mandate
                </Button>
              )}
            </div>
          ) : null}
        </div>

        {saveMessage ? (
          <p
            className={`mt-2 text-xs ${
              saveMessage.tone === "error"
                ? "text-rose-600"
                : "text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {saveMessage.text}
          </p>
        ) : null}
      </GlassCard>

      {isEditing && canEdit && draft ? (
        <GlassCard>
          <CardLabel>Edit Mandate</CardLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            Saving creates a new version and notifies non-oversight users about what changed in each section.
          </p>
          <div className="mt-4 space-y-3">
            {sections.map((section) => (
              <div key={section.key} className="space-y-1.5">
                <Label htmlFor={`mandate-${section.key}`}>{section.label}</Label>
                <Textarea
                  id={`mandate-${section.key}`}
                  value={draft[section.key]}
                  onChange={(event) => updateDraftField(section.key, event.target.value)}
                  className="min-h-32 rounded-xl text-sm"
                />
              </div>
            ))}
          </div>
        </GlassCard>
      ) : (
        <section className="space-y-3">
          {sections.map((section) => {
            const sectionComments = data.mandateComments.filter(
              (c) => c.sectionKey === section.key && c.parentId == null
            );
            const sectionText = data.policy.content[section.key];
            const withHighlights = sectionComments.length > 0;

            return (
              <GlassCard key={section.key}>
                <CardLabel>{section.label}</CardLabel>
                <div
                  data-mandate-section={section.key}
                  className="select-text"
                >
                  {withHighlights
                    ? renderSectionContentWithHighlights(
                        sectionText,
                        section.key,
                        sectionComments,
                        setViewingComment
                      )
                    : renderSectionContent(sectionText, section.key)}
                </div>
              </GlassCard>
            );
          })}
        </section>
      )}

      {typeof document !== "undefined" &&
        floatingButtonPosition !== null &&
        pendingComment &&
        createPortal(
          <div
            className="fixed z-50 -translate-x-1/2 -translate-y-full"
            style={{
              left: floatingButtonPosition.x,
              top: floatingButtonPosition.y - 8
            }}
          >
            <Button
              size="sm"
              className="gap-1.5 shadow-lg"
              onClick={openAddCommentDialog}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Add comment
            </Button>
          </div>,
          document.body
        )}

      <Dialog
        open={addCommentOpen}
        onOpenChange={(open) => {
          setAddCommentOpen(open);
          if (!open) {
            setPendingComment(null);
            setAddCommentError(null);
          }
        }}
      >
        <DialogContent showCloseButton={!addCommentSubmitting}>
          <DialogHeader>
            <DialogTitle>Add comment</DialogTitle>
            {pendingComment ? (
              <p className="text-sm text-muted-foreground">
                On: &ldquo;{pendingComment.quotedText.slice(0, 120)}
                {pendingComment.quotedText.length > 120 ? "…" : ""}&rdquo;
              </p>
            ) : null}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mandate-comment-body">Your comment</Label>
            <Textarea
              id="mandate-comment-body"
              value={addCommentBody}
              onChange={(e) => setAddCommentBody(e.target.value)}
              placeholder="Add a note for the group..."
              className="min-h-24"
              disabled={addCommentSubmitting}
            />
            {addCommentError ? (
              <p className="text-xs text-rose-600">{addCommentError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => void submitNewComment()}
              disabled={addCommentSubmitting || !addCommentBody.trim()}
            >
              {addCommentSubmitting ? "Adding…" : "Add comment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewingComment}
        onOpenChange={(open) => {
          if (!open) {
            setViewingComment(null);
            setReplyBody("");
            setReplyError(null);
          }
        }}
      >
        <DialogContent showCloseButton={!replySubmitting && !resolvingThread}>
          {viewingComment ? (
            <>
              <DialogHeader>
                <DialogTitle>Comment thread</DialogTitle>
                {viewingComment.quotedText ? (
                  <p className="text-xs text-muted-foreground">
                    On: &ldquo;{viewingComment.quotedText.slice(0, 100)}
                    {viewingComment.quotedText.length > 100 ? "…" : ""}&rdquo;
                  </p>
                ) : null}
              </DialogHeader>
              <div className="space-y-3">
                <article className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {viewingComment.authorName ?? "Unknown"} · {prettyDate(viewingComment.createdAt)}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{viewingComment.body}</p>
                </article>
                {data.mandateComments
                  .filter((c) => c.parentId === viewingComment.id)
                  .map((reply) => (
                    <article
                      key={reply.id}
                      className="ml-4 border-l-2 border-muted-foreground/20 pl-3"
                    >
                      <p className="text-xs font-medium text-muted-foreground">
                        {reply.authorName ?? "Unknown"} · {prettyDate(reply.createdAt)}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm">{reply.body}</p>
                    </article>
                  ))}
                <div className="space-y-2 pt-2">
                  <Label htmlFor="mandate-reply-body" className="text-xs text-muted-foreground">
                    Reply
                  </Label>
                  <Textarea
                    id="mandate-reply-body"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a reply..."
                    className="min-h-20 text-sm"
                    disabled={replySubmitting}
                  />
                  {replyError ? (
                    <p className="text-xs text-rose-600">{replyError}</p>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => void submitReply()}
                    disabled={replySubmitting || !replyBody.trim()}
                  >
                    {replySubmitting ? "Sending…" : "Reply"}
                  </Button>
                </div>
                {canEdit ? (
                  <div className="border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => void markThreadResolved()}
                      disabled={resolvingThread}
                    >
                      {resolvingThread ? "Marking…" : "Mark thread resolved"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {!canEdit ? (
        <GlassCard>
          <CardLabel>Policy Update Notifications</CardLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            Review each update and either acknowledge it or flag it for discussion.
          </p>

          {notificationMessage ? (
            <p className="mt-2 text-xs text-muted-foreground">{notificationMessage}</p>
          ) : null}

          <div className="mt-3 space-y-3">
            {data.notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No policy updates yet.</p>
            ) : (
              data.notifications.map((notification) => (
                <article key={notification.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        Version {formatNumber(notification.version)} changes
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Changed {prettyDate(notification.changedAt)}
                        {notification.changedByName ? ` by ${notification.changedByName}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_STYLES[notification.status]}`}
                    >
                      {notification.status}
                    </span>
                  </div>

                  {notification.diffs.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No section-level diff available.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {notification.diffs.map((diff) => (
                        <details key={`${notification.id}-${diff.key}`} className="rounded-lg border p-2">
                          <summary className="cursor-pointer text-sm font-medium">{diff.label}</summary>
                          <div className="mt-2 grid gap-2 lg:grid-cols-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Previous
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                                {diff.before || "(empty)"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Updated
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                                {diff.after || "(empty)"}
                              </p>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}

                  {notification.flagReason ? (
                    <p className="mt-2 text-xs text-rose-600">
                      Reason flagged: {notification.flagReason}
                    </p>
                  ) : null}

                  {notification.status === "pending" ? (
                    <div className="mt-3 space-y-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`flag-reason-${notification.id}`} className="text-xs text-muted-foreground">
                          Discussion note (required if you flag this update)
                        </Label>
                        <Input
                          id={`flag-reason-${notification.id}`}
                          type="text"
                          value={flagReasons[notification.id] ?? ""}
                          onChange={(event) =>
                            setFlagReasons((current) => ({
                              ...current,
                              [notification.id]: event.target.value
                            }))
                          }
                          placeholder="What should the team discuss?"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="lg"
                          disabled={activeNotificationId === notification.id}
                          onClick={() => void updateNotificationStatus(notification.id, "acknowledge")}
                          className="bg-emerald-600 hover:bg-emerald-600/90"
                        >
                          Mark Acknowledged
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="lg"
                          disabled={
                            activeNotificationId === notification.id ||
                            (flagReasons[notification.id] ?? "").trim().length < 4
                          }
                          onClick={() => void updateNotificationStatus(notification.id, "flag")}
                        >
                          Flag for Discussion
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </GlassCard>
      ) : null}

      {canEdit && (data.oversightVersionReviews?.length ?? 0) > 0 ? (
        <GlassCard>
          <CardLabel>Policy Update Notifications</CardLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            Each version change with previous vs updated text, and each reviewer&apos;s acknowledgement, flag (with comment), or pending status.
          </p>
          <div className="mt-3 space-y-3">
            {(data.oversightVersionReviews ?? []).map((versionReview) => (
              <OversightVersionCard key={versionReview.version} versionReview={versionReview} />
            ))}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
