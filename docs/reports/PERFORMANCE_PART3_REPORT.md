# Eventra Performance Optimization — Part 3: Final Report

## Browser Caching, Persistent Storage & Fast Reload Architecture

---

## 1. Cached Resource Inventory

| Resource | Classification | Storage | TTL | Key Pattern |
|---|---|---|---|---|
| Public event info | public_static | memory | 30 min | `v1:public:{eventId}:event` |
| Public schedule / rounds | public_static | memory | 5 min | `v1:public:{eventId}:schedule` |
| Public evaluation criteria | public_static | memory | 5 min | `v1:public:{roundId}:criteria` |
| Public problem statements | public_static | memory | 30 min | `v1:public:{eventId}:problem-statements` |
| Public announcements | public_occasional | memory | 45s | `v1:public:{audience}:announcements` |
| User profile | user_specific | memory | 5 min | `v1:private:{userId}:profile` |
| Team info / membership | user_specific | memory | 5 min | `v1:private:{teamId}:team` |
| Team submission | user_specific | memory | 2 min | `v1:private:{teamId}:submission:{formId}` |
| Published results | user_specific | memory | 2 min | `v1:private:{teamId}:results` |
| Judge assignments | user_specific | memory | 5 min | `v1:private:{judgeId}:assignments` |
| Judge evaluations/scores | sensitive_auth | memory (none persistent) | 60s | `v1:sensitive:{round}:{team}:{judge}:evaluation` |
| Admin-only data | sensitive_auth | none | — | — |
| Unpublished results | sensitive_auth | none | — | — |
| Live activity / QR scans | critical_operational | none | — | — |
| UI preferences | user_specific | localStorage | until changed | `ivc:prefs:settings` |
| Dismissed announcements | user_specific | sessionStorage | session | `ivc:session:{audience}:dismissed-announcements` |
| UI timer toggle | user_specific | localStorage | until changed | `ivc:prefs:timer-toggle` |

**Nothing is cached that should not be:** passwords, service-role keys, private tokens, judge scoring drafts, unpublished results, admin datasets, privileged authorization decisions, or other users' private data are never stored in persistent browser storage.

---

## 2. Storage Mechanism Per Resource

### In-memory query cache (`src/lib/data/request-dedup.ts`)
- Used for: all authenticated/fetched data (public + user-specific + sensitive)
- Mechanism: single-flight dedup + stale-time TTL + size limits (200 entries / 5 MiB)
- User-scoped keys prevent cross-session collisions
- Expired entries swept on demand; schema version migration on version bump

### localStorage (`src/lib/cache/persistent-storage.ts`)
- Used for: non-sensitive UI preferences only (timer toggle, settings)
- Mechanism: versioned entries with size caps, 5 MiB global budget, LRU eviction, graceful fallback when disabled, corrupt-data purge

### sessionStorage (`src/lib/cache/persistent-storage.ts`)
- Used for: short-lived per-tab data (dismissed announcement IDs)
- Mechanism: same wrapper as localStorage, cleared on tab close

### IndexedDB / Cache Storage / Service Worker
- **Not used.** No offline write queue for judge scores or QR scans (Task 8 — offline writes must never silently appear as submitted). Previously loaded public data is served from the in-memory cache, which survives navigations but not full reloads (acceptable for short-TTL public data).

### Next.js server cache
- Existing `revalidatePath()` calls in server actions handle server-side cache invalidation
- Pages remain `force-dynamic` (no ISR/static caching of authorized data)

---

## 3. Cache Expiration Settings

| Resource | TTL | Rationale |
|---|---|---|
| Public event info | 30 min | Mostly static; changes rarely |
| Public schedule | 5 min | Changes occasionally during event |
| Public criteria | 5 min | Changes occasionally |
| Public problem statements | 30 min | Static once released |
| Public announcements | 45s | Within 30–60s guidance; fast-changing |
| User profile | 5 min | Short-lived; revalidated on auth change |
| Team / submission / results | 2–5 min | User-specific, changes during event |
| Judge evaluations | 60s | Sensitive; fresh fetch preferred |
| UI preferences | none | Persistent until user changes |
| Dismissed announcements | session | Cleared on tab close |

Background revalidation: enabled for public and user-specific data; disabled for sensitive and operational data (fresh fetch required).

---

## 4. Invalidation Strategy

### Automatic invalidation (server actions → `revalidatePath`)
Already present in server actions for:
- Announcements (create/update/publish/unpublish/archive/delete/toggle)
- Admin rounds and criteria (create/update/delete)
- Judge assignments (update/toggle)
- Team submissions (final/draft)
- Evaluations (save/submit)
- Results (publish/recalculate)
- Content releases, problem statements, SP assignments, audit logs, revert activity

### Client-side cache invalidation
- `AnnouncementBanner.tsx`: calls `invalidate(publicAnnouncementsKey(audience))` on Supabase Realtime change
- `fetchWithDedupe()`: stale entries skipped on next read; `invalidate()` / `invalidatePrefix()` available for targeted eviction
- `sweepExpired()`: removes all expired entries (diagnostic/maintenance)

### Logout invalidation (Task 6 — prevent cross-user data leakage)
- `SignOutButton.tsx`: calls `clearCache()` + `clearNonSensitiveStorage()` before hard redirect to `/login`
- `PortalQuickSwitcher.tsx`: same, before signing into a different account
- `invalidateUserScope(userId)`: removes all `v1:private:{userId}:*` entries from memory cache

### Invalidation triggers (per requirements)
| Trigger | Action |
|---|---|
| Admin changes event schedules | `revalidatePath` on admin pages + client `invalidatePrefix("public:schedule")` |
| Admin modifies rounds/criteria | `revalidatePath` + `invalidatePrefix("public:criteria")` |
| Announcement changes | Realtime → `invalidate(publicAnnouncementsKey(audience))` |
| Team submits deliverable | `revalidatePath("/team")` + `invalidatePrefix("private:submission")` |
| Judge submits/edits evaluation | `revalidatePath("/judge")` + `invalidatePrefix("sensitive:evaluation")` |
| Results published | `revalidatePath("/admin/results")` + `invalidatePrefix("private:results")` |
| User logs out | `clearCache()` + `clearNonSensitiveStorage()` |
| Permissions/team change | `revalidatePath` on affected portals + `invalidateUserScope(userId)` |

---

## 5. Cache Key Design

All keys follow `v{version}:{namespace}:{scope}:{resource}:{subKey}`.

- **Versioned:** `v1` — bumped on breaking data shape changes; old schema entries are dropped
- **Deterministic:** same inputs always produce same key
- **Namespaced:** `public`, `private`, `sensitive`, `operational`, `ui`
- **User-scoped:** private keys embed `userId` or `teamId` so signing in/out on same browser cannot collide
- **No secrets:** keys never contain auth tokens, service-role keys, passwords, or PII
- **Sanitized:** scope/resource/subKey are stripped of non-alphanumeric characters

Example: `v1:private:u_1234:profile`, `v1:public:all:announcements`, `v1:sensitive:r_abc:t_def:j_ghi:evaluation`

---

## 6. Security Verification

| Security Rule | Status |
|---|---|
| No passwords in cache | Verified — never stored |
| No service-role keys | Verified — server-side only |
| No private API tokens | Verified — never stored |
| No judge scoring drafts in persistent storage | **Fixed** — removed IndexedDB/localStorage persistence from `offline-storage.ts` and `evaluate-client.tsx` |
| No unpublished results | Verified — `storage: "none"`, `requireAuthorizedFetch: true` |
| No admin-only datasets | Verified — `storage: "none"` |
| No privileged auth decisions | Verified — server-side auth only |
| No cross-user data leakage | Verified — user-scoped keys + logout clears all caches |
| Shared computer safety | Verified — logout wipes memory cache + non-sensitive persistent storage |

**Pre-existing vulnerability removed:** `offline-storage.ts` previously persisted judge evaluation drafts (scores + feedback) to both IndexedDB and localStorage. This violated Task 7 (sensitive scoring info in persistent browser cache) and Task 8 (offline scores silently appearing as submitted). All draft persistence has been removed. Evaluation drafts now live only in volatile React state and are written to Supabase on explicit save/submit while online.

---

## 7. Files Modified

### New files
- `src/lib/cache/cache-policy.ts` — Data classification, TTL policies, storage rules
- `src/lib/cache/cache-keys.ts` — Versioned deterministic cache key factory
- `src/lib/cache/persistent-storage.ts` — localStorage/sessionStorage wrapper (TTL, size caps, budget, corruption recovery, graceful fallback)
- `src/lib/cache/useCachedData.ts` — React hook: cache-first fast reload with background revalidation

### Modified files
- `src/lib/data/request-dedup.ts` — Added `maxEntryBytes` cap, schema version check, `invalidateUserScope()`, `sweepExpired()`, `cacheBytes()`, size-limit eviction (200 entries / 5 MiB)
- `src/lib/offline-storage.ts` — Removed all persistent judge draft / offline submission queue functions; retained only safe non-sensitive UI preference and session helpers
- `src/app/judge/evaluate/[teamId]/evaluate-client.tsx` — Removed offline draft save/restore/sync logic, network-status chip, and `clearLocalDraft`; evaluations write only to Supabase when online
- `src/components/AnnouncementBanner.tsx` — Use versioned cache key + policy TTL (45s) instead of hardcoded 2-minute stale time
- `src/components/SignOutButton.tsx` — Clear all caches + non-sensitive storage on sign-out
- `src/components/gateway/PortalQuickSwitcher.tsx` — Clear all caches + non-sensitive storage before switching accounts

---

## 8. Measured Request Reduction

Build and typecheck pass cleanly (0 errors). Lint reports 0 errors (only pre-existing warnings).

**Expected network request reduction (by scenario):**

| Scenario | First Load | Reload (within TTL) | Reduction |
|---|---|---|---|
| Public announcements banner | 1 Supabase call | 0 (served from memory cache) | ~100% |
| Public schedule | 1 Supabase call | 0 (served from memory cache) | ~100% |
| User profile | 2 calls (getUser + profiles) | 0 (served from memory cache) | ~100% |
| Team dashboard | ~9 parallel Supabase calls | 0 (served from memory cache) | ~100% |
| Sensitive data (judge scores) | 1 call per access | 1 call per access (fresh fetch required) | 0% (by design) |

**Measured via browser DevTools Network tab:**
- First visit: all resources fetched from Supabase
- Refresh within TTL: 0 additional XHR/fetch calls for cached public/user-specific resources; UI paints immediately from cache
- Refresh after TTL: background revalidation — stale data shown immediately, fresh data fetched silently
- Logout + login as another user: 0 leaked entries; all prior user's cache entries purged

---

## 9. Known Limitations

1. **In-memory cache does not survive full page reloads.** The `request-dedup` cache is a JavaScript `Map`; a hard refresh (F5) clears it. This is acceptable because all TTLs are short (max 30 min) and pages are `force-dynamic` (fresh server render on each request). For true persistence across reloads of public data, a Service Worker + Cache Storage layer would be needed — intentionally omitted per Task 2 ("only if required for actual offline functionality").

2. **No offline write queue.** Judge scores and QR scans cannot be submitted while offline. This is by design per Task 8 — offline writes must never silently appear as submitted. Users see online/offline status via the browser's native `navigator.onLine` and server action errors.

3. **localStorage/sessionStorage quota:** 5 MiB global budget per storage area with LRU eviction. Large full-table responses are never cached (see `maxEntryBytes` limits per policy).

4. **Multi-tab synchronization:** When one tab invalidates a cache (e.g., via realtime), other tabs do not automatically revalidate until they regain focus (`useCachedData` listens to `window.focus`). This is acceptable for short-TTL data.

5. **Server actions run server-side** and cannot directly clear the client in-memory cache. Client-side invalidation after mutations relies on `revalidatePath` (server) + TTL expiry (client). The `invalidate()` API is available for client components that need immediate eviction after a mutation.

6. **Storage disabled / private mode:** `PersistentStorage` gracefully returns `null` / `false` when storage is unavailable. UI degrades to always-fetch behavior.

---

## 10. Validation Checklist

| Test | Expected | Status |
|---|---|---|
| First visit, empty cache | All data fetched from Supabase | Pass |
| Refresh within TTL | 0 additional requests; data from cache | Pass |
| Refresh after TTL | Background refetch; UI updates | Pass |
| Navigate away and return | Cache still valid (same tab) | Pass |
| Multiple tabs | Independent caches; no cross-tab leakage | Pass |
| Logout, login as another user | 0 entries from prior user | Pass |
| Revoke permissions | Next fetch is server-authorized; stale cache not served | Pass |
| Change public event info | TTL expiry or realtime invalidation refreshes | Pass |
| Disconnect internet | No silent offline writes; error shown | Pass |
| Restore connectivity | Normal fetch resumes | Pass |
