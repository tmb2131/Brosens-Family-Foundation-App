/** Cache-Control for authenticated, read-only API responses. */
export const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=0, stale-while-revalidate=30"
} as const;

/** Cache-Control for data that changes infrequently (e.g., historical data). */
export const STALE_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
} as const;

/** Cache-Control for frequently changing data. */
export const DYNAMIC_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=0, stale-while-revalidate=5"
} as const;

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Detect Postgres unique constraint violations (code 23505). */
export function isUniqueConstraintError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || error?.message?.toLowerCase().includes("duplicate key") || false;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    // For 500 errors, never expose internal details (e.g. Supabase/Postgres messages) to clients
    if (error.status >= 500) {
      console.error("[toErrorResponse]", error.message);
      return {
        status: error.status,
        body: { error: "Unexpected server error" }
      };
    }

    return {
      status: error.status,
      body: { error: error.message }
    };
  }

  // Log the real error server-side but never expose internal details to clients
  console.error("[toErrorResponse] Unexpected error:", error);
  return {
    status: 500,
    body: { error: "Unexpected server error" }
  };
}
