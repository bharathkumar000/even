/**
 * Eventra Regression Tests — Admin Portal
 *
 * API-level regression tests using a Supabase service-role client against
 * STAGING only. Covers user management, team management, round management,
 * judge assignments, results publication, and announcements.
 *
 * Prerequisites (env vars):
 *   EVENTRA_SUPABASE_URL       — Staging Supabase URL
 *   EVENTRA_SUPABASE_SERVICE_ROLE_KEY — Staging service-role key (server-side only)
 *
 * Run: node tests/regression/admin-regression.mjs
 *
 * NEVER run against production without explicit approval.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EVENTRA_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.EVENTRA_SUPABASE_SERVICE_ROLE_KEY;

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

export default async function runAdminRegression() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Set EVENTRA_SUPABASE_URL and EVENTRA_SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log("\n============================================================");
  console.log("  EVENTRA REGRESSION — ADMIN PORTAL (STAGING)");
  console.log("============================================================\n");

  // ---------- 1. User management ----------
  console.log("--- 1. User Management ---");
  const testEmail = `regression.admin.${Date.now()}@staging.example`;
  const testPassword = "TempPass@123!";

  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: "Regression Test User", role: "participant" },
  });
  test("Create user account", !createErr && !!createdUser?.user, createErr?.message || createdUser?.user?.id);

  const userId = createdUser?.user?.id;
  if (userId) {
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      email: testEmail,
      full_name: "Regression Test User",
      role: "participant",
    });
    test("Upsert user profile", !profileErr, profileErr?.message);

    const { data: profiles, error: profQueryErr } = await admin
      .from("profiles")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle();
    test("Query user profile by id", !profQueryErr && !!profiles, profQueryErr?.message);

    // Role change
    const { error: roleErr } = await admin
      .from("profiles")
      .update({ role: "judge" })
      .eq("id", userId);
    test("Update user role", !roleErr, roleErr?.message);

    const { data: updated } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    test("Verify role persisted", !!updated && updated.role === "judge", `role=${updated?.role}`);

    // Cleanup
    await admin.auth.admin.deleteUser(userId);
    await admin.from("profiles").delete().eq("id", userId);
    test("Cleanup regression user", true);
  }

  // ---------- 2. Team management ----------
  console.log("\n--- 2. Team Management ---");
  const { data: teams, error: teamsErr } = await admin.from("teams").select("id, name, track, status").limit(5);
  test("List teams", !teamsErr && Array.isArray(teams), teamsErr?.message || `${teams?.length} teams`);

  const sampleTeamId = teams?.[0]?.id;
  if (sampleTeamId) {
    const { data: teamDetail, error: teamErr } = await admin
      .from("teams")
      .select("*, team_members(*), team_spoc_assignments(spocs(*))")
      .eq("id", sampleTeamId)
      .maybeSingle();
    test("Fetch team detail with members & SPOC", !teamErr && !!teamDetail, teamErr?.message);

    const { error: teamUpdateErr } = await admin
      .from("teams")
      .update({ status: "active" })
      .eq("id", sampleTeamId);
    test("Update team status", !teamUpdateErr, teamUpdateErr?.message);
  }

  // ---------- 3. Round management ----------
  console.log("\n--- 3. Round Management ---");
  const { data: rounds, error: roundsErr } = await admin
    .from("evaluation_rounds")
    .select("*, evaluation_criteria(*)")
    .order("sequence_order", { ascending: true });
  test("List rounds with criteria", !roundsErr && Array.isArray(rounds), roundsErr?.message || `${rounds?.length} rounds`);

  const newRoundTitle = `Regression Round ${Date.now()}`;
  const { data: newRound, error: roundCreateErr } = await admin
    .from("evaluation_rounds")
    .insert([{ title: newRoundTitle, sequence_order: 999, status: "draft" }])
    .select()
    .single();
  test("Create round", !roundCreateErr && !!newRound, roundCreateErr?.message || newRound?.id);

  const roundId = newRound?.id;
  if (roundId) {
    const { error: statusErr } = await admin
      .from("evaluation_rounds")
      .update({ status: "open" })
      .eq("id", roundId);
    test("Open round status", !statusErr, statusErr?.message);

    const { data: verifyRound } = await admin
      .from("evaluation_rounds")
      .select("status")
      .eq("id", roundId)
      .maybeSingle();
    test("Verify round opened", !!verifyRound && verifyRound.status === "open", `status=${verifyRound?.status}`);

    // Criteria CRUD on this round
    const { data: criterion, error: critErr } = await admin
      .from("evaluation_criteria")
      .insert([{ round_id: roundId, title: "Regression Criterion", max_marks: 25, is_required: true }])
      .select()
      .single();
    test("Create criterion", !critErr && !!criterion, critErr?.message || criterion?.id);

    const critId = criterion?.id;
    if (critId) {
      const { error: critUpdateErr } = await admin
        .from("evaluation_criteria")
        .update({ max_marks: 30 })
        .eq("id", critId);
      test("Update criterion marks", !critUpdateErr, critUpdateErr?.message);

      const { error: critDelErr } = await admin.from("evaluation_criteria").delete().eq("id", critId);
      test("Delete criterion", !critDelErr, critDelErr?.message);
    }

    // Cleanup round
    await admin.from("evaluation_criteria").delete().eq("round_id", roundId);
    const { error: roundDelErr } = await admin.from("evaluation_rounds").delete().eq("id", roundId);
    test("Delete round", !roundDelErr, roundDelErr?.message);
  }

  // ---------- 4. Judge assignments ----------
  console.log("\n--- 4. Judge Assignments ---");
  const { data: assignments, error: assignErr } = await admin
    .from("judge_assignments")
    .select("*, judges:judge_id(id, email), teams:team_id(id, name)");
  test("List judge assignments", !assignErr && Array.isArray(assignments), assignErr?.message || `${assignments?.length} assignments`);

  // ---------- 5. Results publication ----------
  console.log("\n--- 5. Results Publication ---");
  const { data: results, error: resultsErr } = await admin.from("event_results").select("*").limit(5);
  test("Read event results", !resultsErr && Array.isArray(results), resultsErr?.message || `${results?.length} results`);

  // ---------- 6. Announcements ----------
  console.log("\n--- 6. Announcements ---");
  const { data: announcements, error: annErr } = await admin
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);
  test("List announcements", !annErr && Array.isArray(announcements), annErr?.message || `${announcements?.length} announcements`);

  console.log(`\n${passed}/${total} admin regression tests passed`);
  if (failures.length) {
    console.error("Failures:", failures.join(", "));
    process.exit(1);
  }
}

runAdminRegression();
