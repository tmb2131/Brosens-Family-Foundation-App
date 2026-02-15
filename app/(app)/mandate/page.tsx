"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import {
  MandatePolicyContent,
  MandatePolicyPageData,
  MandateSectionKey,
  PolicyChangeNotification
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
    /economic opportunity/gi,
    /education/gi,
    /long-term pathways to equity/gi
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
          className="font-semibold text-zinc-800 dark:text-zinc-100"
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
      <strong className="font-semibold text-zinc-800 dark:text-zinc-100">{lead}</strong>
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
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
        {renderReadableLine(lines[0] ?? value, sectionKey, "single")}
      </p>
    );
  }

  const isNumberedList = lines.every((line) => /^\d+[.)]\s+/.test(line));

  if (isNumberedList) {
    return (
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
        {lines.map((line, index) => (
          <li key={`${line}-${index}`}>
            {renderReadableLine(line.replace(/^\d+[.)]\s+/, ""), sectionKey, `numbered-${index}`)}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`}>
          {renderReadableLine(line.replace(/^[-*]\s+/, ""), sectionKey, `bullet-${index}`)}
        </li>
      ))}
    </ul>
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

  if (!user) {
    return <p className="text-sm text-zinc-500">Loading mandate...</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-rose-600">
        We could not load the mandate: {error.message}
      </p>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-zinc-500">Loading mandate...</p>;
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
      <Card className="rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Foundation Mandate</CardTitle>
            <CardValue>{data.policy.title}</CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <span className="status-dot bg-emerald-500" />
              Version {formatNumber(data.policy.version)} | Last updated {prettyDate(data.policy.updatedAt)}
              {data.policy.updatedByName ? ` by ${data.policy.updatedByName}` : ""}
            </p>
            {!canEdit ? (
              <p className="mt-1 text-xs text-zinc-500">
                You have {formatNumber(data.pendingNotificationsCount)} update(s) waiting for review.
              </p>
            ) : null}
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void savePolicy()}
                    className="min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setIsEditing(false);
                      setDraft(data.policy.content);
                      setSaveMessage(null);
                    }}
                    className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setDraft(data.policy.content);
                    setSaveMessage(null);
                  }}
                  className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Edit Mandate
                </button>
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
      </Card>

      {isEditing && canEdit && draft ? (
        <Card>
          <CardTitle>Edit Mandate</CardTitle>
          <p className="mt-1 text-sm text-zinc-500">
            Saving creates a new version and notifies non-oversight users about what changed in each section.
          </p>
          <div className="mt-4 space-y-3">
            {sections.map((section) => (
              <label key={section.key} className="block text-sm font-medium">
                {section.label}
                <textarea
                  value={draft[section.key]}
                  onChange={(event) => updateDraftField(section.key, event.target.value)}
                  className="field-control mt-1 min-h-32 w-full rounded-xl text-sm"
                />
              </label>
            ))}
          </div>
        </Card>
      ) : (
        <section className="space-y-3">
          {sections.map((section) => (
            <Card key={section.key}>
              <CardTitle>{section.label}</CardTitle>
              {renderSectionContent(data.policy.content[section.key], section.key)}
            </Card>
          ))}
        </section>
      )}

      {canEdit ? (
        <Card>
          <CardTitle>Flagged for Discussion</CardTitle>
          <p className="mt-1 text-sm text-zinc-500">
            Non-oversight users can flag updates here and leave notes for follow-up.
          </p>

          <div className="mt-3 space-y-2">
            {data.discussionFlags.length === 0 ? (
              <p className="text-sm text-zinc-500">No flagged notes right now.</p>
            ) : (
              data.discussionFlags.map((flag) => (
                <article key={flag.id} className="rounded-xl border p-3">
                  <p className="text-sm font-semibold">
                    {flag.userName ?? "Unknown user"} flagged version {formatNumber(flag.version)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Flagged {prettyDate(flag.flaggedAt)} | Changed {prettyDate(flag.changedAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
                    {flag.reason}
                  </p>
                </article>
              ))
            )}
          </div>
        </Card>
      ) : null}

      {!canEdit ? (
        <Card>
          <CardTitle>Policy Update Notifications</CardTitle>
          <p className="mt-1 text-sm text-zinc-500">
            Review each update and either acknowledge it or flag it for discussion.
          </p>

          {notificationMessage ? (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{notificationMessage}</p>
          ) : null}

          <div className="mt-3 space-y-3">
            {data.notifications.length === 0 ? (
              <p className="text-sm text-zinc-500">No policy updates yet.</p>
            ) : (
              data.notifications.map((notification) => (
                <article key={notification.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        Version {formatNumber(notification.version)} changes
                      </p>
                      <p className="text-xs text-zinc-500">
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
                    <p className="mt-2 text-xs text-zinc-500">No section-level diff available.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {notification.diffs.map((diff) => (
                        <details key={`${notification.id}-${diff.key}`} className="rounded-lg border p-2">
                          <summary className="cursor-pointer text-sm font-medium">{diff.label}</summary>
                          <div className="mt-2 grid gap-2 lg:grid-cols-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                Previous
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
                                {diff.before || "(empty)"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                Updated
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
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
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={activeNotificationId === notification.id}
                          onClick={() => void updateNotificationStatus(notification.id, "acknowledge")}
                          className="min-h-11 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Mark Acknowledged
                        </button>
                        <button
                          type="button"
                          disabled={activeNotificationId === notification.id}
                          onClick={() => void updateNotificationStatus(notification.id, "flag")}
                          className="min-h-11 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Flag for Discussion
                        </button>
                      </div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        Discussion note (required if you flag this update)
                        <input
                          type="text"
                          value={flagReasons[notification.id] ?? ""}
                          onChange={(event) =>
                            setFlagReasons((current) => ({
                              ...current,
                              [notification.id]: event.target.value
                            }))
                          }
                          className="field-control mt-1 w-full"
                          placeholder="What should the team discuss?"
                        />
                      </label>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
