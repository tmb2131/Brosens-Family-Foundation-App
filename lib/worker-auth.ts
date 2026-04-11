import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/http-error";

/**
 * Returns true if the request carries a Bearer token matching one of the named env var secrets.
 * Accepts a single env var name or an array of alternatives (any match wins).
 */
export function isAuthorizedByWorker(
  request: NextRequest,
  secretEnvNames: string | string[]
): boolean {
  const names = Array.isArray(secretEnvNames) ? secretEnvNames : [secretEnvNames];
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  for (const name of names) {
    const secret = process.env[name]?.trim();
    if (secret && authorization === `Bearer ${secret}`) return true;
  }
  return false;
}

/**
 * Parses an optional numeric `limit` field from a worker-endpoint JSON body.
 * Returns undefined if not present; throws HttpError(400) if present but not numeric.
 */
export function parseWorkerLimit(body: Record<string, unknown>): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(body, "limit")) {
    return undefined;
  }

  const parsed = Number(body.limit);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, "limit must be a number.");
  }

  return parsed;
}
