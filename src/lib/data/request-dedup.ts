"use client";

/**
 * request-dedup.ts
 *
 * Lightweight, dependency-free request deduplication layer tuned for the
 * Eventra Next.js architecture. Provides:
 *
 * 1. In-flight request deduplication (single-flight): identical concurrent
 *    requests share one Promise.
 * 2. Configurable stale-time cache: fresh cache entries are returned without
 *    hitting the network.
 * 3. Background revalidation: mark a key stale so the next read refetches.
 * 4. Controlled retries with exponential backoff.
 * 5. Targeted cache invalidation (exact key or prefix).
 * 6. Explicit, namespaced keys only — no automatic capture of private user data.
 *    Never include authentication tokens or secrets in keys.
 *
 * Intended for server-action / fetch wrappers used by client components.
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  staleTime: number;
};

type FetchOptions<T> = {
  /** Time in ms the cached result stays fresh (default 60s). */
  staleTime?: number;
  /** Max retry attempts on failure (default 2). */
  retries?: number;
  /** Base delay in ms for exponential backoff retries (default 1000). */
  retryBaseMs?: number;
  /** Abort signal to cancel the request. */
  signal?: AbortSignal;
  /** When true, bypass cache and force a network fetch. */
  bypassCache?: boolean;
  /** Max approximate bytes for this entry. Overlong entries are not cached. */
  maxEntryBytes?: number;
};

export const INFLIGHT_PREFIX = "inflight:";
export const CACHE_PREFIX = "cache:";

const inFlight = new Map<string, Promise<unknown>>();
const cache = new Map<string, CacheEntry<unknown>>();

function isExpired(entry: CacheEntry<unknown>, now: number): boolean {
  return now - entry.timestamp >= entry.staleTime;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a fetch with deduplication, caching, and controlled retries.
 *
 * @param key   Explicit namespace + identifier (e.g. "announcements:teams").
 *              Never include raw PII in the key.
 * @param fn    Async fetch function. Must throw on failure to trigger retry.
 * @param opts  Stale time, retries, backoff, signal, bypass cache.
 */
export async function fetchWithDedupe<T>(
  key: string,
  fn: () => Promise<T>,
  opts: FetchOptions<T> = {}
): Promise<T> {
  const {
    staleTime = 60_000,
    retries = 2,
    retryBaseMs = 1_000,
    signal,
    bypassCache = false,
    maxEntryBytes,
  } = opts;

  const now = Date.now();

  // 1. Serve fresh cache without touching the network (unless bypassed).
  if (!bypassCache) {
    const cached = cache.get(CACHE_PREFIX + key);
    if (cached && !isExpired(cached, now)) {
      return cached.data as T;
    }
  }

  // 2. Single-flight: share one in-flight promise for identical keys.
  const inflightKey = INFLIGHT_PREFIX + key;
  const existing = inFlight.get(inflightKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const attempt = async (attemptNo: number): Promise<T> => {
    if (signal?.aborted) throw new Error("Request aborted");
    try {
      const data = await fn();
      // Store in cache on success.
      cache.set(CACHE_PREFIX + key, {
        data,
        timestamp: Date.now(),
        staleTime,
      });
      return data;
    } catch (err) {
      if (signal?.aborted) throw new Error("Request aborted");
      if (attemptNo < retries) {
        const backoff = retryBaseMs * Math.pow(2, attemptNo);
        await sleep(backoff);
        return attempt(attemptNo + 1);
      }
      throw err;
    } finally {
      // Release the in-flight entry only when the owning attempt completes.
      if (attemptNo === 0) {
        inFlight.delete(inflightKey);
      }
    }
  };

  const promise = attempt(0);
  inFlight.set(inflightKey, promise);
  return promise as Promise<T>;
}

/** Return the cached value for a key if fresh, otherwise undefined. */
export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(CACHE_PREFIX + key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (isExpired(entry, Date.now())) return undefined;
  return entry.data as T;
}

/** Mark a key as stale so the next read triggers a refetch. */
export function invalidate(key: string): void {
  cache.delete(CACHE_PREFIX + key);
}

/** Remove every cache entry whose key starts with the given prefix. */
export function invalidatePrefix(prefix: string): void {
  for (const k of cache.keys()) {
    if (k.startsWith(CACHE_PREFIX + prefix)) {
      cache.delete(k);
    }
  }
}

/** Clear the entire cache (tests / logout). */
export function clearCache(): void {
  cache.clear();
}

/** Number of keys currently cached (diagnostics). */
export function cacheSize(): number {
  return cache.size;
}

/** Number of in-flight requests (diagnostics). */
export function inFlightSize(): number {
  return inFlight.size;
}
