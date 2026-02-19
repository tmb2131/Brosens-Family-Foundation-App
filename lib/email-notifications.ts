import { SupabaseClient } from "@supabase/supabase-js";
import { AppRole, ProposalType } from "@/lib/types";
import { HttpError } from "@/lib/http-error";
import { currency } from "@/lib/utils";

type AdminClient = SupabaseClient;
type EmailNotificationType =
  | "action_required"
  | "weekly_action_reminder"
  | "proposal_sent_fyi"
  | "introduction"
  | "proposal_submitted_confirmation"
  | "user_access_notification";

type OutstandingActionType = "vote_required" | "meeting_review_required" | "admin_send_required";

interface UserProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  timezone: string | null;
}

interface ProposalActionRow {
  id: string;
  proposal_title: string | null;
  proposer_id: string;
  proposal_type: ProposalType;
  created_at: string;
}

interface ApprovedProposalRow {
  id: string;
  proposal_title: string | null;
  proposer_id: string;
  created_at: string;
}

interface VoteActionRow {
  proposal_id: string;
  voter_id: string;
}

interface EmailNotificationRow {
  id: string;
  subject: string;
  html_body: string;
  text_body: string;
  payload: Record<string, unknown> | null;
}

interface EmailDeliveryRow {
  id: string;
  notification_id: string;
  user_id: string;
  email: string;
  attempt_count: number;
}

interface LocalTimeSnapshot {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
}

interface OutstandingAction {
  id: string;
  type: OutstandingActionType;
  title: string;
  description: string;
  linkPath: string;
  createdAt: string;
}

interface OwnProposalUpdate {
  id: string;
  title: string;
  statusLabel: "To review" | "Approved";
  summary: string;
  chaseNames: string[];
  linkPath: string;
  createdAt: string;
}

interface QueueEmailNotificationInput {
  notificationType: EmailNotificationType;
  actorUserId?: string | null;
  entityId?: string | null;
  idempotencyKey: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  primaryLinkPath: string;
  primaryLinkLabel?: string;
  payload?: Record<string, unknown>;
  recipientUserIds: string[];
}

interface QueueActionRequiredEmailInput {
  recipientUserIds: string[];
  actorUserId?: string | null;
  entityId: string;
  actionType: OutstandingActionType;
  actionTitle: string;
  actionDescription: string;
  actionLinkPath: string;
  idempotencyKeyPrefix: string;
}

interface SendEmailResult {
  ok: boolean;
  providerMessageId?: string | null;
  permanent: boolean;
  errorMessage?: string;
}

interface ResendApiResponse {
  id?: string;
  message?: string;
  error?: unknown;
}

interface EmailConfig {
  from: string;
  apiKey: string;
  replyTo: string | null;
}

export interface ProcessEmailDeliveryResult {
  processed: number;
  sent: number;
  failed: number;
  pendingRetries: number;
  skipped: number;
  configMissing: boolean;
}

export interface ProcessWeeklyActionReminderResult {
  evaluatedUsers: number;
  dueUsers: number;
  remindersQueued: number;
  skippedNoActions: number;
  skippedWrongLocalTime: number;
  skippedAlreadySent: number;
}

export interface ProcessDailyProposalSentDigestResult {
  dueForWindow: boolean;
  sentEventsFound: number;
  proposalsIncluded: number;
  digestQueued: number;
  skippedNoEvents: number;
  skippedWrongLocalTime: number;
  skippedAlreadySent: number;
}

/** Preview payload for the daily sent digest (no email sent). */
export interface DailyDigestPreview {
  dayKey: string;
  proposals: Array<{ id: string; title: string; sentAt: string | null; amount: number }>;
  outstanding: Array<{ id: string; title: string }>;
}

const MAX_EMAIL_DELIVERY_ATTEMPTS = 5;
const WEEKLY_REMINDER_LOCAL_HOUR = 10;
const DAILY_SENT_DIGEST_LOCAL_HOUR = 10;
const DEFAULT_TIMEZONE = "America/New_York";
const WEEKDAY_TUESDAY = 2;

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sanitizeLinkPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  return trimmed;
}

function truncateErrorMessage(message: string) {
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

function resolveNextRetryAt(attemptCount: number) {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapEmailHtml(preheader: string, contentHtml: string) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<title>Brosens Family Foundation</title>
<!--[if mso]>
<style>table,td{font-family:Arial,sans-serif;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

<!-- Header -->
<tr><td style="padding:20px 32px;border-bottom:3px solid #249660;">
<span style="font-size:18px;font-weight:700;color:#111827;">Brosens Family Foundation</span>
</td></tr>

<!-- Content card -->
<tr><td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
${contentHtml}
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;text-align:center;">
<p style="margin:0 0 6px 0;font-size:12px;color:#9ca3af;line-height:1.5;">You received this email because you are a member of the Brosens Family Foundation.</p>
<p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">Sent automatically &mdash; please do not reply to this email.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function emailButton(label: string, href: string) {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
<tr><td align="center" style="background-color:#2563eb;border-radius:8px;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="18%" fillcolor="#2563eb" stroke="f">
<w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">${safeLabel}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!--><a href="${safeHref}" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;line-height:1;">${safeLabel}</a><!--<![endif]-->
</td></tr>
</table>`;
}

function emailSectionHeading(text: string) {
  return `<h3 style="margin:28px 0 12px 0;padding-bottom:8px;border-bottom:1px solid #e5e7eb;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(text)}</h3>`;
}

function roleLabel(role: AppRole) {
  if (role === "admin") {
    return "admin";
  }
  if (role === "manager") {
    return "manager";
  }
  if (role === "oversight") {
    return "oversight";
  }
  return "member";
}

function getEmailConfig(): EmailConfig | null {
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || null;

  if (!from || !apiKey) {
    return null;
  }

  return {
    from,
    apiKey,
    replyTo
  };
}

function getAppBaseUrl() {
  const baseUrlCandidates = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
  ];

  for (const candidate of baseUrlCandidates) {
    const value = String(candidate ?? "").trim();
    if (!value) {
      continue;
    }

    try {
      const url = new URL(value);
      return `${url.origin}/`;
    } catch {
      continue;
    }
  }

  return null;
}

function withAppBase(path: string) {
  const safePath = sanitizeLinkPath(path);
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) {
    return safePath;
  }

  try {
    return new URL(safePath, baseUrl).toString();
  } catch {
    return safePath;
  }
}

function buildOpenPath(path: string) {
  return `/open?to=${encodeURIComponent(sanitizeLinkPath(path))}`;
}

function buildOpenUrl(path: string) {
  return withAppBase(buildOpenPath(path));
}

function getLocalTimeSnapshot(now: Date, timeZone: string): LocalTimeSnapshot | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });

    const parts = formatter.formatToParts(now);
    const byType = new Map(parts.map((part) => [part.type, part.value]));
    const weekdayToken = (byType.get("weekday") ?? "").slice(0, 3).toLowerCase();
    const weekday = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(weekdayToken);

    if (weekday < 0) {
      return null;
    }

    const year = Number(byType.get("year"));
    const month = Number(byType.get("month"));
    const day = Number(byType.get("day"));
    const hour = Number(byType.get("hour"));

    if (![year, month, day, hour].every(Number.isFinite)) {
      return null;
    }

    return {
      year,
      month,
      day,
      weekday,
      hour
    };
  } catch {
    return null;
  }
}

function toIsoWeekKey(localDate: Pick<LocalTimeSnapshot, "year" | "month" | "day">) {
  const date = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function toIsoDateKey(localDate: Pick<LocalTimeSnapshot, "year" | "month" | "day">) {
  return `${localDate.year}-${String(localDate.month).padStart(2, "0")}-${String(localDate.day).padStart(2, "0")}`;
}

function displayName(user: UserProfileRow) {
  const fullName = String(user.full_name ?? "").trim();
  if (fullName) {
    return fullName;
  }
  const localPart = String(user.email ?? "")
    .split("@")[0]
    ?.trim();
  return localPart || "there";
}

function displayNameOrEmail(user: UserProfileRow | undefined) {
  if (!user) {
    return "Unknown user";
  }
  const fullName = String(user.full_name ?? "").trim();
  if (fullName) {
    return fullName;
  }
  const email = String(user.email ?? "").trim();
  return email || "Unknown user";
}

function sortActions(actions: OutstandingAction[]) {
  return [...actions].sort((a, b) => {
    const createdDiff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (!Number.isNaN(createdDiff) && createdDiff !== 0) {
      return createdDiff;
    }
    return a.title.localeCompare(b.title);
  });
}

function renderOutstandingActionsText(actions: OutstandingAction[]) {
  if (!actions.length) {
    return "No outstanding actions remain.";
  }

  return sortActions(actions)
    .map((action, index) => {
      const link = buildOpenUrl(action.linkPath);
      return `${index + 1}. ${action.title}\n   ${action.description}\n   ${link}`;
    })
    .join("\n");
}

function renderOutstandingActionsHtml(actions: OutstandingAction[]) {
  if (!actions.length) {
    return "<p style=\"margin:0;color:#4b5563;\">No outstanding actions remain.</p>";
  }

  const rows = sortActions(actions)
    .map((action) => {
      const link = buildOpenUrl(action.linkPath);
      const title = escapeHtml(action.title);
      const description = escapeHtml(action.description);
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
<tr><td style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:6px;">
<a href="${escapeHtml(link)}" style="color:#1d4ed8;text-decoration:underline;font-weight:600;">${title}</a><br />
<span style="color:#4b5563;font-size:14px;">${description}</span>
</td></tr>
</table>`;
    })
    .join("");

  return rows;
}

function sortOwnProposalUpdates(updates: OwnProposalUpdate[]) {
  return [...updates].sort((a, b) => {
    const createdDiff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (!Number.isNaN(createdDiff) && createdDiff !== 0) {
      return createdDiff;
    }
    return a.title.localeCompare(b.title);
  });
}

function renderOwnProposalUpdatesText(updates: OwnProposalUpdate[]) {
  if (!updates.length) {
    return "No pending proposals submitted by you.";
  }

  return sortOwnProposalUpdates(updates)
    .map((proposal, index) => {
      const link = buildOpenUrl(proposal.linkPath);
      const chaseLine = proposal.chaseNames.length
        ? proposal.chaseNames.join(", ")
        : "No follow-up owner identified yet.";
      return `${index + 1}. ${proposal.title} (${proposal.statusLabel})\n   ${proposal.summary}\n   Pending action from: ${chaseLine}\n   ${link}`;
    })
    .join("\n");
}

function statusBadgeColor(statusLabel: string): { bg: string; text: string } {
  if (statusLabel === "Approved") {
    return { bg: "#dcfce7", text: "#166534" };
  }
  return { bg: "#fef3c7", text: "#92400e" };
}

function renderOwnProposalUpdatesHtml(updates: OwnProposalUpdate[]) {
  if (!updates.length) {
    return "<p style=\"margin:0;color:#4b5563;\">No pending proposals submitted by you.</p>";
  }

  const rows = sortOwnProposalUpdates(updates)
    .map((proposal) => {
      const link = buildOpenUrl(proposal.linkPath);
      const chaseLine = proposal.chaseNames.length
        ? proposal.chaseNames.join(", ")
        : "No follow-up owner identified yet.";
      const badge = statusBadgeColor(proposal.statusLabel);
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
<tr><td style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:6px;">
<a href="${escapeHtml(link)}" style="color:#1d4ed8;text-decoration:underline;font-weight:600;">${escapeHtml(proposal.title)}</a>
<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;background-color:${badge.bg};color:${badge.text};">${escapeHtml(proposal.statusLabel)}</span><br />
<span style="color:#4b5563;font-size:14px;">${escapeHtml(proposal.summary)}</span><br />
<span style="color:#374151;font-size:14px;"><strong>Pending action from:</strong> ${escapeHtml(chaseLine)}</span>
</td></tr>
</table>`;
    })
    .join("");

  return rows;
}

function buildActionRequiredContent(input: {
  recipientName: string;
  actionTitle: string;
  actionDescription: string;
  actionLinkPath: string;
  outstandingActions: OutstandingAction[];
}) {
  const actionTitle = input.actionTitle.trim() || "New required action";
  const actionDescription = input.actionDescription.trim() || "A new action is required in your workspace.";
  const actionUrl = buildOpenUrl(input.actionLinkPath);
  const subject = `Action required: ${actionTitle}`;
  const outstandingText = renderOutstandingActionsText(input.outstandingActions);
  const outstandingHtml = renderOutstandingActionsHtml(input.outstandingActions);

  const textBody = [
    `Hi ${input.recipientName},`,
    "",
    "A new required action is waiting for you:",
    `${actionTitle}`,
    `${actionDescription}`,
    `${actionUrl}`,
    "",
    "Existing outstanding required actions:",
    outstandingText,
    "",
    "Brosens Family Foundation"
  ].join("\n");

  const contentHtml = `
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">Hi ${escapeHtml(input.recipientName)},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">A new required action is waiting for you:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
<tr><td style="padding:16px 20px;background-color:#eff6ff;border-left:4px solid #2563eb;border-radius:4px;">
<p style="margin:0 0 4px 0;font-weight:700;font-size:15px;color:#111827;">${escapeHtml(actionTitle)}</p>
<p style="margin:0;color:#4b5563;font-size:14px;">${escapeHtml(actionDescription)}</p>
</td></tr>
</table>
${emailButton("Open Required Action", actionUrl)}
${emailSectionHeading("Your outstanding actions")}
${outstandingHtml}`;

  const htmlBody = wrapEmailHtml(subject, contentHtml);

  return {
    subject,
    htmlBody,
    textBody
  };
}

function buildWeeklyReminderContent(input: {
  recipientName: string;
  outstandingActions: OutstandingAction[];
  ownProposalUpdates: OwnProposalUpdate[];
}) {
  const actionCount = input.outstandingActions.length;
  const ownProposalCount = input.ownProposalUpdates.length;
  const subjectParts: string[] = [];
  if (ownProposalCount > 0) {
    subjectParts.push(`${ownProposalCount} pending proposal${ownProposalCount === 1 ? "" : "s"}`);
  }
  if (actionCount > 0) {
    subjectParts.push(`${actionCount} action${actionCount === 1 ? "" : "s"} for you`);
  }
  const subject = subjectParts.length
    ? `Tuesday weekly update: ${subjectParts.join(", ")}`
    : "Tuesday weekly update";
  const outstandingText = renderOutstandingActionsText(input.outstandingActions);
  const outstandingHtml = renderOutstandingActionsHtml(input.outstandingActions);
  const ownProposalText = renderOwnProposalUpdatesText(input.ownProposalUpdates);
  const ownProposalHtml = renderOwnProposalUpdatesHtml(input.ownProposalUpdates);
  const primaryLinkPath = input.ownProposalUpdates[0]?.linkPath ?? input.outstandingActions[0]?.linkPath ?? "/workspace";
  const openUrl = buildOpenUrl(primaryLinkPath);

  const actionsSection = { heading: "Outstanding required actions", text: outstandingText, html: outstandingHtml, hasItems: actionCount > 0 };
  const proposalsSection = { heading: "Your pending proposals", text: ownProposalText, html: ownProposalHtml, hasItems: ownProposalCount > 0 };
  const sections = [actionsSection, proposalsSection].sort((a, b) => (a.hasItems === b.hasItems ? 0 : a.hasItems ? -1 : 1));

  const textBody = [
    `Hi ${input.recipientName},`,
    "",
    "Here is your Tuesday update.",
    `${openUrl}`,
    ...sections.flatMap((s) => ["", `${s.heading}:`, s.text]),
    "",
    "Brosens Family Foundation"
  ].join("\n");

  const contentHtml = `
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">Hi ${escapeHtml(input.recipientName)},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">Here is your Tuesday update.</p>
${emailButton("Open Actions", openUrl)}
${sections.map((s) => `${emailSectionHeading(s.heading)}\n${s.html}`).join("\n")}`;

  const htmlBody = wrapEmailHtml(subject, contentHtml);

  return {
    subject,
    htmlBody,
    textBody,
    primaryLinkPath
  };
}

function buildProposalSentFyiContent(input: {
  dayKey: string;
  proposals: Array<{ id: string; title: string; sentAt: string | null; amount: number }>;
  outstanding?: Array<{ id: string; title: string }>;
}) {
  const count = input.proposals.length;
  const subject = `Daily sent digest: ${count} donation${count === 1 ? "" : "s"} sent`;
  const openUrl = buildOpenUrl("/dashboard");
  const formatSentDate = (sentAt: string | null) => {
    const dateStr = sentAt?.trim() || input.dayKey;
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime())
      ? dateStr
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const proposalRowsText = input.proposals
    .map((proposal, index) => {
      const amountStr = currency(proposal.amount);
      const sentOn = formatSentDate(proposal.sentAt);
      return `${index + 1}. ${proposal.title} — ${amountStr} sent on ${sentOn}`;
    })
    .join("\n");
  const sentSectionHeading = "Donations marked Sent today";
  const proposalRowsHtml =
    input.proposals.length > 0
      ? input.proposals
          .map((proposal) => {
            const amountStr = currency(proposal.amount);
            const sentOn = formatSentDate(proposal.sentAt);
            return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
<tr><td style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:6px;">
<span style="font-weight:600;color:#111827;">${escapeHtml(proposal.title)}</span><br />
<span style="color:#4b5563;font-size:14px;">${escapeHtml(amountStr)} sent on ${escapeHtml(sentOn)}</span>
</td></tr>
</table>`;
          })
          .join("")
      : "<p style=\"margin:0;color:#4b5563;\">No donations marked Sent today.</p>";

  const outstandingList = input.outstanding ?? [];
  const outstandingText =
    outstandingList.length > 0
      ? outstandingList.map((p, i) => `${i + 1}. ${p.title}`).join("\n")
      : "None.";
  const outstandingSectionText = [
    "",
    "Still outstanding (approved, not yet marked Sent):",
    outstandingText
  ].join("\n");

  const outstandingSectionHeading = "Still outstanding (approved, not yet marked Sent)";
  const outstandingRowsHtml =
    outstandingList.length > 0
      ? outstandingList
          .map((p) => {
            return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
<tr><td style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:6px;">
<span style="font-weight:600;color:#111827;">${escapeHtml(p.title)}</span>
</td></tr>
</table>`;
          })
          .join("")
      : "<p style=\"margin:0;color:#4b5563;\">None.</p>";

  const textBody = [
    "Hello,",
    "",
    "Here is your daily sent digest.",
    "",
    `${openUrl}`,
    "",
    `${sentSectionHeading}:`,
    proposalRowsText || "No donations marked Sent today.",
    "",
    outstandingSectionHeading + ":",
    outstandingText,
    "",
    "Brosens Family Foundation"
  ].join("\n");

  const contentHtml = `
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">Hello,</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">Here is your daily sent digest.</p>
${emailButton("Open Dashboard", openUrl)}
${emailSectionHeading(sentSectionHeading)}
${proposalRowsHtml}
${emailSectionHeading(outstandingSectionHeading)}
${outstandingRowsHtml}
<p style="margin:20px 0 0 0;color:#6b7280;font-size:13px;">This daily digest is sent to all users.</p>`;

  const htmlBody = wrapEmailHtml(subject, contentHtml);

  return {
    subject,
    htmlBody,
    textBody
  };
}

function buildProposalSubmittedConfirmationContent(input: {
  proposerName: string;
  proposalTitle: string;
  proposedAmount: number;
  proposalType: ProposalType;
  otherMembersNotified: boolean;
}) {
  const title = input.proposalTitle.trim() || "Proposal";
  const amountStr = currency(input.proposedAmount);
  const typeLabel = input.proposalType === "joint" ? "Joint" : "Discretionary";
  const subject = `Proposal submitted: ${title}`;
  const workspaceUrl = buildOpenUrl("/workspace");

  const otherMembersLine = input.otherMembersNotified
    ? input.proposalType === "joint"
      ? "We've sent action-required emails to the other members asking them to submit their votes and allocations."
      : "We've sent action-required emails to the other members asking them to acknowledge or flag the proposal."
    : "You're the only voting member, so no other notifications were sent.";

  const textBody = [
    `Hi ${input.proposerName},`,
    "",
    "Your proposal has been submitted.",
    "",
    "Details:",
    `  Name: ${title}`,
    `  Amount: ${amountStr}`,
    `  Type: ${typeLabel}`,
    "",
    otherMembersLine,
    "",
    workspaceUrl,
    "",
    "Brosens Family Foundation"
  ].join("\n");

  const contentHtml = `
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">Hi ${escapeHtml(input.proposerName)},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">Your proposal has been submitted.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
<tr><td style="padding:16px 20px;background-color:#f0fdf4;border-left:4px solid #16a34a;border-radius:4px;">
<p style="margin:0 0 4px 0;font-weight:700;font-size:15px;color:#111827;">${escapeHtml(title)}</p>
<p style="margin:0;color:#4b5563;font-size:14px;">${escapeHtml(amountStr)} · ${escapeHtml(typeLabel)}</p>
</td></tr>
</table>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">${escapeHtml(otherMembersLine)}</p>
${emailButton("Open Workspace", workspaceUrl)}`;

  const htmlBody = wrapEmailHtml(subject, contentHtml);

  return {
    subject,
    htmlBody,
    textBody
  };
}

function formatLastAccessedAt(isoTimestamp: string): { dateTime: string; iso: string } {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return { dateTime: isoTimestamp, iso: isoTimestamp };
  }
  const dateTime = date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: "UTC"
  });
  return { dateTime, iso: date.toISOString() };
}

function buildUserAccessNotificationContent(input: {
  userEmail: string;
  lastAccessedAt: string;
}) {
  const { dateTime } = formatLastAccessedAt(input.lastAccessedAt);
  const subject = `User access: ${input.userEmail}`;
  const textBody = [
    "A foundation member has just accessed the app.",
    "",
    "User email: " + input.userEmail,
    "Last accessed at: " + dateTime,
    "",
    "Brosens Family Foundation"
  ].join("\n");

  const contentHtml = `
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#111827;">A foundation member has just accessed the app.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
<tr><td style="padding:16px 20px;background-color:#f0fdf4;border-left:4px solid #16a34a;border-radius:4px;">
<p style="margin:0 0 4px 0;font-size:15px;color:#111827;"><strong>User email:</strong> ${escapeHtml(input.userEmail)}</p>
<p style="margin:0;color:#4b5563;font-size:14px;"><strong>Last accessed at:</strong> ${escapeHtml(dateTime)}</p>
</td></tr>
</table>`;

  const htmlBody = wrapEmailHtml(subject, contentHtml);

  return {
    subject,
    htmlBody,
    textBody
  };
}

async function loadUsersByRoles(admin: AdminClient, roles: AppRole[]) {
  if (!roles.length) {
    return [];
  }

  const { data, error } = await admin
    .from("user_profiles")
    .select("id, full_name, email, role, timezone")
    .in("role", roles)
    .returns<UserProfileRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load user profiles by role: ${error.message}`);
  }

  return data ?? [];
}

async function loadUsersByIds(admin: AdminClient, userIds: string[]) {
  const ids = uniqueIds(userIds);
  if (!ids.length) {
    return new Map<string, UserProfileRow>();
  }

  const { data, error } = await admin
    .from("user_profiles")
    .select("id, full_name, email, role, timezone")
    .in("id", ids)
    .returns<UserProfileRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load user profiles: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.id, row]));
}

async function markEmailNotificationProcessed(admin: AdminClient, notificationId: string) {
  const { error } = await admin
    .from("email_notifications")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("processed_at", null);

  if (error) {
    throw new HttpError(500, `Could not mark email notification as processed: ${error.message}`);
  }
}

async function markEmailNotificationsProcessedIfDone(admin: AdminClient, notificationIds: string[]) {
  const ids = uniqueIds(notificationIds);
  for (const notificationId of ids) {
    const { count, error } = await admin
      .from("email_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("notification_id", notificationId)
      .eq("status", "pending");

    if (error) {
      throw new HttpError(500, `Could not verify email delivery status: ${error.message}`);
    }

    if ((count ?? 0) === 0) {
      await markEmailNotificationProcessed(admin, notificationId);
    }
  }
}

async function loadOversightEmails(admin: AdminClient): Promise<string[]> {
  const { data, error } = await admin
    .from("user_profiles")
    .select("email")
    .eq("role", "oversight")
    .returns<Array<{ email: string }>>();

  if (error) {
    console.error("[email] Could not load oversight emails for BCC:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => row.email?.trim())
    .filter(Boolean);
}

async function sendEmailViaResend(
  config: EmailConfig,
  delivery: Pick<EmailDeliveryRow, "email">,
  notification: EmailNotificationRow,
  bcc?: string[]
): Promise<SendEmailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      from: config.from,
      to: [delivery.email],
      reply_to: config.replyTo ?? undefined,
      bcc: bcc?.length ? bcc : undefined,
      subject: notification.subject,
      html: notification.html_body,
      text: notification.text_body
    })
  });

  const payload = (await response.json().catch(() => null)) as ResendApiResponse | null;
  if (!response.ok) {
    const fallbackMessage = payload?.message || payload?.error || `Email API error (${response.status})`;
    const message = truncateErrorMessage(String(fallbackMessage));
    const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
    return {
      ok: false,
      permanent,
      errorMessage: message
    };
  }

  return {
    ok: true,
    permanent: false,
    providerMessageId: payload?.id ?? null
  };
}

async function loadOutstandingActionsState(admin: AdminClient): Promise<{
  usersById: Map<string, UserProfileRow>;
  actionsByUserId: Map<string, OutstandingAction[]>;
  ownProposalUpdatesByUserId: Map<string, OwnProposalUpdate[]>;
}> {
  const [usersResult, toReviewResult, approvedResult] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id, full_name, email, role, timezone")
      .returns<UserProfileRow[]>(),
    admin
      .from("grant_proposals")
      .select("id, proposal_title, proposer_id, proposal_type, created_at")
      .eq("status", "to_review")
      .returns<ProposalActionRow[]>(),
    admin
      .from("grant_proposals")
      .select("id, proposal_title, proposer_id, created_at")
      .eq("status", "approved")
      .returns<ApprovedProposalRow[]>()
  ]);

  if (usersResult.error) {
    throw new HttpError(500, `Could not load users for email notifications: ${usersResult.error.message}`);
  }
  if (toReviewResult.error) {
    throw new HttpError(
      500,
      `Could not load to-review proposals for email notifications: ${toReviewResult.error.message}`
    );
  }
  if (approvedResult.error) {
    throw new HttpError(
      500,
      `Could not load approved proposals for email notifications: ${approvedResult.error.message}`
    );
  }

  const users = usersResult.data ?? [];
  const toReviewProposals = toReviewResult.data ?? [];
  const approvedProposals = approvedResult.data ?? [];
  const toReviewIds = toReviewProposals.map((proposal) => proposal.id);

  const votesResult = await (
    toReviewIds.length
      ? admin
          .from("votes")
          .select("proposal_id, voter_id")
          .in("proposal_id", toReviewIds)
          .returns<VoteActionRow[]>()
      : Promise.resolve({ data: [] as VoteActionRow[], error: null })
  );

  if (votesResult.error) {
    throw new HttpError(500, `Could not load votes for email notifications: ${votesResult.error.message}`);
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const actionsByUserId = new Map<string, OutstandingAction[]>();
  const ownProposalUpdatesByUserId = new Map<string, OwnProposalUpdate[]>();
  const votingUserIds = users.filter((user) => user.role === "member" || user.role === "oversight").map((user) => user.id);
  const meetingUsers = users.filter((user) => user.role === "oversight" || user.role === "manager");
  const adminUsers = users.filter((user) => user.role === "admin");
  const votesByProposalId = new Map<string, Set<string>>();

  for (const vote of votesResult.data ?? []) {
    const proposalVotes = votesByProposalId.get(vote.proposal_id) ?? new Set<string>();
    proposalVotes.add(vote.voter_id);
    votesByProposalId.set(vote.proposal_id, proposalVotes);
  }

  const pushAction = (userId: string, action: OutstandingAction) => {
    const existing = actionsByUserId.get(userId) ?? [];
    existing.push(action);
    actionsByUserId.set(userId, existing);
  };

  const pushOwnProposalUpdate = (userId: string, update: OwnProposalUpdate) => {
    const existing = ownProposalUpdatesByUserId.get(userId) ?? [];
    existing.push(update);
    ownProposalUpdatesByUserId.set(userId, existing);
  };

  const meetingChaseNames = uniqueIds(meetingUsers.map((user) => displayNameOrEmail(user)));
  const adminChaseNames = uniqueIds(adminUsers.map((user) => displayNameOrEmail(user)));

  for (const proposal of toReviewProposals) {
    const title = proposal.proposal_title?.trim() || "Proposal";
    const storedVotes = votesByProposalId.get(proposal.id) ?? new Set<string>();
    const eligibleVotes =
      proposal.proposal_type === "discretionary"
        ? new Set([...storedVotes].filter((voterId) => voterId !== proposal.proposer_id))
        : storedVotes;
    const requiredVotes =
      proposal.proposal_type === "joint"
        ? votingUserIds.length
        : votingUserIds.filter((userId) => userId !== proposal.proposer_id).length;
    const readyForMeeting = requiredVotes > 0 && eligibleVotes.size >= requiredVotes;
    const pendingVoterIds = votingUserIds.filter((userId) => {
      if (proposal.proposal_type === "discretionary" && userId === proposal.proposer_id) {
        return false;
      }
      return !eligibleVotes.has(userId);
    });

    for (const userId of votingUserIds) {
      if (proposal.proposal_type === "discretionary" && userId === proposal.proposer_id) {
        continue;
      }
      if (eligibleVotes.has(userId)) {
        continue;
      }

      pushAction(userId, {
        id: `${proposal.id}:vote:${userId}`,
        type: "vote_required",
        title,
        description:
          proposal.proposal_type === "joint"
            ? "Submit your vote and allocation."
            : "Mark this proposal as acknowledged or flagged.",
        linkPath: `/workspace?proposalId=${proposal.id}`,
        createdAt: proposal.created_at
      });
    }

    if (readyForMeeting) {
      for (const user of meetingUsers) {
        pushAction(user.id, {
          id: `${proposal.id}:meeting:${user.id}`,
          type: "meeting_review_required",
          title,
          description: "Review votes and record the meeting decision.",
          linkPath: `/meeting?proposalId=${proposal.id}`,
          createdAt: proposal.created_at
        });
      }
    }

    pushOwnProposalUpdate(proposal.proposer_id, {
      id: proposal.id,
      title,
      statusLabel: "To review",
      summary: pendingVoterIds.length
        ? `Waiting on ${pendingVoterIds.length} remaining vote${pendingVoterIds.length === 1 ? "" : "s"} before meeting review.`
        : "All votes are complete. Waiting for oversight/manager meeting decision.",
      chaseNames: pendingVoterIds.length
        ? uniqueIds(pendingVoterIds.map((userId) => displayNameOrEmail(usersById.get(userId))))
        : meetingChaseNames,
      linkPath: pendingVoterIds.length ? `/workspace?proposalId=${proposal.id}` : `/meeting?proposalId=${proposal.id}`,
      createdAt: proposal.created_at
    });
  }

  for (const proposal of approvedProposals) {
    const title = proposal.proposal_title?.trim() || "Proposal";
    for (const user of adminUsers) {
      pushAction(user.id, {
        id: `${proposal.id}:admin:${user.id}`,
        type: "admin_send_required",
        title,
        description: "Mark the donation as Sent after execution is complete.",
        linkPath: `/admin?proposalId=${proposal.id}`,
        createdAt: proposal.created_at
      });
    }

    pushOwnProposalUpdate(proposal.proposer_id, {
      id: proposal.id,
      title,
      statusLabel: "Approved",
      summary: "Approved and waiting for admin execution plus Sent confirmation.",
      chaseNames: adminChaseNames,
      linkPath: `/admin?proposalId=${proposal.id}`,
      createdAt: proposal.created_at
    });
  }

  for (const [userId, actions] of actionsByUserId.entries()) {
    actionsByUserId.set(userId, sortActions(actions));
  }

  for (const [userId, updates] of ownProposalUpdatesByUserId.entries()) {
    ownProposalUpdatesByUserId.set(userId, sortOwnProposalUpdates(updates));
  }

  return {
    usersById,
    actionsByUserId,
    ownProposalUpdatesByUserId
  };
}

async function enqueueActionRequiredEmails(admin: AdminClient, input: QueueActionRequiredEmailInput) {
  const recipientUserIds = uniqueIds(input.recipientUserIds);
  if (!recipientUserIds.length) {
    return { queued: 0 };
  }

  const [{ actionsByUserId }, usersById] = await Promise.all([
    loadOutstandingActionsState(admin),
    loadUsersByIds(admin, recipientUserIds)
  ]);

  let queued = 0;

  for (const recipientUserId of recipientUserIds) {
    const user = usersById.get(recipientUserId);
    if (!user || !user.email?.trim()) {
      continue;
    }

    const outstandingActions = actionsByUserId.get(recipientUserId) ?? [];
    const content = buildActionRequiredContent({
      recipientName: displayName(user),
      actionTitle: input.actionTitle,
      actionDescription: input.actionDescription,
      actionLinkPath: input.actionLinkPath,
      outstandingActions
    });

    await queueEmailNotification(admin, {
      notificationType: "action_required",
      actorUserId: input.actorUserId ?? null,
      entityId: input.entityId,
      idempotencyKey: `${input.idempotencyKeyPrefix}:${recipientUserId}`,
      subject: content.subject,
      htmlBody: content.htmlBody,
      textBody: content.textBody,
      primaryLinkPath: input.actionLinkPath,
      primaryLinkLabel: "Open Required Action",
      payload: {
        actionType: input.actionType,
        actionTitle: input.actionTitle,
        targetRole: roleLabel(user.role)
      },
      recipientUserIds: [recipientUserId]
    });

    queued += 1;
  }

  return { queued };
}

export async function queueEmailNotification(admin: AdminClient, input: QueueEmailNotificationInput) {
  const recipients = uniqueIds(input.recipientUserIds);
  if (!recipients.length) {
    return {
      enqueued: false,
      reason: "no_recipients"
    } as const;
  }

  const subject = String(input.subject ?? "").trim();
  const htmlBody = String(input.htmlBody ?? "").trim();
  const textBody = String(input.textBody ?? "").trim();
  const idempotencyKey = String(input.idempotencyKey ?? "").trim();

  if (!subject || !htmlBody || !textBody || !idempotencyKey) {
    throw new HttpError(500, "Email notification requires subject, htmlBody, textBody, and idempotencyKey.");
  }

  const { data: inserted, error: insertError } = await admin
    .from("email_notifications")
    .insert({
      notification_type: input.notificationType,
      actor_user_id: input.actorUserId ?? null,
      entity_id: input.entityId ?? null,
      idempotency_key: idempotencyKey,
      subject,
      html_body: htmlBody,
      text_body: textBody,
      primary_link_path: sanitizeLinkPath(input.primaryLinkPath),
      primary_link_label: String(input.primaryLinkLabel ?? "Open").trim() || "Open",
      payload: input.payload ?? {},
      recipient_user_ids: recipients
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    const isDuplicate = insertError.code === "23505" || insertError.message.toLowerCase().includes("duplicate");
    if (isDuplicate) {
      return {
        enqueued: false,
        reason: "duplicate"
      } as const;
    }
    throw new HttpError(500, `Could not enqueue email notification: ${insertError.message}`);
  }

  const notificationId = inserted?.id;
  if (!notificationId) {
    throw new HttpError(500, "Email notification insert did not return an id.");
  }

  const usersById = await loadUsersByIds(admin, recipients);
  const deliveries = recipients
    .map((recipientId) => usersById.get(recipientId))
    .filter((user): user is UserProfileRow => Boolean(user?.email?.trim()))
    .map((user) => ({
      notification_id: notificationId,
      user_id: user.id,
      email: user.email.trim(),
      status: "pending" as const,
      next_attempt_at: new Date().toISOString()
    }));

  if (!deliveries.length) {
    await markEmailNotificationProcessed(admin, notificationId);
    return {
      enqueued: true,
      notificationId,
      queuedDeliveryCount: 0
    } as const;
  }

  const { error: deliveryError } = await admin
    .from("email_deliveries")
    .upsert(deliveries, { onConflict: "notification_id,user_id" });

  if (deliveryError) {
    throw new HttpError(500, `Could not enqueue email deliveries: ${deliveryError.message}`);
  }

  await processPendingEmailDeliveries(admin, {
    limit: Math.max(25, deliveries.length),
    notificationId
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email] delivery processing failed", message);
  });

  return {
    enqueued: true,
    notificationId,
    queuedDeliveryCount: deliveries.length
  } as const;
}

export async function processPendingEmailDeliveries(
  admin: AdminClient,
  options?: { limit?: number; notificationId?: string }
): Promise<ProcessEmailDeliveryResult> {
  const config = getEmailConfig();
  if (!config) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      pendingRetries: 0,
      skipped: 0,
      configMissing: true
    };
  }

  const limit = Math.max(1, Math.min(200, options?.limit ?? 50));
  const now = new Date().toISOString();
  let query = admin
    .from("email_deliveries")
    .select("id, notification_id, user_id, email, attempt_count")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  if (options?.notificationId) {
    query = query.eq("notification_id", options.notificationId);
  }

  const { data: pendingRows, error: pendingError } = await query.returns<EmailDeliveryRow[]>();

  if (pendingError) {
    throw new HttpError(500, `Could not load pending email deliveries: ${pendingError.message}`);
  }

  const pendingDeliveries = pendingRows ?? [];
  if (!pendingDeliveries.length) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      pendingRetries: 0,
      skipped: 0,
      configMissing: false
    };
  }

  const notificationIds = uniqueIds(pendingDeliveries.map((row) => row.notification_id));
  const { data: notifications, error: notificationError } = await admin
    .from("email_notifications")
    .select("id, subject, html_body, text_body, payload")
    .in("id", notificationIds)
    .returns<EmailNotificationRow[]>();

  if (notificationError) {
    throw new HttpError(500, `Could not load email notifications: ${notificationError.message}`);
  }

  const notificationById = new Map((notifications ?? []).map((notification) => [notification.id, notification]));
  const oversightEmails = await loadOversightEmails(admin);
  const touchedNotificationIds: string[] = [];
  let sent = 0;
  let failed = 0;
  let pendingRetries = 0;
  let skipped = 0;

  for (let i = 0; i < pendingDeliveries.length; i++) {
    // Respect Resend rate limit (2 req/s) — pause 600ms between sends
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    const delivery = pendingDeliveries[i];
    touchedNotificationIds.push(delivery.notification_id);
    const notification = notificationById.get(delivery.notification_id);

    if (!notification) {
      skipped += 1;
      const { error } = await admin
        .from("email_deliveries")
        .update({
          status: "failed",
          attempt_count: delivery.attempt_count + 1,
          last_attempt_at: now,
          last_error: "Email notification no longer exists."
        })
        .eq("id", delivery.id);

      if (error) {
        throw new HttpError(500, `Could not update missing-notification email delivery: ${error.message}`);
      }

      continue;
    }

    const attemptCount = delivery.attempt_count + 1;

    try {
      const payloadBcc = Array.isArray(notification.payload?.bcc_emails)
        ? (notification.payload.bcc_emails as string[]).map((e) => String(e).trim()).filter(Boolean)
        : [];
      const bcc = [...new Set([...oversightEmails, ...payloadBcc])]
        .filter((email) => email.toLowerCase() !== delivery.email.toLowerCase());
      const result = await sendEmailViaResend(config, delivery, notification, bcc);

      if (result.ok) {
        const { error } = await admin
          .from("email_deliveries")
          .update({
            status: "sent",
            attempt_count: attemptCount,
            sent_at: new Date().toISOString(),
            last_attempt_at: now,
            provider_message_id: result.providerMessageId ?? null,
            last_error: null
          })
          .eq("id", delivery.id);

        if (error) {
          throw new HttpError(500, `Could not update sent email delivery: ${error.message}`);
        }

        sent += 1;
        continue;
      }

      if (result.permanent || attemptCount >= MAX_EMAIL_DELIVERY_ATTEMPTS) {
        const { error } = await admin
          .from("email_deliveries")
          .update({
            status: "failed",
            attempt_count: attemptCount,
            last_attempt_at: now,
            last_error: result.errorMessage ?? "Email provider rejected delivery."
          })
          .eq("id", delivery.id);

        if (error) {
          throw new HttpError(500, `Could not update failed email delivery: ${error.message}`);
        }

        failed += 1;
      } else {
        const { error } = await admin
          .from("email_deliveries")
          .update({
            status: "pending",
            attempt_count: attemptCount,
            last_attempt_at: now,
            last_error: result.errorMessage ?? "Temporary email delivery error.",
            next_attempt_at: resolveNextRetryAt(attemptCount)
          })
          .eq("id", delivery.id);

        if (error) {
          throw new HttpError(500, `Could not schedule email delivery retry: ${error.message}`);
        }

        pendingRetries += 1;
      }
    } catch (sendError) {
      const message =
        sendError instanceof Error ? truncateErrorMessage(sendError.message) : "Unexpected email send error.";
      if (attemptCount >= MAX_EMAIL_DELIVERY_ATTEMPTS) {
        const { error } = await admin
          .from("email_deliveries")
          .update({
            status: "failed",
            attempt_count: attemptCount,
            last_attempt_at: now,
            last_error: message
          })
          .eq("id", delivery.id);

        if (error) {
          throw new HttpError(500, `Could not update failed email delivery after exception: ${error.message}`);
        }

        failed += 1;
      } else {
        const { error } = await admin
          .from("email_deliveries")
          .update({
            status: "pending",
            attempt_count: attemptCount,
            last_attempt_at: now,
            last_error: message,
            next_attempt_at: resolveNextRetryAt(attemptCount)
          })
          .eq("id", delivery.id);

        if (error) {
          throw new HttpError(
            500,
            `Could not schedule email delivery retry after exception: ${error.message}`
          );
        }

        pendingRetries += 1;
      }
    }
  }

  await markEmailNotificationsProcessedIfDone(admin, touchedNotificationIds);

  return {
    processed: pendingDeliveries.length,
    sent,
    failed,
    pendingRetries,
    skipped,
    configMissing: false
  };
}

export async function queueVoteRequiredActionEmails(
  admin: AdminClient,
  input: {
    proposalId: string;
    proposalTitle: string;
    proposalType: ProposalType;
    recipientUserIds: string[];
    actorUserId?: string | null;
  }
) {
  return enqueueActionRequiredEmails(admin, {
    recipientUserIds: input.recipientUserIds,
    actorUserId: input.actorUserId ?? null,
    entityId: input.proposalId,
    actionType: "vote_required",
    actionTitle: input.proposalTitle,
    actionDescription:
      input.proposalType === "joint"
        ? "A joint proposal now needs your vote."
        : "A discretionary proposal now needs your acknowledgement or flag.",
    actionLinkPath: `/workspace?proposalId=${input.proposalId}`,
    idempotencyKeyPrefix: `action-required:vote:${input.proposalId}`
  });
}

export async function queueProposalSubmittedConfirmationEmail(
  admin: AdminClient,
  input: {
    proposalId: string;
    proposalTitle: string;
    proposedAmount: number;
    proposalType: ProposalType;
    proposerUserId: string;
    proposerName: string;
    otherMembersNotified: boolean;
  }
) {
  const content = buildProposalSubmittedConfirmationContent({
    proposerName: input.proposerName,
    proposalTitle: input.proposalTitle,
    proposedAmount: input.proposedAmount,
    proposalType: input.proposalType,
    otherMembersNotified: input.otherMembersNotified
  });
  const primaryLinkPath = `/workspace?proposalId=${input.proposalId}`;
  return queueEmailNotification(admin, {
    notificationType: "proposal_submitted_confirmation",
    actorUserId: input.proposerUserId,
    entityId: input.proposalId,
    idempotencyKey: `proposal-submitted-confirmation:${input.proposalId}`,
    subject: content.subject,
    htmlBody: content.htmlBody,
    textBody: content.textBody,
    primaryLinkPath,
    primaryLinkLabel: "Open Workspace",
    payload: {
      proposalId: input.proposalId,
      proposalTitle: input.proposalTitle,
      proposalType: input.proposalType
    },
    recipientUserIds: [input.proposerUserId]
  });
}

export async function queueMeetingReviewActionEmails(
  admin: AdminClient,
  input: {
    proposalId: string;
    proposalTitle: string;
    recipientUserIds: string[];
    actorUserId?: string | null;
  }
) {
  return enqueueActionRequiredEmails(admin, {
    recipientUserIds: input.recipientUserIds,
    actorUserId: input.actorUserId ?? null,
    entityId: input.proposalId,
    actionType: "meeting_review_required",
    actionTitle: input.proposalTitle,
    actionDescription: "This proposal is ready for meeting review and decision.",
    actionLinkPath: `/meeting?proposalId=${input.proposalId}`,
    idempotencyKeyPrefix: `action-required:meeting:${input.proposalId}`
  });
}

export async function queueAdminSendRequiredActionEmails(
  admin: AdminClient,
  input: {
    proposalId: string;
    proposalTitle: string;
    recipientUserIds: string[];
    actorUserId?: string | null;
  }
) {
  return enqueueActionRequiredEmails(admin, {
    recipientUserIds: input.recipientUserIds,
    actorUserId: input.actorUserId ?? null,
    entityId: input.proposalId,
    actionType: "admin_send_required",
    actionTitle: input.proposalTitle,
    actionDescription: "This approved proposal now requires execution and sent confirmation.",
    actionLinkPath: `/admin?proposalId=${input.proposalId}`,
    idempotencyKeyPrefix: `action-required:admin-send:${input.proposalId}`
  });
}

export async function queueUserAccessNotification(
  admin: AdminClient,
  input: {
    userEmail: string;
    userId: string;
    lastAccessedAt: string;
  }
) {
  const oversightUsers = await loadUsersByRoles(admin, ["oversight"]);
  const oversightIds = oversightUsers.map((u) => u.id).filter(Boolean);
  if (!oversightIds.length) {
    return { enqueued: false, reason: "no_oversight_users" as const };
  }

  const content = buildUserAccessNotificationContent({
    userEmail: input.userEmail,
    lastAccessedAt: input.lastAccessedAt
  });

  const idempotencyKey = `user-access:${input.userId}:${input.lastAccessedAt}`;
  const result = await queueEmailNotification(admin, {
    notificationType: "user_access_notification",
    actorUserId: input.userId,
    entityId: null,
    idempotencyKey,
    subject: content.subject,
    htmlBody: content.htmlBody,
    textBody: content.textBody,
    primaryLinkPath: "/dashboard",
    primaryLinkLabel: "Open Dashboard",
    payload: {
      userEmail: input.userEmail,
      lastAccessedAt: input.lastAccessedAt
    },
    recipientUserIds: oversightIds
  });

  return result;
}

export async function processWeeklyActionReminderEmails(
  admin: AdminClient,
  options?: { now?: Date }
): Promise<ProcessWeeklyActionReminderResult> {
  const now = options?.now ?? new Date();
  const state = await loadOutstandingActionsState(admin);
  let dueUsers = 0;
  let remindersQueued = 0;
  let skippedNoActions = 0;
  let skippedWrongLocalTime = 0;
  let skippedAlreadySent = 0;
  const nyLocalTime = getLocalTimeSnapshot(now, DEFAULT_TIMEZONE);

  const candidates: Array<{
    user: UserProfileRow;
    actions: OutstandingAction[];
    ownProposalUpdates: OwnProposalUpdate[];
    weekKey: string;
  }> = [];

  if (!nyLocalTime || nyLocalTime.weekday !== WEEKDAY_TUESDAY || nyLocalTime.hour < WEEKLY_REMINDER_LOCAL_HOUR) {
    return {
      evaluatedUsers: state.usersById.size,
      dueUsers,
      remindersQueued,
      skippedNoActions,
      skippedWrongLocalTime: state.usersById.size,
      skippedAlreadySent
    };
  }

  const weekKey = toIsoWeekKey(nyLocalTime);

  for (const user of state.usersById.values()) {
    const actions = state.actionsByUserId.get(user.id) ?? [];
    const ownProposalUpdates = state.ownProposalUpdatesByUserId.get(user.id) ?? [];
    if (!actions.length && !ownProposalUpdates.length) {
      skippedNoActions += 1;
      continue;
    }

    dueUsers += 1;
    candidates.push({
      user,
      actions,
      ownProposalUpdates,
      weekKey
    });
  }

  if (!candidates.length) {
    return {
      evaluatedUsers: state.usersById.size,
      dueUsers,
      remindersQueued,
      skippedNoActions,
      skippedWrongLocalTime,
      skippedAlreadySent
    };
  }

  const uniqueUserIds = uniqueIds(candidates.map((candidate) => candidate.user.id));
  const uniqueWeekKeys = uniqueIds(candidates.map((candidate) => candidate.weekKey));

  const { data: existingRuns, error: existingRunsError } = await admin
    .from("email_weekly_reminders")
    .select("user_id, week_key")
    .in("user_id", uniqueUserIds)
    .in("week_key", uniqueWeekKeys)
    .returns<Array<{ user_id: string; week_key: string }>>();

  if (existingRunsError) {
    throw new HttpError(
      500,
      `Could not load weekly reminder audit rows: ${existingRunsError.message}`
    );
  }

  const sentKeySet = new Set((existingRuns ?? []).map((row) => `${row.user_id}:${row.week_key}`));

  for (const candidate of candidates) {
    const dedupeKey = `${candidate.user.id}:${candidate.weekKey}`;
    if (sentKeySet.has(dedupeKey)) {
      skippedAlreadySent += 1;
      continue;
    }

    const content = buildWeeklyReminderContent({
      recipientName: displayName(candidate.user),
      outstandingActions: candidate.actions,
      ownProposalUpdates: candidate.ownProposalUpdates
    });

    const queueResult = await queueEmailNotification(admin, {
      notificationType: "weekly_action_reminder",
      actorUserId: null,
      entityId: null,
      idempotencyKey: `weekly-action-reminder:${candidate.user.id}:${candidate.weekKey}`,
      subject: content.subject,
      htmlBody: content.htmlBody,
      textBody: content.textBody,
      primaryLinkPath: content.primaryLinkPath,
      primaryLinkLabel: "Open Actions",
      payload: {
        weekKey: candidate.weekKey,
        reminderTimeZone: DEFAULT_TIMEZONE
      },
      recipientUserIds: [candidate.user.id]
    });

    if (queueResult.enqueued || queueResult.reason === "duplicate") {
      const { error: insertError } = await admin.from("email_weekly_reminders").insert({
        user_id: candidate.user.id,
        week_key: candidate.weekKey
      });

      if (insertError && insertError.code !== "23505") {
        throw new HttpError(500, `Could not save weekly reminder audit row: ${insertError.message}`);
      }

      remindersQueued += 1;
      sentKeySet.add(dedupeKey);
    }
  }

  return {
    evaluatedUsers: state.usersById.size,
    dueUsers,
    remindersQueued,
    skippedNoActions,
    skippedWrongLocalTime,
    skippedAlreadySent
  };
}


type DailyDigestDataOptions = {
  now?: Date;
  ignoreTimeWindow?: boolean;
  sendEvenIfNoSentToday?: boolean;
};

type FetchDailyDigestDataResult =
  | {
      kind: "data";
      dayKey: string;
      proposals: Array<{ id: string; title: string; sentAt: string | null; amount: number }>;
      outstanding: Array<{ id: string; title: string }>;
      sentEventsFound: number;
    }
  | { kind: "skipped"; reason: "time"; sentEventsFound: number }
  | { kind: "skipped"; reason: "no_events"; sentEventsFound: number };

async function fetchDailyDigestData(
  admin: AdminClient,
  options?: DailyDigestDataOptions
): Promise<FetchDailyDigestDataResult> {
  const now = options?.now ?? new Date();
  const nyLocalTime = getLocalTimeSnapshot(now, DEFAULT_TIMEZONE);

  const inWindow =
    nyLocalTime &&
    (options?.ignoreTimeWindow === true || nyLocalTime.hour >= DAILY_SENT_DIGEST_LOCAL_HOUR);
  if (!nyLocalTime || !inWindow) {
    return {
      kind: "skipped",
      reason: "time",
      sentEventsFound: 0
    };
  }

  const dayKey = toIsoDateKey(nyLocalTime);
  const lookbackStart = new Date(now.getTime() - 48 * 60 * 60_000).toISOString();

  const { data: sentAuditRows, error: sentAuditError } = await admin
    .from("audit_log")
    .select("entity_id, created_at")
    .eq("action", "meeting_decision_sent")
    .eq("entity_type", "proposal")
    .gte("created_at", lookbackStart)
    .returns<Array<{ entity_id: string | null; created_at: string }>>();

  if (sentAuditError) {
    throw new HttpError(500, `Could not load sent proposal audit rows: ${sentAuditError.message}`);
  }

  const sentToday = (sentAuditRows ?? []).filter((row) => {
    if (!row.entity_id) {
      return false;
    }
    const createdAt = new Date(row.created_at);
    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }
    const localSnapshot = getLocalTimeSnapshot(createdAt, DEFAULT_TIMEZONE);
    return Boolean(localSnapshot && toIsoDateKey(localSnapshot) === dayKey);
  });

  const proposalIds = uniqueIds(sentToday.map((row) => String(row.entity_id ?? "")));

  let proposals: Array<{ id: string; title: string; sentAt: string | null; amount: number }>;

  if (proposalIds.length === 0) {
    if (!options?.sendEvenIfNoSentToday) {
      return {
        kind: "skipped",
        reason: "no_events",
        sentEventsFound: sentToday.length
      };
    }
    proposals = [];
  } else {
    const { data: proposalRows, error: proposalRowsError } = await admin
      .from("grant_proposals")
      .select("id, proposal_title, sent_at, final_amount")
      .in("id", proposalIds)
      .returns<
        Array<{
          id: string;
          proposal_title: string | null;
          sent_at: string | null;
          final_amount: number | string | null;
        }>
      >();

    if (proposalRowsError) {
      throw new HttpError(500, `Could not load sent proposals for digest: ${proposalRowsError.message}`);
    }

    const proposalById = new Map((proposalRows ?? []).map((row) => [row.id, row]));
    const built = proposalIds
      .map((proposalId) => {
        const row = proposalById.get(proposalId);
        if (!row) {
          return null;
        }
        const amount = typeof row.final_amount === "number" ? row.final_amount : Number(row.final_amount) || 0;
        return {
          id: proposalId,
          title: row.proposal_title?.trim() || "Proposal",
          sentAt: row.sent_at,
          amount
        };
      })
      .filter(
        (proposal): proposal is { id: string; title: string; sentAt: string | null; amount: number } =>
          Boolean(proposal)
      )
      .sort((a, b) => a.title.localeCompare(b.title));

    if (!built.length && !options?.sendEvenIfNoSentToday) {
      return {
        kind: "skipped",
        reason: "no_events",
        sentEventsFound: sentToday.length
      };
    }
    proposals = built;
  }

  const { data: approvedRows, error: approvedError } = await admin
    .from("grant_proposals")
    .select("id, proposal_title")
    .eq("status", "approved")
    .order("proposal_title", { ascending: true })
    .returns<Array<{ id: string; proposal_title: string | null }>>();

  if (approvedError) {
    throw new HttpError(
      500,
      `Could not load approved proposals for digest: ${approvedError.message}`
    );
  }

  const outstanding = (approvedRows ?? [])
    .map((row) => ({
      id: row.id,
      title: row.proposal_title?.trim() || "Proposal"
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    kind: "data",
    dayKey,
    proposals,
    outstanding,
    sentEventsFound: sentToday.length
  };
}

/**
 * Returns the proposals and outstanding list that would be included in today's daily digest (America/New_York).
 * Does not send any email. Use for previews or scripts.
 */
export async function getDailyDigestPreview(
  admin: AdminClient,
  options?: { now?: Date }
): Promise<DailyDigestPreview> {
  const result = await fetchDailyDigestData(admin, {
    ...options,
    ignoreTimeWindow: true,
    sendEvenIfNoSentToday: true
  });
  if (result.kind === "skipped") {
    return {
      dayKey: toIsoDateKey(
        getLocalTimeSnapshot(options?.now ?? new Date(), DEFAULT_TIMEZONE) ?? {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          day: new Date().getDate()
        }
      ),
      proposals: [],
      outstanding: []
    };
  }
  return {
    dayKey: result.dayKey,
    proposals: result.proposals,
    outstanding: result.outstanding
  };
}

export async function processDailyProposalSentDigestEmails(
  admin: AdminClient,
  options?: DailyDigestDataOptions
): Promise<ProcessDailyProposalSentDigestResult> {
  const result = await fetchDailyDigestData(admin, options);

  if (result.kind === "skipped") {
    const dueForWindow = result.reason === "no_events";
    return {
      dueForWindow,
      sentEventsFound: result.sentEventsFound,
      proposalsIncluded: 0,
      digestQueued: 0,
      skippedNoEvents: result.reason === "no_events" ? 1 : 0,
      skippedWrongLocalTime: result.reason === "time" ? 1 : 0,
      skippedAlreadySent: 0
    };
  }

  const { dayKey, proposals, outstanding, sentEventsFound } = result;
  const now = options?.now ?? new Date();

  const recipients = await loadUsersByRoles(admin, ["member", "oversight", "manager", "admin"]);
  const content = buildProposalSentFyiContent({ dayKey, proposals, outstanding });
  // Manual run: in development use a unique key per click so each test sends; in production one digest per day
  const idempotencyKey =
    options?.ignoreTimeWindow === true
      ? process.env.NODE_ENV === "development"
        ? `proposal-sent-digest:${dayKey}:manual:${now.getTime()}`
        : `proposal-sent-digest:${dayKey}:manual`
      : `proposal-sent-digest:${dayKey}`;
  const queueResult = await queueEmailNotification(admin, {
    notificationType: "proposal_sent_fyi",
    actorUserId: null,
    entityId: null,
    idempotencyKey,
    subject: content.subject,
    htmlBody: content.htmlBody,
    textBody: content.textBody,
    primaryLinkPath: "/dashboard",
    primaryLinkLabel: "Open Dashboard",
    payload: {
      dayKey,
      proposalIds: proposals.map((proposal) => proposal.id),
      outstandingProposalIds: outstanding.map((p) => p.id)
    },
    recipientUserIds: uniqueIds(recipients.map((recipient) => recipient.id))
  });

  return {
    dueForWindow: true,
    sentEventsFound,
    proposalsIncluded: proposals.length,
    digestQueued: queueResult.enqueued ? 1 : 0,
    skippedNoEvents: 0,
    skippedWrongLocalTime: 0,
    skippedAlreadySent: queueResult.reason === "duplicate" ? 1 : 0
  };
}
