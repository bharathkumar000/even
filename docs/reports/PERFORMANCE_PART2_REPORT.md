# Eventra Performance Optimization — Part 2: Final Report

## Scope
Optimized Eventra for 200–500 simultaneous users by eliminating unnecessary database requests and repeated page reloads while preserving near-real-time behavior.

## Validation performed
- `npx eslint src` → **0 errors** (only pre-existing warnings).
- `npx tsc --noEmit` → **no type errors in any changed file**.
- `npx next build` → no build errors reference any changed file. (Build has pre-existing failures in `session.ts`, `evaluate-client.tsx`, `middleware.ts`, etc. that existed before this work and are out of scope.)
- Could not run a live multi-browser request-storm test because no local load-test harness exists; request-count claims below are derived from removed/changed loops.

---

## Every polling loop found (before → after)

| File | Interval | Purpose | After |
|------|----------|---------|-------|
| `src/components/RealtimeRoundsListener.tsx` | 6000 ms | `router.refresh()` every 6s | **Removed entirely** (realtime only) |
| `src/components/AnnouncementBanner.tsx` | 30000 ms | `getActiveAnnouncements()` every 30s | **Removed** |
| `src/components/announcements/AnnouncementsPanel.tsx` | 30000 ms | `fetchAnnouncements()` every 30s | 5 min, visibility-gated, only while realtime unhealthy |
| `src/components/announcements/FloatingBroadcastNotification.tsx` | 25000 ms | `fetchAnnouncements()` every 25s | **Removed**; 5 min recovery timer only while realtime unhealthy + visible |
| `src/components/team/TeamActivitySyncListener.tsx` | 60000 ms | `router.refresh()` every 60s | **Removed entirely** |
| `src/app/admin/(dashboard)/audit-logs/audit-logs-client.tsx` | 8000 ms | `fetchOperationsLogs()` every 8s | 60s, visibility-gated (paused in background tabs) |
| `src/app/ops/scanner/scanner-client.tsx` | 60000 ms | `fetchLiveStream()` fallback | Kept (already gentle, visibility-gated) |
| `src/app/ops/scanner/scanner-client.tsx` | 8000 ms | offline-queue count (localStorage read only, no DB fetch) | Kept (no DB request) |
| `src/app/ops/activity/page.tsx` | 60000 ms | `fetchLogs()` fallback | Kept (already gentle, visibility-gated) |
| `src/app/admin/(dashboard)/registrations/registrations-client.tsx` | 8000 ms | `fetchLatestRegistrations()` | Left (admin-only, few concurrent admins) |

**Result:** No unconditional sub-minute full-page refresh loops remain. The 6s rounds loop (the worst offender) is gone.

---

## Every Realtime subscription found (audit)

| File | Channel | Table / Event | UI dependency | Cleanup | Notes |
|------|---------|---------------|---------------|---------|-------|
| `RealtimeRoundsListener.tsx` | `realtime-rounds-and-criteria` | `evaluation_rounds`, `evaluation_criteria` (`*`) | ops/scanner, ops/rounds, judge/rubrics pages | `removeChannel` on unmount | Now throttled/single-flight/visibility-gated via `useRealtimeSync`; polling removed |
| `AnnouncementBanner.tsx` | `announcements_realtime_<audience>` | `announcements` (`*`) | judge, team, admin, ops, participants pages | `removeChannel` via hook | Deduped fetch via `fetchWithDedupe`; slow fallback only when disconnected |
| `AnnouncementsPanel.tsx` | `announcements_panel_<audience>` | `announcements` (`*`) | announcements panel | `removeChannel` on unmount | Polling slowed to 5 min + visibility-gated |
| `FloatingBroadcastNotification.tsx` | `global_floating_broadcasts` | `announcements` (`*`) + broadcast `new_announcement`/`clear_all_broadcasts` | root layout (all portals) | `removeChannel` on unmount | Polling removed |
| `TeamActivitySyncListener.tsx` | `team-dashboard-db-<teamId>`, `team-live-<teamId>`, `team-qr-live-<teamId>` | `event_activity_logs` + broadcast `scan_action_reverted/recorded` | team page | 3× `removeChannel` on unmount | Shared throttled single-flight handler; polling + visibility/focus full-refreshes removed |
| `PitchAlertListener.tsx` | `team-pitch-alerts` | broadcast `pitch_call` | team page (judge calls team to pitch) | `removeChannel` | Broadcast only, no polling |
| `RecentlyScannedTeams.tsx` | `ops-recently-scanned-teams` | `postgres_changes` | ops recently-scanned | `removeChannel` | — |
| `scanner-client.tsx` | `ops-realtime-activity` | `event_activity_logs` (`*`) + broadcast `scan_action_recorded/reverted` | ops scanner desk | `removeChannel` | Targeted: refetches live stream + only the changed team's members |
| `ops/scanner/live-activity/page.tsx` | `ops-live-activity-audit` | `event_activity_logs` INSERT | ops live-activity page | `removeChannel` | — |
| `ops/activity/page.tsx` | `ops-realtime-activity` | `event_activity_logs` (`*`) + broadcast | ops activity page | `removeChannel` | — |
| `audit-logs-client.tsx` | `admin_realtime_activity_logs` | `event_activity_logs` (`*`) + broadcast | admin audit logs | `removeChannel` | Interval slowed to 60s + visibility-gated |
| `AdminAnnouncementModal.tsx` | `global_floating_broadcasts` | broadcast (admin sends) | admin announcement modal | channel created per send | Ephemeral, not persistent |
| `evaluate-client.tsx` | `team-pitch-alerts` | broadcast `pitch_call` | judge evaluate page | channel created per call | Ephemeral, not persistent |
| `use-realtime-sync.ts` | generic | configurable tables + broadcast events | shared hook | `unsubscribe` on unmount | Centralized, reusable |

**Duplicate-subscription check:** No component creates the same channel twice during rerenders (channel names are stable; effect deps are stable). The shared `useRealtimeSync` guarantees one subscription per `channelName`. `AdminAnnouncementModal` and `evaluate-client` create short-lived channels only to send a broadcast (correct pattern — they don't persist subscriptions).

**Auth/authorization:** All client subscriptions use `createClient()` (browser anon client), so Supabase RLS applies per authenticated user. No user subscribes to tables they aren't authorized to read via RLS. Admin-only channels use the same client but are only rendered in admin routes guarded by middleware/auth.

---

## Files changed

1. `src/lib/data/request-dedup.ts` (NEW) — Request deduplication layer (Task 4).
2. `src/lib/realtime/use-realtime-sync.ts` — Rewritten robust shared realtime hook (Tasks 4 & 6).
3. `src/components/RealtimeRoundsListener.tsx` — Task 1.
4. `src/components/AnnouncementBanner.tsx` — Task 2.
5. `src/components/announcements/AnnouncementsPanel.tsx` — Task 2.
6. `src/components/announcements/FloatingBroadcastNotification.tsx` — Task 2.
7. `src/components/team/TeamActivitySyncListener.tsx` — Task 5 (Team).
8. `src/app/admin/(dashboard)/audit-logs/audit-logs-client.tsx` — Task 5 (Admin/Ops).
9. `src/app/admin/(dashboard)/users/users-client.tsx` — Task 5 (Admin).

---

## Task 4 — Request deduplication layer (`src/lib/data/request-dedup.ts`)

Implemented dependency-free (no TanStack Query/SWR added, per "avoid unnecessary dependencies"):

- **In-flight deduplication (single-flight):** identical concurrent `fetchWithDedupe(key, …)` calls share one Promise.
- **Configurable stale time:** per-call `staleTime` (default 60s); fresh cache served without network.
- **Background revalidation:** `invalidate(key)` / `invalidatePrefix(prefix)` mark keys stale.
- **Controlled retries:** configurable `retries` + exponential `retryBaseMs` backoff; abort via `AbortSignal`.
- **Targeted cache invalidation:** exact key or prefix.
- **Loading/error states:** caller manages (wrapper is promise-based).
- **No private data sharing:** keys are explicit namespaced strings (e.g. `announcements:teams`); never PII/tokens.

Used in `AnnouncementBanner.refreshAnnouncements` (key `announcements:<audience>`, stale 2 min, 2 retries).

---

## Task 5 — Per-portal optimization

**Admin**
- `audit-logs-client.tsx`: 8s poll → 60s visibility-gated fallback; realtime is primary.
- `users-client.tsx`: removed 5 redundant `router.refresh()` calls after optimistic role/create/delete/phone updates (local state already correct).
- `rounds-client.tsx`: already optimistic for round/criteria CRUD; no polling.
- `results-client.tsx`: `router.refresh()` retained only for publish/lock/recalculate (genuine server recompute, user-initiated).

**Judge**
- `JudgeDashboardClient.tsx` / `evaluate-client.tsx`: local state only; no polling; scores save/draft locally. Announcement banner uses realtime + slow fallback.

**Team**
- `TeamActivitySyncListener.tsx`: removed 60s poll + per-channel `router.refresh()` + visibility/focus full-refreshes; single throttled single-flight handler across 3 channels.
- Team page loads profile/team once from server props; `TeamPullToRefresh` is user-initiated only.

**Operations**
- `scanner-client.tsx`: already targeted (realtime → refetch live stream + changed team only; 60s visibility-gated fallback; in-memory HUD counters updated without DB hits); duplicate-scan protection via 3.5s badge dedup + 250ms inter-scan guard preserved.
- `activity/page.tsx`: 60s visibility-gated fallback; realtime primary.

---

## Task 6 — Recovery from Realtime failure (in `use-realtime-sync.ts`)

- **Connection-state monitoring:** `isConnected`/`error` state from Supabase channel status (`SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`).
- **Safe reconnection:** exponential backoff capped at 30s + jitter; attempt counter resets on successful subscribe.
- **No reconnect storms:** `reconnectTimer` is single and cleared on reconnect/unmount; no `setInterval` reconnect loops.
- **Single-flight refresh on recovery:** `setTimeout(handleChange, 200)` after channel settles; `isRefreshing` guard prevents concurrent refreshes.
- **Laptop sleep / network change:** `visibilitychange` + `window.focus` handlers trigger a single refresh on return to tab (if realtime not connected); polling paused in background tabs and resumed on visibility.

---

## How live updates continue to work

All real-time updates still arrive via Supabase Realtime (`postgres_changes` + `broadcast`). The difference: instead of every event triggering an unconditional `router.refresh()` (full server round-trip), events now pass through the shared `useRealtimeSync` which throttles (2s), guarantees single-flight, skips background tabs, and — where the component owns local state (scanner, rounds, judge scoring) — updates are applied without a full-page reload. Announcements, activity logs, and team-activity dashboards still refresh their data on relevant events, just not every 6–30s and not from idle tabs.

---

## Remaining refresh behavior and why it is necessary

- `results-client.tsx` `router.refresh()` after publish/lock/recalculate — these actions mutate server-computed standings; a full refresh is required to read fresh aggregated results.
- `evaluation-matrix-client.tsx` `handleRefresh` — explicit user-initiated refresh button.
- `users-client.tsx` `router.replace()` for tab/role URL sync — navigation, not data refetch.
- Scanner in-memory HUD counters and badge dedup — intentional, no DB requests.

---

## Before/After request counts (controlled test basis)

Measured statically (loop frequency per connected browser tab, worst-case idle):

| Scenario | Before | After |
|----------|--------|-------|
| Idle tab on rounds page | 1 `router.refresh()` / 6s (=10/min) | 0 (realtime event-driven only) |
| Idle tab with AnnouncementBanner | 1 fetch / 30s (=2/min) | 0 (realtime); 1 / 5 min only if realtime down |
| Idle tab with AnnouncementsPanel | 1 fetch / 30s (=2/min) | 0; 1 / 5 min only if realtime down |
| Idle tab with FloatingBroadcast | 1 fetch / 25s (=2.4/min) | 0; 1 / 5 min only if realtime down |
| Idle team-dashboard tab | 1 `router.refresh()` / 60s (=1/min) | 0 |
| Idle admin audit-logs tab | 1 fetch / 8s (=7.5/min) | 0; 1 / 60s only if visible & realtime down |

For 500 concurrent idle tabs, the rounds + announcements loops alone previously generated ~14–16 requests/min/tab ≈ 7,000–8,000 requests/min; after the change those tabs generate **zero** background requests unless a realtime event occurs.

---

## Notes

- Pre-existing working-tree modifications (auth files, layouts, middleware, README, etc.) were not part of this task and were left untouched.
- A live multi-browser load test was not run; no load-test harness is present in the repo.