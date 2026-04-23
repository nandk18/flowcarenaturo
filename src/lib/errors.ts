// Centralized error handling — single place to add Sentry later.

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

export const ErrorCodes = {
  RATE_LIMITED: "RATE_LIMITED",
  AI_UNAVAILABLE: "AI_UNAVAILABLE",
  STORAGE_FAILED: "STORAGE_FAILED",
  DB_ERROR: "DB_ERROR",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  NOT_FOUND: "NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
};

export const handleError = (err: unknown, context?: string) => {
  const error = err instanceof Error ? err : new Error(String(err));

  console.error(`[${context || "app"}]`, error.message, error);

  if (error.message.includes("rate limit") || error.message.includes("429")) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (error.message.includes("network") || error.message.includes("fetch")) {
    return "Network error. Please check your connection.";
  }
  if (error.message.includes("JWT") || error.message.includes("auth")) {
    return "Session expired. Please log in again.";
  }
  return error.message || "Something went wrong. Please try again.";
};

export const withRetry = async <T,>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> => {
  let lastError: Error = new Error("Retry failed");

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (err instanceof AppError && !err.retryable) throw err;
      if (err instanceof Error && err.message.includes("permission")) throw err;

      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
};