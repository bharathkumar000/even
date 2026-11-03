"use server";

import { requireActiveJudgeForTeam } from "@/lib/auth/judge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  SubmitEvaluationSchema,
  type SubmitEvaluationInput,
} from "@/lib/validations/evaluation";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { revalidatePath } from "next/cache";

export interface EvaluationActionResult {
  success: boolean;
  evaluation?: any;
  status?: string;
  error?: string;
}

export async function saveOrSubmitEvaluation(
  data: SubmitEvaluationInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }
): Promise<EvaluationActionResult> {
  try {
    // 1. Validate input schema first (need round_id for auth check)
    const parsed = SubmitEvaluationSchema.safeParse(data);
    if (!parsed.success) {
      const errMessage =
        parsed.error.issues.map((i) => i.message).join(", ") || "Invalid evaluation data";
      return { success: false, error: errMessage };
    }
    const validated = parsed.data;

    try {
      await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
    } catch (csrfErr) {
      console.warn("[CSRF] saveOrSubmitEvaluation notice:", csrfErr);
    }

    // 2. Verify judge authentication & team assignment (for this round)
    const { user } = await requireActiveJudgeForTeam(validated.team_id, validated.round_id);

    // 3. Verify evaluation round is open for scoring
    const { data: round, error: roundError } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("status, title, event_id")
      .eq("id", validated.round_id)
      .single();

    if (roundError || !round) {
      return {
        success: false,
        error: `Round not found: ${roundError?.message || "Invalid round ID"}`,
      };
    }

    if (round.status !== "open" && round.status !== "reopened") {
      return {
        success: false,
        error: `Evaluation round "${round.title}" is currently ${round.status.toUpperCase()}. Edits are locked.`,
      };
    }

    // 4. Fetch criteria to validate scoring bounds
    const { data: criteria, error: critError } = await supabaseAdmin
      .from("evaluation_criteria")
      .select("id, title, max_marks")
      .eq("round_id", validated.round_id);

    if (critError || !criteria || criteria.length === 0) {
      return {
        success: false,
        error: `Failed to load evaluation criteria: ${critError?.message || "No criteria configured"}`,
      };
    }

    const criteriaMap = new Map<string, number>(criteria.map((c) => [c.id, c.max_marks]));

    let totalScore = 0;
    for (const item of validated.scores) {
      const maxMarks = criteriaMap.get(item.criterion_id);
      if (maxMarks === undefined) {
        return {
          success: false,
          error: `Invalid criterion ID: ${item.criterion_id}`,
        };
      }
      if (item.score > maxMarks) {
        return {
          success: false,
          error: `Score (${item.score}) exceeds maximum allowed mark (${maxMarks}) for criterion`,
        };
      }
      totalScore += item.score;
    }

    // 5a. Dynamic max mark cap per judge based on round criteria
    const maxPossibleScore = criteria.reduce((sum, c) => sum + (c.max_marks || 0), 0);
    if (maxPossibleScore > 0 && totalScore > maxPossibleScore) {
      return {
        success: false,
        error: `Total score (${totalScore}) exceeds the maximum possible (${maxPossibleScore}) for this round`,
      };
    }

    // 5. Determine status
    const evaluationStatus = validated.is_draft ? "draft" : "submitted";

    // 6. Upsert evaluation record (writing both scores and scores_breakdown for schema compatibility)
    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from("evaluations")
      .upsert(
        {
          round_id: validated.round_id,
          team_id: validated.team_id,
          judge_id: user.id,
          event_id: round.event_id || null,
          scores: validated.scores,
          scores_breakdown: validated.scores,
          total_score: totalScore,
          status: evaluationStatus,
          feedback: validated.feedback || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "round_id,team_id,judge_id" }
      )
      .select()
      .single();

    if (evalError) {
      return {
        success: false,
        error: `Failed to record evaluation: ${evalError.message}`,
      };
    }

    // Revalidate judge portal paths cleanly
    try {
      revalidatePath("/judge");
      revalidatePath(`/judge/evaluate/${validated.team_id}`);
    } catch (e) {
      console.warn("revalidatePath notice:", e);
    }

    return { evaluation, success: true, status: evaluationStatus };
  } catch (err: unknown) {
    console.error("[saveOrSubmitEvaluation error]:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving evaluation.",
    };
  }
}
