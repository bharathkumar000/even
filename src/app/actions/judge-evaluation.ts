"use server";

import { requireActiveJudgeForTeam } from "@/lib/auth/judge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  SubmitEvaluationSchema,
  type SubmitEvaluationInput,
} from "@/lib/validations/evaluation";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export async function saveOrSubmitEvaluation(data: SubmitEvaluationInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }) {
  // 1. Verify judge authentication & team assignment
  const { user } = await requireActiveJudgeForTeam(data.team_id);
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  // 2. Validate input schema
  const validated = SubmitEvaluationSchema.parse(data);

  // 3. Verify evaluation round is open for scoring
  const { data: round, error: roundError } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("status, title")
    .eq("id", validated.round_id)
    .single();

  if (roundError || !round) {
    throw new Error(`Round not found: ${roundError?.message || "Invalid round ID"}`);
  }

  if (round.status !== "open" && round.status !== "reopened") {
    throw new Error(
      `Evaluation round "${round.title}" is currently ${round.status.toUpperCase()}. Edits are locked.`
    );
  }

  // 4. Fetch criteria to validate scoring bounds
  const { data: criteria, error: critError } = await supabaseAdmin
    .from("evaluation_criteria")
    .select("id, title, max_marks")
    .eq("round_id", validated.round_id);

  if (critError || !criteria) {
    throw new Error(`Failed to load evaluation criteria: ${critError?.message}`);
  }

  const criteriaMap = new Map<string, number>(criteria.map((c) => [c.id, c.max_marks]));

  let totalScore = 0;
  for (const item of validated.scores) {
    const maxMarks = criteriaMap.get(item.criterion_id);
    if (maxMarks === undefined) {
      throw new Error(`Invalid criterion ID: ${item.criterion_id}`);
    }
    if (item.score > maxMarks) {
      throw new Error(`Score (${item.score}) exceeds maximum allowed mark (${maxMarks}) for criterion`);
    }
    totalScore += item.score;
  }

  // 5. Determine status
  const evaluationStatus = validated.is_draft ? "draft" : "submitted";

  // 6. Upsert evaluation record
  const { data: evaluation, error: evalError } = await supabaseAdmin
    .from("evaluations")
    .upsert(
      {
        round_id: validated.round_id,
        team_id: validated.team_id,
        judge_id: user.id,
        total_score: totalScore,
        status: evaluationStatus,
        feedback: validated.feedback || null,
        scores_breakdown: validated.scores,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "round_id,team_id,judge_id" }
    )
    .select()
    .single();

  if (evalError) {
    throw new Error(`Failed to record evaluation: ${evalError.message}`);
  }

  return { evaluation, success: true, status: evaluationStatus };
}
