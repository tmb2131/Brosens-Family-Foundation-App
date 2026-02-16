/**
 * Charity Navigator integration: parse EIN from profile URLs and fetch
 * encompass score (0-100) via their GraphQL API for auto-populating
 * organizations.charity_navigator_score.
 *
 * API: https://data.charitynavigator.org (Stellate-Api-Token required).
 * Profile URL format: https://www.charitynavigator.org/ein/<9-digit EIN>
 */

const CHARITY_NAVIGATOR_API_URL = "https://data.charitynavigator.org";
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
