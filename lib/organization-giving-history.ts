import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http-error";
import { GivingHistoryEntry, OrganizationGivingHistory } from "@/lib/types";

type AdminClient = SupabaseClient;

interface GivingHistoryInput {
  organizationId?: string | null;
  name: string;
}

interface SentProposalRow {
  budget_year: number;
  final_amount: number | string;
}

interface FrankDeenieDonationRow {
  donation_date: string;
  amount: number | string;
}

interface OrgIdRow {
  id: string;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function yearFromDate(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}

async function loadChildrenAmountsByYear(
  admin: AdminClient,
  name: string,
  extraOrganizationId?: string | null
): Promise<Map<number, number>> {
  const { data: orgRows, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .ilike("name", name.trim())
    .returns<OrgIdRow[]>();

  if (orgError) {
    throw new HttpError(500, `Failed to look up organizations: ${orgError.message}`);
  }

  const orgIds = new Set((orgRows ?? []).map((r) => r.id));
  if (extraOrganizationId) {
    orgIds.add(extraOrganizationId);
  }

  if (orgIds.size === 0) {
    return new Map<number, number>();
  }

  const { data, error } = await admin
    .from("grant_proposals")
    .select("budget_year, final_amount")
    .in("organization_id", [...orgIds])
    .eq("status", "sent")
    .returns<SentProposalRow[]>();

  if (error) {
    throw new HttpError(500, `Failed to load children giving history: ${error.message}`);
  }

  const map = new Map<number, number>();
  for (const row of data ?? []) {
    const year = row.budget_year;
    map.set(year, round2((map.get(year) ?? 0) + toNumber(row.final_amount)));
  }
  return map;
}

async function loadFrankDeenieDonationsByYear(
  admin: AdminClient,
  name: string
): Promise<Map<number, number>> {
  const { data, error } = await admin
    .from("frank_deenie_donations")
    .select("donation_date, amount")
    .ilike("recipient_name", name.trim())
    .returns<FrankDeenieDonationRow[]>();

  if (error) {
    throw new HttpError(500, `Failed to load Frank & Deenie giving history: ${error.message}`);
  }

  const map = new Map<number, number>();
  for (const row of data ?? []) {
    const year = yearFromDate(row.donation_date);
    if (!Number.isFinite(year) || year < 1900) continue;
    map.set(year, round2((map.get(year) ?? 0) + toNumber(row.amount)));
  }
  return map;
}

async function loadYearlyOverallTotals(admin: AdminClient): Promise<Map<number, number>> {
  const [proposalResult, fdResult] = await Promise.all([
    admin
      .from("grant_proposals")
      .select("budget_year, final_amount")
      .eq("status", "sent")
      .returns<SentProposalRow[]>(),
    admin
      .from("frank_deenie_donations")
      .select("donation_date, amount")
      .returns<FrankDeenieDonationRow[]>()
  ]);

  if (proposalResult.error) {
    throw new HttpError(500, `Failed to load yearly totals: ${proposalResult.error.message}`);
  }
  if (fdResult.error) {
    throw new HttpError(500, `Failed to load yearly totals: ${fdResult.error.message}`);
  }

  const map = new Map<number, number>();

  for (const row of proposalResult.data ?? []) {
    const year = row.budget_year;
    map.set(year, round2((map.get(year) ?? 0) + toNumber(row.final_amount)));
  }

  for (const row of fdResult.data ?? []) {
    const year = yearFromDate(row.donation_date);
    if (!Number.isFinite(year) || year < 1900) continue;
    map.set(year, round2((map.get(year) ?? 0) + toNumber(row.amount)));
  }

  return map;
}

export async function getOrganizationGivingHistory(
  admin: AdminClient,
  input: GivingHistoryInput
): Promise<OrganizationGivingHistory> {
  const name = input.name.trim();
  if (!name) {
    throw new HttpError(400, "name is required.");
  }

  const [childrenByYear, fdByYear, yearlyTotals] = await Promise.all([
    loadChildrenAmountsByYear(admin, name, input.organizationId),
    loadFrankDeenieDonationsByYear(admin, name),
    loadYearlyOverallTotals(admin)
  ]);

  const allYears = new Set<number>([...childrenByYear.keys(), ...fdByYear.keys()]);
  const sortedYears = [...allYears].sort((a, b) => b - a);

  let grandTotal = 0;
  let childrenGrandTotal = 0;
  let frankDeenieGrandTotal = 0;

  const entries: GivingHistoryEntry[] = sortedYears.map((year) => {
    const childrenAmount = round2(childrenByYear.get(year) ?? 0);
    const frankDeenieAmount = round2(fdByYear.get(year) ?? 0);
    const totalAmount = round2(childrenAmount + frankDeenieAmount);
    const yearOverallTotal = round2(yearlyTotals.get(year) ?? 0);
    const percentOfYear = yearOverallTotal > 0 ? round2((totalAmount / yearOverallTotal) * 100) : 0;

    grandTotal += totalAmount;
    childrenGrandTotal += childrenAmount;
    frankDeenieGrandTotal += frankDeenieAmount;

    return { year, childrenAmount, frankDeenieAmount, totalAmount, yearOverallTotal, percentOfYear };
  });

  return {
    charityName: name,
    entries,
    grandTotal: round2(grandTotal),
    childrenGrandTotal: round2(childrenGrandTotal),
    frankDeenieGrandTotal: round2(frankDeenieGrandTotal)
  };
}
