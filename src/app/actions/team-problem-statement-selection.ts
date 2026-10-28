"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkServerActionRateLimit, SERVER_ACTION_RATE_LIMITS } from "@/lib/rate-limit";

export async function selectProblemStatement(statementId: string) {
  const { user, teamId, role } = await requireAuthenticatedTeamUser();

  if (!teamId) {
    throw new Error("You must belong to a team to select a problem statement.");
  }
  if (role !== "leader") {
    throw new Error("Only team leaders can select a problem statement.");
  }

  const rateLimit = checkServerActionRateLimit(
    user.id,
    "problemStatementSelect",
    SERVER_ACTION_RATE_LIMITS.problemStatementSelect.maxRequests,
    SERVER_ACTION_RATE_LIMITS.problemStatementSelect.windowMs
  );
  if (!rateLimit.success) {
    throw new Error("Too many selection attempts. Please try again later.");
  }

  // Fetch the problem statement details
  const { data: statement, error } = await supabaseAdmin
    .from("problem_statements")
    .select("*")
    .eq("id", statementId)
    .eq("status", "published")
    .maybeSingle();

  if (error || !statement) {
    throw new Error("Problem statement not found or not published.");
  }

  if (statement.enable_selection === false) {
    throw new Error("Team selection is disabled for this problem statement.");
  }
  if (statement.manual_lock === true) {
    throw new Error("This problem statement is locked and cannot be selected.");
  }

  const now = Date.now();
  if (statement.selection_opening) {
    const opening = new Date(statement.selection_opening).getTime();
    if (!Number.isNaN(opening) && now < opening) {
      throw new Error("Selection for this problem statement has not opened yet.");
    }
  }
  if (statement.selection_closing) {
    const closing = new Date(statement.selection_closing).getTime();
    if (!Number.isNaN(closing) && now > closing) {
      throw new Error("Selection for this problem statement has closed.");
    }
  }

  // --- Capacity enforcement ---
  // If a team limit is set, ensure the statement hasn't reached its quota.
  // We count distinct teams already assigned to this statement, excluding the current team (if it already has an assignment).
  if (statement.team_limit !== null && statement.team_limit !== undefined) {
    const { data: existingAssignments, error: countError } = await supabaseAdmin
      .from("team_problem_statement_assignments")
      .select("team_id")
      .eq("problem_statement_id", statementId);
    if (countError) {
      throw new Error("Failed to verify problem statement capacity.");
    }
    const assignedTeams = (existingAssignments || []).map((row: any) => row.team_id);
    const otherTeamsCount = assignedTeams.filter((t: string) => t !== teamId).length;
    if (otherTeamsCount >= statement.team_limit) {
      throw new Error(`Problem statement capacity reached (limit ${statement.team_limit}).`);
    }
  }

  // Attempt to allocate – upsert ensures a single assignment per team.
  const { error: assignmentError } = await supabaseAdmin
    .from("team_problem_statement_assignments")
    .upsert(
      {
        team_id: teamId,
        problem_statement_id: statementId,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "team_id" }
    );

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  revalidatePath("/team/problem-statements");
  return { success: true };
}
