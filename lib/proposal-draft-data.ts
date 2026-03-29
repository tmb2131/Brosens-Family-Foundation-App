import { createAdminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/http-error";
import type { ProposalDraft, ProposalDraftPayload } from "@/lib/proposal-draft-types";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

function isProposalDraftPayload(value: unknown): value is ProposalDraftPayload {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.organizationName === "string" &&
    typeof o.description === "string" &&
    typeof o.website === "string" &&
    typeof o.charityNavigatorUrl === "string" &&
    typeof o.proposalType === "string" &&
    typeof o.proposedAmount === "string" &&
    typeof o.proposerAllocationAmount === "string"
  );
}

export function draftPayloadHasContent(payload: ProposalDraftPayload): boolean {
  return Boolean(
    payload.organizationName.trim() ||
      payload.description.trim() ||
      payload.proposalType.trim()
  );
}

export function parseProposalDraftPayload(body: unknown): ProposalDraftPayload {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
  const o = body as Record<string, unknown>;
  const proposalType = String(o.proposalType ?? "");
  if (proposalType && proposalType !== "joint" && proposalType !== "discretionary") {
    throw new HttpError(400, "Invalid proposalType.");
  }
  return {
    organizationName: String(o.organizationName ?? "").trim(),
    description: String(o.description ?? "").trim(),
    website: String(o.website ?? "").trim(),
    charityNavigatorUrl: String(o.charityNavigatorUrl ?? "").trim(),
    proposalType,
    proposedAmount: String(o.proposedAmount ?? "0"),
    proposerAllocationAmount: String(o.proposerAllocationAmount ?? "").trim()
  };
}

export async function getProposalDraft(
  admin: AdminClient,
  userId: string
): Promise<ProposalDraft | null> {
  const { data, error } = await admin
    .from("proposal_drafts")
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle<{ payload: unknown; updated_at: string }>();

  if (error) {
    throw new HttpError(500, `Could not load proposal draft: ${error.message}`);
  }
  if (!data || !isProposalDraftPayload(data.payload)) {
    return null;
  }
  const updatedAt = Date.parse(data.updated_at);
  const savedAt = Number.isFinite(updatedAt) ? updatedAt : Date.now();
  return { ...data.payload, savedAt };
}

export async function upsertProposalDraft(
  admin: AdminClient,
  userId: string,
  payload: ProposalDraftPayload
): Promise<void> {
  if (!draftPayloadHasContent(payload)) {
    await deleteProposalDraft(admin, userId);
    return;
  }

  const { error } = await admin.from("proposal_drafts").upsert(
    { user_id: userId, payload },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new HttpError(500, `Could not save proposal draft: ${error.message}`);
  }
}

export async function deleteProposalDraft(admin: AdminClient, userId: string): Promise<void> {
  const { error } = await admin.from("proposal_drafts").delete().eq("user_id", userId);

  if (error) {
    throw new HttpError(500, `Could not clear proposal draft: ${error.message}`);
  }
}
