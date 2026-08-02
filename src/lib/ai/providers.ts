import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

// A provider resolves a model id (e.g. "google/gemini-2.5-flash") into a
// LanguageModel ready to pass into generateText/streamText. New providers
// (DeepSeek, Groq, OpenRouter, ...) register themselves in PROVIDERS below —
// router.ts decides which registered provider is actually active, so nothing
// else in the app needs to know or care which one is used.

export type ModelResolver = (modelId: string) => LanguageModel;

export type ProviderId = "lovable-gateway";

export interface ProviderDefinition {
  /** Builds this provider's model resolver. Called lazily and memoized by router.ts. */
  createResolver: () => ModelResolver;
}

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

// Registry of every provider the app knows how to build. To add DeepSeek,
// Groq, or OpenRouter later: implement its own createResolver here (reading
// that provider's own API key/base URL) and add one entry below — router.ts
// and ai.service.ts need no changes to start using it.
export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  "lovable-gateway": { createResolver: createLovableGatewayResolver },
};

// Model catalog for the currently active provider (Lovable AI Gateway, which
// currently proxies to Gemini 2.5). This is unchanged from before the refactor.
export const AI_MODELS = {
  flash: "google/gemini-2.5-flash",
  pro: "google/gemini-2.5-pro",
} as const;

export type AIModelId = (typeof AI_MODELS)[keyof typeof AI_MODELS];

export const DEFAULT_MODEL: AIModelId = AI_MODELS.flash;
