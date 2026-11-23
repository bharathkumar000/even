# Eventra Production Readiness Report — Part 5

**Status:** TEST INFRASTRUCTURE READY — NO LOAD TESTS EXECUTED YET  
**Do not claim Eventra is ready for 500 users until k6 load tests demonstrate it.**

This document is a template to be completed after running the load tests in
`tests/load/eventra-load-test.js` and regression suites in
`tests/regression/` against a provisioned **staging** Supabase project.

---

## 1. Summary of completed changes (Parts 1–4)

### Removed / reduced polling loops
- `RealtimeRoundsListener.tsx`: removed 6s `router.refresh()` loop → Realtime-only, throttled, visibility-gated.
- `AnnouncementBanner.tsx`: removed 30s poll → Realtime + 5-min fallback only when disconnected.
- `AnnouncementsPanel.tsx`: 30s poll → 5-min visibility-gated fallback.
- `FloatingBroadcastNotification.tsx`: 25s poll removed → 5-min recovery timer only when unhealthy + visible.
- `TeamActivitySyncListener.tsx`: removed 60s poll + per-channel `router.refresh()` + visibility/focus full-refreshes.
- `audit-logs-client.tsx`: 8s poll → 60s visibility-gated fallback.

### Request deduplication
- New `src/lib/data/request-dedup.ts`: single-flight dedup, configurable stale-time cache, controlled retries (exponential backoff), targeted invalidation, no PII in keys.

### Reusable Realtime hook
- Rewritten `src/lib/realtime/use-realtime-sync.ts`: throttled + single-flight + visibility-gated change handling, fallback polling only when disconnected + visible, exponential-backoff reconnect (capped 30s), single-flight refresh on recovery, cleanup on unmount.

### Per-portal optimizations
- Admin: removed 5 redundant `router.refresh()` calls in `users-client.tsx` after optimistic updates; audit-logs poll slowed.
- Judge/Team: local state, no polling; announcements via Realtime.
- Operations: scanner already targeted (realtime → refetch live stream + changed team only; in-memory HUD counters); duplicate-scan protection preserved.

### Cache (Part 3)
- Versioned cache keys, user-scoped namespaces, TTL policies, logout/portal-switch cache clearing, sensitive data never persisted.

---

## 2. Before/after performance comparison (to be filled in)

| Metric | Before (baseline) | After (measured) | Change |
|--------|-------------------|------------------|--------|
| Idle tab background requests/min | ~14–16 (rounds + announcements loops) | 0 (Realtime event-driven only) | ~-100% |
| p95 dashboard latency | TBD | TBD | — |
| HTTP 5xx rate | TBD | TBD | — |
| Supabase 503/504 | TBD | TBD | — |
| DB connections at 500 VU | TBD | TBD | — |
| Realtime channels at 500 VU | TBD | TBD | — |

_To be populated after running k6 stages 25→500._

---

## 3. Load-test results for every concurrency stage (to be filled in)

Record one block per stage after executing `tests/load/eventra-load-test.js`.

### Stage 1 — 25 VUs (3 min)
- p50 dashboard latency: ___ ms
- p95 dashboard latency: ___ ms
- p99 dashboard latency: ___ ms
- p95 login latency: ___ ms
- HTTP 5xx rate: ___ %
- Supabase 503/504: ___
- DB CPU peak: ___ %
- DB memory peak: ___ %
- DB connections peak: ___
- Realtime channels peak: ___
- Successful score submissions: ___
- Failed score submissions: ___
- Duplicate score writes: ___
- Verdict: PASS / FAIL / STOP

### Stage 2 — 50 VUs (5 min)
(same fields)

### Stage 3 — 100 VUs (8 min)
(same fields)

### Stage 4 — 200 VUs (10 min)
(same fields)

### Stage 5 — 300 VUs (12 min)
(same fields)

### Stage 6 — 500 VUs (15 min)
(same fields)

**Stop rule:** halt or reduce load if 5xx rate > 1%, p95 > 2s, Realtime reconnect storms, or Supabase 503/504 appear.

---

## 4. Database CPU and memory observations (to be filled in)

Capture from Supabase project metrics at each stage peak:

| Stage | DB CPU peak | DB memory peak | DB connections peak | Realtime channels peak | Notes |
|-------|-------------|----------------|---------------------|------------------------|-------|
| 25 VU | ___ % | ___ MB | ___ | ___ | |
| 50 VU | ___ % | ___ MB | ___ | ___ | |
| 100 VU | ___ % | ___ MB | ___ | ___ | |
| 200 VU | ___ % | ___ MB | ___ | ___ | |
| 300 VU | ___ % | ___ MB | ___ | ___ | |
| 500 VU | ___ % | ___ MB | ___ | ___ | |

---

## 5. Auth/API requests reduced (to be measured)

| Source | Before | After | Reduction |
|--------|--------|-------|-----------|
| Rounds poll (per idle tab) | 10/min | 0 | — |
| Announcements poll (per tab) | 2/min | 0 | — |
| Dashboard reloads | N per user | N − cached reloads | — |
| Auth requests per session | 1 (login) | 1 (login) | 0 (login still required) |

_Auth requests per session remain 1 (login is unavoidable). Dashboard reloads within TTL now serve 0 additional Supabase calls._

---

## 6. Cache hit rates (to be measured via browser DevTools + cacheSize()/inFlightSize())

| Scenario | First load | Reload within TTL | Hit rate |
|----------|------------|-------------------|----------|
| Public announcements | 1 call | 0 calls | ~100% |
| User profile | 2 calls | 0 calls | ~100% |
| Team dashboard | ~9 parallel calls | 0 calls | ~100% |
| Judge scores (sensitive) | 1 call/access | 1 call/access | 0% (by design) |

---

## 7. Known risks

1. **No live load data yet.** These are untested assumptions until k6 runs against staging.
2. **Realtime channel concurrency.** 500 concurrent Realtime connections may exceed Small Compute limits; channels must be monitored.
3. **In-memory cache does not survive full reloads.** Acceptable per Part 3 (short TTLs, force-dynamic pages) but increases DB load on hard refresh.
4. **No offline write queue.** Judge scores / QR scans fail when offline by design (no silent false writes).
5. **Vercel function duration.** Server actions must complete within Vercel limits; long operations (CSV export, bulk import) may time out.
6. **Shared staging credentials.** Regression tests mutate staging data; coordinate runs to avoid collisions.

---

## 8. Production deployment checklist

- [ ] Staging Supabase project provisioned (Pro + Small or recommended size)
- [ ] Staging user accounts created for all 4 roles
- [ ] `EVENTRA_STAGING_URL`, `EVENTRA_SUPABASE_URL`, `EVENTRA_SUPABASE_ANON_KEY`, `EVENTRA_SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] k6 installed (`brew install k6` or https://k6.io)
- [ ] `npx tsx` available (for cache regression) or ts-node
- [ ] k6 stage 1 (25 VU) passes: p95 < 2s, 5xx < 1%
- [ ] k6 stages 2–6 pass incrementally to target concurrency
- [ ] All 5 regression suites pass on staging
- [ ] Realtime channels stable (no reconnect storms) at peak load
- [ ] DB CPU/memory/connections within compute headroom at peak
- [ ] Logout clears cache + storage (no cross-user leakage)
- [ ] Rollback plan tested (previous commit tagged)
- [ ] Monitoring alerts configured (5xx rate, p95 latency, DB CPU, Realtime channels)

---

## 9. Rollback plan

1. **Tag the current working commit** before deploying: `git tag eventra-pre-part5`
2. **If load test reveals regressions at any stage:**
   - Stop the load test.
   - Revert to the tagged commit: `git checkout eventra-pre-part5` (or `git revert <merge-commit>`)
   - Re-deploy the prior stable version.
   - Re-run regression suites to confirm stability.
3. **Database rollback:** migrations are additive; if a migration caused issues, reverse it via Supabase SQL editor or `supabase migration down`.
4. **Feature-flag killswitch:** Realtime/polling behavior can be toggled by setting `pollEnabled: false` / removing `RealtimeRoundsListener` from pages if Realtime misbehaves.

---

## 10. Recommended Supabase compute size (framework — complete after measurements)

Do not select a size until load-test results are recorded.

| Configuration | Sufficient for | Why / why not |
|---------------|----------------|---------------|
| Pro + Micro | ≤ ~50–100 concurrent users | Likely insufficient DB CPU/connections for 300–500 VU; Realtime channel headroom low. |
| Pro + Small (proposed) | 100–250 concurrent users | Baseline proposal; validate at 200/300 VU. May be insufficient at 500 if Realtime channels or DB CPU exceed headroom. |
| Pro + Medium | 250–500 concurrent users | Recommended if Small shows DB CPU > 70% or connections near limit at 300 VU. |
| Pro + Large / Higher | 500+ or bursty traffic | Needed only if Medium saturates or Realtime requires dedicated resources. |

**Decision rule (post-measurement):**
- If at **300 VU** DB CPU ≤ 60%, memory ≤ 70%, connections ≤ 70% of limit, and Realtime stable → **Pro + Small** is sufficient for 300; re-test at 500 before committing to 500.
- If at **300 VU** any resource > 70% or errors appear → **Pro + Medium** minimum; do not claim 500-user readiness until 500 VU stage passes on Medium.
- If **500 VU** stage passes on Medium → recommend **Pro + Medium** for 500 users.
- If **500 VU** fails on Medium → recommend **Pro + Large** or re-architect (e.g., reduce Realtime channel count, add caching layer) before production.

**Vercel considerations:** Confirm server action durations stay under Vercel limits (hobby/pro). Long operations (bulk import, CSV export) should be backgrounded or paginated.

---

## Next steps (require your approval)

1. Provision a **staging** Supabase project (not production).
2. Create staging accounts for admin/judge/team/ops.
3. Set the environment variables listed in `tests/metrics/metrics-spec.md`.
4. Install k6 and run stages 25 → 500 incrementally, recording results in section 3.
5. Run all 5 regression suites.
6. Complete this report with measurements, then select a compute size per section 10.
7. Request explicit approval before any production deployment.
