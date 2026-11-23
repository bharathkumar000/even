# Eventra Metrics Specification — Part 5 Load Testing

Defines every metric collected during load/regression testing, how it is
captured, and the acceptance targets. Actual measurements are filled in
after executing the k6 load tests against a provisioned staging environment.

## Collection sources

| Source | What it provides | How to capture |
|--------|------------------|----------------|
| k6 output (JSON + text) | p50/p95/p99 latency, error rate, VUs, duration, iterations | `k6 run --out json=results.json` |
| k6 custom metrics | login/dashboard/score/qr/announcement/results latency, DB requests/load, Realtime channels, Supabase 5xx, duplicate writes, submissions | custom `Rate`/`Trend`/`Counter` in `tests/load/eventra-load-test.js` |
| Supabase dashboard / API | DB CPU, DB memory, DB connections, Realtime channels, 503/504 responses | Supabase project metrics page or metrics API |
| Vercel analytics (if deployed) | Function duration, invocations, errors | Vercel dashboard |
| Browser DevTools (manual) | DB requests per dashboard load, cache hit/miss | Network tab + `cacheSize()` / `inFlightSize()` diagnostics |

## k6 custom metrics (from eventra-load-test.js)

| Metric | Type | Meaning | Acceptance target |
|--------|------|---------|-------------------|
| `errors` | Rate | Non-HTTP assertion failures in test scripts | < 1% |
| `http_errors` | Rate | HTTP 5xx responses | < 1% |
| `dashboard_latency_ms` | Trend | Time to load a role-specific dashboard | p95 < 2000 ms |
| `login_latency_ms` | Trend | Auth sign-in time | p95 < 3000 ms |
| `score_submit_latency_ms` | Trend | Judge evaluation save/submit time | p95 < 2000 ms |
| `qr_scan_latency_ms` | Trend | Ops team-lookup (read-only probe) time | p95 < 1500 ms |
| `announcement_latency_ms` | Trend | Announcements fetch time | p95 < 1000 ms |
| `results_latency_ms` | Trend | Results view fetch time | p95 < 1500 ms |
| `db_requests_per_dashboard_load` | Trend | Supabase queries issued per dashboard load | trend downward vs. baseline |
| `realtime_channels_open` | Trend | Concurrent Realtime channels per VU | stable, no runaway growth |
| `supabase_5xx_responses` | Counter | Supabase 503/504 responses | 0 |
| `successful_score_submissions` | Counter | Judge submissions that succeeded | = attempted (no loss) |
| `failed_score_submissions` | Counter | Judge submissions that failed | 0 |
| `duplicate_score_writes` | Counter | Duplicate evaluation rows detected | 0 |

## Acceptance targets (Task 4)

| Criterion | Target | Measured at (stage) |
|-----------|--------|---------------------|
| p95 dashboard response | < 2 s | all stages |
| HTTP 5xx failure rate | < 1% | all stages |
| No uncontrolled refresh/auth request storms | 0 background loops | all stages (observe k6 + Supabase metrics) |
| No duplicate scoring from retries | 0 duplicate rows | all stages (regression + k6 duplicate_writes) |
| No missing confirmed score submissions | 0 failed submissions | all stages (k6 successful/failed counters) |
| No cross-user data leakage | 0 leaked cache entries | cache regression + logout test |
| No unauthorized access | role enforcement holds | regression per portal |
| Stable Realtime behavior | channels stable, no reconnect storms | all stages (realtime_channels_open, Supabase Realtime metrics) |

## Load stages (execute sequentially, stop if unhealthy)

| Stage | VUs | Duration | Stop condition |
|-------|-----|----------|----------------|
| 1 | 25 | 3 min | 5xx > 1% or p95 > 2s |
| 2 | 50 | 5 min | same |
| 3 | 100 | 8 min | same |
| 4 | 200 | 10 min | same |
| 5 | 300 | 12 min | same |
| 6 | 500 | 15 min | same |

## Result recording template

After each stage, record:

```
Stage: N (VUs)
p50 dashboard latency: ___ ms
p95 dashboard latency: ___ ms
p99 dashboard latency: ___ ms
p95 login latency: ___ ms
HTTP 5xx rate: ___ %
Supabase 503/504: ___ count
DB CPU peak: ___ %
DB memory peak: ___ %
DB connections peak: ___ count
Realtime channels peak: ___ count
Successful score submissions: ___ count
Failed score submissions: ___ count
Duplicate score writes: ___ count
Cache hit rate (reload within TTL): ___ %
Verdict: PASS / FAIL / STOP
```

## How to run

```bash
# Install k6 (https://k6.io/docs/getting-started/install)
# Configure staging credentials:
export EVENTRA_STAGING_URL=https://staging.eventra.example
export EVENTRA_SUPABASE_URL=https://<staging-project>.supabase.co
export EVENTRA_SUPABASE_ANON_KEY=<staging-anon-key>
export EVENTRA_STAGING_USERS='[{"role":"admin","email":"...","password":"..."}, ...]'

# Stage 1 — 25 users
k6 run -e VUS=25 -e DURATION=3m --out json=stage-25.json tests/load/eventra-load-test.js

# ... repeat for 50, 100, 200, 300, 500
```

## Regression tests (Node, Supabase API-level)

| File | Covers | Run command |
|------|--------|-------------|
| `tests/regression/admin-regression.mjs` | users, teams, rounds, assignments, results, announcements | `node tests/regression/admin-regression.mjs` |
| `tests/regression/judge-regression.mjs` | login, assigned teams, eval forms, score save, submit, results | `node tests/regression/judge-regression.mjs` |
| `tests/regression/team-regression.mjs` | login, dashboard, submission, QR badge, SPOC, results | `node tests/regression/team-regression.mjs` |
| `tests/regression/ops-regression.mjs` | login, QR lookup, attendance, meal tokens, activity logs | `node tests/regression/ops-regression.mjs` |
| `tests/regression/cache-regression.ts` | single-flight, stale TTL, invalidation, logout clear, retries, abort | `npx tsx tests/regression/cache-regression.ts` |

All regression tests require `EVENTRA_SUPABASE_URL` and either `EVENTRA_SUPABASE_ANON_KEY` or `EVENTRA_SUPABASE_SERVICE_ROLE_KEY` plus staging credentials.
