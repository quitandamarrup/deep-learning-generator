import { generateText } from "ai";
import { withCache } from "./cache";
import type { AIModelId } from "./providers";
import { DEFAULT_MODEL } from "./providers";
import { getModel } from "./router";
import type { RetryOptions } from "./retry";
import { withRetry } from "./retry";

// Single call-site for every AI text generation in the app. rpp.functions.ts,
// cp-analysis.functions.ts, and admin-docs.functions.ts each used to duplicate
// "read LOVABLE_API_KEY -> build gateway -> generateText" with no retry and no
// caching; they now all call askAI() instead, which adds retry-with-backoff
// (via retry.ts) and optional response caching (via cache.ts) for free, while
// leaving every prompt, JSON schema, and business rule untouched.

export interface AskAIInput {
  system: string;
  prompt: string;
  model?: AIModelId;
  /**
   * Pass a stable key (e.g. from buildCacheKey in cache.ts) to cache this
   * response. Omitted by default, which always calls the model — matching
   * the pre-refactor behavior exactly for every existing call site.
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

export async function askAI({
  system,
  prompt,
  model = DEFAULT_MODEL,
  cacheKey,
  cacheTtlMs,
  retry,
}: AskAIInput): Promise<AskAIResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const call = () =>
    withRetry(async () => {
      const { text } = await generateText({ model: getModel(apiKey, model), system, prompt });
      return text;
    }, retry);

  if (!cacheKey) {
    return { text: await call(), cached: false };
  }

  const { value, cached } = await withCache(cacheKey, call, cacheTtlMs);
  return { text: value, cached };
}
