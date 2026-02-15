/** Cache-Control for authenticated, read-only API responses. */
export const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=0, stale-while-revalidate=30"
} as const;

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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
