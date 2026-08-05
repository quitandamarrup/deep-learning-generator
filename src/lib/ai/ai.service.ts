import { generateText } from "ai";
import { AiError, classifyAskAIError } from "./ai-errors";
import { withCache } from "./cache";
import { getDefaultModelId, getProviderChain, getResolver } from "./router";
import type { RetryOptions } from "./retry";
import { withRetry } from "./retry";

// Single call-site for every AI text generation in the app — this is
// "AIRouter" from the application's point of view. Every caller (rpp/
// cp-analysis/admin-docs .functions.ts) calls askAI() only; none of them
// import providers.ts or router.ts directly, and none of them know or care
// which provider actually served a given request.
//
// askAI() walks router.ts's provider priority chain in order (Google AI
// Studio -> OpenRouter -> Lovable Gateway by default). Each provider gets
// its own retry-with-backoff budget (askAI's existing withRetry, still 3
// attempts / exponential backoff + jitter); if a provider is unconfigured
// (missing API key) or exhausts its retries, AIRouter logs why and moves to
// the next provider automatically — no user action, no change to the
// request. Only if every provider in the chain fails does askAI throw a
// single friendly error; the caller (and ultimately the teacher) never
// finds out which providers were tried or why any of them failed — except
// for the one specific, actionable case where every attempted provider
// failed because of exhausted credits, which is worth telling the person
// who can actually fix it (top up credits) rather than hiding behind a
// generic "try again later".

export interface AskAIInput {
  system: string;
  prompt: string;
  /**
   * Pass a stable key (e.g. from buildCacheKey in cache.ts) to cache this
   * response. Omitted by default, which always calls the model — matching
   * the pre-router behavior exactly for every existing call site.
   */
  cacheKey?: string;
  cacheTtlMs?: number;
  retry?: RetryOptions;
}

export interface AskAIResult {
  text: string;
  /** True when this result came from cache instead of a fresh model call. */
  cached: boolean;
}

// --- TEMPORARY DEBUG LOGGING (runtime configuration audit) -----------------
// Requested to diagnose why the router keeps falling back to Lovable
// Gateway. Prints, once per call, whether each provider's required env var
// is actually present in *this* running process — without exposing the key
// values themselves. Safe to remove once the live env vars are confirmed.
function logProviderConfigAudit(chain: readonly string[]) {
  const envVarFor: Record<string, string> = {
    "google-ai-studio": "GOOGLE_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    "lovable-gateway": "LOVABLE_API_KEY",
  };
  const report = chain.map((providerId) => {
    const envVar = envVarFor[providerId];
    const present = Boolean(envVar && process.env[envVar]);
    return `${providerId}: ${envVar ?? "?"}=${present ? "SET" : "MISSING"}`;
  });
  console.log(`[AIRouter:AUDIT] Urutan prioritas: ${chain.join(" -> ")}`);
  console.log(`[AIRouter:AUDIT] Status env var per provider: ${report.join(" | ")}`);
}

async function callWithFallbackChain(
  system: string,
  prompt: string,
  retry?: RetryOptions,
): Promise<string> {
  const chain = getProviderChain();
  logProviderConfigAudit(chain);
  const attempted: { provider: string; error: AiError }[] = [];
  const skipped: string[] = [];

  for (const providerId of chain) {
    let resolver;
    try {
      resolver = getResolver(providerId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[AIRouter] Lewati provider "${providerId}": ${reason} (belum dikonfigurasi)`);
      skipped.push(providerId);
      continue;
    }

    const modelId = getDefaultModelId(providerId);
    const startedAt = Date.now();
    let retryCount = 0;

    try {
      const text = await withRetry(
        async () => {
          const { text } = await generateText({ model: resolver(modelId), system, prompt });
          return text;
        },
        {
          ...retry,
          onRetry: (error, attempt, delayMs) => {
            retryCount = attempt;
            console.warn(
              `[AIRouter] Provider "${providerId}" percobaan ${attempt} gagal, retry setelah ${delayMs}ms:`,
              error instanceof Error ? error.message : error,
            );
            retry?.onRetry?.(error, attempt, delayMs);
          },
        },
      );

      console.log(
        `[AIRouter] Provider terpilih: "${providerId}" (model: ${modelId}) — selesai dalam ${Date.now() - startedAt}ms, percobaan: ${retryCount + 1}.`,
      );
      console.log(
        `[AIRouter:AUDIT] Active provider: ${providerId} | Providers skipped: ${skipped.length ? skipped.join(", ") : "(none)"} | Reason: ${skipped.length ? "missing required env var (see above)" : "n/a"}`,
      );
      return text;
    } catch (error) {
      const classified = classifyAskAIError(error);
      console.error(
        `[AIRouter] Provider "${providerId}" gagal total setelah ${retryCount + 1} percobaan (${Date.now() - startedAt}ms): [${classified.code}] ${classified.message}`,
      );
      attempted.push({ provider: providerId, error: classified });
      continue; // otomatis coba provider berikutnya dalam rantai
    }
  }

  console.error(
    "[AIRouter] Semua provider gagal:",
    attempted.map((a) => `${a.provider}=${a.error.code}`),
    skipped.length ? `(dilewati karena belum dikonfigurasi: ${skipped.join(", ")})` : "",
  );

  // Kalau setiap provider yang benar-benar dicoba (bukan yang dilewati
  // karena belum dikonfigurasi) gagal karena kredit habis, itu satu-satunya
  // kegagalan yang sebaiknya diberi tahu apa adanya — guru/admin bisa
  // langsung menambah kredit, alih-alih tersesat dengan pesan generik.
  if (attempted.length > 0 && attempted.every((a) => a.error.code === "AI_CREDITS_EXHAUSTED")) {
    throw attempted[attempted.length - 1].error;
  }

  // Untuk kegagalan lain, tidak pernah membocorkan alasan/error mentah tiap
  // provider ke pengguna — guru hanya melihat satu pesan ramah, apa pun
  // penyebab teknisnya.
  throw new AiError(
    "AI_ALL_PROVIDERS_FAILED",
    "Maaf, layanan AI sedang tidak tersedia saat ini. Silakan coba beberapa saat lagi.",
  );
}

export async function askAI({
  system,
  prompt,
  cacheKey,
  cacheTtlMs,
  retry,
}: AskAIInput): Promise<AskAIResult> {
  const call = () => callWithFallbackChain(system, prompt, retry);

  if (!cacheKey) {
    return { text: await call(), cached: false };
  }

  const { value, cached } = await withCache(cacheKey, call, cacheTtlMs);
  return { text: value, cached };
}
