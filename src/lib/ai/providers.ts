import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";

// Central place for "which AI provider/model do we call". Keeping this separate
// from ai.service.ts means swapping providers (or adding a fallback provider)
// never touches retry/cache/call-site logic.

export const AI_MODELS = {
  flash: "google/gemini-2.5-flash",
  pro: "google/gemini-2.5-pro",
} as const;

export type AIModelId = (typeof AI_MODELS)[keyof typeof AI_MODELS];

export const DEFAULT_MODEL: AIModelId = AI_MODELS.flash;

function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

// Reuse the same provider instance across calls instead of rebuilding it (and
// re-reading process.env) on every request.
let cachedProvider: OpenAICompatibleProvider | undefined;

function getProvider(): OpenAICompatibleProvider {
  if (cachedProvider) return cachedProvider;

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  cachedProvider = createLovableAiGatewayProvider(key);
  return cachedProvider;
}

/** Resolve a chat-completion model handle ready to pass into generateText/streamText. */
export function getModel(modelId: AIModelId = DEFAULT_MODEL) {
  return getProvider()(modelId);
}
