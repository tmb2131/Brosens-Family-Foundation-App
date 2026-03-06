import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http-error";
import { GivingHistoryEntry, GivingHistoryGift, OrganizationGivingHistory } from "@/lib/types";

type AdminClient = SupabaseClient;

interface GivingHistoryInput {
  organizationId?: string | null;
  name: string;
  /** When true, treat `name` as a substring filter (%name%) instead of exact match. */
  fuzzy?: boolean;
  /** When provided, match these exact names instead of using `name`/`fuzzy`. */
  names?: string[];
}

interface SentProposalRow {
  budget_year: number;
  final_amount: number | string;
  sent_at: string | null;
}

interface FrankDeenieDonationRow {
  donation_date: string;
  amount: number | string;
  memo: string | null;
}

interface OrgIdRow {
  id: string;
}

interface GiftLoadResult {
  byYear: Map<number, number>;
  giftsByYear: Map<number, GivingHistoryGift[]>;
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

function namesOrFilter(names: string[]): string {
  return names.map((n) => `name.ilike.${JSON.stringify(n.trim())}`).join(",");
}

function recipientNamesOrFilter(names: string[]): string {
  return names.map((n) => `recipient_name.ilike.${JSON.stringify(n.trim())}`).join(",");
}

async function loadChildrenAmountsByYear(
  admin: AdminClient,
  name: string,
  extraOrganizationId?: string | null,
  fuzzy?: boolean,
  names?: string[]
): Promise<GiftLoadResult> {
  let query = admin.from("organizations").select("id");
  if (names && names.length > 0) {
    query = query.or(namesOrFilter(names));
  } else {
    const pattern = fuzzy ? `%${name.trim()}%` : name.trim();
    query = query.ilike("name", pattern);
  }
  const { data: orgRows, error: orgError } = await query.returns<OrgIdRow[]>();

  if (orgError) {
    throw new HttpError(500, `Failed to look up organizations: ${orgError.message}`);
  }

  const orgIds = new Set((orgRows ?? []).map((r) => r.id));
  if (extraOrganizationId) {
    orgIds.add(extraOrganizationId);
  }

  if (orgIds.size === 0) {
    return { byYear: new Map(), giftsByYear: new Map() };
  }

  const { data, error } = await admin
    .from("grant_proposals")
    .select("budget_year, final_amount, sent_at")
    .in("organization_id", [...orgIds])
    .eq("status", "sent")
    .returns<SentProposalRow[]>();

  if (error) {
    throw new HttpError(500, `Failed to load children giving history: ${error.message}`);
  }

  const byYear = new Map<number, number>();
  const giftsByYear = new Map<number, GivingHistoryGift[]>();

  for (const row of data ?? []) {
    const year = row.budget_year;
    const amount = toNumber(row.final_amount);
    byYear.set(year, round2((byYear.get(year) ?? 0) + amount));

    const gifts = giftsByYear.get(year) ?? [];
    gifts.push({
      source: "children",
      date: row.sent_at ?? `${year}-01-01`,
      amount: round2(amount),
      label: ""
    });
    giftsByYear.set(year, gifts);
  }

  return { byYear, giftsByYear };
}

async function loadFrankDeenieDonationsByYear(
  admin: AdminClient,
  name: string,
  fuzzy?: boolean,
  names?: string[]
): Promise<GiftLoadResult> {
  let query = admin.from("frank_deenie_donations").select("donation_date, amount, memo");
  if (names && names.length > 0) {
    query = query.or(recipientNamesOrFilter(names));
  } else {
    const pattern = fuzzy ? `%${name.trim()}%` : name.trim();
    query = query.ilike("recipient_name", pattern);
  }
  const { data, error } = await query.returns<FrankDeenieDonationRow[]>();

  if (error) {
    throw new HttpError(500, `Failed to load Frank & Deenie giving history: ${error.message}`);
  }

  const byYear = new Map<number, number>();
  const giftsByYear = new Map<number, GivingHistoryGift[]>();

  for (const row of data ?? []) {
    const year = yearFromDate(row.donation_date);
    if (!Number.isFinite(year) || year < 1900) continue;
    const amount = toNumber(row.amount);
    byYear.set(year, round2((byYear.get(year) ?? 0) + amount));

    const gifts = giftsByYear.get(year) ?? [];
    gifts.push({
      source: "frank_deenie",
      date: row.donation_date,
      amount: round2(amount),
      label: row.memo?.trim() || ""
    });
    giftsByYear.set(year, gifts);
  }

  return { byYear, giftsByYear };
}

interface YearlyTotals {
  overall: Map<number, number>;
  frankDeenieOnly: Map<number, number>;
}

async function loadYearlyTotals(admin: AdminClient): Promise<YearlyTotals> {
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

  const overall = new Map<number, number>();
  const frankDeenieOnly = new Map<number, number>();

  for (const row of proposalResult.data ?? []) {
    const year = row.budget_year;
    overall.set(year, round2((overall.get(year) ?? 0) + toNumber(row.final_amount)));
  }

  for (const row of fdResult.data ?? []) {
    const year = yearFromDate(row.donation_date);
    if (!Number.isFinite(year) || year < 1900) continue;
    const amount = toNumber(row.amount);
    overall.set(year, round2((overall.get(year) ?? 0) + amount));
    frankDeenieOnly.set(year, round2((frankDeenieOnly.get(year) ?? 0) + amount));
  }

  return { overall, frankDeenieOnly };
}

export async function getOrganizationGivingHistory(
  admin: AdminClient,
  input: GivingHistoryInput
): Promise<OrganizationGivingHistory> {
  const name = input.name.trim();
  if (!name) {
    throw new HttpError(400, "name is required.");
  }

  const [childrenResult, fdResult, yearlyTotals] = await Promise.all([
    loadChildrenAmountsByYear(admin, name, input.organizationId, input.fuzzy, input.names),
    loadFrankDeenieDonationsByYear(admin, name, input.fuzzy, input.names),
    loadYearlyTotals(admin)
  ]);

  const allYears = new Set<number>([...childrenResult.byYear.keys(), ...fdResult.byYear.keys()]);
  const sortedYears = [...allYears].sort((a, b) => b - a);

  let grandTotal = 0;
  let childrenGrandTotal = 0;
  let frankDeenieGrandTotal = 0;

  const entries: GivingHistoryEntry[] = sortedYears.map((year) => {
    const childrenAmount = round2(childrenResult.byYear.get(year) ?? 0);
    const frankDeenieAmount = round2(fdResult.byYear.get(year) ?? 0);
    const totalAmount = round2(childrenAmount + frankDeenieAmount);
    const yearOverallTotal = round2(yearlyTotals.overall.get(year) ?? 0);
    const yearFrankDeenieTotal = round2(yearlyTotals.frankDeenieOnly.get(year) ?? 0);
    const percentOfYear = yearOverallTotal > 0 ? round2((totalAmount / yearOverallTotal) * 100) : 0;

    const gifts = [
      ...(childrenResult.giftsByYear.get(year) ?? []),
      ...(fdResult.giftsByYear.get(year) ?? [])
    ].sort((a, b) => a.date.localeCompare(b.date));

    grandTotal += totalAmount;
    childrenGrandTotal += childrenAmount;
    frankDeenieGrandTotal += frankDeenieAmount;

    return { year, childrenAmount, frankDeenieAmount, totalAmount, yearOverallTotal, yearFrankDeenieTotal, percentOfYear, gifts };
  });

  return {
    charityName: name,
    entries,
    grandTotal: round2(grandTotal),
    childrenGrandTotal: round2(childrenGrandTotal),
    frankDeenieGrandTotal: round2(frankDeenieGrandTotal)
  };
}
