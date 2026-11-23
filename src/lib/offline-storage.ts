"use client";

/**
 * offline-storage.ts
 *
 * Security-hardened client storage helpers.
 *
 * NOTE (Task 7): Persistent browser storage must NEVER contain:
 *   - Judge evaluation drafts containing sensitive scoring information
 *   - Unpublished results
 *   - Admin-only datasets
 *   - Privileged authorization decisions
 *   - Private data belonging to other users
 *
 * The previous version persisted judge evaluation drafts to IndexedDB and
 * localStorage. That is removed here because offline judge scores must never
 * silently appear as successfully submitted (Task 8). Evaluation drafts live
 * only in volatile client state and are written to Supabase when the user
 * explicitly saves/submits while online.
 *
 * This file retains only safe, non-sensitive helpers:
 *   - localStorage preferences (UI settings, persisted until changed)
 *   - sessionStorage short-lived per-tab data (dismissed announcements)
 *
 * Both storage areas enforce size caps, expiration, and graceful fallback
 * when storage is disabled (see persistent-storage.ts).
 */

import { localPrefs, sessionPrefs } from "@/lib/cache/persistent-storage";

/**
 * Save a non-sensitive UI preference to localStorage.
 * Safe for: theme, collapsed sidebars, timer visibility toggles.
 * Unsafe for: any scoring, evaluation, or personal data.
 */
export function saveUiPreference(key: string, value: unknown): boolean {
  const current = localPrefs.get(key) ?? {};
  const next = { ...current, [key]: value };
  return localPrefs.set(key, next);
}

/**
 * Read a non-sensitive UI preference from localStorage.
 */
export function getUiPreference<T = unknown>(key: string): T | null {
  const current = localPrefs.get(key) as Record<string, unknown> | null;
  if (!current) return null;
  return (current[key] as T) ?? null;
}

/**
 * Remove a UI preference from localStorage.
 */
export function removeUiPreference(key: string): void {
  localPrefs.remove(key);
}

/**
 * Store short-lived, non-sensitive per-tab data (e.g. dismissed announcement
 * IDs). Cleared automatically when the tab/session ends.
 */
export function setSessionData(key: string, value: unknown): boolean {
  return sessionPrefs.set(key, value as unknown as Record<string, unknown>);
}

/**
 * Read short-lived per-tab data from sessionStorage.
 */
export function getSessionData<T = unknown>(key: string): T | null {
  return sessionPrefs.get(key) as T | null;
}

/**
 * Remove short-lived per-tab data.
 */
export function removeSessionData(key: string): void {
  sessionPrefs.remove(key);
}

/**
 * Clear all non-sensitive app-owned browser storage (called on logout).
 * Does not touch sensitive server-side data.
 */
export function clearNonSensitiveStorage(): void {
  localPrefs.clear();
  sessionPrefs.clear();
}

/**
 * Check whether browser storage is available.
 */
export function isBrowserStorageAvailable(): boolean {
  return typeof window !== "undefined" && !!(
    window.localStorage || window.sessionStorage
  );
}
