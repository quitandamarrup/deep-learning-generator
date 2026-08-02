import { getStatusCode } from "./retry";

// Typed error codes so callers (and eventually the UI) can distinguish "AI is
// slow/rate-limited, try again" from "the AI produced something we can't use"
// instead of one generic Error. Opt-in: askAI() itself still throws plain
// errors (rpp/admin-docs untouched, per Sprint 2 scope) — callers that want
// typed codes wrap their own askAI() call with classifyAskAIError().

export type AiErrorCode =
  | "AI_TIMEOUT"
  | "AI_RATE_LIMIT"
  | "AI_INVALID_JSON"
  | "AI_EMPTY_RESULT"
  | "AI_VALIDATION_ERROR"
  | "AI_PROVIDER_ERROR";

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiError";
    this.code = code;
  }
}

/**
 * Classifies a raw error thrown by askAI() (network/HTTP/provider failure)
 * into an AiError. Never echoes the original error's raw message into the
 * user-facing message — only a fixed, safe string per code — so provider
 * details (headers, keys, endpoints) can't leak through.
 */
export function classifyAskAIError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const status = getStatusCode(error);
  if (status === 429) {
    return new AiError(
      "AI_RATE_LIMIT",
      "Permintaan AI dibatasi (rate limit). Coba lagi sebentar.",
      {
        cause: error,
      },
    );
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timeout")) {
    return new AiError("AI_TIMEOUT", "Permintaan AI melebihi batas waktu.", { cause: error });
  }

  return new AiError("AI_PROVIDER_ERROR", "Gagal menghubungi layanan AI. Coba lagi.", {
    cause: error,
  });
}
