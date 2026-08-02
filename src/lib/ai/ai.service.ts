import { generateText } from "ai";
import { buildCacheKey, withCache } from "./cache";
import { AIModelId, DEFAULT_MODEL, getModel } from "./providers";
import { RetryOptions, withRetry } from "./retry";

// Single call-site for every AI text generation in the app. rpp.functions.ts,
// cp-analysis.functions.ts, and admin-docs.functions.ts each duplicated
// "read LOVABLE_API_KEY -> build gateway -> generateText" with no retry and
// no caching; this centralizes that so future call sites (and these three,
// once wired up) get retry + optional caching for free.

export interface GenerateAITextInput {
  system: string;
  prompt: string;
  model?: AIModelId;
  /** Pass a stable key (e.g. buildCacheKey("rpp", data)) to cache the result. Omit to always call the model. */
  cacheKey?: string;
  cacheTtlMs?: number;
  retry?: RetryOptions;
}

export interface GenerateAITextResult {
  text: string;
  /** True when this result came from cache instead of a fresh model call. */
  cached: boolean;
}

export async function generateAIText({
  system,
  prompt,
  model = DEFAULT_MODEL,
  cacheKey,
  cacheTtlMs,
  retry,
}: GenerateAITextInput): Promise<GenerateAITextResult> {
  const call = async () => {
    const { text } = await withRetry(
      () => generateText({ model: getModel(model), system, prompt }),
      retry,
    );
    return text;
  };

  if (!cacheKey) {
    return { text: await call(), cached: false };
  }

  const { value, cached } = await withCache(cacheKey, call, cacheTtlMs);
  return { text: value, cached };
}

export interface GenerateAIJsonInput extends Omit<GenerateAITextInput, "cacheKey"> {
  cacheNamespace?: string;
  /** Payload used to build the cache key when cacheNamespace is set (defaults to { system, prompt }). */
  cachePayload?: unknown;
}

/**
 * Same as generateAIText, but extracts and parses a JSON object/array out of the
 * model's response (handles ```json fences and stray prose around the JSON).
 * Throws a descriptive error if no valid JSON can be found.
 */
export async function generateAIJson<T = unknown>({
  cacheNamespace,
  cachePayload,
  ...input
}: GenerateAIJsonInput): Promise<{ data: T; cached: boolean }> {
  const cacheKey = cacheNamespace
    ? buildCacheKey(cacheNamespace, cachePayload ?? { system: input.system, prompt: input.prompt })
    : undefined;

  const { text, cached } = await generateAIText({ ...input, cacheKey });

  try {
    return { data: JSON.parse(extractJson(text)) as T, cached };
  } catch (cause) {
    throw new Error("Gagal memproses hasil AI: JSON tidak valid.", { cause });
  }
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();

  const startObj = text.indexOf("{");
  const endObj = text.lastIndexOf("}");
  if (startObj !== -1 && endObj !== -1) return text.slice(startObj, endObj + 1);

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);

  return text.trim();
}
