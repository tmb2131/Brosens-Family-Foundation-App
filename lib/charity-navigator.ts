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

type FetchScoreReason =
  | "ok"
  | "missing_api_key"
  | "http_error"
  | "graphql_error"
  | "no_results"
  | "missing_score"
  | "invalid_score"
  | "exception";

interface FetchScoreByEinDebug {
  reason: FetchScoreReason;
  resultCount: number | null;
  firstResultEin: string | null;
  firstResultScore: number | string | null;
  httpStatus: number | null;
}

interface FetchScoreByEinResult {
  score: number | null;
  debug: FetchScoreByEinDebug;
}

async function fetchScoreByEinWithDebug(ein: string): Promise<FetchScoreByEinResult> {
  const emptyDebug = {
    resultCount: null,
    firstResultEin: null,
    firstResultScore: null,
    httpStatus: null
  } satisfies Omit<FetchScoreByEinDebug, "reason">;

  const apiKey = process.env.CHARITY_NAVIGATOR_API_KEY?.trim();
  if (!apiKey) {
    return {
      score: null,
      debug: { reason: "missing_api_key", ...emptyDebug }
    };
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
        Authorization: apiKey
      },
      body: JSON.stringify({ query, variables: { term: ein } })
    });

    if (!res.ok) {
      return {
        score: null,
        debug: { reason: "http_error", ...emptyDebug, httpStatus: res.status }
      };
    }

    const json = (await res.json()) as PublicSearchFacetedResponse;
    if (json.errors?.length) {
      return {
        score: null,
        debug: { reason: "graphql_error", ...emptyDebug }
      };
    }

    const results = json.data?.publicSearchFaceted?.results;
    const resultCount = Array.isArray(results) ? results.length : null;
    const firstResultEin = Array.isArray(results) && results.length > 0 ? results[0]?.ein ?? null : null;
    const firstResultScore =
      Array.isArray(results) && results.length > 0 ? results[0]?.encompass_score ?? null : null;

    if (!Array.isArray(results) || results.length === 0) {
      return {
        score: null,
        debug: {
          reason: "no_results",
          resultCount,
          firstResultEin,
          firstResultScore,
          httpStatus: null
        }
      };
    }

    const normalizedEin = ein.replace(/^0+/, "") || ein;
    const match = results.find(
      (r) => r?.ein != null && (r.ein === ein || r.ein.replace(/^0+/, "") === normalizedEin)
    );
    const candidate = match ?? results[0];
    if (candidate?.encompass_score == null) {
      return {
        score: null,
        debug: {
          reason: "missing_score",
          resultCount,
          firstResultEin,
          firstResultScore,
          httpStatus: null
        }
      };
    }

    const score = Number(candidate.encompass_score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return {
        score: null,
        debug: {
          reason: "invalid_score",
          resultCount,
          firstResultEin,
          firstResultScore,
          httpStatus: null
        }
      };
    }

    return {
      score,
      debug: {
        reason: "ok",
        resultCount,
        firstResultEin,
        firstResultScore,
        httpStatus: null
      }
    };
  } catch {
    return {
      score: null,
      debug: { reason: "exception", ...emptyDebug }
    };
  }
}

/**
 * Fetch Charity Navigator encompass score (0-100) by EIN via GraphQL API.
 * Uses env var CHARITY_NAVIGATOR_API_KEY in Authorization header. If unset, returns null.
 * On API/network errors or missing score, returns null and logs; does not throw.
 */
export async function fetchScoreByEin(ein: string): Promise<number | null> {
  const result = await fetchScoreByEinWithDebug(ein);
  return result.score;
}

export interface CharityNavigatorScoreBackfillResult {
  updated: number;
  skipped: number;
  failed: number;
  configMissing: boolean;
  debug: {
    processed: number;
    scored: number;
    noResults: number;
    missingScore: number;
    invalidScore: number;
    httpErrors: number;
    graphqlErrors: number;
    exceptions: number;
    missingApiKey: number;
    samples: Array<{
      ein: string;
      reason: FetchScoreReason;
      resultCount: number | null;
      firstResultEin: string | null;
      firstResultScore: number | string | null;
      httpStatus: number | null;
    }>;
  };
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
    configMissing: false,
    debug: {
      processed: 0,
      scored: 0,
      noResults: 0,
      missingScore: 0,
      invalidScore: 0,
      httpErrors: 0,
      graphqlErrors: 0,
      exceptions: 0,
      missingApiKey: 0,
      samples: []
    }
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
    result.debug.processed++;
    const ein = parseEinFromCharityNavigatorUrl(charityNavigatorUrl);
    if (!ein) {
      result.skipped++;
      continue;
    }

    const scoreResult = await fetchScoreByEinWithDebug(ein);
    const score = scoreResult.score;

    if (scoreResult.debug.reason !== "ok" && result.debug.samples.length < 12) {
      result.debug.samples.push({
        ein,
        reason: scoreResult.debug.reason,
        resultCount: scoreResult.debug.resultCount,
        firstResultEin: scoreResult.debug.firstResultEin,
        firstResultScore: scoreResult.debug.firstResultScore,
        httpStatus: scoreResult.debug.httpStatus
      });
    }

    if (scoreResult.debug.reason === "missing_api_key") result.debug.missingApiKey++;
    if (scoreResult.debug.reason === "http_error") result.debug.httpErrors++;
    if (scoreResult.debug.reason === "graphql_error") result.debug.graphqlErrors++;
    if (scoreResult.debug.reason === "no_results") result.debug.noResults++;
    if (scoreResult.debug.reason === "missing_score") result.debug.missingScore++;
    if (scoreResult.debug.reason === "invalid_score") result.debug.invalidScore++;
    if (scoreResult.debug.reason === "exception") result.debug.exceptions++;

    if (score === null) {
      result.skipped++;
      continue;
    }
    result.debug.scored++;

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
