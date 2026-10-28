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
  assigned_team_ids: string[];
}

export interface TeamOption {
  id: string;
  name: string;
  code?: string | null;
  track?: string | null;
  assigned_judge_ids: string[];
  assigned_judge_names?: string[];
}

export interface JudgeAssignmentsData {
  judges: JudgeOption[];
  teams: TeamOption[];
}

export async function getJudgeAssignmentsData(): Promise<JudgeAssignmentsData> {
  try {
    // Accessible by admins as well as operational staff / club members
    await requireOperationsRole();
  } catch {
    try {
      await requireAdmin();
    } catch (err) {
      console.warn("getJudgeAssignmentsData auth notice:", err);
      return { judges: [], teams: [] };
    }
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
        .select("judge_id, team_id"),
    ]);

    const assignments = assignmentsRes.data || [];

    // Map judge -> array of team_ids
    const judgeToTeams = new Map<string, string[]>();
    // Map team -> array of judge_ids
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

    return { judges, teams };
  };

  const timeoutPromise = new Promise<JudgeAssignmentsData>((resolve) =>
    setTimeout(() => resolve({ judges: [], teams: [] }), 3000)
  );

  return Promise.race([fetchData(), timeoutPromise]);
}

export async function updateJudgeTeams(data: {
  judgeId: string;
  teamIds: string[];
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  // 1. Delete all existing assignments for this judge
  const { error: deleteError } = await supabaseAdmin
    .from("judge_assignments")
    .delete()
    .eq("judge_id", data.judgeId);

  if (deleteError) {
    throw new Error(`Failed to reset existing judge assignments: ${deleteError.message}`);
  }

  // 2. Insert new assignments if any
  if (data.teamIds.length > 0) {
    const rows = data.teamIds.map((tId) => ({
      judge_id: data.judgeId,
      team_id: tId,
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
  assign: boolean;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  if (data.assign) {
    const { error } = await supabaseAdmin
      .from("judge_assignments")
      .upsert(
        { judge_id: data.judgeId, team_id: data.teamId, assigned_at: new Date().toISOString() },
        { onConflict: "judge_id,team_id" }
      );
    if (error) throw new Error(`Failed to assign team: ${error.message}`);
  } else {
    const { error } = await supabaseAdmin
      .from("judge_assignments")
      .delete()
      .eq("judge_id", data.judgeId)
      .eq("team_id", data.teamId);
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
 */
export async function autoBalanceJudgeAssignments(options: {
  judgesPerTeam?: number;
  clearExisting?: boolean;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
} = {}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(options[CSRF_CONSTANTS.HEADER_NAME] || null);
  const judgesPerTeam = Math.max(1, options.judgesPerTeam || 2);

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

  // 2. Clear existing assignments if requested
  if (options.clearExisting) {
    await supabaseAdmin.from("judge_assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  // 3. Round-robin assignment balancing
  const judgeLoads = new Map<string, number>();
  judges.forEach((j) => judgeLoads.set(j.id, 0));

  const newAssignments: Array<{ judge_id: string; team_id: string; assigned_at: string }> = [];

  for (const team of teams) {
    // Sort judges by lowest current load
    const availableJudges = [...judges]
      .filter((j) => !conflicts.has(`${j.id}_${team.id}`))
      .sort((a, b) => (judgeLoads.get(a.id) || 0) - (judgeLoads.get(b.id) || 0));

    const selectedJudges = availableJudges.slice(0, Math.min(judgesPerTeam, availableJudges.length));

    for (const judge of selectedJudges) {
      newAssignments.push({
        judge_id: judge.id,
        team_id: team.id,
        assigned_at: new Date().toISOString(),
      });
      judgeLoads.set(judge.id, (judgeLoads.get(judge.id) || 0) + 1);
    }
  }

  if (newAssignments.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("judge_assignments")
      .upsert(newAssignments, { onConflict: "judge_id,team_id" });

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
  };
}

