"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { requireOperationsRole } from "@/lib/auth/operations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export interface JudgeOption {
  id: string;
  full_name: string | null;
  email: string | null;
  assigned_team_ids: string[]; // team_ids for the active round
}

export interface TeamOption {
  id: string;
  name: string;
  code?: string | null;
  track?: string | null;
  assigned_judge_ids: string[]; // judge_ids for the active round
  assigned_judge_names?: string[];
}

export interface JudgeAssignmentsData {
  judges: JudgeOption[];
  teams: TeamOption[];
  round_id: string | null;
  round_title: string | null;
}

export async function getJudgeAssignmentsData(roundId: string | null = null): Promise<JudgeAssignmentsData> {
  try {
    await requireOperationsRole();
  } catch {
    try {
      await requireAdmin();
    } catch (err) {
      console.warn("getJudgeAssignmentsData auth notice:", err);
      return { judges: [], teams: [], round_id: null, round_title: null };
    }
  }

  // Determine the active round
  let activeRoundId = roundId;
  let activeRoundTitle: string | null = null;

  if (!activeRoundId) {
    const { data: rounds } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("id, title")
      .eq("status", "open")
      .order("sequence_order", { ascending: true })
      .limit(1);
    if (rounds && rounds.length > 0) {
      activeRoundId = rounds[0].id;
      activeRoundTitle = rounds[0].title;
    }
  } else {
    const { data: round } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("title")
      .eq("id", activeRoundId)
      .maybeSingle();
    activeRoundTitle = round?.title || null;
  }

  const fetchData = async (): Promise<JudgeAssignmentsData> => {
    const [judgesRes, teamsRes, assignmentsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("role", "judge")
        .order("full_name", { ascending: true }),
      supabaseAdmin
        .from("teams")
        .select("id, name, code, track")
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("judge_assignments")
        .select("judge_id, team_id, round_id")
        .eq("round_id", activeRoundId),
    ]);

    const assignments = assignmentsRes.data || [];

    const judgeToTeams = new Map<string, string[]>();
    const teamToJudges = new Map<string, string[]>();

    for (const a of assignments) {
      if (!judgeToTeams.has(a.judge_id)) judgeToTeams.set(a.judge_id, []);
      judgeToTeams.get(a.judge_id)!.push(a.team_id);

      if (!teamToJudges.has(a.team_id)) teamToJudges.set(a.team_id, []);
      teamToJudges.get(a.team_id)!.push(a.judge_id);
    }

    const judgeNameMap = new Map<string, string>();
    (judgesRes.data || []).forEach((j) => {
      judgeNameMap.set(j.id, j.full_name || j.email || "Judge");
    });

    const judges: JudgeOption[] = (judgesRes.data || []).map((j) => ({
      id: j.id,
      full_name: j.full_name,
      email: j.email,
      assigned_team_ids: judgeToTeams.get(j.id) || [],
    }));

    const teams: TeamOption[] = (teamsRes.data || []).map((t) => {
      const jIds = teamToJudges.get(t.id) || [];
      return {
        id: t.id,
        name: t.name,
        code: t.code,
        track: t.track,
        assigned_judge_ids: jIds,
        assigned_judge_names: jIds.map((id) => judgeNameMap.get(id) || "Judge"),
      };
    });

    return { judges, teams, round_id: activeRoundId, round_title: activeRoundTitle };
  };

  const timeoutPromise = new Promise<JudgeAssignmentsData>((resolve) =>
    setTimeout(() => resolve({ judges: [], teams: [], round_id: null, round_title: null }), 3000)
  );

  return Promise.race([fetchData(), timeoutPromise]);
}

export async function updateJudgeTeams(data: {
  judgeId: string;
  teamIds: string[];
  roundId?: string | null;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  // Determine the active round
  let activeRoundId = data.roundId || null;
  if (!activeRoundId) {
    const { data: round } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("id")
      .eq("status", "open")
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeRoundId = round?.id || null;
  }

  if (!activeRoundId) {
    throw new Error("No active evaluation round found. Please create or open a round first.");
  }

  // 1. Delete all existing assignments for this judge in this round
  const { error: deleteError } = await supabaseAdmin
    .from("judge_assignments")
    .delete()
    .eq("judge_id", data.judgeId)
    .eq("round_id", activeRoundId);

  if (deleteError) {
    throw new Error(`Failed to reset existing judge assignments: ${deleteError.message}`);
  }

  // 2. Insert new assignments if any
  if (data.teamIds.length > 0) {
    const rows = data.teamIds.map((tId) => ({
      judge_id: data.judgeId,
      team_id: tId,
      round_id: activeRoundId,
      assigned_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseAdmin
      .from("judge_assignments")
      .insert(rows);

    if (insertError) {
      throw new Error(`Failed to save judge assignments: ${insertError.message}`);
    }
  }

  // 3. Audit log write (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "UPDATE_JUDGE_ASSIGNMENTS",
      entity_type: "judge_assignments",
      entity_id: data.judgeId,
      admin_id: user.id,
      details: {
        judge_id: data.judgeId,
        team_ids: data.teamIds,
        round_id: activeRoundId,
        assigned_count: data.teamIds.length,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/assignments");
  revalidatePath("/admin/users");
  revalidatePath("/judge");

  return { success: true };
}

export async function toggleSingleAssignment(data: {
  judgeId: string;
  teamId: string;
  roundId?: string | null;
  assign: boolean;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  // Determine the active round
  let activeRoundId = data.roundId || null;
  if (!activeRoundId) {
    const { data: round } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("id")
      .eq("status", "open")
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeRoundId = round?.id || null;
  }

  if (!activeRoundId) {
    throw new Error("No active evaluation round found. Please create or open a round first.");
  }

  if (data.assign) {
    const { error } = await supabaseAdmin
      .from("judge_assignments")
      .upsert(
        { judge_id: data.judgeId, team_id: data.teamId, round_id: activeRoundId, assigned_at: new Date().toISOString() },
        { onConflict: "judge_id,team_id,round_id" }
      );
    if (error) throw new Error(`Failed to assign team: ${error.message}`);
  } else {
    const { error } = await supabaseAdmin
      .from("judge_assignments")
      .delete()
      .eq("judge_id", data.judgeId)
      .eq("team_id", data.teamId)
      .eq("round_id", activeRoundId);
    if (error) throw new Error(`Failed to unassign team: ${error.message}`);
  }

  // Audit log (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: data.assign ? "ASSIGN_TEAM_TO_JUDGE" : "UNASSIGN_TEAM_FROM_JUDGE",
      entity_type: "judge_assignments",
      entity_id: data.judgeId,
      admin_id: user.id,
      details: {
        judge_id: data.judgeId,
        team_id: data.teamId,
        round_id: data.roundId,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/assignments");
  revalidatePath("/admin/users");
  revalidatePath("/judge");

  return { success: true };
}

/**
 * Smart Auto-Allotment Algorithm for Judges
 * Distributes judges evenly across teams ensuring conflict avoidance.
 * Supports per-round assignment (2 judges per team by default).
 */
export async function autoBalanceJudgeAssignments(options: {
  judgesPerTeam?: number;
  clearExisting?: boolean;
  roundId?: string | null;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
} = {}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(options[CSRF_CONSTANTS.HEADER_NAME] || null);
  const judgesPerTeam = Math.max(1, options.judgesPerTeam || 2);

  // Determine the active round
  let activeRoundId = options.roundId || null;
  if (!activeRoundId) {
    const { data: rounds } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("id")
      .eq("status", "open")
      .order("sequence_order", { ascending: true })
      .limit(1);
    if (rounds && rounds.length > 0) {
      activeRoundId = rounds[0].id;
    }
  }

  if (!activeRoundId) {
    throw new Error("No active evaluation round found. Please create or open a round first.");
  }

  // 1. Fetch judges and teams
  const [judgesRes, teamsRes, conflictsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name").eq("role", "judge"),
    supabaseAdmin.from("teams").select("id, name, track"),
    supabaseAdmin.from("judge_conflicts").select("judge_id, team_id"),
  ]);

  const judges = judgesRes.data || [];
  const teams = teamsRes.data || [];
  const conflicts = new Set(
    (conflictsRes.data || []).map((c) => `${c.judge_id}_${c.team_id}`)
  );

  if (judges.length === 0) {
    throw new Error("No judges found to allocate. Please add judges first.");
  }
  if (teams.length === 0) {
    throw new Error("No teams found to allocate.");
  }

  // 2. Clear existing assignments if requested (for this round)
  if (options.clearExisting) {
    await supabaseAdmin
      .from("judge_assignments")
      .delete()
      .eq("round_id", activeRoundId);
  }

  // 3. Round-robin assignment balancing per round
  const judgeLoads = new Map<string, number>();
  judges.forEach((j) => judgeLoads.set(j.id, 0));

  const newAssignments: Array<{ judge_id: string; team_id: string; round_id: string; assigned_at: string }> = [];

  for (const team of teams) {
    const availableJudges = [...judges]
      .filter((j) => !conflicts.has(`${j.id}_${team.id}`))
      .sort((a, b) => (judgeLoads.get(a.id) || 0) - (judgeLoads.get(b.id) || 0));

    const selectedJudges = availableJudges.slice(0, Math.min(judgesPerTeam, availableJudges.length));

    for (const judge of selectedJudges) {
      newAssignments.push({
        judge_id: judge.id,
        team_id: team.id,
        round_id: activeRoundId,
        assigned_at: new Date().toISOString(),
      });
      judgeLoads.set(judge.id, (judgeLoads.get(judge.id) || 0) + 1);
    }
  }

  if (newAssignments.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("judge_assignments")
      .upsert(newAssignments, { onConflict: "judge_id,team_id,round_id" });

    if (insertError) {
      throw new Error(`Failed to save auto-balanced judge assignments: ${insertError.message}`);
    }
  }

  // Audit log
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "AUTO_BALANCE_JUDGES",
      entity_type: "judge_assignments",
      admin_id: user.id,
      details: {
        judges_count: judges.length,
        teams_count: teams.length,
        assigned_pairs_count: newAssignments.length,
        judges_per_team: judgesPerTeam,
        round_id: activeRoundId,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/assignments");
  revalidatePath("/admin/users");
  revalidatePath("/judge");

  return {
    success: true,
    teamsCount: teams.length,
    judgesCount: judges.length,
    totalAssignments: newAssignments.length,
    round_id: activeRoundId,
  };
}
