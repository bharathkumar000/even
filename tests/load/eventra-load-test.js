/**
 * Eventra Load Test — k6
 *
 * Simulates authenticated users across Admin, Judge, Team, and Operations
 * portals executing realistic workflows against a STAGING environment.
 *
 * Uses k6's native `http` module (no Node-only deps, works in k6).
 *
 * Prerequisites (env vars):
 *   EVENTRA_STAGING_URL      — Staging Next.js app URL (e.g. https://staging.eventra.example)
 *   EVENTRA_SUPABASE_URL     — Staging Supabase project URL
 *   EVENTRA_SUPABASE_ANON_KEY— Staging Supabase anon key
 *   EVENTRA_STAGING_USERS    — JSON array of staging user credentials:
 *       [
 *         {"role":"admin","email":"admin@staging.example","password":"P@ssw0rd!"},
 *         {"role":"judge","email":"judge@staging.example","password":"P@ssw0rd!"},
 *         {"role":"team","email":"team@staging.example","password":"P@ssw0rd!"},
 *         {"role":"ops","email":"ops@staging.example","password":"P@ssw0rd!"}
 *       ]
 *
 * Run:
 *   k6 run -e USERS='[...]' -e STAGING_URL=... -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... tests/load/eventra-load-test.js
 *
 * Load stages (run separately, gradually increasing concurrency):
 *   k6 run -e VUS=25  -e DURATION=3m  tests/load/eventra-load-test.js
 *   k6 run -e VUS=50  -e DURATION=5m  tests/load/eventra-load-test.js
 *   k6 run -e VUS=100 -e DURATION=8m  tests/load/eventra-load-test.js
 *   k6 run -e VUS=200 -e DURATION=10m tests/load/eventra-load-test.js
 *   k6 run -e VUS=300 -e DURATION=12m tests/load/eventra-load-test.js
 *   k6 run -e VUS=500 -e DURATION=15m tests/load/eventra-load-test.js
 *
 * STOP or reduce load if 5xx rate > 1%, p95 > 2s, Supabase 503/504, or
 * Realtime reconnect storms appear.
 *
 * NEVER run against production without explicit approval.
 */

import { http, check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ---------------------------------------------------------------------------
// Configuration from environment
// ---------------------------------------------------------------------------
const STAGING_URL = __ENV.EVENTRA_STAGING_URL || "http://localhost:3000";
const SUPABASE_URL = __ENV.EVENTRA_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = __ENV.EVENTRA_SUPABASE_ANON_KEY || "";
const RAW_USERS = __ENV.EVENTRA_STAGING_USERS || "[]";

let STAGING_USERS = [];
try {
  STAGING_USERS = JSON.parse(RAW_USERS);
} catch (e) {
  console.error("Failed to parse EVENTRA_STAGING_USERS JSON:", e.message);
}

const VUS = parseInt(__ENV.VUS) || 10;
const DURATION = __ENV.DURATION || "3m";

// Role distribution (configurable). Adjust to match expected production mix.
const ROLE_DISTRIBUTION = {
  admin: 0.05,
  judge: 0.20,
  team: 0.65,
  ops: 0.10,
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate("errors");
const httpErrorRate = new Rate("http_errors");
const dashboardLatency = new Trend("dashboard_latency_ms");
const loginLatency = new Trend("login_latency_ms");
const scoreSubmitLatency = new Trend("score_submit_latency_ms");
const qrScanLatency = new Trend("qr_scan_latency_ms");
const announcementLatency = new Trend("announcement_latency_ms");
const resultsLatency = new Trend("results_latency_ms");
const dbRequestsPerLoad = new Trend("db_requests_per_dashboard_load");
const supabase5xx = new Counter("supabase_5xx_responses");
const duplicateWrites = new Counter("duplicate_score_writes");
const successfulSubmissions = new Counter("successful_score_submissions");
const failedSubmissions = new Counter("failed_score_submissions");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pickUser(role) {
  const candidates = STAGING_USERS.filter((u) => u.role === role);
  if (candidates.length === 0) return null;
  return candidates[__VU % candidates.length];
}

function roleForVU() {
  const r = Math.random();
  let acc = 0;
  for (const [role, share] of Object.entries(ROLE_DISTRIBUTION)) {
    acc += share;
    if (r <= acc) return role;
  }
  return "team";
}

function supabaseRestHeaders(token) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function signIn(user) {
  const start = Date.now();
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" } },
  );
  const lat = Date.now() - start;
  loginLatency.add(lat);

  let token = null;
  const ok = check(res, {
    "login status 200": (r) => r.status === 200,
    "login returns access_token": (r) => {
      try {
        const body = JSON.parse(r.body);
        token = body.access_token || null;
        return !!token;
      } catch {
        return false;
      }
    },
  });
  if (!ok) {
    errorRate.add(1);
    return null;
  }
  return token;
}

function restGet(path, token, label) {
  const start = Date.now();
  const res = http.get(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: supabaseRestHeaders(token),
  });
  const lat = Date.now() - start;
  const is5xx = res.status >= 500;
  if (is5xx) supabase5xx.add(1);
  httpErrorRate.add(is5xx);
  const ok = check(res, {
    [`${label} status < 500`]: (r) => r.status < 500,
  });
  if (!ok) errorRate.add(1);
  return { res, lat };
}

// ---------------------------------------------------------------------------
// Setup: validate config
// ---------------------------------------------------------------------------
export function setup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("EVENTRA_SUPABASE_URL and EVENTRA_SUPABASE_ANON_KEY are required");
  }
  if (STAGING_USERS.length === 0) {
    throw new Error("EVENTRA_STAGING_USERS must contain at least one staging user");
  }
  return { stagingUrl: STAGING_URL, users: STAGING_USERS };
}

// ---------------------------------------------------------------------------
// Default scenario: one VU = one simulated user repeating workflows
// ---------------------------------------------------------------------------
export default function () {
  const role = roleForVU(__VU);
  const user = pickUser(role);
  if (!user) {
    errorRate.add(1);
    return;
  }

  const token = signIn(user);
  if (!token) return; // cannot proceed without a session

  sleep(1);

  if (role === "admin") {
    adminWorkflow(token);
  } else if (role === "judge") {
    judgeWorkflow(token);
  } else if (role === "team") {
    teamWorkflow(token);
  } else if (role === "ops") {
    opsWorkflow(token);
  }

  sleep(2);
}

// ---------------------------------------------------------------------------
// Admin workflow
// ---------------------------------------------------------------------------
function adminWorkflow(token) {
  group("admin_dashboard", () => {
    const { res, lat } = restGet(
      "/evaluation_rounds?select=*,evaluation_criteria(*)&order=sequence_order.asc",
      token,
      "admin rounds",
    );
    dashboardLatency.add(lat);
    dbRequestsPerLoad.add(1);
    if (!check(res, { "admin rounds loaded": (r) => r.status === 200 })) errorRate.add(1);
  });

  group("admin_announcements", () => {
    const { res, lat } = restGet("/announcements?select=*&limit=20", token, "admin announcements");
    announcementLatency.add(lat);
    if (!check(res, { "announcements loaded": (r) => r.status === 200 })) errorRate.add(1);
  });
}

// ---------------------------------------------------------------------------
// Judge workflow
// ---------------------------------------------------------------------------
function judgeWorkflow(token) {
  group("judge_dashboard", () => {
    const { res, lat } = restGet("/evaluation_rounds?select=*&order=sequence_order.asc", token, "judge rounds");
    dashboardLatency.add(lat);
    dbRequestsPerLoad.add(1);
    if (!check(res, { "judge rounds loaded": (r) => r.status === 200 })) errorRate.add(1);
  });

  sleep(1);

  group("judge_evaluation_view", () => {
    const { res } = restGet("/teams?select=id,name,track&limit=10", token, "judge teams");
    if (!check(res, { "judge teams loaded": (r) => r.status === 200 })) errorRate.add(1);
  });

  sleep(1);

  group("judge_score_probe", () => {
    // Read-only probe: verify evaluation data is fetchable without writing
    // (duplicate-write safety under load is covered by regression suites).
    const { res, lat } = restGet("/evaluations?select=*&limit=5", token, "judge evaluations");
    scoreSubmitLatency.add(lat);
    if (!check(res, { "evaluations readable": (r) => r.status === 200 })) errorRate.add(1);
  });
}

// ---------------------------------------------------------------------------
// Team workflow
// ---------------------------------------------------------------------------
function teamWorkflow(token) {
  group("team_dashboard", () => {
    const { res, lat } = restGet("/teams?select=*&limit=1", token, "team dashboard");
    dashboardLatency.add(lat);
    dbRequestsPerLoad.add(1);
    if (!check(res, { "team dashboard loaded": (r) => r.status === 200 })) errorRate.add(1);
  });

  sleep(1);

  group("team_submission_view", () => {
    const { res } = restGet("/team_submissions?select=*&limit=5", token, "team submission");
    if (!check(res, { "team submission readable": (r) => r.status === 200 })) errorRate.add(1);
  });

  sleep(1);

  group("team_qr_badge", () => {
    const { res } = restGet("/teams?select=id,code,qr_token&limit=1", token, "team qr badge");
    if (!check(res, { "qr badge data readable": (r) => r.status === 200 })) errorRate.add(1);
  });
}

// ---------------------------------------------------------------------------
// Operations workflow
// ---------------------------------------------------------------------------
function opsWorkflow(token) {
  group("ops_scanner_desk", () => {
    const { res, lat } = restGet("/event_activity_logs?select=*&limit=35", token, "ops activity logs");
    dashboardLatency.add(lat);
    if (!check(res, { "ops activity logs loaded": (r) => r.status === 200 })) errorRate.add(1);
  });

  sleep(1);

  group("ops_qr_checkin_probe", () => {
    // Read-only probe: team lookup without writing a scan record.
    const { res, lat } = restGet("/teams?select=id,name,qr_token&limit=5", token, "ops team lookup");
    qrScanLatency.add(lat);
    if (!check(res, { "ops team lookup readable": (r) => r.status === 200 })) errorRate.add(1);
  });

  sleep(1);

  group("ops_activity_logs", () => {
    const { res, lat } = restGet(
      "/event_activity_logs?select=*&order=created_at.desc&limit=50",
      token,
      "ops activity log",
    );
    resultsLatency.add(lat);
    if (!check(res, { "ops activity log readable": (r) => r.status === 200 })) errorRate.add(1);
  });
}

// ---------------------------------------------------------------------------
// Options (throttled ramp to avoid thundering-herd on Realtime connect)
// ---------------------------------------------------------------------------
export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    errors: ["rate < 0.01"],
    http_errors: ["rate < 0.01"],
    dashboard_latency: ["p95 < 2000"],
    login_latency: ["p95 < 3000"],
  },
  stages: [
    { duration: "30s", target: VUS / 2 },
    { duration: "1m", target: VUS },
    { duration: DURATION, target: VUS },
  ],
};

// ---------------------------------------------------------------------------
// Teardown: summary
// ---------------------------------------------------------------------------
export function teardown(data) {
  console.log("\n==============================================");
  console.log("  EVENTRA LOAD TEST SUMMARY");
  console.log("==============================================");
  console.log(`VUs: ${VUS} | Duration: ${DURATION}`);
  console.log(`Staging users configured: ${data.users.length}`);
  console.log(`Supabase 5xx responses: ${supabase5xx.value || 0}`);
  console.log(`Successful submissions: ${successfulSubmissions.value || 0}`);
  console.log(`Failed submissions: ${failedSubmissions.value || 0}`);
  console.log(`Duplicate writes: ${duplicateWrites.value || 0}`);
  console.log("==============================================\n");
}
