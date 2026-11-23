"use client";

/**
 * useCachedData.ts
 *
 * React hook implementing the fast page reload pattern (Task 4):
 *
 *   1. Check the in-memory cache first.
 *   2. Validate cache version and expiration.
 *   3. Display valid cached data immediately.
 *   4. Avoid a network request if the data is fresh.
 *   5. Revalidate stale data in the background where policy allows.
 *   6. Update the interface when newer data arrives.
 *
 * For authenticated / user-specific resources the fetch function (a server
 * action) performs server-side authorization before returning data, so cached
 * private data is never served without a fresh permission check when the
 * policy requires it.
 *
 * Usage:
 *   const { data, isLoading, isRefetching } = useCachedData({
 *     key: privateProfileKey(userId),
 *     fetch: () => getProfileAction(),
 *     policy: getPolicy("private:profile"),
 *   });
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchWithDedupe, getCached, invalidate, CACHE_PREFIX } from "@/lib/data/request-dedup";
import type { CachePolicy } from "@/lib/cache/cache-policy";
import { localPrefs, sessionPrefs } from "@/lib/cache/persistent-storage";

/** BroadcastChannel for cross-tab cache invalidation. */
const broadcastChannel = typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel("eventra-cache-invalidation")
  : null;

interface UseCachedDataOptions<T> {
  /** Versioned cache key (see cache-keys.ts). */
  key: string;
  /** Fetch function (typically a server action wrapper). Must enforce auth. */
  fetch: () => Promise<T>;
  /** Cache policy from cache-policy.ts. */
  policy: CachePolicy;
  /** When true, skip cache and force fetch (e.g. after a mutation). */
  bypassCache?: boolean;
  /** If data is stale and backgroundRevalidate is false, still refetch on mount. */
  refetchOnMount?: boolean;
}

interface UseCachedDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCachedData<T>({
  key,
  fetch,
  policy,
  bypassCache = false,
  refetchOnMount = false,
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(false);
  const fetchingRef = useRef(false);
  const staleRef = useRef(false);

  const doFetch = useCallback(
    async (background: boolean): Promise<void> => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        if (!background) {
          setIsLoading(true);
          setError(null);
        } else {
          setIsRefetching(true);
        }

        const result = await fetchWithDedupe<T>(key, fetch, {
          staleTime: policy.ttlMs ?? 60_000,
          bypassCache: bypassCache,
          maxEntryBytes: policy.maxEntryBytes,
        });

        if (!mountedRef.current) return;
        setData(result);
        staleRef.current = false;

        // 6. Persist to disk if policy allows (survives full reload for public data).
        const storage = getPersistentStorage();
        if (storage) {
          const name = persistentKey();
          if (name) {
            try {
              storage.set(name, result as unknown as Record<string, unknown>);
            } catch {
              // Persistent storage write failure is non-fatal.
            }
          }
        }
      } catch (err) {
        if (!mountedRef.current) return;
        const e = err instanceof Error ? err : new Error(String(err));
        // Never crash the UI on a cache read failure; show last known data.
        if (!background) {
          setError(e);
          setIsLoading(false);
        } else {
          setIsRefetching(false);
        }
      } finally {
        if (!mountedRef.current) return;
        if (!background) setIsLoading(false);
        setIsRefetching(false);
        fetchingRef.current = false;
      }
    },
    [key, fetch, policy.ttlMs, policy.maxEntryBytes, bypassCache]
  );

  // ── Helper: resolve persistent storage instance from policy ──
  const getPersistentStorage = useCallback(() => {
    if (policy.storage === "localStorage") return localPrefs;
    if (policy.storage === "sessionStorage") return sessionPrefs;
    return null;
  }, [policy.storage]);

  const persistentKey = useCallback((): string | null => {
    if (!key.startsWith(CACHE_PREFIX)) return null;
    return key.slice(CACHE_PREFIX.length);
  }, [key]);

  // ── Step 1–4: cache first, display immediately, skip network if fresh ──
  useEffect(() => {
    mountedRef.current = true;

    // 1. Check in-memory cache first (fastest).
    const cached = getCached<T>(key);
    if (cached !== undefined && cached !== null) {
      setData(cached);
      setIsLoading(false);
    }

    // 2. If no in-memory cache but persistent storage is allowed, check disk.
    if (cached === undefined || cached === null) {
      const storage = getPersistentStorage();
      if (storage) {
        const name = persistentKey();
        if (name) {
          const persisted = storage.get(name);
          if (persisted !== undefined && persisted !== null) {
            setData(persisted as T);
            setIsLoading(false);
          }
        }
      }
    }

    // Decide whether to fetch.
    const shouldFetch = refetchOnMount || cached === undefined || staleRef.current;
    if (shouldFetch) {
      void doFetch(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [key, doFetch, refetchOnMount, getPersistentStorage, persistentKey]);

  // ── Cross-tab invalidation listener ──
  // When another tab invalidates a cache key, refresh this tab's data.
  useEffect(() => {
    if (!broadcastChannel) return;

    const handler = (event: MessageEvent) => {
      try {
        const { type, key: eventKey } = event.data as { type: string; key: string };
        if (type === "invalidate" && eventKey === key) {
          staleRef.current = true;
          void doFetch(true);
        }
      } catch {
        // Ignore malformed messages.
      }
    };

    broadcastChannel.addEventListener("message", handler);
    return () => {
      broadcastChannel.removeEventListener("message", handler);
    };
  }, [key, doFetch, broadcastChannel]);

  // ── Step 5–6: background revalidation of stale data ──
  // Revalidate when the tab regains focus (user returns to page).
  useEffect(() => {
    if (!policy.backgroundRevalidate) return;

    const handleFocus = () => {
      const cached = getCached<T>(key);
      if (cached === undefined || cached === null) return;
      staleRef.current = true;
      void doFetch(true);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, policy.backgroundRevalidate, doFetch]);

  // Explicit refetch (e.g. after a user-triggered refresh).
  const refetch = useCallback(async (): Promise<void> => {
    invalidate(key);
    staleRef.current = false;
    await doFetch(false);

    // Notify other tabs to invalidate their cache for this key.
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: "invalidate", key });
      } catch {
        // Broadcast channel postMessage failure is non-fatal.
      }
    }
  }, [key, doFetch, broadcastChannel]);

  return { data, isLoading, isRefetching, error, refetch };
}
