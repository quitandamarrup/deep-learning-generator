import { PROVIDERS } from "./providers";
import type { ModelResolver, ProviderId } from "./providers";

// AIRouter: the application (via ai.service.ts's askAI()) only ever calls
// getProviderChain() + getResolver() here — it never imports providers.ts
// or talks to a provider SDK directly. This is the one place that decides
// which providers are registered, in what priority order, and resolves
// each one's model handle.

const DEFAULT_PROVIDER_CHAIN: ProviderId[] = ["google-ai-studio", "openrouter", "lovable-gateway"];

/**
 * Priority order AIRouter tries providers in. Configurable via
 * AI_PROVIDER_PRIORITY (comma-separated provider ids), e.g.
 * "google-ai-studio,openrouter". Falls back to the default chain (Google ->
 * OpenRouter -> Lovable Gateway) if unset, so existing deployments that only
 * have LOVABLE_API_KEY configured keep working exactly as before — Google/
 * OpenRouter are simply skipped (missing API key) until configured.
 */
export function getProviderChain(): ProviderId[] {
  const configured = process.env.AI_PROVIDER_PRIORITY;
  if (!configured) return DEFAULT_PROVIDER_CHAIN;

  const ids = configured
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const unknown = ids.filter((id) => !(id in PROVIDERS));
  if (unknown.length > 0) {
    const known = Object.keys(PROVIDERS).join(", ");
    throw new Error(
      `Unknown provider id(s) in AI_PROVIDER_PRIORITY: ${unknown.join(", ")}. Registered providers: ${known}.`,
    );
  }
  return ids as ProviderId[];
}

// Memoized per provider id so repeated calls within a warm process reuse one
// resolver instance instead of rebuilding it (and re-reading env vars) every
// request. A provider whose resolver throws (missing config) is never
// cached as failed — later requests get a fresh chance in case the
// environment changes.
const resolverCache = new Map<ProviderId, ModelResolver>();

/** Builds (or reuses) the given provider's model resolver. Throws if that provider isn't configured — callers treat that as "skip to the next provider". */
export function getResolver(providerId: ProviderId): ModelResolver {
  const cached = resolverCache.get(providerId);
  if (cached) return cached;

  const resolver = PROVIDERS[providerId].createResolver();
  resolverCache.set(providerId, resolver);
  return resolver;
}

/** This provider's own default model id (may come from its own env var, e.g. OPENROUTER_MODEL). */
export function getDefaultModelId(providerId: ProviderId): string {
  return PROVIDERS[providerId].defaultModelId();
}
