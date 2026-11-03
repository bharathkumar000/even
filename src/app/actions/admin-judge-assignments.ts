"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

/** A team together with its assigned judges for a specific round. */
export interface JudgeAssignmentGridRow {
  team_id: string;
  team_name: string;
  team_code: string | null;
  track: string | null;
  round_id: string;
  judge_1_id: string | null;
  judge_1_name: string | null;
  judge_1_email: string | null;
  judge_2_id: string | null;
  judge_2_name: string | null;
  judge_2_email: string | null;
  assigned_count: number; // 0, 1 or 2
  status: "unassigned" | "partial" | "complete";
  judge_1_evaluation_id: string | null;
  judge_1_evaluation_status: string | null;
  judge_2_evaluation_id: string | null;
  judge_2_evaluation_status: string | null;
}

/** Aggregate stats for the admin dashboard. */
export interface JudgeAssignmentStats {
  total_teams: number;
  required_slots: number; // total_teams * 2
  filled_slots: number;
  remaining_slots: number;
  fully_assigned: number;
  partially_assigned: number;
  unassigned: number;
}

export interface JudgeSummary {
  id: string;
  full_name: string | null;
  email: string | null;
  assigned_team_count: number;
}

/**
 * Fetch the full assignment grid for a round: every team with its two judge
 * slots, assignment status, and any existing evaluations per judge.
 */
export async function getJudgeAssignmentGrid(roundId: string): Promise<JudgeAssignmentGridRow[]> {
  await requireAdmin();

  const [teamsRes, assignmentsRes, judgesRes, evalsRes] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, name, code, track")
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("judge_assignments")
      .select("judge_id, team_id, round_id")
      .eq("round_id", roundId),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("role", "judge"),
    supabaseAdmin
      .from("evaluations")
      .select("id, team_id, judge_id, round_id, status")
      .eq("round_id", roundId),
  ]);

  const teams = teamsRes.data || [];
  const assignments = assignmentsRes.data || [];
  const judges = judgesRes.data || [];
  const evaluations = evalsRes.data || [];

  const judgeMap = new Map<string, { full_name: string | null; email: string | null }>();
  judges.forEach((j) => judgeMap.set(j.id, { full_name: j.full_name, email: j.email }));

  // team_id -> [judge_id, ...] (max 2 enforced at DB level)
  const teamToJudges = new Map<string, string[]>();
  assignments.forEach((a) => {
    if (!teamToJudges.has(a.team_id)) teamToJudges.set(a.team_id, []);
    teamToJudges.get(a.team_id)!.push(a.judge_id);
  });

  // (team_id, judge_id) -> evaluation
  const evalMap = new Map<string, { id: string; status: string }>();
  evaluations.forEach((e) => {
    evalMap.set(`${e.team_id}|${e.judge_id}`, { id: e.id, status: e.status });
  });

  return teams.map((t) => {
    const judgeIds = teamToJudges.get(t.id) || [];
    const j1Id = judgeIds[0] || null;
    const j2Id = judgeIds[1] || null;
    const j1 = j1Id ? judgeMap.get(j1Id) : null;
    const j2 = j2Id ? judgeMap.get(j2Id) : null;
    const assignedCount = judgeIds.length;

    let status: JudgeAssignmentGridRow["status"];
    if (assignedCount === 0) status = "unassigned";
    else if (assignedCount === 1) status = "partial";
    else status = "complete";

    const e1 = evalMap.get(`${t.id}|${j1Id}`);
    const e2 = evalMap.get(`${t.id}|${j2Id}`);

    return {
      team_id: t.id,
      team_name: t.name,
      team_code: t.code ?? null,
      track: t.track ?? null,
      round_id: roundId,
      judge_1_id: j1Id,
      judge_1_name: j1?.full_name ?? null,
      judge_1_email: j1?.email ?? null,
      judge_2_id: j2Id,
      judge_2_name: j2?.full_name ?? null,
      judge_2_email: j2?.email ?? null,
      assigned_count: assignedCount,
      status,
      judge_1_evaluation_id: e1?.id ?? null,
      judge_1_evaluation_status: e1?.status ?? null,
      judge_2_evaluation_id: e2?.id ?? null,
      judge_2_evaluation_status: e2?.status ?? null,
    };
  });
}

/** Fetch all judges with their current assigned-team count (across all rounds). */
export async function getJudgesSummary(): Promise<JudgeSummary[]> {
  await requireAdmin();

  const [judgesRes, assignmentsRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "judge")
      .order("full_name", { ascending: true }),
    supabaseAdmin.from("judge_assignments").select("judge_id"),
  ]);

  const judgeLoads = new Map<string, number>();
  (judgesRes.data || []).forEach((j) => judgeLoads.set(j.id, 0));
  (assignmentsRes.data || []).forEach((a) => {
    judgeLoads.set(a.judge_id, (judgeLoads.get(a.judge_id) || 0) + 1);
  });

  return (judgesRes.data || []).map((j) => ({
    id: j.id,
    full_name: j.full_name,
    email: j.email,
    assigned_team_count: judgeLoads.get(j.id) || 0,
  }));
}

/** Aggregate dashboard statistics for the dual-judge assignment system. */
export async function getJudgeAssignmentStats(roundId: string): Promise<JudgeAssignmentStats> {
  await requireAdmin();

  let totalTeams = 0;
  const teamsRes = await supabaseAdmin.from("teams").select("id", { count: "exact", head: true });
  if (teamsRes.error) {
    throw new Error(`Failed to load teams: ${teamsRes.error.message}`);
  }
  totalTeams = teamsRes.count ?? 0;

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from("judge_assignments")
    .select("team_id, judge_id")
    .eq("round_id", roundId);

  if (assignmentsError) {
    throw new Error(`Failed to load judge assignments: ${assignmentsError.message}`);
  }

  const safeAssignments = (assignments ?? []) as { team_id: string; judge_id: string }[];

  const teamToJudges = new Map<string, string[]>();
  safeAssignments.forEach((a) => {
    if (!teamToJudges.has(a.team_id)) teamToJudges.set(a.team_id, []);
    teamToJudges.get(a.team_id)!.push(a.judge_id);
  });

  let filledSlots = 0;
  let fullyAssigned = 0;
  let partiallyAssigned = 0;
  let unassigned = 0;

  teamToJudges.forEach((judgeIds) => {
    const count = judgeIds.length;
    filledSlots += count;
    if (count === 0) unassigned += 1;
    else if (count === 1) partiallyAssigned += 1;
    else fullyAssigned += 1;
  });
  // Teams with no assignment row at all count as unassigned.
  unassigned += totalTeams - teamToJudges.size;

  return {
    total_teams: totalTeams,
    required_slots: totalTeams * 2,
    filled_slots: filledSlots,
    remaining_slots: Math.max(0, totalTeams * 2 - filledSlots),
    fully_assigned: fullyAssigned,
    partially_assigned: partiallyAssigned,
    unassigned,
  };
}

/** Detailed assignments for a round: every team with its assigned judge IDs. */
export interface JudgeAssignmentDetail {
  team_id: string;
  team_name: string;
  team_code: string | null;
  track: string | null;
  judge_ids: string[];
  judge_names: (string | null)[];
  judge_emails: (string | null)[];
  assigned_count: number;
}

export async function getJudgeAssignmentsForRound(roundId: string): Promise<{
  assignments: JudgeAssignmentDetail[];
  error?: string;
}> {
  await requireAdmin();

  const [teamsRes, assignmentsRes, judgesRes] = await Promise.all([
    supabaseAdmin.from("teams").select("id, name, code, track").order("name", { ascending: true }),
    supabaseAdmin
      .from("judge_assignments")
      .select("team_id, judge_id")
      .eq("round_id", roundId),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "judge"),
  ]);

  if (teamsRes.error) {
    return { assignments: [], error: teamsRes.error.message };
  }
  if (assignmentsRes.error) {
    return { assignments: [], error: assignmentsRes.error.message };
  }
  if (judgesRes.error) {
    return { assignments: [], error: judgesRes.error.message };
  }

  const teams = teamsRes.data ?? [];
  const rawAssignments = assignmentsRes.data ?? [];
  const judges = judgesRes.data ?? [];

  const judgeMap = new Map<string, { full_name: string | null; email: string | null }>();
  judges.forEach((j) => judgeMap.set(j.id, { full_name: j.full_name, email: j.email }));

  const teamToJudges = new Map<string, string[]>();
  rawAssignments.forEach((a) => {
    if (!teamToJudges.has(a.team_id)) teamToJudges.set(a.team_id, []);
    teamToJudges.get(a.team_id)!.push(a.judge_id);
  });

  const assignments: JudgeAssignmentDetail[] = teams.map((t) => {
    const judgeIds = teamToJudges.get(t.id) ?? [];
    const judgeNames = judgeIds.map((id) => judgeMap.get(id)?.full_name ?? null);
    const judgeEmails = judgeIds.map((id) => judgeMap.get(id)?.email ?? null);
    return {
      team_id: t.id,
      team_name: t.name,
      team_code: t.code ?? null,
      track: t.track ?? null,
      judge_ids: judgeIds,
      judge_names: judgeNames,
      judge_emails: judgeEmails,
      assigned_count: judgeIds.length,
    };
  });

  return { assignments };
}

/** Judges with their assigned-team count for a specific round. */
export interface JudgeRoundLoad {
  id: string;
  full_name: string | null;
  email: string | null;
  assigned_team_count: number;
}

export async function getJudgesForRound(roundId: string): Promise<{
  judges: JudgeRoundLoad[];
  error?: string;
}> {
  await requireAdmin();

  const [judgesRes, assignmentsRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "judge")
      .order("full_name", { ascending: true }),
    supabaseAdmin
      .from("judge_assignments")
      .select("judge_id, team_id")
      .eq("round_id", roundId),
  ]);

  if (judgesRes.error) {
    return { judges: [], error: judgesRes.error.message };
  }
  if (assignmentsRes.error) {
    return { judges: [], error: assignmentsRes.error.message };
  }

  const judges = judgesRes.data ?? [];
  const rawAssignments = assignmentsRes.data ?? [];

  const judgeLoads = new Map<string, number>();
  judges.forEach((j) => judgeLoads.set(j.id, 0));
  rawAssignments.forEach((a) => {
    if (a.judge_id && judgeLoads.has(a.judge_id)) {
      judgeLoads.set(a.judge_id, (judgeLoads.get(a.judge_id) ?? 0) + 1);
    }
  });

  return {
    judges: judges.map((j) => ({
      id: j.id,
      full_name: j.full_name,
      email: j.email,
      assigned_team_count: judgeLoads.get(j.id) ?? 0,
    })),
  };
}

interface BatchAssignmentInput {
  roundId: string;
  assignments: Array<{ teamId: string; judgeId: string }>;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}

/** Batch-assign multiple judge-team pairs for a round. Each pair is validated
 * independently; existing assignments and the two-judge hard limit are respected.
 * Returns the list of successfully assigned pairs and any errors. */
export async function batchAssignJudges(input: BatchAssignmentInput): Promise<{
  assigned: Array<{ teamId: string; judgeId: string }>;
  errors: Array<{ teamId: string; judgeId: string; message: string }>;
}> {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { roundId, assignments } = input;

  // Validate round exists
  const { data: round, error: roundErr } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("id")
    .eq("id", roundId)
    .maybeSingle();
  if (roundErr || !round) {
    throw new Error("Evaluation round not found.");
  }

  const assigned: Array<{ teamId: string; judgeId: string }> = [];
  const errors: Array<{ teamId: string; judgeId: string; message: string }> = [];

  // Track in-memory counts to avoid duplicate inserts within this batch
  const teamJudgeSet = new Set<string>();
  const teamJudgeCount = new Map<string, number>();

  // Load existing assignments for this round once
  const { data: existingAssignments } = await supabaseAdmin
    .from("judge_assignments")
    .select("team_id, judge_id")
    .eq("round_id", roundId);

  const existingSet = new Set<string>();
  const existingCount = new Map<string, number>();
  (existingAssignments ?? []).forEach((a) => {
    existingSet.add(`${a.team_id}|${a.judge_id}`);
    existingCount.set(a.team_id, (existingCount.get(a.team_id) ?? 0) + 1);
  });

  for (const { teamId, judgeId } of assignments) {
    const key = `${teamId}|${judgeId}`;

    // Skip if already assigned (existing or in this batch)
    if (existingSet.has(key) || teamJudgeSet.has(key)) {
      continue;
    }

    // Validate team exists
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .maybeSingle();
    if (!team) {
      errors.push({ teamId, judgeId, message: "Team not found." });
      continue;
    }

    // Validate judge exists and has judge role
    const { data: judge } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", judgeId)
      .maybeSingle();
    if (!judge || judge.role !== "judge") {
      errors.push({ teamId, judgeId, message: "Not a valid judge." });
      continue;
    }

    // Enforce max 2 judges per team per round
    const currentCount = (existingCount.get(teamId) ?? 0) + (teamJudgeCount.get(teamId) ?? 0);
    if (currentCount >= 2) {
      errors.push({ teamId, judgeId, message: "Team already has 2 judges in this round." });
      continue;
    }

    // Insert the assignment
    const { error: insertErr } = await supabaseAdmin.from("judge_assignments").insert({
      judge_id: judgeId,
      team_id: teamId,
      round_id: roundId,
      assigned_at: new Date().toISOString(),
    });

    if (insertErr) {
      if (insertErr.message.includes("max_two_judges_per_team_round")) {
        errors.push({ teamId, judgeId, message: "Team already has 2 judges in this round." });
      } else if (insertErr.message.includes("uq_judge_team_round")) {
        errors.push({ teamId, judgeId, message: "Already assigned." });
      } else {
        errors.push({ teamId, judgeId, message: insertErr.message });
      }
      continue;
    }

    // Track success
    teamJudgeSet.add(key);
    teamJudgeCount.set(teamId, (teamJudgeCount.get(teamId) ?? 0) + 1);
    existingCount.set(teamId, (existingCount.get(teamId) ?? 0) + 1);
    assigned.push({ teamId, judgeId });
  }

  if (assigned.length > 0) {
    revalidatePath("/admin/assignments");
    revalidatePath("/admin/dashboard");
  }

  return { assigned, errors };
}

interface AutoBalanceInput {
  roundId: string;
  reset?: boolean;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}

/** Auto-distribute teams across available judges as evenly as possible for the
 * selected round. Respects existing assignments unless reset=true. Fills only
 * missing slots (up to 2 judges per team). Returns a preview of proposed
 * allocations before committing them. */
export async function autoBalanceJudges(input: AutoBalanceInput): Promise<{
  proposed: Array<{
    teamId: string;
    teamName: string;
    judgeId: string;
    judgeName: string;
  }>;
  assigned: Array<{ teamId: string; judgeId: string }>;
  errors: Array<{ teamId: string; judgeId: string; message: string }>;
  message: string;
}> {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { roundId, reset = false } = input;

  // Validate round exists
  const { data: round, error: roundErr } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("id")
    .eq("id", roundId)
    .maybeSingle();
  if (roundErr || !round) {
    throw new Error("Evaluation round not found.");
  }

  // Get all teams
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, name")
    .order("name", { ascending: true });
  if (teamsError) {
    throw new Error(`Failed to load teams: ${teamsError.message}`);
  }
  const allTeams = teams ?? [];

  // Get all judges
  const { data: judges, error: judgesError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "judge")
    .order("full_name", { ascending: true });
  if (judgesError) {
    throw new Error(`Failed to load judges: ${judgesError.message}`);
  }
  const allJudges = judges ?? [];

  if (allJudges.length === 0) {
    throw new Error("No judges available for auto-balance.");
  }

  // Get existing assignments for this round
  const { data: existingAssignments } = await supabaseAdmin
    .from("judge_assignments")
    .select("team_id, judge_id")
    .eq("round_id", roundId);

  const teamToExistingJudges = new Map<string, Set<string>>();

  if (!reset) {
    (existingAssignments ?? []).forEach((a) => {
      if (!teamToExistingJudges.has(a.team_id)) {
        teamToExistingJudges.set(a.team_id, new Set());
      }
      teamToExistingJudges.get(a.team_id)!.add(a.judge_id);
    });
  }

  // Build proposed assignments: fill missing slots for each team
  const proposed: Array<{
    teamId: string;
    teamName: string;
    judgeId: string;
    judgeName: string;
  }> = [];

  // Round-robin judge index for even distribution
  let judgeIdx = 0;

  for (const team of allTeams) {
    const existingJudges = teamToExistingJudges.get(team.id) ?? new Set();
    const needed = 2 - existingJudges.size;
    if (needed <= 0) continue;

    // Find judges not already assigned to this team, starting from round-robin index
    const availableJudges = allJudges.filter((j) => !existingJudges.has(j.id));
    if (availableJudges.length === 0) continue;

    let added = 0;
    let attempts = 0;
    while (added < needed && attempts < availableJudges.length) {
      const judge = availableJudges[judgeIdx % availableJudges.length];
      judgeIdx++;
      attempts++;

      // Skip if already in proposed for this team
      if (existingJudges.has(judge.id)) continue;
      if (proposed.some((p) => p.teamId === team.id && p.judgeId === judge.id)) continue;

      proposed.push({
        teamId: team.id,
        teamName: team.name,
        judgeId: judge.id,
        judgeName: judge.full_name || judge.email,
      });
      existingJudges.add(judge.id);
      added++;
    }
  }

  // Commit the proposed assignments via batchAssignJudges (re-validates CSRF)
  const { assigned, errors } = await batchAssignJudges({
    roundId,
    assignments: proposed.map((p) => ({ teamId: p.teamId, judgeId: p.judgeId })),
    [CSRF_CONSTANTS.HEADER_NAME]: input[CSRF_CONSTANTS.HEADER_NAME],
  });

  return {
    proposed,
    assigned,
    errors,
    message: `Auto-balance committed ${assigned.length} assignment(s) for round ${roundId}.`,
  };
}

/**
 * Assign a judge to a team for a round.
 *
 * Validation:
 *   * team and round must exist
 *   * the account must have the judge role
 *   * the judge must not already be assigned to this team/round
 *   * fewer than two judges must already be assigned (DB trigger is the final guard)
 */
export async function assignJudgeToTeam(data: {
  roundId: string;
  teamId: string;
  judgeId: string;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { roundId, teamId, judgeId } = data;

  // 1. Team must exist
  const { data: team, error: teamErr } = await supabaseAdmin
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .maybeSingle();
  if (teamErr || !team) {
    throw new Error("Team not found.");
  }

  // 2. Round must exist
  const { data: round, error: roundErr } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("id")
    .eq("id", roundId)
    .maybeSingle();
  if (roundErr || !round) {
    throw new Error("Evaluation round not found.");
  }

  // 3. Judge must have the judge role
  const { data: judge, error: judgeErr } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", judgeId)
    .maybeSingle();
  if (judgeErr || !judge || judge.role !== "judge") {
    throw new Error("Selected account is not a judge.");
  }

  // 4. Judge must not already be assigned to this team in this round.
  const { data: existing } = await supabaseAdmin
    .from("judge_assignments")
    .select("id")
    .eq("team_id", teamId)
    .eq("round_id", roundId)
    .eq("judge_id", judgeId)
    .maybeSingle();
  if (existing) {
    throw new Error(
      `${judge.full_name || judge.email} is already assigned to this team in this round.`
    );
  }

  // 5. Fewer than two judges may already be assigned (DB trigger enforces this too).
  const { count: currentCount } = await supabaseAdmin
    .from("judge_assignments")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("round_id", roundId);

  if ((currentCount || 0) >= 2) {
    throw new Error(
      "This team already has 2 judges assigned in this round. No third judge can be added."
    );
  }

  // 6. Insert the assignment (trigger is the final concurrency-safe guard).
  const { error: insertErr } = await supabaseAdmin.from("judge_assignments").insert({
    judge_id: judgeId,
    team_id: teamId,
    round_id: roundId,
    assigned_at: new Date().toISOString(),
  });
  if (insertErr) {
    // Surface the DB trigger message when a concurrent third assignment is attempted.
    throw new Error(
      insertErr.message.includes("max_two_judges_per_team_round")
        ? "This team already has 2 judges assigned in this round. A third judge cannot be added."
        : `Failed to assign judge: ${insertErr.message}`
    );
  }

  // Audit log (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "ASSIGN_JUDGE_TO_TEAM",
      entity_type: "judge_assignments",
      entity_id: teamId,
      admin_id: user.id,
      details: {
        judge_id: judgeId,
        judge_name: judge.full_name || judge.email,
        team_id: teamId,
        round_id: roundId,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/assignments");
  revalidatePath("/admin/dashboard");

  return {
    success: true,
    judge: { id: judgeId, name: judge.full_name || judge.email, email: judge.email },
    team: { id: teamId, name: team.name || "" },
    round_id: roundId,
  };
}

/**
 * Remove a judge's assignment from a team in a round.
 *
 * If an evaluation already exists for (round, team, judge), removal is rejected
 * unless `confirmed` is true, preserving evaluation history.
 */
export async function removeJudgeFromTeam(data: {
  roundId: string;
  teamId: string;
  judgeId: string;
  confirmed?: boolean;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { roundId, teamId, judgeId, confirmed = false } = data;

  // 1. The assignment must exist.
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("judge_assignments")
    .select("id")
    .eq("team_id", teamId)
    .eq("round_id", roundId)
    .eq("judge_id", judgeId)
    .maybeSingle();
  if (fetchErr || !existing) {
    throw new Error("No assignment found for this judge, team and round.");
  }

  // 2. If an evaluation exists, require explicit confirmation before removing.
  const { data: evaluation } = await supabaseAdmin
    .from("evaluations")
    .select("id, status, total_score")
    .eq("round_id", roundId)
    .eq("team_id", teamId)
    .eq("judge_id", judgeId)
    .maybeSingle();

  if (evaluation && !confirmed) {
    throw new Error(
      `An evaluation (status: ${evaluation.status}, score: ${evaluation.total_score ?? 0}) already exists for this judge on this team. ` +
        "Confirm to remove the assignment and preserve evaluation history."
    );
  }

  // 3. Delete the assignment.
  const { error: deleteErr } = await supabaseAdmin
    .from("judge_assignments")
    .delete()
    .eq("id", existing.id);
  if (deleteErr) {
    throw new Error(`Failed to remove assignment: ${deleteErr.message}`);
  }

  // Audit log (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "REMOVE_JUDGE_FROM_TEAM",
      entity_type: "judge_assignments",
      entity_id: teamId,
      admin_id: user.id,
      details: {
        judge_id: judgeId,
        team_id: teamId,
        round_id: roundId,
        evaluation_preserved: Boolean(evaluation),
        confirmed,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/assignments");
  revalidatePath("/admin/dashboard");

  return { success: true, evaluation_preserved: Boolean(evaluation) };
}

/**
 * Replace judge A with judge B for a team in a round.
 * Requires confirmation if judge A has an existing evaluation.
 */
/**
 * Delete ALL judge assignments for a given evaluation round.
 * Removes every judge-team assignment row for that round. Existing evaluations
 * are preserved (their judge_id is kept for history) but the assignments are
 * gone, so teams return to unassigned status for that round.
 */
export async function deleteAllJudgeAssignments(data: {
  roundId: string;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { roundId } = data;

  // Validate round exists
  const { data: round, error: roundErr } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("id")
    .eq("id", roundId)
    .maybeSingle();
  if (roundErr || !round) {
    throw new Error("Evaluation round not found.");
  }

  // Delete all assignments for this round
  const { error: deleteErr } = await supabaseAdmin
    .from("judge_assignments")
    .delete()
    .eq("round_id", roundId);
  if (deleteErr) {
    throw new Error(`Failed to delete assignments: ${deleteErr.message}`);
  }

  // Audit log (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "DELETE_ALL_JUDGE_ASSIGNMENTS",
      entity_type: "judge_assignments",
      entity_id: roundId,
      admin_id: user.id,
      details: { round_id: roundId },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/assignments");
  revalidatePath("/admin/dashboard");

  return { success: true, round_id: roundId };
}

export async function replaceJudgeAssignment(data: {
  roundId: string;
  teamId: string;
  fromJudgeId: string;
  toJudgeId: string;
  confirmed?: boolean;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { roundId, teamId, fromJudgeId, toJudgeId, confirmed = false } = data;

  if (fromJudgeId === toJudgeId) {
    throw new Error("The replacement judge must be different from the current judge.");
  }

  // Remove the existing judge (respects evaluation-history confirmation).
  await removeJudgeFromTeam({
    roundId,
    teamId,
    judgeId: fromJudgeId,
    confirmed,
    [CSRF_CONSTANTS.HEADER_NAME]: data[CSRF_CONSTANTS.HEADER_NAME],
  });

  // Assign the new judge.
  const result = await assignJudgeToTeam({
    roundId,
    teamId,
    judgeId: toJudgeId,
    [CSRF_CONSTANTS.HEADER_NAME]: data[CSRF_CONSTANTS.HEADER_NAME],
  });

  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "REPLACE_JUDGE_ASSIGNMENT",
      entity_type: "judge_assignments",
      entity_id: teamId,
      admin_id: user.id,
      details: {
        from_judge_id: fromJudgeId,
        to_judge_id: toJudgeId,
        team_id: teamId,
        round_id: roundId,
        confirmed,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/assignments");
  revalidatePath("/admin/dashboard");

  return result;
}
