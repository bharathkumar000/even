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
