import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http-error";
import { DonationLedgerSource, DonationReturnRole, FrankDeenieDonationRow, FrankDeenieSnapshot } from "@/lib/types";

type AdminClient = SupabaseClient;

interface FrankDeenieDonationDbRow {
  id: string;
  donation_date: string;
  donation_type: string;
  recipient_name: string;
  memo: string | null;
  split: string | null;
  amount: number | string;
  status: string;
  created_at: string;
  created_by: string | null;
  return_group_id: string | null;
  return_role: DonationReturnRole | null;
  returned_at: string | null;
  return_source_id: string | null;
}

interface ChildrenProposalRow {
  id: string;
  grant_master_id: string;
  organization_id: string | null;
  proposer_id: string;
  final_amount: number | string;
  status: string;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
  returned_at: string | null;
  return_group_id: string | null;
}

interface OrganizationRow {
  id: string;
  name: string;
}

interface GrantMasterRow {
  id: string;
  title: string;
  description: string | null;
}

interface FrankDeenieSnapshotInput {
  year?: number | null;
  includeChildren?: boolean;
}

interface CreateFrankDeenieDonationInput {
  date: string;
  type?: string;
  name: string;
  memo?: string | null;
  split?: string | null;
  amount: number;
  status?: string;
  requesterId: string;
}

interface UpdateFrankDeenieDonationInput {
  donationId: string;
  date?: string;
  type?: string;
  name?: string;
  memo?: string | null;
  split?: string | null;
  amount?: number;
  status?: string;
  requesterId: string;
}

export interface FrankDeenieImportRow {
  date: string;
  type?: string;
  name: string;
  memo?: string;
  split?: string;
  amount: number;
  status?: string;
}

const DONATION_SELECT =
  "id, donation_date, donation_type, recipient_name, memo, split, amount, status, created_at, created_by, return_group_id, return_role, returned_at, return_source_id";
const DONATION_STATUSES = ["Gave", "Planned"] as const;

function currentYear() {
  return new Date().getFullYear();
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeYear(value: number) {
  if (!Number.isInteger(value) || value < 1900 || value > 3000) {
    throw new HttpError(400, "year must be a valid year.");
  }
  return value;
}

function normalizeDateString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, "date is required.");
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    throw new HttpError(400, "Invalid date. Use YYYY-MM-DD or a valid ISO date.");
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeRequiredText(value: string, fieldName: string, maxLength = 200) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function normalizeDonationStatus(value: string | undefined, fieldName: string) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "Gave";
  }

  const match = DONATION_STATUSES.find((statusOption) => statusOption.toLowerCase() === trimmed.toLowerCase());
  if (!match) {
    throw new HttpError(400, `${fieldName} must be one of ${DONATION_STATUSES.join(", ")}.`);
  }

  return match;
}

function normalizeOptionalText(value: string | null | undefined, fieldName: string, maxLength = 500) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function toYearWindow(year: number) {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`
  };
}

async function fetchProfileEmailsById(admin: AdminClient, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const { data, error } = await admin
    .from("user_profiles")
    .select("id, email")
    .in("id", userIds)
    .returns<Array<{ id: string; email: string }>>();

  if (error) return map;

  for (const row of data ?? []) {
    map.set(row.id, row.email);
  }

  return map;
}

function mapFrankDeenieDonationRow(
  row: FrankDeenieDonationDbRow,
  profileEmailById: Map<string, string>
): FrankDeenieDonationRow {
  const returnRole = row.return_role ?? null;
  const lockedByReturn = returnRole === "original" || returnRole === "reversal";
  return {
    id: row.id,
    source: "frank_deenie",
    date: row.donation_date,
    type: row.donation_type,
    name: row.recipient_name,
    memo: row.memo ?? "",
    split: row.split ?? "",
    amount: toNumber(row.amount),
    status: row.status,
    editable: !lockedByReturn,
    proposedBy: row.created_by ? profileEmailById.get(row.created_by) ?? "" : "",
    returnGroupId: row.return_group_id ?? null,
    returnRole,
    returnedAt: row.returned_at ?? null,
  };
}

function mapChildrenDonationRow(
  row: ChildrenProposalRow,
  organizationNamesById: Map<string, string>,
  grantMasterTitlesById: Map<string, string>,
  grantMasterDescriptionsById: Map<string, string>,
  profileEmailById: Map<string, string>
): FrankDeenieDonationRow {
  const normalizedStatus = row.status.trim().toLowerCase();
  const isSent = normalizedStatus === "sent";
  const proposalTitle = grantMasterTitlesById.get(row.grant_master_id)?.trim() || "Submitted gift";
  const proposalDescription = grantMasterDescriptionsById.get(row.grant_master_id)?.trim() ?? "";
  const organizationName = row.organization_id
    ? organizationNamesById.get(row.organization_id)?.trim() ?? ""
    : "";
  const isReturned = !!row.returned_at;
  const proposalNotes = row.notes?.trim() ?? "";

  return {
    id: `children:${row.id}`,
    source: "children",
    date: isSent ? row.sent_at ?? row.created_at.slice(0, 10) : row.created_at.slice(0, 10),
    type: "donation",
    name: organizationName || proposalTitle,
    memo: proposalNotes || proposalDescription,
    split: "",
    amount: toNumber(row.final_amount),
    status: isSent ? "Gave" : "Planned",
    editable: false,
    proposedBy: profileEmailById.get(row.proposer_id) ?? "",
    returnGroupId: row.return_group_id ?? null,
    returnRole: isReturned ? "original" : null,
    returnedAt: row.returned_at ?? null,
  };
}

function sortLedgerRows(rows: FrankDeenieDonationRow[]) {
  return [...rows].sort((a, b) => {
    const dateComparison = b.date.localeCompare(a.date);
    if (dateComparison !== 0) {
      return dateComparison;
    }

    return a.name.localeCompare(b.name);
  });
}

async function listFrankDeenieDonationsByYear(admin: AdminClient, year: number | null) {
  let query = admin
    .from("frank_deenie_donations")
    .select(DONATION_SELECT)
    .order("donation_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (year !== null) {
    const { startDate, endDate } = toYearWindow(year);
    query = query.gte("donation_date", startDate).lte("donation_date", endDate);
  }

  const { data, error } = await query.returns<FrankDeenieDonationDbRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load Frank & Deenie donations: ${error.message}`);
  }

  const rows = data ?? [];
  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter((id): id is string => !!id))];
  const profileEmailById = await fetchProfileEmailsById(admin, creatorIds);

  return rows.map((row) => mapFrankDeenieDonationRow(row, profileEmailById));
}

async function listChildrenDonationsByYear(admin: AdminClient, year: number | null) {
  const query = admin
    .from("grant_proposals")
    .select("id, grant_master_id, organization_id, proposer_id, final_amount, status, notes, sent_at, created_at, returned_at, return_group_id")
    .in("status", ["sent", "approved"])
    .order("created_at", { ascending: false });

  const { data: proposals, error: proposalsError } = await query.returns<ChildrenProposalRow[]>();

  if (proposalsError) {
    throw new HttpError(500, `Could not load Children donation rows: ${proposalsError.message}`);
  }

  const organizationIds = [...new Set((proposals ?? []).map((row) => row.organization_id).filter(Boolean))];
  const grantMasterIds = [...new Set((proposals ?? []).map((row) => row.grant_master_id).filter(Boolean))];
  const proposerIds = [...new Set((proposals ?? []).map((row) => row.proposer_id).filter(Boolean))];
  const organizationNamesById = new Map<string, string>();
  const grantMasterTitlesById = new Map<string, string>();
  const grantMasterDescriptionsById = new Map<string, string>();

  const profileEmailByIdPromise = fetchProfileEmailsById(admin, proposerIds);

  if (organizationIds.length > 0 || grantMasterIds.length > 0) {
    const [organizationsResult, grantMasterResult] = await Promise.all([
      organizationIds.length > 0
        ? admin.from("organizations").select("id, name").in("id", organizationIds).returns<OrganizationRow[]>()
        : Promise.resolve({ data: [], error: null }),
      grantMasterIds.length > 0
        ? admin
            .from("grants_master")
            .select("id, title, description")
            .in("id", grantMasterIds)
            .returns<GrantMasterRow[]>()
        : Promise.resolve({ data: [], error: null })
    ]);

    if (organizationsResult.error) {
      throw new HttpError(500, `Could not load organization names: ${organizationsResult.error.message}`);
    }

    if (grantMasterResult.error) {
      throw new HttpError(500, `Could not load proposal titles: ${grantMasterResult.error.message}`);
    }

    for (const organization of organizationsResult.data ?? []) {
      organizationNamesById.set(organization.id, organization.name);
    }

    for (const grantMaster of grantMasterResult.data ?? []) {
      grantMasterTitlesById.set(grantMaster.id, grantMaster.title);
      grantMasterDescriptionsById.set(grantMaster.id, grantMaster.description ?? "");
    }
  }

  const profileEmailById = await profileEmailByIdPromise;

  const mappedRows = (proposals ?? []).map((row) =>
    mapChildrenDonationRow(
      row,
      organizationNamesById,
      grantMasterTitlesById,
      grantMasterDescriptionsById,
      profileEmailById
    )
  );

  if (year === null) {
    return mappedRows;
  }

  return mappedRows.filter((row) => Number(row.date.slice(0, 4)) === year);
}

async function loadAvailableYears(admin: AdminClient) {
  const [frankDeenieResult, childrenResult] = await Promise.all([
    admin
      .from("frank_deenie_donations")
      .select("donation_date")
      .returns<Array<{ donation_date: string }>>(),
    admin
      .from("grant_proposals")
      .select("status, sent_at, created_at")
      .in("status", ["sent", "approved"])
      .returns<Array<{ status: string; sent_at: string | null; created_at: string }>>()
  ]);

  if (frankDeenieResult.error) {
    throw new HttpError(500, `Could not load Frank & Deenie years: ${frankDeenieResult.error.message}`);
  }

  if (childrenResult.error) {
    throw new HttpError(500, `Could not load Children years: ${childrenResult.error.message}`);
  }

  const years = new Set<number>();

  for (const row of frankDeenieResult.data ?? []) {
    if (row.donation_date) {
      years.add(Number(row.donation_date.slice(0, 4)));
    }
  }

  for (const row of childrenResult.data ?? []) {
    const normalizedStatus = row.status.trim().toLowerCase();
    const effectiveDate =
      normalizedStatus === "sent"
        ? row.sent_at ?? row.created_at
        : row.created_at;

    if (effectiveDate) {
      years.add(Number(effectiveDate.slice(0, 4)));
    }
  }

  years.add(currentYear());

  return [...years]
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => b - a);
}

export async function getFrankDeenieSnapshot(
  admin: AdminClient,
  input: FrankDeenieSnapshotInput = {}
): Promise<FrankDeenieSnapshot> {
  const includeChildren = input.includeChildren ?? false;
  const requestedYear = input.year ?? null;
  const year = requestedYear === null ? null : normalizeYear(requestedYear);

  const [frankDeenieRows, childrenRows, availableYears] = await Promise.all([
    listFrankDeenieDonationsByYear(admin, year),
    includeChildren ? listChildrenDonationsByYear(admin, year) : Promise.resolve([]),
    loadAvailableYears(admin)
  ]);

  const years =
    year === null
      ? availableYears
      : availableYears.includes(year)
        ? availableYears
        : [...availableYears, year].sort((a, b) => b - a);
  const rows = sortLedgerRows(includeChildren ? [...frankDeenieRows, ...childrenRows] : frankDeenieRows);
  const frankDeenieTotal = frankDeenieRows.reduce((sum, row) => sum + row.amount, 0);
  const childrenTotal = childrenRows.reduce((sum, row) => sum + row.amount, 0);

  return {
    year,
    includeChildren,
    availableYears: years,
    totals: {
      frankDeenie: roundCurrency(frankDeenieTotal),
      children: roundCurrency(childrenTotal),
      overall: roundCurrency(frankDeenieTotal + childrenTotal)
    },
    rows
  };
}

export async function createFrankDeenieDonation(
  admin: AdminClient,
  input: CreateFrankDeenieDonationInput
) {
  const date = normalizeDateString(input.date);
  const type = normalizeRequiredText(input.type ?? "donation", "type", 64);
  const name = normalizeRequiredText(input.name, "name", 180);
  const memo = normalizeOptionalText(input.memo, "memo", 800);
  const split = normalizeOptionalText(input.split, "split", 120);
  const status = normalizeDonationStatus(input.status, "status");
  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, "amount must be a non-negative number.");
  }

  const { data, error } = await admin
    .from("frank_deenie_donations")
    .insert({
      donation_date: date,
      donation_type: type,
      recipient_name: name,
      memo,
      split,
      amount: roundCurrency(amount),
      status,
      created_by: input.requesterId,
      updated_by: input.requesterId
    })
    .select(DONATION_SELECT)
    .single<FrankDeenieDonationDbRow>();

  if (error || !data) {
    throw new HttpError(500, `Could not create Frank & Deenie donation: ${error?.message ?? "missing row"}`);
  }

  const profileEmailById = await fetchProfileEmailsById(admin, [input.requesterId]);
  return mapFrankDeenieDonationRow(data, profileEmailById);
}

export async function updateFrankDeenieDonation(
  admin: AdminClient,
  input: UpdateFrankDeenieDonationInput
) {
  const updatePayload: Record<string, unknown> = {
    updated_by: input.requesterId
  };

  if (input.date !== undefined) {
    updatePayload.donation_date = normalizeDateString(input.date);
  }

  if (input.type !== undefined) {
    updatePayload.donation_type = normalizeRequiredText(input.type, "type", 64);
  }

  if (input.name !== undefined) {
    updatePayload.recipient_name = normalizeRequiredText(input.name, "name", 180);
  }

  if (input.memo !== undefined) {
    updatePayload.memo = normalizeOptionalText(input.memo, "memo", 800);
  }

  if (input.split !== undefined) {
    updatePayload.split = normalizeOptionalText(input.split, "split", 120);
  }

  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new HttpError(400, "amount must be a non-negative number.");
    }
    updatePayload.amount = roundCurrency(amount);
  }

  if (input.status !== undefined) {
    updatePayload.status = normalizeDonationStatus(input.status, "status");
  }

  if (Object.keys(updatePayload).length === 1) {
    throw new HttpError(400, "No editable fields were provided.");
  }

  const { data, error } = await admin
    .from("frank_deenie_donations")
    .update(updatePayload)
    .eq("id", input.donationId)
    .select(DONATION_SELECT)
    .maybeSingle<FrankDeenieDonationDbRow>();

  if (error) {
    throw new HttpError(500, `Could not update Frank & Deenie donation: ${error.message}`);
  }

  if (!data) {
    throw new HttpError(404, "Frank & Deenie donation not found.");
  }

  const creatorIds = [data.created_by].filter((id): id is string => !!id);
  const profileEmailById = await fetchProfileEmailsById(admin, creatorIds);
  return mapFrankDeenieDonationRow(data, profileEmailById);
}

export async function updateChildrenDonationNotes(
  admin: AdminClient,
  proposalId: string,
  notes: string | null
) {
  const normalizedNotes = normalizeOptionalText(notes, "notes", 800);

  const { data, error } = await admin
    .from("grant_proposals")
    .update({ notes: normalizedNotes })
    .eq("id", proposalId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new HttpError(500, `Could not update Children donation notes: ${error.message}`);
  }

  if (!data) {
    throw new HttpError(404, "Children donation not found.");
  }
}

export async function getFrankDeenieDonationById(admin: AdminClient, donationId: string) {
  const { data, error } = await admin
    .from("frank_deenie_donations")
    .select(DONATION_SELECT)
    .eq("id", donationId)
    .maybeSingle<FrankDeenieDonationDbRow>();

  if (error) {
    throw new HttpError(500, `Could not fetch Frank & Deenie donation: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const creatorIds = [data.created_by].filter((id): id is string => !!id);
  const profileEmailById = await fetchProfileEmailsById(admin, creatorIds);
  return mapFrankDeenieDonationRow(data, profileEmailById);
}

export async function deleteFrankDeenieDonation(admin: AdminClient, donationId: string) {
  const { data, error } = await admin
    .from("frank_deenie_donations")
    .delete()
    .eq("id", donationId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new HttpError(500, `Could not delete Frank & Deenie donation: ${error.message}`);
  }

  if (!data) {
    throw new HttpError(404, "Frank & Deenie donation not found.");
  }
}

export interface MarkDonationReturnedInput {
  sourceId: string;
  source: DonationLedgerSource;
  returnedDate: string;
  newDonationDate: string;
  newAmount?: number;
  requesterId: string;
}

export async function markDonationReturned(
  admin: AdminClient,
  input: MarkDonationReturnedInput
) {
  const returnedDate = normalizeDateString(input.returnedDate);
  const newDonationDate = normalizeDateString(input.newDonationDate);

  const { data: groupIdRow } = await admin.rpc("gen_random_uuid").single<string>();
  const returnGroupId = groupIdRow ?? crypto.randomUUID();

  if (input.source === "frank_deenie") {
    return markFrankDeenieDonationReturned(admin, input, returnedDate, newDonationDate, returnGroupId);
  }
  return markChildrenDonationReturned(admin, input, returnedDate, newDonationDate, returnGroupId);
}

async function markFrankDeenieDonationReturned(
  admin: AdminClient,
  input: MarkDonationReturnedInput,
  returnedDate: string,
  newDonationDate: string,
  returnGroupId: string,
) {
  const { data: original, error: fetchError } = await admin
    .from("frank_deenie_donations")
    .select(DONATION_SELECT)
    .eq("id", input.sourceId)
    .maybeSingle<FrankDeenieDonationDbRow>();

  if (fetchError) {
    throw new HttpError(500, `Could not fetch donation: ${fetchError.message}`);
  }
  if (!original) {
    throw new HttpError(404, "Donation not found.");
  }
  if (original.return_role !== null) {
    throw new HttpError(400, "This donation is already part of a return group.");
  }
  if (original.status !== "Gave") {
    throw new HttpError(400, "Only donations with status \"Gave\" can be marked as returned.");
  }

  const originalAmount = toNumber(original.amount);
  const newAmount = input.newAmount !== undefined ? roundCurrency(Number(input.newAmount)) : originalAmount;
  if (!Number.isFinite(newAmount) || newAmount < 0) {
    throw new HttpError(400, "newAmount must be a non-negative number.");
  }

  const { error: updateError } = await admin
    .from("frank_deenie_donations")
    .update({
      return_group_id: returnGroupId,
      return_role: "original",
      returned_at: returnedDate,
      updated_by: input.requesterId,
    })
    .eq("id", input.sourceId);

  if (updateError) {
    throw new HttpError(500, `Could not update original donation: ${updateError.message}`);
  }

  const { error: reversalError } = await admin
    .from("frank_deenie_donations")
    .insert({
      donation_date: returnedDate,
      donation_type: original.donation_type,
      recipient_name: original.recipient_name,
      memo: original.memo,
      split: original.split,
      amount: roundCurrency(-originalAmount),
      status: "Gave",
      return_group_id: returnGroupId,
      return_role: "reversal",
      returned_at: returnedDate,
      created_by: input.requesterId,
      updated_by: input.requesterId,
    });

  if (reversalError) {
    throw new HttpError(500, `Could not create reversal entry: ${reversalError.message}`);
  }

  const { error: replacementError } = await admin
    .from("frank_deenie_donations")
    .insert({
      donation_date: newDonationDate,
      donation_type: original.donation_type,
      recipient_name: original.recipient_name,
      memo: original.memo,
      split: original.split,
      amount: newAmount,
      status: "Gave",
      return_group_id: returnGroupId,
      return_role: "replacement",
      created_by: input.requesterId,
      updated_by: input.requesterId,
    });

  if (replacementError) {
    throw new HttpError(500, `Could not create replacement entry: ${replacementError.message}`);
  }

  return { returnGroupId };
}

async function markChildrenDonationReturned(
  admin: AdminClient,
  input: MarkDonationReturnedInput,
  returnedDate: string,
  newDonationDate: string,
  returnGroupId: string,
) {
  const { data: proposal, error: fetchError } = await admin
    .from("grant_proposals")
    .select("id, organization_id, final_amount, status, returned_at")
    .eq("id", input.sourceId)
    .maybeSingle<{
      id: string;
      organization_id: string | null;
      final_amount: number | string;
      status: string;
      returned_at: string | null;
    }>();

  if (fetchError) {
    throw new HttpError(500, `Could not fetch proposal: ${fetchError.message}`);
  }
  if (!proposal) {
    throw new HttpError(404, "Proposal not found.");
  }
  if (proposal.returned_at !== null) {
    throw new HttpError(400, "This proposal has already been marked as returned.");
  }
  if (proposal.status !== "sent") {
    throw new HttpError(400, "Only sent proposals can be marked as returned.");
  }

  let recipientName = "Unknown Organization";
  if (proposal.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", proposal.organization_id)
      .maybeSingle<{ name: string }>();
    if (org?.name) {
      recipientName = org.name;
    }
  }

  const originalAmount = toNumber(proposal.final_amount);
  const newAmount = input.newAmount !== undefined ? roundCurrency(Number(input.newAmount)) : originalAmount;
  if (!Number.isFinite(newAmount) || newAmount < 0) {
    throw new HttpError(400, "newAmount must be a non-negative number.");
  }

  const { error: updateError } = await admin
    .from("grant_proposals")
    .update({
      returned_at: returnedDate,
      return_group_id: returnGroupId,
    })
    .eq("id", input.sourceId);

  if (updateError) {
    throw new HttpError(500, `Could not update proposal: ${updateError.message}`);
  }

  const { error: reversalError } = await admin
    .from("frank_deenie_donations")
    .insert({
      donation_date: returnedDate,
      donation_type: "donation",
      recipient_name: recipientName,
      memo: null,
      split: null,
      amount: roundCurrency(-originalAmount),
      status: "Gave",
      return_group_id: returnGroupId,
      return_role: "reversal",
      returned_at: returnedDate,
      return_source_id: input.sourceId,
      created_by: input.requesterId,
      updated_by: input.requesterId,
    });

  if (reversalError) {
    throw new HttpError(500, `Could not create reversal entry: ${reversalError.message}`);
  }

  const { error: replacementError } = await admin
    .from("frank_deenie_donations")
    .insert({
      donation_date: newDonationDate,
      donation_type: "donation",
      recipient_name: recipientName,
      memo: null,
      split: null,
      amount: newAmount,
      status: "Gave",
      return_group_id: returnGroupId,
      return_role: "replacement",
      return_source_id: input.sourceId,
      created_by: input.requesterId,
      updated_by: input.requesterId,
    });

  if (replacementError) {
    throw new HttpError(500, `Could not create replacement entry: ${replacementError.message}`);
  }

  return { returnGroupId };
}

function dedupeKeyFromInsertRow(row: {
  donation_date: string;
  donation_type: string;
  recipient_name: string;
  memo: string | null;
  split: string | null;
  amount: number;
  status: string;
}) {
  return [
    row.donation_date,
    row.donation_type.trim().toLowerCase(),
    row.recipient_name.trim().toLowerCase(),
    (row.memo ?? "").trim().toLowerCase(),
    (row.split ?? "").trim().toLowerCase(),
    roundCurrency(row.amount).toFixed(2),
    row.status.trim().toLowerCase()
  ].join("::");
}

export async function listDonationNameSuggestions(admin: AdminClient, limit = 50) {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));

  const [donationsResult, organizationsResult] = await Promise.all([
    admin
      .from("frank_deenie_donations")
      .select("recipient_name")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 5)
      .returns<Array<{ recipient_name: string }>>(),
    admin
      .from("organizations")
      .select("name")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 3)
      .returns<Array<{ name: string }>>()
  ]);

  if (donationsResult.error) {
    throw new HttpError(500, `Could not load donation name suggestions: ${donationsResult.error.message}`);
  }

  if (organizationsResult.error) {
    throw new HttpError(500, `Could not load organization name suggestions: ${organizationsResult.error.message}`);
  }

  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const row of donationsResult.data ?? []) {
    const name = (row.recipient_name ?? "").trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(name);
  }

  for (const row of organizationsResult.data ?? []) {
    const name = (row.name ?? "").trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(name);
  }

  return suggestions.slice(0, safeLimit);
}

export async function importFrankDeenieDonations(
  admin: AdminClient,
  input: {
    rows: FrankDeenieImportRow[];
    importedByUserId: string;
  }
) {
  if (!input.rows.length) {
    throw new HttpError(400, "No rows were provided for Frank & Deenie import.");
  }

  const parsedRows = input.rows.map((row) => {
    const donation_date = normalizeDateString(row.date);
    const donation_type = normalizeRequiredText(row.type ?? "donation", "type", 64);
    const recipient_name = normalizeRequiredText(row.name, "name", 180);
    const memo = normalizeOptionalText(row.memo, "memo", 800);
    const split = normalizeOptionalText(row.split, "split", 120);
    const amount = Number(row.amount);
    const status = normalizeDonationStatus(row.status, "status");

    if (!Number.isFinite(amount) || amount < 0) {
      throw new HttpError(400, "amount must be a non-negative number.");
    }

    return {
      donation_date,
      donation_type,
      recipient_name,
      memo,
      split,
      amount: roundCurrency(amount),
      status,
      created_by: input.importedByUserId,
      updated_by: input.importedByUserId
    };
  });

  const { data: existingRows, error: existingRowsError } = await admin
    .from("frank_deenie_donations")
    .select("donation_date, donation_type, recipient_name, memo, split, amount, status")
    .returns<
      Array<{
        donation_date: string;
        donation_type: string;
        recipient_name: string;
        memo: string | null;
        split: string | null;
        amount: number | string;
        status: string;
      }>
    >();

  if (existingRowsError) {
    throw new HttpError(500, `Could not load existing Frank & Deenie donations: ${existingRowsError.message}`);
  }

  const existingKeySet = new Set(
    (existingRows ?? []).map((row) =>
      dedupeKeyFromInsertRow({
        donation_date: row.donation_date,
        donation_type: row.donation_type,
        recipient_name: row.recipient_name,
        memo: row.memo,
        split: row.split,
        amount: toNumber(row.amount),
        status: row.status
      })
    )
  );

  let skippedCount = 0;
  const rowsToInsert: Array<{
    donation_date: string;
    donation_type: string;
    recipient_name: string;
    memo: string | null;
    split: string | null;
    amount: number;
    status: string;
    created_by: string;
    updated_by: string;
  }> = [];

  for (const row of parsedRows) {
    const dedupeKey = dedupeKeyFromInsertRow(row);
    if (existingKeySet.has(dedupeKey)) {
      skippedCount += 1;
      continue;
    }

    rowsToInsert.push(row);
    existingKeySet.add(dedupeKey);
  }

  if (rowsToInsert.length) {
    const { error: insertError } = await admin.from("frank_deenie_donations").insert(rowsToInsert);

    if (insertError) {
      throw new HttpError(500, `Could not import Frank & Deenie donations: ${insertError.message}`);
    }
  }

  return {
    insertedCount: rowsToInsert.length,
    skippedCount
  };
}
