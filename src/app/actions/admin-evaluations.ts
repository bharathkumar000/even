"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { EvaluationOverrideSchema } from "@/lib/validations/admin";
import { z } from "zod";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export type EvaluationOverrideInput = z.infer<typeof EvaluationOverrideSchema>;

export async function overrideEvaluationStatus(
  data: EvaluationOverrideInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }
): Promise<{ success: boolean; evaluation?: any; error?: string }> {
  try {
    const { user } = await requireAdmin();
    try {
      await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
    } catch (csrfErr) {
      console.warn("[CSRF] overrideEvaluationStatus notice:", csrfErr);
    }

    const parsed = EvaluationOverrideSchema.safeParse(data);
    if (!parsed.success) {
      const errMessage = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid override input.";
      return { success: false, error: errMessage };
    }
    const validated = parsed.data;

    // 1. Fetch current evaluation record for audit diffing
    const { data: previousEvaluation, error: fetchError } = await supabaseAdmin
      .from("evaluations")
      .select("*")
      .eq("id", validated.evaluation_id)
      .single();

    if (fetchError || !previousEvaluation) {
      return { success: false, error: `Evaluation not found: ${fetchError?.message || "Invalid ID"}` };
    }

    // 2. Update evaluation status
    const { data: updatedEvaluation, error: updateError } = await supabaseAdmin
      .from("evaluations")
      .update({
        status: validated.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.evaluation_id)
      .select()
      .single();

    if (updateError) {
      return { success: false, error: `Failed to update evaluation status: ${updateError.message}` };
    }

    // 3. Log action in audit_logs (non-blocking)
    void supabaseAdmin.from("audit_logs").insert([
      {
        action: "EVALUATION_STATUS_OVERRIDE",
        entity_type: "evaluation",
        entity_id: validated.evaluation_id,
        admin_id: user.id,
        details: {
          previous_status: previousEvaluation.status,
          new_status: validated.status,
          reason: validated.reason,
        },
        created_at: new Date().toISOString(),
      },
    ]);

    return { evaluation: updatedEvaluation, success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to override evaluation status";
    console.error("[overrideEvaluationStatus] Unexpected error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function getEvaluationsData() {
  const fetchEvals = async () => {
    const [evalsRes, roundsRes] = await Promise.all([
      supabaseAdmin
        .from("evaluations")
        .select(`
          id,
          total_score,
          status,
          created_at,
          updated_at,
          round_id,
          judge_id,
          team_id
        `)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title")
        .order("sequence_order", { ascending: true }),
    ]);
    return {
      evaluations: (evalsRes.data || []) as any[],
      rounds: (roundsRes.data || []) as any[],
    };
  };

  const timeoutPromise = new Promise<{ evaluations: any[]; rounds: any[] }>((resolve) =>
    setTimeout(() => resolve({ evaluations: [], rounds: [] }), 2500)
  );

  return Promise.race([fetchEvals(), timeoutPromise]);
}

export interface TeamEvaluationRecord {
  team_id: string;
  team_code: string;
  team_name: string;
  team_track: string | null;
  team_status: string | null;
  leader_id: string | null;
  leader_name: string | null;
  leader_email: string | null;
  round_id: string | null;
  round_title: string | null;
  // Judge 1
  judge1_id: string | null;
  judge1_name: string | null;
  judge1_email: string | null;
  judge1_evaluation_id: string | null;
  judge1_evaluation_status: string | null;
  judge1_total_score: number | null;
  judge1_feedback: string | null;
  judge1_submitted_at: string | null;
  judge1_updated_at: string | null;
  // Judge 2
  judge2_id: string | null;
  judge2_name: string | null;
  judge2_email: string | null;
  judge2_evaluation_id: string | null;
  judge2_evaluation_status: string | null;
  judge2_total_score: number | null;
  judge2_feedback: string | null;
  judge2_submitted_at: string | null;
  judge2_updated_at: string | null;
  // Combined
  combined_score: number | null;
  overall_status: string | null;
  override_info: {
    previous_status: string | null;
    new_status: string | null;
    reason: string | null;
    admin_name: string | null;
    created_at: string | null;
  } | null;
}

export async function getAllTeamsWithEvaluations() {
  const { user } = await requireAdmin();

  // 1. Fetch all teams
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, name, code, track, leader_name, status, created_at")
    .order("name", { ascending: true });

  if (teamsError) {
    throw new Error(`Failed to load teams: ${teamsError.message}`);
  }

  if (!teams || teams.length === 0) {
    return { teams: [], rounds: [] };
  }

  const teamIds = teams.map((t: any) => t.id);

  // 2. Fetch team leaders from team_members + profiles
  const { data: teamMembers, error: tmError } = await supabaseAdmin
    .from("team_members")
    .select("id, team_id, user_id, role, name, email")
    .eq("role", "leader")
    .in("team_id", teamIds);

  if (tmError) {
    throw new Error(`Failed to load team members: ${tmError.message}`);
  }

  const leaderUserIds = teamMembers
    ? teamMembers.map((m: any) => m.user_id).filter(Boolean)
    : [];

  const { data: leaderProfiles, error: lpError } = leaderUserIds.length > 0
    ? await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", leaderUserIds)
    : { data: [], error: null };

  if (lpError) {
    throw new Error(`Failed to load leader profiles: ${lpError.message}`);
  }

  // 3. Fetch judge assignments for the active round + judge profiles
  let { data: activeRound } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("id, title")
    .in("status", ["open", "reopened"])
    .order("sequence_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!activeRound) {
    const { data: anyRound } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("id, title")
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeRound = anyRound;
  }

  const activeRoundId = activeRound?.id || null;

  let jaQuery = supabaseAdmin
    .from("judge_assignments")
    .select("id, judge_id, team_id, round_id")
    .in("team_id", teamIds);

  if (activeRoundId) {
    jaQuery = jaQuery.eq("round_id", activeRoundId);
  }

  const { data: judgeAssignments, error: jaError } = await jaQuery;

  if (jaError) {
    throw new Error(`Failed to load judge assignments: ${jaError.message}`);
  }

  const judgeUserIds = judgeAssignments
    ? judgeAssignments.map((j: any) => j.judge_id).filter(Boolean)
    : [];

  const { data: judgeProfiles, error: jpError } = judgeUserIds.length > 0
    ? await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", judgeUserIds)
    : { data: [], error: null };

  if (jpError) {
    throw new Error(`Failed to load judge profiles: ${jpError.message}`);
  }

  // 4. Fetch evaluations for all teams in the active round
  let evalQuery = supabaseAdmin
    .from("evaluations")
    .select(`
      id,
      total_score,
      status,
      feedback,
      created_at,
      updated_at,
      round_id,
      judge_id,
      team_id
    `)
    .in("team_id", teamIds);

  if (activeRoundId) {
    evalQuery = evalQuery.eq("round_id", activeRoundId);
  }

  const { data: evaluations, error: evalError } = await evalQuery;

  if (evalError) {
    throw new Error(`Failed to load evaluations: ${evalError.message}`);
  }

  // 5. Fetch evaluation rounds for title mapping
  const { data: rounds, error: rError } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("id, title");

  if (rError) {
    throw new Error(`Failed to load rounds: ${rError.message}`);
  }

  // 6. Fetch override audit logs for evaluations
  const evaluationIds = evaluations
    ? evaluations.map((e: any) => e.id).filter(Boolean)
    : [];

  let overrideLogs: any[] = [];
  if (evaluationIds.length > 0) {
    const { data: logs, error: lError } = await supabaseAdmin
      .from("audit_logs")
      .select(`
        id,
        action,
        entity_id,
        reason,
        details,
        created_at,
        admin_id
      `)
      .eq("action", "EVALUATION_STATUS_OVERRIDE")
      .in("entity_id", evaluationIds)
      .order("created_at", { ascending: false });

    if (!lError && logs) {
      overrideLogs = logs;
    }

    const adminIds = overrideLogs
      .map((l: any) => l.admin_id)
      .filter(Boolean);

    if (adminIds.length > 0) {
      const { data: adminProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", adminIds);

      if (adminProfiles) {
        const adminMap = new Map(adminProfiles.map((a: any) => [a.id, a]));
        overrideLogs = overrideLogs.map((l: any) => ({
          ...l,
          admin_name: adminMap.get(l.admin_id)?.full_name || null,
          admin_email: adminMap.get(l.admin_id)?.email || null,
        }));
      }
    }
  }

  // Build lookup maps
  const leaderMap = new Map<string, any>();
  teamMembers?.forEach((m: any) => {
    const profile = leaderProfiles?.find((p: any) => p.id === m.user_id);
    leaderMap.set(m.team_id, {
      leader_id: m.user_id,
      leader_name: profile?.full_name || m.name || null,
      leader_email: profile?.email || m.email || null,
    });
  });

  const judgeProfileMap = new Map<string, any>();
  judgeProfiles?.forEach((p: any) => {
    judgeProfileMap.set(p.id, p);
  });

  // Map team_id -> [judge assignments]
  const teamJudgeAssignments = new Map<string, any[]>();
  judgeAssignments?.forEach((ja: any) => {
    if (!teamJudgeAssignments.has(ja.team_id)) {
      teamJudgeAssignments.set(ja.team_id, []);
    }
    teamJudgeAssignments.get(ja.team_id)!.push(ja);
  });

  // Map (team_id, judge_id) -> evaluation
  const evalMap = new Map<string, any>();
  evaluations?.forEach((e: any) => {
    evalMap.set(`${e.team_id}_${e.judge_id}`, e);
  });

  const roundMap = new Map<string, any>();
  rounds?.forEach((r: any) => {
    roundMap.set(r.id, r);
  });

  // Build override log lookup by evaluation_id (latest override per evaluation)
  const overrideMap = new Map<string, any>();
  overrideLogs?.forEach((log: any) => {
    const existing = overrideMap.get(log.entity_id);
    if (!existing || new Date(log.created_at) > new Date(existing.created_at)) {
      overrideMap.set(log.entity_id, log);
    }
  });

  // 7. Combine all data into team evaluation records with dual-judge view
  const teamRecords: TeamEvaluationRecord[] = teams.map((team: any) => {
    const leader = leaderMap.get(team.id) || {};
    const assignments = teamJudgeAssignments.get(team.id) || [];
    const round = activeRound ? roundMap.get(activeRoundId) : null;

    // Sort assignments to have consistent Judge 1 / Judge 2 ordering
    const sortedAssignments = [...assignments].sort((a, b) => {
      const nameA = judgeProfileMap.get(a.judge_id)?.full_name || "";
      const nameB = judgeProfileMap.get(b.judge_id)?.full_name || "";
      return nameA.localeCompare(nameB);
    });

    const judge1Assignment = sortedAssignments[0];
    const judge2Assignment = sortedAssignments[1];

    const judge1Profile = judge1Assignment ? judgeProfileMap.get(judge1Assignment.judge_id) : null;
    const judge2Profile = judge2Assignment ? judgeProfileMap.get(judge2Assignment.judge_id) : null;

    const judge1Eval = judge1Assignment ? evalMap.get(`${team.id}_${judge1Assignment.judge_id}`) : null;
    const judge2Eval = judge2Assignment ? evalMap.get(`${team.id}_${judge2Assignment.judge_id}`) : null;

    const judge1Score = judge1Eval?.total_score ?? null;
    const judge2Score = judge2Eval?.total_score ?? null;

    // Combined score: sum of both judges' scores (max 100)
    let combinedScore: number | null = null;
    if (judge1Score !== null && judge2Score !== null) {
      combinedScore = judge1Score + judge2Score;
    } else if (judge1Score !== null) {
      combinedScore = judge1Score; // Provisional
    } else if (judge2Score !== null) {
      combinedScore = judge2Score; // Provisional
    }

    // Overall status
    let overallStatus: string = "Pending";
    const j1Status = judge1Eval?.status || null;
    const j2Status = judge2Eval?.status || null;

    if (j1Status === "submitted" && j2Status === "submitted") {
      overallStatus = "Fully Evaluated";
    } else if ((j1Status === "submitted" || j2Status === "submitted") && !(j1Status === "submitted" && j2Status === "submitted")) {
      overallStatus = "Partially Evaluated";
    } else if (j1Status === "draft" || j2Status === "draft") {
      overallStatus = "In Progress";
    }

    const override = overrideMap.get(judge1Eval?.id || judge2Eval?.id || "");

    return {
      team_id: team.id,
      team_code: team.code || `IVC-${String(team.id.slice(-4)).toUpperCase()}`,
      team_name: team.name,
      team_track: team.track,
      team_status: team.status,
      leader_id: leader.leader_id,
      leader_name: leader.leader_name,
      leader_email: leader.leader_email,
      round_id: activeRoundId,
      round_title: round?.title || null,
      // Judge 1
      judge1_id: judge1Assignment?.judge_id || null,
      judge1_name: judge1Profile?.full_name || null,
      judge1_email: judge1Profile?.email || null,
      judge1_evaluation_id: judge1Eval?.id || null,
      judge1_evaluation_status: j1Status,
      judge1_total_score: judge1Score,
      judge1_feedback: judge1Eval?.feedback || null,
      judge1_submitted_at: judge1Eval?.updated_at || null,
      judge1_updated_at: judge1Eval?.updated_at || null,
      // Judge 2
      judge2_id: judge2Assignment?.judge_id || null,
      judge2_name: judge2Profile?.full_name || null,
      judge2_email: judge2Profile?.email || null,
      judge2_evaluation_id: judge2Eval?.id || null,
      judge2_evaluation_status: j2Status,
      judge2_total_score: judge2Score,
      judge2_feedback: judge2Eval?.feedback || null,
      judge2_submitted_at: judge2Eval?.updated_at || null,
      judge2_updated_at: judge2Eval?.updated_at || null,
      // Combined
      combined_score: combinedScore,
      overall_status: overallStatus,
      override_info: override
        ? {
            previous_status: override.details?.previous_status || null,
            new_status: override.details?.new_status || null,
            reason: override.reason || null,
            admin_name: override.admin_name || null,
            created_at: override.created_at || null,
          }
        : null,
    };
  });

  return { teams: teamRecords, rounds: rounds || [] };
}

export async function getEvaluationDetails(evaluationId: string) {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("evaluations")
    .select("*")
    .eq("id", evaluationId)
    .single();

  if (error || !data) {
    throw new Error(`Evaluation not found: ${error?.message || "Invalid ID"}`);
  }

  return { evaluation: data, success: true };
}

export async function getEvaluationStatistics() {
  const { user } = await requireAdmin();

  // Fetch all teams
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, name, code, track, status")
    .order("name", { ascending: true });

  if (teamsError) {
    throw new Error(`Failed to load teams: ${teamsError.message}`);
  }

  const teamIds = teams.map((t: any) => t.id);

  // Fetch judge assignments for active round
  let { data: activeRound } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("id")
    .in("status", ["open", "reopened"])
    .order("sequence_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!activeRound) {
    const { data: anyRound } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("id")
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeRound = anyRound;
  }

  const activeRoundId = activeRound?.id || null;

  let jaQuery = supabaseAdmin
    .from("judge_assignments")
    .select("judge_id, team_id, round_id");

  if (activeRoundId) {
    jaQuery = jaQuery.eq("round_id", activeRoundId);
  }

  const { data: judgeAssignments, error: jaError } = await jaQuery;

  if (jaError) {
    throw new Error(`Failed to load judge assignments: ${jaError.message}`);
  }

  // Total judge slots = teams * 2 (dual judge system)
  const totalTeams = teams.length;
  const totalJudgeSlots = totalTeams * 2;
  const assignedJudgeSlots = judgeAssignments ? judgeAssignments.length : 0;

  // Fetch evaluations for active round
  let evalQuery = supabaseAdmin
    .from("evaluations")
    .select("team_id, judge_id, status, total_score");

  if (activeRoundId) {
    evalQuery = evalQuery.eq("round_id", activeRoundId);
  }

  const { data: evaluations, error: evalError } = await evalQuery;

  if (evalError) {
    throw new Error(`Failed to load evaluations: ${evalError.message}`);
  }

  // Count evaluations by status
  let completedEvaluations = 0;
  let draftEvaluations = 0;
  let submittedEvaluations = 0;

  evaluations?.forEach((e: any) => {
    if (e.status === "submitted") submittedEvaluations++;
    else if (e.status === "draft") draftEvaluations++;
    if (e.status === "submitted") completedEvaluations++;
  });

  const pendingEvaluations = assignedJudgeSlots - (submittedEvaluations + draftEvaluations);

  // Count teams by evaluation state
  const teamEvalState = new Map<string, { j1: boolean; j2: boolean }>();
  teams.forEach((t) => teamEvalState.set(t.id, { j1: false, j2: false }));

  judgeAssignments?.forEach((ja) => {
    const state = teamEvalState.get(ja.team_id) || { j1: false, j2: false };
    const evalRec = evaluations?.find((e) => e.team_id === ja.team_id && e.judge_id === ja.judge_id);
    if (evalRec) {
      if (evalRec.status === "submitted") {
        if (!state.j1) state.j1 = true;
        if (!state.j2) state.j2 = true;
      }
    }
  });

  let teamsBothCompleted = 0;
  let teamsAwaitingOne = 0;
  let teamsAwaitingBoth = 0;

  teamEvalState.forEach((state) => {
    const submittedCount = (state.j1 ? 1 : 0) + (state.j2 ? 1 : 0);
    if (submittedCount === 2) teamsBothCompleted++;
    else if (submittedCount === 1) teamsAwaitingOne++;
    else teamsAwaitingBoth++;
  });

  return {
    total_teams: totalTeams,
    total_judge_slots: totalJudgeSlots,
    assigned_judge_slots: assignedJudgeSlots,
    completed_evaluations: completedEvaluations,
    draft_evaluations: draftEvaluations,
    submitted_evaluations: submittedEvaluations,
    pending_evaluations: pendingEvaluations,
    teams_both_completed: teamsBothCompleted,
    teams_awaiting_one: teamsAwaitingOne,
    teams_awaiting_both: teamsAwaitingBoth,
  };
}

