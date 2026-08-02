// Generic retry-with-backoff for transient failures (rate limits, timeouts,
// gateway hiccups). Kept independent of any specific AI SDK so it can wrap
// any async call, not just generateText.

export interface RetryOptions {
  /** Total attempts including the first call. Default 3. */
  attempts?: number;
  /** Base delay in ms before the first retry. Default 500. */
  baseDelayMs?: number;
  /** Upper bound for the backoff delay. Default 8000. */
  maxDelayMs?: number;
  /** Return true if this error is worth retrying. Default: retryable status/network errors. */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry attempt (useful for logging). */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = status ?? statusCode;
  return typeof value === "number" ? value : undefined;
}

/** Default heuristic: retry on rate limiting / 5xx / network-level failures, not on 4xx validation errors. */
export function isRetryableByDefault(error: unknown): boolean {
  const status = getStatusCode(error);
  if (status !== undefined) return RETRYABLE_STATUS_CODES.has(status);

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("rate limit")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying with exponential backoff + jitter on retryable errors.
 * Throws the last error once attempts are exhausted.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    attempts: requestedAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8_000,
    isRetryable = isRetryableByDefault,
    onRetry,
  } = options;
  // Guard against a caller passing 0/negative attempts, which would otherwise
  // skip the loop entirely and throw `undefined` instead of a real error.
  const attempts = Math.max(1, requestedAttempts);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === attempts;
      if (isLastAttempt || !isRetryable(error)) throw error;

      const exponential = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * baseDelayMs;
      const delayMs = Math.min(exponential + jitter, maxDelayMs);

      onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }

  // Unreachable: the loop above always returns or throws.
  throw lastError;
}
