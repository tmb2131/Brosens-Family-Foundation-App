/**
 * Charity Navigator integration: parse EIN from profile URLs and fetch
 * encompass score (0-100) via their GraphQL API for auto-populating
 * organizations.charity_navigator_score.
 *
 * API: https://api.charitynavigator.org/graphql.
 * Profile URL format: https://www.charitynavigator.org/ein/<9-digit EIN>
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const CHARITY_NAVIGATOR_API_URL = "https://api.charitynavigator.org/graphql";
const EIN_FROM_URL_REGEX = /charitynavigator\.org\/ein\/(\d{9})\b/i;

/**
 * Parse 9-digit EIN from a Charity Navigator profile URL.
 * Supports host www.charitynavigator.org or charitynavigator.org and path /ein/<EIN>.
 */
export function parseEinFromCharityNavigatorUrl(url: string): string | null {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(EIN_FROM_URL_REGEX);
  return match ? match[1]! : null;
}

interface PublicSearchResult {
  ein?: string | null;
  encompass_score?: number | null;
}

interface PublicSearchFacetedResponse {
  data?: {
    publicSearchFaceted?: {
      results?: PublicSearchResult[] | null;
    } | null;
  } | null;
  errors?: Array<{ message?: string }>;
}

/**
 * Fetch Charity Navigator encompass score (0-100) by EIN via GraphQL API.
 * Uses env var CHARITY_NAVIGATOR_API_KEY (Stellate-Api-Token). If unset, returns null.
 * On API/network errors or missing score, returns null and logs; does not throw.
 */
export async function fetchScoreByEin(ein: string): Promise<number | null> {
  const apiKey = process.env.CHARITY_NAVIGATOR_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const query = `
    query PublicSearchFaceted($term: String!) {
      publicSearchFaceted(term: $term) {
        results {
          ein
          encompass_score
        }
      }
    }
  `;

  try {
    const res = await fetch(CHARITY_NAVIGATOR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Stellate-Api-Token": apiKey
      },
      body: JSON.stringify({ query, variables: { term: ein } })
    });

    if (!res.ok) {
      console.error("[charity-navigator] API HTTP error:", res.status, res.statusText);
      return null;
    }

    const json = (await res.json()) as PublicSearchFacetedResponse;

    if (json.errors?.length) {
      console.error("[charity-navigator] GraphQL errors:", json.errors);
      return null;
    }

    const results = json.data?.publicSearchFaceted?.results;
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const normalizedEin = ein.replace(/^0+/, "") || ein;
    const match = results.find(
      (r) => r?.ein != null && (r.ein === ein || r.ein.replace(/^0+/, "") === normalizedEin)
    );
    const candidate = match ?? results[0];
    if (candidate?.encompass_score != null) {
      const score = Number(candidate.encompass_score);
      return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
    }
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[charity-navigator] fetch error:", message);
    return null;
  }
}

export interface CharityNavigatorScoreBackfillResult {
  updated: number;
  skipped: number;
  failed: number;
  configMissing: boolean;
}

type ProposalRow = { organization_id: string | null; proposal_charity_navigator_url: string | null };
type OrgRow = { id: string; charity_navigator_url: string | null };

/**
 * Fetch Charity Navigator scores for all organizations that have a Charity Navigator URL
 * (from proposals or organization record) and update organizations.charity_navigator_score.
 * Uses env CHARITY_NAVIGATOR_API_KEY; if unset, no API calls are made.
 */
export async function runCharityNavigatorScoreBackfill(
  admin: SupabaseClient
): Promise<CharityNavigatorScoreBackfillResult> {
  const result: CharityNavigatorScoreBackfillResult = {
    updated: 0,
    skipped: 0,
    failed: 0,
    configMissing: false
  };

  if (!process.env.CHARITY_NAVIGATOR_API_KEY?.trim()) {
    result.configMissing = true;
    return result;
  }

  const { data: proposals, error: proposalsError } = await admin
    .from("grant_proposals")
    .select("organization_id, proposal_charity_navigator_url")
    .not("organization_id", "is", null)
    .returns<ProposalRow[]>();

  if (proposalsError) {
    result.failed++;
  }

  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .select("id, charity_navigator_url")
    .returns<OrgRow[]>();

  if (orgsError) {
    result.failed++;
    return result;
  }

  const orgById = new Map((orgs ?? []).map((o) => [o.id, o]));
  const toProcess = new Map<string, string>();

  for (const p of proposals ?? []) {
    const orgId = p.organization_id;
    if (!orgId) continue;
    const url =
      (p.proposal_charity_navigator_url?.trim() || null) ??
      (orgById.get(orgId)?.charity_navigator_url?.trim() || null);
    if (url && parseEinFromCharityNavigatorUrl(url)) {
      toProcess.set(orgId, url);
    }
  }

  for (const o of orgs ?? []) {
    const url = o.charity_navigator_url?.trim() || null;
    if (url && parseEinFromCharityNavigatorUrl(url)) {
      toProcess.set(o.id, url);
    }
  }

  for (const [organizationId, charityNavigatorUrl] of toProcess) {
    const ein = parseEinFromCharityNavigatorUrl(charityNavigatorUrl);
    if (!ein) {
      result.skipped++;
      continue;
    }

    const score = await fetchScoreByEin(ein);
    if (score === null) {
      result.skipped++;
      continue;
    }

    const updates: { charity_navigator_score: number; charity_navigator_url?: string } = {
      charity_navigator_score: score
    };
    if (!orgById.get(organizationId)?.charity_navigator_url?.trim()) {
      updates.charity_navigator_url = charityNavigatorUrl.trim();
    }

    const { error: updateError } = await admin
      .from("organizations")
      .update(updates)
      .eq("id", organizationId);

    if (updateError) {
      result.failed++;
      continue;
    }

    result.updated++;
  }

  return result;
}
