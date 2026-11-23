/**
 * Eventra Regression Tests — Team Portal
 *
 * API-level regression tests against STAGING. Covers login, dashboard,
 * deliverable submission, QR badge, SPOC contact, and results.
 *
 * Prerequisites (env vars):
 *   EVENTRA_SUPABASE_URL       — Staging Supabase URL
 *   EVENTRA_SUPABASE_ANON_KEY  — Staging Supabase anon key
 *   EVENTRA_STAGING_TEAM_EMAIL/PASSWORD — Staging team credentials
 *   EVENTRA_STAGING_TEAM_ID    — Staging team id to test against
 *
 * Run: node tests/regression/team-regression.mjs
 *
 * NEVER run against production without explicit approval.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EVENTRA_SUPABASE_URL;
const ANON_KEY = process.env.EVENTRA_SUPABASE_ANON_KEY;
const TEAM_EMAIL = process.env.EVENTRA_STAGING_TEAM_EMAIL;
const TEAM_PASSWORD = process.env.EVENTRA_STAGING_TEAM_PASSWORD;
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

export default async function runTeamRegression() {
  if (!SUPABASE_URL || !ANON_KEY || !TEAM_EMAIL || !TEAM_PASSWORD || !TEAM_ID) {
    console.error("Set EVENTRA_SUPABASE_URL, EVENTRA_SUPABASE_ANON_KEY, EVENTRA_STAGING_TEAM_EMAIL, EVENTRA_STAGING_TEAM_PASSWORD, EVENTRA_STAGING_TEAM_ID");
    process.exit(1);
  }

  const team = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  console.log("\n============================================================");
  console.log("  EVENTRA REGRESSION — TEAM PORTAL (STAGING)");
  console.log("============================================================\n");

  // ---------- Login ----------
  console.log("--- Team Login ---");
  const { data: authData, error: loginErr } = await team.auth.signInWithPassword({
    email: TEAM_EMAIL,
    password: TEAM_PASSWORD,
  });
  test("Team login", !loginErr && !!authData?.user, loginErr?.message || authData?.user?.id);

  // ---------- Dashboard ----------
  console.log("\n--- Dashboard ---");
  const { data: teamInfo, error: teamErr } = await team
    .from("teams")
    .select("id, name, track, leader_name, created_at")
    .eq("id", TEAM_ID)
    .maybeSingle();
  test("Fetch team info", !teamErr && !!teamInfo, teamErr?.message || teamInfo?.name);

  const { data: members, error: membersErr } = await team
    .from("team_members")
    .select("id, user_id, role, profiles(id, name, email, phone)")
    .eq("team_id", TEAM_ID);
  test("Fetch team members", !membersErr && Array.isArray(members), membersErr?.message || `${members?.length} members`);

  const { data: logs, error: logsErr } = await team
    .from("event_activity_logs")
    .select("*")
    .eq("team_id", TEAM_ID)
    .eq("result", "success")
    .order("created_at", { ascending: false });
  test("Fetch team activity logs", !logsErr && Array.isArray(logs), logsErr?.message || `${logs?.length} logs`);

  const { data: submission, error: subErr } = await team
    .from("team_submissions")
    .select("*")
    .eq("team_id", TEAM_ID)
    .maybeSingle();
  test("Fetch team submission", !subErr, subErr?.message || `hasSubmission=${!!submission}`);

  const { data: rounds, error: roundsErr } = await team
    .from("evaluation_rounds")
    .select("*")
    .order("sequence_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  test("Fetch active round", !roundsErr && !!rounds, roundsErr?.message || rounds?.title);

  const { error: resultsErr } = await team
    .from("event_results")
    .select("*")
    .eq("team_id", TEAM_ID)
    .eq("is_published", true)
    .maybeSingle();
  test("Fetch published results (may be null)", !resultsErr, resultsErr?.message);

  // ---------- Deliverable submission ----------
  console.log("\n--- Deliverable Submission ---");
  const { data: subRound } = await team
    .from("evaluation_rounds")
    .select("*")
    .order("sequence_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (subRound) {
    // Read-only probe: verify submission form is accessible. Actual file upload
    // is covered by UI regression; here we verify the row is writable shape.
    const { data: forms, error: formsErr } = await team
      .from("team_submissions")
      .select("id")
      .eq("team_id", TEAM_ID)
      .eq("round_id", subRound.id);
    test("Team submission form readable", !formsErr && Array.isArray(forms), formsErr?.message);
  }

  // ---------- QR badge ----------
  console.log("\n--- QR Badge ---");
  const { data: qrTeam, error: qrErr } = await team
    .from("teams")
    .select("id, code, qr_token")
    .eq("id", TEAM_ID)
    .maybeSingle();
  test("QR badge data readable", !qrErr && !!qrTeam, qrErr?.message || `hasQR=${!!qrTeam?.qr_token}`);

  // ---------- SPOC contact ----------
  console.log("\n--- SPOC Contact ---");
  const { data: spoc, error: spocErr } = await team
    .from("team_spoc_assignments")
    .select("spocs(id, name, email, phone, department)")
    .eq("team_id", TEAM_ID)
    .maybeSingle();
  test("SPOC assignment readable", !spocErr, spocErr?.message || `hasSPOC=${!!spoc?.spocs}`);

  // ---------- Results ----------
  console.log("\n--- Results ---");
  const { data: publishedResult, error: pubErr } = await team
    .from("event_results")
    .select("*")
    .eq("team_id", TEAM_ID)
    .eq("is_published", true)
    .maybeSingle();
  test("Published results readable", !pubErr, pubErr?.message || `rank=${publishedResult?.rank}`);

  console.log(`\n${passed}/${total} team regression tests passed`);
  if (failures.length) {
    console.error("Failures:", failures.join(", "));
    process.exit(1);
  }
}

runTeamRegression();
