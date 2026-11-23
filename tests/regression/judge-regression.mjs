/**
 * Eventra Regression Tests — Judge Portal
 *
 * API-level regression tests against STAGING. Covers assigned teams,
 * evaluation forms, score saving, final submission, and results access.
 *
 * Prerequisites (env vars):
 *   EVENTRA_SUPABASE_URL       — Staging Supabase URL
 *   EVENTRA_SUPABASE_ANON_KEY  — Staging Supabase anon key
 *   EVENTRA_STAGING_JUDGE_EMAIL/ PASSWORD — Staging judge credentials
 *
 * Run: node tests/regression/judge-regression.mjs
 *
 * NEVER run against production without explicit approval.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EVENTRA_SUPABASE_URL;
const ANON_KEY = process.env.EVENTRA_SUPABASE_ANON_KEY;
const JUDGE_EMAIL = process.env.EVENTRA_STAGING_JUDGE_EMAIL;
const JUDGE_PASSWORD = process.env.EVENTRA_STAGING_JUDGE_PASSWORD;

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

export default async function runJudgeRegression() {
  if (!SUPABASE_URL || !ANON_KEY || !JUDGE_EMAIL || !JUDGE_PASSWORD) {
    console.error("Set EVENTRA_SUPABASE_URL, EVENTRA_SUPABASE_ANON_KEY, EVENTRA_STAGING_JUDGE_EMAIL, EVENTRA_STAGING_JUDGE_PASSWORD");
    process.exit(1);
  }

  const judge = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  console.log("\n============================================================");
  console.log("  EVENTRA REGRESSION — JUDGE PORTAL (STAGING)");
  console.log("============================================================\n");

  // ---------- Login ----------
  console.log("--- Judge Login ---");
  const { data: authData, error: loginErr } = await judge.auth.signInWithPassword({
    email: JUDGE_EMAIL,
    password: JUDGE_PASSWORD,
  });
  test("Judge login", !loginErr && !!authData?.user, loginErr?.message || authData?.user?.id);
  const judgeId = authData?.user?.id;

  // ---------- Assigned teams ----------
  console.log("\n--- Assigned Teams ---");
  const { data: assignments, error: assignErr } = await judge
    .from("judge_assignments")
    .select("team_id, teams(id, name, track, status)")
    .eq("judge_id", judgeId);
  test("List assigned teams", !assignErr && Array.isArray(assignments), assignErr?.message || `${assignments?.length} teams`);

  const assignedTeam = assignments?.[0]?.teams;
  const teamId = assignedTeam?.id;
  if (teamId) {
    test("Assigned team has name", !!assignedTeam?.name, `team=${assignedTeam?.name}`);
  }

  // ---------- Evaluation forms ----------
  console.log("\n--- Evaluation Forms ---");
  const { data: rounds, error: roundsErr } = await judge
    .from("evaluation_rounds")
    .select("*, evaluation_criteria(*)")
    .in("status", ["open", "reopened"])
    .order("sequence_order", { ascending: true });
  test("List open rounds with criteria", !roundsErr && Array.isArray(rounds), roundsErr?.message || `${rounds?.length} rounds`);

  const openRound = rounds?.[0];
  const roundId = openRound?.id;
  if (roundId && teamId) {
    const { data: criteria, error: critErr } = await judge
      .from("evaluation_criteria")
      .select("*")
      .eq("round_id", roundId);
    test("List evaluation criteria", !critErr && Array.isArray(criteria), critErr?.message || `${criteria?.length} criteria`);

    const { error: evalErr } = await judge
      .from("evaluations")
      .select("*")
      .eq("round_id", roundId)
      .eq("team_id", teamId)
      .eq("judge_id", judgeId)
      .maybeSingle();
    test("Fetch existing evaluation (may be null)", !evalErr, evalErr?.message);

    // ---------- Score saving (draft) ----------
    console.log("\n--- Score Saving (Draft) ---");
    const scoreItems = (criteria || []).map((c) => ({ criterion_id: c.id, score: Number(c.max_marks) / 2 }));
    const { data: saveRes, error: saveErr } = await judge.rpc("save_or_submit_evaluation", {
      p_round_id: roundId,
      p_team_id: teamId,
      p_scores: scoreItems,
      p_feedback: "Regression draft score",
      p_is_draft: true,
    }).single();
    // Note: fall back to server action if RPC not present
    let saved = !!saveRes && !saveErr;
    if (!saved) {
      // Try direct insert/upsert as fallback
      const { error: upsertErr } = await judge.from("evaluations").upsert({
        round_id: roundId,
        team_id: teamId,
        judge_id: judgeId,
        scores_breakdown: scoreItems,
        feedback: "Regression draft score",
        status: "draft",
      });
      saved = !upsertErr;
      test("Save draft evaluation (fallback upsert)", saved, upsertErr?.message);
    } else {
      test("Save draft evaluation (RPC)", saved, saveErr?.message);
    }
    if (saved) successfulSubmissions++; else failedSubmissions++;

    // Verify draft persisted
    const { data: verifyDraft } = await judge
      .from("evaluations")
      .select("status, scores_breakdown")
      .eq("round_id", roundId)
      .eq("team_id", teamId)
      .eq("judge_id", judgeId)
      .maybeSingle();
    test("Verify draft persisted", !!verifyDraft && verifyDraft.status === "draft", `status=${verifyDraft?.status}`);

    // ---------- Final submission ----------
    console.log("\n--- Final Submission ---");
    const { data: submitRes, error: submitErr } = await judge.rpc("save_or_submit_evaluation", {
      p_round_id: roundId,
      p_team_id: teamId,
      p_scores: scoreItems,
      p_feedback: "Regression final submission",
      p_is_draft: false,
    }).single();
    let submitted = !!submitRes && !submitErr;
    if (!submitted) {
      const { error: updErr } = await judge
        .from("evaluations")
        .update({ status: "submitted", feedback: "Regression final submission" })
        .eq("round_id", roundId)
        .eq("team_id", teamId)
        .eq("judge_id", judgeId);
      submitted = !updErr;
      test("Submit final evaluation (fallback update)", submitted, updErr?.message);
    } else {
      test("Submit final evaluation (RPC)", submitted, submitErr?.message);
    }
    if (submitted) successfulSubmissions++; else failedSubmissions++;

    // Verify submitted status and lock behavior
    const { data: verifySubmitted } = await judge
      .from("evaluations")
      .select("status")
      .eq("round_id", roundId)
      .eq("team_id", teamId)
      .eq("judge_id", judgeId)
      .maybeSingle();
    test("Verify submitted status", !!verifySubmitted && verifySubmitted.status === "submitted", `status=${verifySubmitted?.status}`);

    // Duplicate-write guard: attempting to resubmit should not create a second row
    const { data: beforeDup } = await judge
      .from("evaluations")
      .select("id")
      .eq("round_id", roundId)
      .eq("team_id", teamId)
      .eq("judge_id", judgeId);
    const beforeCount = beforeDup?.length || 0;

    await judge.from("evaluations").upsert({
      round_id: roundId,
      team_id: teamId,
      judge_id: judgeId,
      scores_breakdown: scoreItems,
      feedback: "Duplicate attempt",
      status: "submitted",
    });
    const { data: afterDup } = await judge
      .from("evaluations")
      .select("id")
      .eq("round_id", roundId)
      .eq("team_id", teamId)
      .eq("judge_id", judgeId);
    const afterCount = afterDup?.length || 0;
    test("No duplicate scoring row on resubmit", beforeCount === afterCount, `before=${beforeCount} after=${afterCount}`);
    if (beforeCount !== afterCount) failures.push("duplicate write detected");

    // ---------- Results access ----------
    console.log("\n--- Results Access ---");
    const { data: judgeResults, error: resultsErr } = await judge
      .from("event_results")
      .select("*")
      .eq("team_id", teamId)
      .eq("is_published", true);
    test("Judge can read published results", !resultsErr && Array.isArray(judgeResults), resultsErr?.message);
  }

  console.log(`\n${passed}/${total} judge regression tests passed`);
  if (failures.length) {
    console.error("Failures:", failures.join(", "));
    process.exit(1);
  }
}

runJudgeRegression();
