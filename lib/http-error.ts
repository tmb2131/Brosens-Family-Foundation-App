export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: { error: error.message }
    };
  }

  return {
    status: 500,
    body: { error: error instanceof Error ? error.message : "Unexpected server error" }
  };
}
