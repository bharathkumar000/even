/**
 * cache-keys.ts
 *
 * Versioned, deterministic cache key factory for Eventra.
 *
 * All cache keys follow the schema:
 *     v{version}:{namespace}:{scope}:{identifier}
 *
 * Where:
 *   - version:  cache schema version (bumped on breaking data shape changes)
 *   - namespace: high-level resource domain (public, private, sensitive, operational, ui)
 *   - scope:    event id, audience, round id, team id, or user id
 *   - identifier: resource type and optional sub-key
 *
 * Keys never contain authentication tokens, service-role keys, or secrets.
 * User identity appears only as a scoped opaque identifier (e.g. userId) and
 * is never combined across sessions to prevent collisions when users sign
 * in/out on the same browser.
 */

import { CACHE_VERSION } from "./cache-policy";

/**
 * Cache key namespace prefixes.
 */
export const NS = {
  PUBLIC: "public",
  PRIVATE: "private",
  SENSITIVE: "sensitive",
  OPERATIONAL: "operational",
  UI: "ui",
} as const;

/**
 * Build a versioned, deterministic cache key.
 *
 * @param namespace - public | private | sensitive | operational | ui
 * @param scope - eventId | audience | roundId | teamId | userId | "all"
 * @param resource - resource type (event, schedule, criteria, announcements, profile, team, submission, ...)
 * @param subKey - optional additional disambiguator (never include secrets/tokens)
 */
export function cacheKey(
  namespace: string,
  scope: string,
  resource: string,
  subKey?: string
): string {
  const safeScope = String(scope).replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeResource = String(resource).replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeSub = subKey ? String(subKey).replace(/[^a-zA-Z0-9_-]/g, "_") : "";
  const parts = [CACHE_VERSION, namespace, safeScope, safeResource, safeSub].filter(Boolean);
  return parts.join(":");
}

/**
 * Public event info (30 min TTL).
 */
export function publicEventKey(eventId: string): string {
  return cacheKey(NS.PUBLIC, eventId, "event");
}

/**
 * Public schedule / rounds (5 min TTL).
 */
export function publicScheduleKey(eventId: string): string {
  return cacheKey(NS.PUBLIC, eventId, "schedule");
}

/**
 * Public evaluation criteria (5 min TTL).
 */
export function publicCriteriaKey(roundId: string): string {
  return cacheKey(NS.PUBLIC, roundId, "criteria");
}

/**
 * Public problem statements (30 min TTL).
 */
export function publicProblemStatementsKey(eventId: string): string {
  return cacheKey(NS.PUBLIC, eventId, "problem-statements");
}

/**
 * Public announcements for an audience (30-60s TTL).
 */
export function publicAnnouncementsKey(audience: string): string {
  return cacheKey(NS.PUBLIC, audience, "announcements");
}

/**
 * User profile (short-lived memory, authorized fetch).
 */
export function privateProfileKey(userId: string): string {
  return cacheKey(NS.PRIVATE, userId, "profile");
}

/**
 * Team info + membership (short-lived memory, authorized fetch).
 */
export function privateTeamKey(teamId: string): string {
  return cacheKey(NS.PRIVATE, teamId, "team");
}

/**
 * Team submission (short-lived memory, authorized fetch).
 */
export function privateSubmissionKey(teamId: string, formId?: string): string {
  return cacheKey(NS.PRIVATE, teamId, "submission", formId ?? "default");
}

/**
 * Published team results (short-lived memory, authorized fetch).
 */
export function privateResultsKey(teamId: string): string {
  return cacheKey(NS.PRIVATE, teamId, "results");
}

/**
 * Judge assignments (short-lived memory, authorized fetch).
 */
export function judgeAssignmentsKey(judgeId: string): string {
  return cacheKey(NS.PRIVATE, judgeId, "assignments");
}

/**
 * Private dashboard data for a specific user and portal (short-lived memory,
 * authorized fetch). Key is user-scoped so different users never share cache.
 */
export function privateDashboardKey(userId: string, portal: string): string {
  return cacheKey(NS.PRIVATE, userId, `dashboard:${portal}`);
}

/**
 * Sensitive evaluation data (memory only, never persisted).
 */
export function sensitiveEvaluationKey(roundId: string, teamId: string, judgeId: string): string {
  return cacheKey(NS.SENSITIVE, `${roundId}:${teamId}:${judgeId}`, "evaluation");
}

/**
 * UI preferences (localStorage, persistent until changed).
 */
export function uiPreferencesKey(): string {
  return cacheKey(NS.UI, "prefs", "settings");
}

/**
 * Dismissed announcements (sessionStorage, cleared on tab close).
 */
export function uiDismissedAnnouncementsKey(audience: string): string {
  return cacheKey(NS.UI, audience, "dismissed-announcements");
}

/**
 * UI timer toggle (localStorage).
 */
export function uiTimerToggleKey(): string {
  return cacheKey(NS.UI, "prefs", "timer-toggle");
}

/**
 * Extract the user scope portion from a private key for logout invalidation.
 * Returns the userId embedded in keys like v1:private:{userId}:profile.
 */
export function userScopeFromKey(key: string): string | null {
  const parts = key.split(":");
  // v1 : private : userId : resource ...
  if (parts.length >= 3 && parts[0] === CACHE_VERSION && parts[1] === NS.PRIVATE) {
    return parts[2] || null;
  }
  return null;
}
