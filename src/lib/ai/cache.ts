// Simple in-memory TTL cache so identical AI requests (same inputs, e.g. a
// teacher re-opening the same CP analysis) don't re-spend tokens/latency.
// Lives only for the lifetime of the server process — fine for this use case
// since results are cheap to regenerate and not required to survive restarts.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ENTRIES = 500; // basic guard against unbounded growth

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    // Evict the oldest entry (Map preserves insertion order) rather than
    // growing forever under heavy, varied traffic.
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function deleteCached(key: string): void {
  store.delete(key);
}

export function clearCache(): void {
  store.clear();
}

/** Deterministic cache key from any JSON-serializable payload (sorts object keys). */
export function buildCacheKey(namespace: string, payload: unknown): string {
  return `${namespace}:${stableStringify(payload)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
  );
  return `{${entries.join(",")}}`;
}

/** Wraps `fn`, returning the cached value if present, otherwise computing + caching it. */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<{ value: T; cached: boolean }> {
  const cached = getCached<T>(key);
  if (cached !== undefined) return { value: cached, cached: true };

  const value = await fn();
  setCached(key, value, ttlMs);
  return { value, cached: false };
}
