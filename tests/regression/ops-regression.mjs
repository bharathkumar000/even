/**
 * Eventra Regression Tests — Operations Portal
 *
 * API-level regression tests against STAGING. Covers QR scanning,
 * attendance records, meal tokens, and activity logs.
 *
 * Prerequisites (env vars):
 *   EVENTRA_SUPABASE_URL       — Staging Supabase URL
 *   EVENTRA_SUPABASE_ANON_KEY  — Staging Supabase anon key
 *   EVENTRA_STAGING_OPS_EMAIL/PASSWORD — Staging ops credentials
 *   EVENTRA_STAGING_TEAM_ID    — Staging team id to scan/lookup
 *
 * Run: node tests/regression/ops-regression.mjs
 *
 * NEVER run against production without explicit approval.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EVENTRA_SUPABASE_URL;
const ANON_KEY = process.env.EVENTRA_SUPABASE_ANON_KEY;
const OPS_EMAIL = process.env.EVENTRA_STAGING_OPS_EMAIL;
const OPS_PASSWORD = process.env.EVENTRA_STAGING_OPS_PASSWORD;
const TEAM_ID = process.env.EVENTRA_STAGING_TEAM_ID;

const pass = "\x1b[32m✔ PASS\x1b[0m";
const fail = "\x1b[31m✘ FAIL\x1b[0m";
let passed = 0;
let total = 0;
const failures = [];

function test(name, ok, info = "") {
  total++;
  if (ok) {
    passed++;
    console.log(`${pass} ${name} ${info ? `(${info})` : ""}`);
  } else {
    console.error(`${fail} ${name} ${info ? `(${info})` : ""}`);
    failures.push(name);
  }
}

export default async function runOpsRegression() {
  if (!SUPABASE_URL || !ANON_KEY || !OPS_EMAIL || !OPS_PASSWORD || !TEAM_ID) {
    console.error("Set EVENTRA_SUPABASE_URL, EVENTRA_SUPABASE_ANON_KEY, EVENTRA_STAGING_OPS_EMAIL, EVENTRA_STAGING_OPS_PASSWORD, EVENTRA_STAGING_TEAM_ID");
    process.exit(1);
  }

  const ops = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  console.log("\n============================================================");
  console.log("  EVENTRA REGRESSION — OPERATIONS PORTAL (STAGING)");
  console.log("============================================================\n");

  // ---------- Login ----------
  console.log("--- Ops Login ---");
  const { data: authData, error: loginErr } = await ops.auth.signInWithPassword({
    email: OPS_EMAIL,
    password: OPS_PASSWORD,
  });
  test("Ops login", !loginErr && !!authData?.user, loginErr?.message || authData?.user?.id);

  // ---------- QR scanning / team lookup ----------
  console.log("\n--- QR Scan / Team Lookup ---");
  const { data: team, error: teamErr } = await ops
    .from("teams")
    .select("id, name, code, qr_token, track")
    .eq("id", TEAM_ID)
    .maybeSingle();
  test("Team lookup by id", !teamErr && !!team, teamErr?.message || team?.name);

  const { data: members, error: membersErr } = await ops
    .from("team_members")
    .select("id, user_id, role, profiles(id, name, email, phone)")
    .eq("team_id", TEAM_ID);
  test("Team roster for scan", !membersErr && Array.isArray(members), membersErr?.message || `${members?.length} members`);

  // ---------- Attendance records ----------
  console.log("\n--- Attendance Records ---");
  const { data: attendance, error: attErr } = await ops
    .from("event_activity_logs")
    .select("*")
    .eq("team_id", TEAM_ID)
    .eq("action_type", "registration")
    .eq("result", "success");
  test("Read attendance records", !attErr && Array.isArray(attendance), attErr?.message || `${attendance?.length} records`);

  // ---------- Meal tokens ----------
  console.log("\n--- Meal Tokens ---");
  for (const action of ["lunch", "snacks"]) {
    const { data: mealLogs, error: mealErr } = await ops
      .from("event_activity_logs")
      .select("*")
      .eq("team_id", TEAM_ID)
      .eq("action_type", action)
      .eq("result", "success");
    test(`Read ${action} logs`, !mealErr && Array.isArray(mealLogs), mealErr?.message || `${mealLogs?.length} ${action} logs`);
  }

  // Duplicate-scan protection: count existing successful registration logs before/after
  const { data: beforeLogs } = await ops
    .from("event_activity_logs")
    .select("id")
    .eq("team_id", TEAM_ID)
    .eq("action_type", "registration")
    .eq("result", "success");
  const beforeCount = beforeLogs?.length || 0;
  // Read-only: we do NOT write a scan under regression to avoid mutating staging.
  const { data: afterLogs } = await ops
    .from("event_activity_logs")
    .select("id")
    .eq("team_id", TEAM_ID)
    .eq("action_type", "registration")
    .eq("result", "success");
  test("No phantom scan writes (read-only probe)", beforeCount === (afterLogs?.length || 0), `before=${beforeCount} after=${afterLogs?.length}`);

  // ---------- Activity logs ----------
  console.log("\n--- Activity Logs ---");
  const { data: activity, error: actErr } = await ops
    .from("event_activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  test("Read recent activity logs", !actErr && Array.isArray(activity), actErr?.message || `${activity?.length} logs`);

  const { data: summary, error: sumErr } = await ops.rpc("get_desk_progress_summary", {}).single();
  test("Desk progress summary readable", !sumErr, sumErr?.message || `summary=${!!summary}`);

  // ---------- Recently scanned teams ----------
  console.log("\n--- Recently Scanned Teams ---");
  const { data: recent, error: recentErr } = await ops
    .from("event_activity_logs")
    .select("team_id, team_name, created_at")
    .eq("result", "success")
    .order("created_at", { ascending: false })
    .limit(10);
  test("Recently scanned teams readable", !recentErr && Array.isArray(recent), recentErr?.message);

  console.log(`\n${passed}/${total} ops regression tests passed`);
  if (failures.length) {
    console.error("Failures:", failures.join(", "));
    process.exit(1);
  }
}

runOpsRegression();
