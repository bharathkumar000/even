/**
 * cache-policy.ts
 *
 * Centralized browser caching policy for Eventra.
 *
 * Classifies every category of application data and defines:
 *   - Which storage mechanism is used
 * *   - Expiration (TTL) in milliseconds
 *   - Whether background revalidation is allowed
 *   - Whether persistent storage is permitted (security)
 *
 * These are the single source of truth for cache behavior. Adjust TTLs here
 * after observing production traffic patterns.
 */

export const CACHE_VERSION = "v1";

/**
 * Data classification (Task 1).
 */
export type DataClass =
  | "public_static"        // A - Public, mostly static (event info, 30 min)
  | "public_occasional"    // B - Public, changes occasionally (announcements, 30-60s)
  | "user_specific"        // C - User-specific (profile, team, submission)
  | "sensitive_auth"       // D - Sensitive / authorization-dependent (judge scores, admin data, unpublished results)
  | "critical_operational"; // E - Critical operational (live activity, QR scans - short-lived or none)

export interface CachePolicy {
  /** Data class for auditing and security review. */
  dataClass: DataClass;
  /** Storage mechanism. */
  storage: "http" | "memory" | "localStorage" | "sessionStorage" | "none";
  /** Time-to-live in ms. Undefined = no expiration (preferences). */
  ttlMs?: number;
  /** Background revalidate after serving stale cache? */
  backgroundRevalidate: boolean;
  /** Permit persistent cross-session browser storage? */
  persistent: boolean;
  /** Require fresh authorized server fetch instead of cache? */
  requireAuthorizedFetch: boolean;
  /** Size cap in bytes per entry (approx). */
  maxEntryBytes?: number;
}

/**
 * Master policy registry. Every cached resource must appear here.
 */
export const CACHE_POLICIES: Record<string, CachePolicy> = {
  // ── A: Public and mostly static ──
  "public:event": {
    dataClass: "public_static",
    storage: "localStorage",
    ttlMs: 30 * 60 * 1000,
    backgroundRevalidate: true,
    persistent: true,
    requireAuthorizedFetch: false,
    maxEntryBytes: 50_000,
  },
  "public:schedule": {
    dataClass: "public_static",
    storage: "localStorage",
    ttlMs: 5 * 60 * 1000,
    backgroundRevalidate: true,
    persistent: true,
    requireAuthorizedFetch: false,
    maxEntryBytes: 100_000,
  },
  "public:criteria": {
    dataClass: "public_static",
    storage: "localStorage",
    ttlMs: 5 * 60 * 1000,
    backgroundRevalidate: true,
    persistent: true,
    requireAuthorizedFetch: false,
    maxEntryBytes: 50_000,
  },
  "public:problem-statements": {
    dataClass: "public_static",
    storage: "localStorage",
    ttlMs: 30 * 60 * 1000,
    backgroundRevalidate: true,
    persistent: true,
    requireAuthorizedFetch: false,
    maxEntryBytes: 100_000,
  },

  // ── B: Public data that changes occasionally ──
  "public:announcements": {
    dataClass: "public_occasional",
    storage: "sessionStorage",
    ttlMs: 45 * 1000, // within 30–60s guidance
    backgroundRevalidate: true,
    persistent: true, // session-only, cleared on tab close
    requireAuthorizedFetch: false,
    maxEntryBytes: 200_000,
  },

  // ── C: User-specific data ──
  "private:profile": {
    dataClass: "user_specific",
    storage: "memory",
    ttlMs: 5 * 60 * 1000,
    backgroundRevalidate: true,
    persistent: false,
    requireAuthorizedFetch: true,
    maxEntryBytes: 10_000,
  },
  "private:team": {
    dataClass: "user_specific",
    storage: "memory",
    ttlMs: 5 * 60 * 1000,
    backgroundRevalidate: true,
    persistent: false,
    requireAuthorizedFetch: true,
    maxEntryBytes: 50_000,
  },
  "private:submission": {
    dataClass: "user_specific",
    storage: "memory",
    ttlMs: 2 * 60 * 1000,
    backgroundRevalidate: true,
    persistent: false,
    requireAuthorizedFetch: true,
    maxEntryBytes: 100_000,
  },
  "private:results": {
    dataClass: "user_specific",
    storage: "memory",
    ttlMs: 2 * 60 * 1000,
    backgroundRevalidate: true,
    persistent: false,
    requireAuthorizedFetch: true,
    maxEntryBytes: 50_000,
  },
  "private:assignments": {
    dataClass: "user_specific",
    storage: "memory",
    ttlMs: 5 * 60 * 1000,
    backgroundRevalidate: true,
    persistent: false,
    requireAuthorizedFetch: true,
    maxEntryBytes: 50_000,
  },

  // ── D: Sensitive / authorization-dependent ──
  // Never persisted to disk. Short-lived memory only, fresh fetch required.
  "sensitive:evaluation": {
    dataClass: "sensitive_auth",
    storage: "memory",
    ttlMs: 60 * 1000,
    backgroundRevalidate: false,
    persistent: false,
    requireAuthorizedFetch: true,
    maxEntryBytes: 20_000,
  },
  "sensitive:judge-scores": {
    dataClass: "sensitive_auth",
    storage: "none",
    ttlMs: undefined,
    backgroundRevalidate: false,
    persistent: false,
    requireAuthorizedFetch: true,
  },
  "sensitive:admin-data": {
    dataClass: "sensitive_auth",
    storage: "none",
    ttlMs: undefined,
    backgroundRevalidate: false,
    persistent: false,
    requireAuthorizedFetch: true,
  },
  "sensitive:unpublished-results": {
    dataClass: "sensitive_auth",
    storage: "none",
    ttlMs: undefined,
    backgroundRevalidate: false,
    persistent: false,
    requireAuthorizedFetch: true,
  },

  // ── E: Critical operational ──
  "operational:live-activity": {
    dataClass: "critical_operational",
    storage: "none",
    ttlMs: undefined,
    backgroundRevalidate: false,
    persistent: false,
    requireAuthorizedFetch: true,
  },
  "operational:qr-scan": {
    dataClass: "critical_operational",
    storage: "none",
    ttlMs: undefined,
    backgroundRevalidate: false,
    persistent: false,
    requireAuthorizedFetch: true,
  },

  // ── UI preferences (non-sensitive, persistent until changed) ──
  "ui:dismissed-announcements": {
    dataClass: "user_specific",
    storage: "sessionStorage",
    ttlMs: undefined,
    backgroundRevalidate: false,
    persistent: true, // session-only, cleared on tab close
    requireAuthorizedFetch: false,
    maxEntryBytes: 5_000,
  },
  "ui:preferences": {
    dataClass: "user_specific",
    storage: "localStorage",
    ttlMs: undefined,
    backgroundRevalidate: false,
    persistent: true,
    requireAuthorizedFetch: false,
    maxEntryBytes: 5_000,
  },
  "ui:timer-toggle": {
    dataClass: "user_specific",
    storage: "localStorage",
    ttlMs: undefined,
    backgroundRevalidate: false,
    persistent: true,
    requireAuthorizedFetch: false,
    maxEntryBytes: 100,
  },
};

/**
 * Resolve a policy by resource key prefix. Falls back to a restrictive default.
 */
export function getPolicy(resourceKey: string): CachePolicy {
  const prefix = Object.keys(CACHE_POLICIES).find((k) => resourceKey.startsWith(k));
  if (prefix && CACHE_POLICIES[prefix]) {
    return CACHE_POLICIES[prefix];
  }
  // Default: restrictive, no cache, fresh authorized fetch.
  return {
    dataClass: "sensitive_auth",
    storage: "none",
    ttlMs: undefined,
    backgroundRevalidate: false,
    persistent: false,
    requireAuthorizedFetch: true,
  };
}

/**
 * True if the resource may be stored in persistent browser storage.
 */
export function isPersistentAllowed(resourceKey: string): boolean {
  return getPolicy(resourceKey).persistent === true;
}

/**
 * True if the resource requires a fresh authorized server fetch (never serve
 * from persistent cache without server re-validation).
 */
export function requiresAuthorizedFetch(resourceKey: string): boolean {
  return getPolicy(resourceKey).requireAuthorizedFetch === true;
}

/**
 * TTL for a resource, or undefined if it does not expire.
 */
export function ttlFor(resourceKey: string): number | undefined {
  return getPolicy(resourceKey).ttlMs;
}

/**
 * Maximum entry size in bytes, or undefined if unconstrained.
 */
export function maxEntryBytesFor(resourceKey: string): number | undefined {
  return getPolicy(resourceKey).maxEntryBytes;
}
