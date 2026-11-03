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

function logEvalAction(operation: string, details: Record<string, unknown>) {
  console.log(`[EVAL:${operation}]`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
}

function logEvalError(operation: string, error: Error | string, context: Record<string, unknown>) {
  console.error(`[EVAL:${operation}:ERROR]`, {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    ...context,
  });
}

export async function saveOrSubmitEvaluation(
  data: SubmitEvaluationInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }
): Promise<EvaluationActionResult> {
  const operation = "saveOrSubmitEvaluation";
  
  // Declare variables accessible in catch block
  let validated: any = null;
  let judgeUserId: string | null = null;

  try {
    // 1. Validate input schema first (need round_id for auth check)
    const parsed = SubmitEvaluationSchema.safeParse(data);
    if (!parsed.success) {
      const errMessage =
        parsed.error.issues.map((i) => i.message).join(", ") || "Invalid evaluation data";
      logEvalAction("validation_failed", { error: errMessage });
      return { success: false, error: errMessage };
    }
    validated = parsed.data;

    logEvalAction("input_validated", {
      round_id: validated.round_id,
      team_id: validated.team_id,
      score_count: validated.scores.length,
      is_draft: validated.is_draft,
    });

    try {
      await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
    } catch (csrfErr) {
      console.warn("[CSRF] saveOrSubmitEvaluation notice:", csrfErr);
    }

    // 2. Verify judge authentication & team assignment
    let { user } = await requireActiveJudgeForTeam(validated.team_id, validated.round_id);
    judgeUserId = user.id;

    logEvalAction("judge_authenticated", {
      judge_id: judgeUserId,
      team_id: validated.team_id,
      round_id: validated.round_id,
    });

    // 3. Verify evaluation round is open for scoring
    const { data: round, error: roundError } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("status, title, event_id")
      .eq("id", validated.round_id)
      .single();

    if (roundError || !round) {
      const errMsg = `Round not found: ${roundError?.message || "Invalid round ID"}`;
      logEvalAction("round_not_found", {
        round_id: validated.round_id,
        judge_id: judgeUserId,
        team_id: validated.team_id,
        supabase_error: roundError?.message,
        supabase_code: (roundError as { code?: string })?.code,
      });
      return { success: false, error: errMsg };
    }

    logEvalAction("round_loaded", {
      round_id: validated.round_id,
      round_title: round.title,
      round_status: round.status,
      event_id: round.event_id,
    });

    if (round.status !== "open" && round.status !== "reopened") {
      const errMsg = `Evaluation round "${round.title}" is currently ${round.status.toUpperCase()}. Edits are locked.`;
      logEvalAction("round_not_open", {
        round_id: validated.round_id,
        round_status: round.status,
        judge_id: judgeUserId,
      });
      return { success: false, error: errMsg };
    }

    // 4. Fetch criteria to validate scoring bounds
    const { data: criteria, error: critError } = await supabaseAdmin
      .from("evaluation_criteria")
      .select("id, title, max_marks")
      .eq("round_id", validated.round_id);

    if (critError || !criteria || criteria.length === 0) {
      const errMsg = `Failed to load evaluation criteria: ${critError?.message || "No criteria configured"}`;
      logEvalAction("criteria_load_failed", {
        round_id: validated.round_id,
        judge_id: judgeUserId,
        supabase_error: critError?.message,
        supabase_code: (critError as { code?: string })?.code,
      });
      return { success: false, error: errMsg };
    }

    const criteriaMap = new Map<string, number>(criteria.map((c) => [c.id, c.max_marks]));

    let totalScore = 0;
    for (const item of validated.scores) {
      const maxMarks = criteriaMap.get(item.criterion_id);
      if (maxMarks === undefined) {
        const errMsg = `Invalid criterion ID: ${item.criterion_id}`;
        logEvalAction("invalid_criterion", {
          round_id: validated.round_id,
          criterion_id: item.criterion_id,
          judge_id: judgeUserId,
        });
        return { success: false, error: errMsg };
      }
      if (item.score > maxMarks) {
        const errMsg = `Score (${item.score}) exceeds maximum allowed mark (${maxMarks}) for criterion`;
        logEvalAction("score_exceeds_max", {
          round_id: validated.round_id,
          criterion_id: item.criterion_id,
          score: item.score,
          max_marks: maxMarks,
          judge_id: judgeUserId,
        });
        return { success: false, error: errMsg };
      }
      totalScore += item.score;
    }

    // 5a. Dynamic max mark cap per judge based on round criteria
    const maxPossibleScore = criteria.reduce((sum, c) => sum + (c.max_marks || 0), 0);
    if (maxPossibleScore > 0 && totalScore > maxPossibleScore) {
      const errMsg = `Total score (${totalScore}) exceeds the maximum possible (${maxPossibleScore}) for this round`;
      logEvalAction("total_score_exceeds_max", {
        round_id: validated.round_id,
        total_score: totalScore,
        max_possible_score: maxPossibleScore,
        judge_id: judgeUserId,
      });
      return { success: false, error: errMsg };
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
          judge_id: judgeUserId,
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
      const errMsg = `Failed to record evaluation: ${evalError.message}`;
      logEvalAction("upsert_failed", {
        round_id: validated.round_id,
        team_id: validated.team_id,
        judge_id: judgeUserId,
        total_score: totalScore,
        status: evaluationStatus,
        supabase_error: evalError.message,
        supabase_code: (evalError as { code?: string })?.code,
        supabase_details: (evalError as { details?: string })?.details,
        supabase_hint: (evalError as { hint?: string })?.hint,
      });
      return { success: false, error: errMsg };
    }

    logEvalAction("upsert_succeeded", {
      round_id: validated.round_id,
      team_id: validated.team_id,
      judge_id: judgeUserId,
      evaluation_id: evaluation?.id,
      total_score: totalScore,
      status: evaluationStatus,
    });

    // Revalidate judge portal paths cleanly
    try {
      revalidatePath("/judge");
      revalidatePath(`/judge/evaluate/${validated.team_id}`);
    } catch (e) {
      console.warn("revalidatePath notice:", e);
    }

    return { evaluation, success: true, status: evaluationStatus };
  } catch (err: unknown) {
    const errMsg =
      err instanceof Error ? err.message : "An unexpected error occurred while saving evaluation.";
    logEvalError("unhandled_error", err instanceof Error ? err : new Error(errMsg), {
      round_id: validated?.round_id,
      team_id: validated?.team_id,
      judge_id: judgeUserId,
      error_type: err instanceof Error ? err.constructor.name : typeof err,
    });
    console.error("[saveOrSubmitEvaluation error]:", err);
    return {
      success: false,
      error: errMsg,
    };
  }
}
