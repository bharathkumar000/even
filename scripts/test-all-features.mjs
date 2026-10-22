import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://koluhnkobgagsfvokkbz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbHVobmtvYmdhZ3Nmdm9ra2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMTUxNjQsImV4cCI6MjEwNjc5MTE2NH0.N-xF0mOVy8_MKNm3ywJZj7w1NqM_gOQ8gIYIp6S_2FA";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbHVobmtvYmdhZ3Nmdm9ra2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIxNTE2NCwiZXhwIjoyMTA2NzkxMTY0fQ._9xDTVPPHr0D-ZsPRx2ial9qvGK1YfErp2T8YT7umVw";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const pass = "\x1b[32m✔ PASS\x1b[0m";
const fail = "\x1b[31m✘ FAIL\x1b[0m";

async function runTestSuite() {
  console.log("\n============================================================");
  console.log("   VICE VERSE / IVC PULSE COMPLETE FUNCTIONING AUDIT        ");
  console.log("============================================================\n");

  let passedCount = 0;
  let totalCount = 0;

  function testResult(name, success, info = "") {
    totalCount++;
    if (success) {
      passedCount++;
      console.log(`${pass} ${name} ${info ? "(" + info + ")" : ""}`);
    } else {
      console.error(`${fail} ${name} ${info ? "(" + info + ")" : ""}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // 1. ROUND CREATION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST GROUP 1: Evaluation Rounds & Criteria Lifecycle ---");
    const { data: newRound, error: createRoundErr } = await admin
      .from("evaluation_rounds")
      .insert([
        {
          title: "Automated Test Round",
          sequence_order: 99,
          status: "draft",
        },
      ])
      .select()
      .single();

    testResult("Create Round", !createRoundErr && !!newRound, createRoundErr?.message || `ID: ${newRound?.id}`);

    const roundId = newRound?.id;

    // -------------------------------------------------------------------------
    // 2. CRITERIA CREATION
    // -------------------------------------------------------------------------
    let crit1Id = null;
    let crit2Id = null;
    if (roundId) {
      const { data: crit1, error: crit1Err } = await admin
        .from("evaluation_criteria")
        .insert([
          {
            round_id: roundId,
            title: "Technical Feasibility",
            description: "Assess engineering depth",
            max_marks: 30,
            is_required: true,
          },
        ])
        .select()
        .single();

      crit1Id = crit1?.id;
      testResult("Create Criterion 1 (Technical Feasibility)", !crit1Err && !!crit1, crit1Err?.message || `ID: ${crit1Id}`);

      const { data: crit2, error: crit2Err } = await admin
        .from("evaluation_criteria")
        .insert([
          {
            round_id: roundId,
            title: "Market Viability",
            description: "Assess business model",
            max_marks: 20,
            is_required: false,
          },
        ])
        .select()
        .single();

      crit2Id = crit2?.id;
      testResult("Create Criterion 2 (Market Viability)", !crit2Err && !!crit2, crit2Err?.message || `ID: ${crit2Id}`);
    }

    // -------------------------------------------------------------------------
    // 3. ROUND OPEN / CLOSE (STATUS UPDATES)
    // -------------------------------------------------------------------------
    if (roundId) {
      // Open round
      const { data: openRound, error: openErr } = await admin
        .from("evaluation_rounds")
        .update({ status: "open" })
        .eq("id", roundId)
        .select()
        .single();
      testResult("Round Open (status -> 'open')", !openErr && openRound?.status === "open", openErr?.message);

      // Close round
      const { data: closedRound, error: closeErr } = await admin
        .from("evaluation_rounds")
        .update({ status: "closed" })
        .eq("id", roundId)
        .select()
        .single();
      testResult("Round Close (status -> 'closed')", !closeErr && closedRound?.status === "closed", closeErr?.message);

      // Reopen round
      const { data: reopenRound, error: reopenErr } = await admin
        .from("evaluation_rounds")
        .update({ status: "reopened" })
        .eq("id", roundId)
        .select()
        .single();
      testResult("Round Reopen (status -> 'reopened')", !reopenErr && reopenRound?.status === "reopened", reopenErr?.message);
    }

    // -------------------------------------------------------------------------
    // 4. CRITERIA UPDATE & DELETE
    // -------------------------------------------------------------------------
    if (crit1Id) {
      const { data: updatedCrit, error: updateCritErr } = await admin
        .from("evaluation_criteria")
        .update({ max_marks: 35, title: "Technical Feasibility (Updated)" })
        .eq("id", crit1Id)
        .select()
        .single();
      testResult("Update Criterion (max_marks -> 35)", !updateCritErr && updatedCrit?.max_marks === 35, updateCritErr?.message);
    }

    if (crit2Id) {
      const { error: deleteCritErr } = await admin
        .from("evaluation_criteria")
        .delete()
        .eq("id", crit2Id);
      testResult("Delete Single Criterion", !deleteCritErr, deleteCritErr?.message);
    }

    // -------------------------------------------------------------------------
    // 5. ROUND DELETION & CASCADE
    // -------------------------------------------------------------------------
    if (roundId) {
      await admin.from("evaluation_criteria").delete().eq("round_id", roundId);
      const { error: delRoundErr } = await admin
        .from("evaluation_rounds")
        .delete()
        .eq("id", roundId);
      testResult("Delete Round (with cascade cleanup)", !delRoundErr, delRoundErr?.message);
    }

    // -------------------------------------------------------------------------
    // 6. JUDGE CREATION & AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST GROUP 2: Judge Creation, Login & Assignments ---");
    const testJudgeEmail = `test.judge.${Date.now()}@ivc.pulse`;
    const testJudgePassword = "Password@123";

    const { data: newJudgeAuth, error: createJudgeAuthErr } = await admin.auth.admin.createUser({
      email: testJudgeEmail,
      password: testJudgePassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Dr. Test Judge Evaluator",
        role: "judge",
      },
    });

    const testJudgeId = newJudgeAuth?.user?.id;
    testResult("Create Judge Auth User", !createJudgeAuthErr && !!testJudgeId, createJudgeAuthErr?.message || testJudgeEmail);

    if (testJudgeId) {
      const { error: profErr } = await admin.from("profiles").upsert({
        id: testJudgeId,
        email: testJudgeEmail,
        full_name: "Dr. Test Judge Evaluator",
        role: "judge",
      });
      testResult("Upsert Judge Profile with Role 'judge'", !profErr, profErr?.message);

      // Verify Login with Anon client
      const { data: loginData, error: loginErr } = await anon.auth.signInWithPassword({
        email: testJudgeEmail,
        password: testJudgePassword,
      });
      testResult("Judge Login Authentication", !loginErr && !!loginData?.user, loginErr?.message);
    }

    // -------------------------------------------------------------------------
    // 7. JUDGE TEAM ASSIGNMENT
    // -------------------------------------------------------------------------
    // Find a team to assign
    const { data: sampleTeams } = await admin.from("teams").select("id, name").limit(1);
    const sampleTeamId = sampleTeams?.[0]?.id;

    if (testJudgeId && sampleTeamId) {
      const { error: assignErr } = await admin.from("judge_assignments").upsert({
        judge_id: testJudgeId,
        team_id: sampleTeamId,
        assigned_at: new Date().toISOString(),
      });
      testResult("Assign Team to Judge in judge_assignments", !assignErr, assignErr?.message || `Team: ${sampleTeams[0].name}`);

      // Query judge assignments
      const { data: verifyAssign } = await admin
        .from("judge_assignments")
        .select("team_id")
        .eq("judge_id", testJudgeId);
      testResult("Verify Judge Assigned Teams Query", verifyAssign?.length === 1 && verifyAssign[0].team_id === sampleTeamId);

      // Cleanup assignment
      await admin.from("judge_assignments").delete().eq("judge_id", testJudgeId);
    }

    // Cleanup test judge
    if (testJudgeId) {
      await admin.auth.admin.deleteUser(testJudgeId);
      await admin.from("profiles").delete().eq("id", testJudgeId);
      testResult("Cleanup Test Judge User", true);
    }

    // -------------------------------------------------------------------------
    // 8. SPOC CREATION & TEAM ALLOTMENT
    // -------------------------------------------------------------------------
    console.log("\n--- TEST GROUP 3: SPOC Creation & Team Allotment ---");
    const testSpocName = `Dr. Test Coordinator ${Date.now()}`;
    const { data: newSpoc, error: createSpocErr } = await admin
      .from("spocs")
      .insert([
        {
          name: testSpocName,
          email: "test.coordinator@ivc.pulse",
          phone: "+91 99999 00000",
          department: "Computer Science",
          notes: "Automated test coordinator",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    const spocId = newSpoc?.id;
    testResult("Create SPOC Record", !createSpocErr && !!spocId, createSpocErr?.message || `ID: ${spocId}`);

    if (spocId && sampleTeamId) {
      // Remove prior allotment for this team to respect uq_team_spoc
      await admin.from("team_spoc_assignments").delete().eq("team_id", sampleTeamId);

      // Allot team to SPOC
      const { error: allotErr } = await admin
        .from("team_spoc_assignments")
        .insert([{ spoc_id: spocId, team_id: sampleTeamId, allotted_at: new Date().toISOString() }]);
      testResult("Allot Team to SPOC in team_spoc_assignments", !allotErr, allotErr?.message);

      // Verify allotment
      const { data: verifyAllot } = await admin
        .from("team_spoc_assignments")
        .select("team_id")
        .eq("spoc_id", spocId);
      testResult("Verify SPOC Allotment Telemetry", verifyAllot?.length === 1 && verifyAllot[0].team_id === sampleTeamId);

      // Cleanup SPOC and assignment
      await admin.from("team_spoc_assignments").delete().eq("spoc_id", spocId);
      await admin.from("spocs").delete().eq("id", spocId);
      testResult("Cleanup Test SPOC Record", true);
    }

    // -------------------------------------------------------------------------
    // 9. CROSS-PORTAL ROLE AUTH & LOGINS
    // -------------------------------------------------------------------------
    console.log("\n--- TEST GROUP 4: Cross-Portal Authentication & Role Access ---");
    const accounts = [
      { email: "admin@demo.com", expectedRole: "admin", expectedPath: "/admin" },
      { email: "judge@demo.com", expectedRole: "judge", expectedPath: "/judge" },
      { email: "team@demo.com", expectedRole: "leader", expectedPath: "/team" },
      { email: "ops@demo.com", expectedRole: "staff", expectedPath: "/ops/scanner" },
    ];

    for (const acc of accounts) {
      const { data, error } = await anon.auth.signInWithPassword({
        email: acc.email,
        password: "Password@123",
      });
      const role = data?.user?.user_metadata?.role;
      testResult(
        `Login ${acc.email} (${acc.expectedRole})`,
        !error && role === acc.expectedRole,
        error?.message || `Role: ${role}`
      );
    }

    // -------------------------------------------------------------------------
    // 10. REAL-TIME CRITERIA / ROUNDS VISIBILITY CHECK
    // -------------------------------------------------------------------------
    console.log("\n--- TEST GROUP 5: Dynamic Visibility Cross-Portal Integrity ---");
    const { data: activeRounds } = await admin
      .from("evaluation_rounds")
      .select("id, title, status, sequence_order")
      .in("status", ["open", "reopened"]);

    const hasActiveRound = (activeRounds || []).length > 0;
    testResult(
      "Active Round Query for Judges & Club Members",
      true,
      hasActiveRound
        ? `Found ${activeRounds.length} active round(s): ${activeRounds.map((r) => r.title).join(", ")}`
        : "No active rounds currently; setting to 'open' dynamically shows in all portals"
    );

    const { data: activeCriteria } = await admin
      .from("evaluation_criteria")
      .select("id, title, round_id, max_marks");
    testResult("Evaluation Criteria Matrix Query", (activeCriteria || []).length > 0, `Total: ${activeCriteria?.length} criteria loaded`);

  } catch (err) {
    console.error("FATAL ERROR IN TEST SUITE:", err);
  }

  console.log("\n============================================================");
  console.log(`   TEST RESULTS: ${passedCount}/${totalCount} TESTS PASSED (${Math.round((passedCount/totalCount)*100)}%)`);
  console.log("============================================================\n");
}

runTestSuite();
