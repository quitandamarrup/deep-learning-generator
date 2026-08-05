import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

// A provider resolves a model id into a LanguageModel ready to pass into
// generateText/streamText. New providers (Claude, Mistral, Azure OpenAI,
// Ollama, a local LLM, ...) register themselves in PROVIDERS below —
// router.ts decides which registered providers are active and in what
// priority order (AIRouter's fallback chain), so nothing else in the app
// needs to know or care which one actually served a given request.

export type ModelResolver = (modelId: string) => LanguageModel;

export type ProviderId = "google-ai-studio" | "openrouter" | "lovable-gateway";

export interface ProviderDefinition {
  /** Builds this provider's model resolver. Called lazily and memoized by router.ts. Throws if required env vars are missing — the router treats that as "skip this provider". */
  createResolver: () => ModelResolver;
  /** This provider's own default model id. Read lazily (may depend on an env var) so it reflects the current environment, not just whatever was set at process start. */
  defaultModelId: () => string;
}

// --- Google AI Studio (Gemini API) — primary provider -----------------------
// Uses Google's OpenAI-compatible endpoint, so no extra SDK dependency is
// needed beyond the @ai-sdk/openai-compatible already used for the other
// providers here.
function createGoogleAiStudioResolver(): ModelResolver {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_API_KEY");

  const provider = createOpenAICompatible({
    name: "google-ai-studio",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey,
  });

  return (modelId: string) => provider(modelId);
}

// --- OpenRouter — fallback provider, free models only ------------------------
function createOpenRouterResolver(): ModelResolver {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const provider = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  return (modelId: string) => provider(modelId);
}

// --- Lovable AI Gateway — kept registered for backward compatibility --------
// This was the only provider before this feature. If GOOGLE_API_KEY/
// OPENROUTER_API_KEY aren't configured yet in a given environment, the
// router falls through to this and behavior is identical to before.
function createLovableGatewayResolver(): ModelResolver {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const provider = createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  return (modelId: string) => provider(modelId);
}

// Registry of every provider the app knows how to build. To add a new one
// (Claude, Mistral, Azure OpenAI, Ollama, a local LLM, ...): implement its
// own createResolver + defaultModelId here, add one entry below, and
// optionally add its id to AI_PROVIDER_PRIORITY. router.ts and ai.service.ts
// need no changes.
export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  "google-ai-studio": {
    createResolver: createGoogleAiStudioResolver,
    defaultModelId: () => process.env.GOOGLE_MODEL || "gemini-2.0-flash",
  },
  openrouter: {
    createResolver: createOpenRouterResolver,
    defaultModelId: () => process.env.OPENROUTER_MODEL || "qwen/qwen3",
  },
  "lovable-gateway": {
    createResolver: createLovableGatewayResolver,
    defaultModelId: () => AI_MODELS.flash,
  },
};

// Model catalog kept for the lovable-gateway provider (its model-id
// namespace), unchanged from before this feature.
export const AI_MODELS = {
  flash: "google/gemini-2.5-flash",
  pro: "google/gemini-2.5-pro",
} as const;

export type AIModelId = (typeof AI_MODELS)[keyof typeof AI_MODELS];

export const DEFAULT_MODEL: AIModelId = AI_MODELS.flash;
