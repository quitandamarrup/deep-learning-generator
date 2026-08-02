import type { LanguageModel } from "ai";
import { AI_MODELS, DEFAULT_MODEL, PROVIDERS } from "./providers";
import type { AIModelId, ModelResolver, ProviderId } from "./providers";

// ai.service.ts (and everything upstream of it) only ever calls getModel()
// here — it never imports providers.ts directly. This is the one place that
// decides *which* registered provider is active, keeping that decision out of
// business logic and call sites entirely.

const DEFAULT_PROVIDER_ID: ProviderId = "lovable-gateway";

function resolveActiveProviderId(): ProviderId {
  const configured = process.env.AI_PROVIDER as ProviderId | undefined;
  if (!configured) return DEFAULT_PROVIDER_ID;

  if (!(configured in PROVIDERS)) {
    const known = Object.keys(PROVIDERS).join(", ");
    throw new Error(`Unknown AI_PROVIDER "${configured}". Registered providers: ${known}.`);
  }
  return configured;
}

// Memoized per provider id so switching AI_PROVIDER (e.g. in tests) doesn't
// require a process restart, while normal requests reuse one resolver instance.
let cachedResolver: ModelResolver | undefined;
let cachedProviderId: ProviderId | undefined;

function getActiveResolver(): ModelResolver {
  const providerId = resolveActiveProviderId();
  if (cachedResolver && cachedProviderId === providerId) return cachedResolver;

  cachedResolver = PROVIDERS[providerId].createResolver();
  cachedProviderId = providerId;
  return cachedResolver;
}

/** Resolve a chat-completion model handle from whichever provider is currently active. */
export function getModel(modelId: AIModelId = DEFAULT_MODEL): LanguageModel {
  return getActiveResolver()(modelId);
}
