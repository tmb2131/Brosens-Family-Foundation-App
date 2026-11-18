import { HttpError } from "@/lib/http-error";

/**
 * Charity Navigator scores are entered by hand (the foundation no longer has
 * API access). The score is the encompass score shown on the charity's
 * Charity Navigator profile, 0–100, stored on organizations.charity_navigator_score
 * (numeric(5,2)).
 *
 * Returns undefined when the field is absent (leave the score as is), null when
 * it is explicitly cleared (null or an empty string), otherwise the score
 * rounded to two decimals. Throws a 400 for anything else.
 */
export function parseCharityNavigatorScoreInput(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" && !value.trim()) return null;

  const score = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new HttpError(400, "Charity Navigator score must be a number from 0 to 100.");
  }
  return Math.round(score * 100) / 100;
}
