"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { EvaluationOverrideSchema } from "@/lib/validations/admin";
import { z } from "zod";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export type EvaluationOverrideInput = z.infer<typeof EvaluationOverrideSchema>;

export async function overrideEvaluationStatus(data: EvaluationOverrideInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
  const validated = EvaluationOverrideSchema.parse(data);

  // 1. Fetch current evaluation record for audit diffing
  const { data: previousEvaluation, error: fetchError } = await supabaseAdmin
    .from("evaluations")
    .select("*")
    .eq("id", validated.evaluation_id)
    .single();

  if (fetchError || !previousEvaluation) {
    throw new Error(`Evaluation not found: ${fetchError?.message || "Invalid ID"}`);
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
    throw new Error(`Failed to update evaluation status: ${updateError.message}`);
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
