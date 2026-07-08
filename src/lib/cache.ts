// ─────────────────────────────────────────────
// Simple in-memory TTL cache
// Prevents redundant API calls when the same ticker
// is researched multiple times within the TTL window.
// ─────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get a value from the cache, or compute and store it if missing/expired.
 *
 * @param key   Cache key (e.g. `financials:AAPL`)
 * @param fn    Async function to compute the value on cache miss
 * @param ttlMs Time-to-live in milliseconds (default 30 min)
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const existing = store.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.data as T;
  }

  const data = await fn();
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/** Clear a specific key or the entire cache */
export function clearCache(key?: string) {
  if (key) {
    store.delete(key);
  } else {
    store.clear();
  }
}
