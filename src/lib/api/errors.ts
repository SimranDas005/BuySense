export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** Supabase/Postgres errors carry a message; normalise everything to ApiError. */
export function toApiError(error: unknown, fallback = "Something went wrong."): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && error.message) return new ApiError(error.message);
  if (error && typeof error === "object") {
    const supabaseError = error as { message?: unknown; code?: unknown };
    if (typeof supabaseError.message === "string" && supabaseError.message.trim()) {
      const code =
        typeof supabaseError.code === "string" && supabaseError.code.trim()
          ? ` (${supabaseError.code})`
          : "";
      return new ApiError(`${supabaseError.message}${code}`);
    }
  }
  return new ApiError(fallback);
}
