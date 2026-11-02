"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  RoundSchema,
  CriterionSchema,
  UpdateCriterionSchema,
} from "@/lib/validations/admin";
import { z } from "zod";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { revalidatePath } from "next/cache";

export type RoundInput = z.infer<typeof RoundSchema>;
export type CriterionInput = z.infer<typeof CriterionSchema>;
export type UpdateCriterionInput = z.infer<typeof UpdateCriterionSchema>;
export type RoundStatus = z.infer<typeof RoundSchema>["status"];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RoundActionResult<T = any> {
  success: boolean;
  round?: T;
  criterion?: T;
  data?: T;
  id?: string;
  error?: string;
}

export async function createRound(
  data: (RoundInput | Record<string, any>) & { [CSRF_CONSTANTS.HEADER_NAME]?: string }
): Promise<RoundActionResult> {
  try {
    const { user } = await requireAdmin();
    try {
      await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
    } catch (csrfErr) {
      console.warn("[CSRF] createRound notice:", csrfErr);
    }

    const parsed = RoundSchema.safeParse(data);
    if (!parsed.success) {
      const errMessage = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid round data.";
      return { success: false, error: errMessage };
    }

    const validated = parsed.data;

    // Resolve event_id with auto-fallback to active event
    let eventId = validated.event_id;
    if (!eventId || !UUID_REGEX.test(eventId)) {
      const { data: defaultEvent } = await supabaseAdmin
        .from("events")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      eventId = defaultEvent?.id || "11111111-1111-1111-1111-111111111111";
    }

    const roundPayload = {
      title: validated.title,
      sequence_order: validated.sequence_order,
      status: validated.status,
      event_id: eventId,
    };

    const { data: round, error } = await supabaseAdmin
      .from("evaluation_rounds")
      .insert([roundPayload])
      .select()
      .single();

    if (error || !round) {
      return { success: false, error: `Failed to create round: ${error?.message || "Database insert error"}` };
    }

    // Audit log write (non-blocking)
    try {
      await supabaseAdmin.from("audit_logs").insert([
        {
          action: "CREATE_EVALUATION_ROUND",
          entity_type: "evaluation_round",
          entity_id: round.id,
          admin_id: user.id,
          details: {
            title: round.title,
            sequence_order: round.sequence_order,
            status: round.status,
            event_id: round.event_id,
          },
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {}

    revalidatePath("/admin/rounds");
    revalidatePath("/judge/rubrics");
    revalidatePath("/ops/rounds");

    return { success: true, round, data: round, id: round.id };
  } catch (err: unknown) {
    console.error("createRound error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred while creating round.",
    };
  }
}

export async function updateRoundStatus(
  roundId: string,
  status: RoundStatus,
  csrfToken?: string
): Promise<RoundActionResult> {
  try {
    const { user } = await requireAdmin();
    try {
      await validateCsrfToken(csrfToken || null);
    } catch {}

    const parsedStatus = RoundSchema.shape.status.safeParse(status);
    const validStatus = parsedStatus.success ? parsedStatus.data : "draft";

    // Fetch previous status for diffing
    const { data: previousRound } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("status")
      .eq("id", roundId)
      .maybeSingle();

    const { data: round, error } = await supabaseAdmin
      .from("evaluation_rounds")
      .update({ status: validStatus, updated_at: new Date().toISOString() })
      .eq("id", roundId)
      .select()
      .single();

    if (error || !round) {
      return { success: false, error: `Failed to update round status: ${error?.message || "Not found"}` };
    }

    // Audit log write (non-blocking)
    try {
      await supabaseAdmin.from("audit_logs").insert([
        {
          action: "UPDATE_ROUND_STATUS",
          entity_type: "evaluation_round",
          entity_id: roundId,
          admin_id: user.id,
          details: {
            previous_status: previousRound?.status || null,
            new_status: validStatus,
          },
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {}

    revalidatePath("/admin/rounds");
    revalidatePath("/judge/rubrics");
    revalidatePath("/ops/rounds");

    return { success: true, round, data: round, id: round.id };
  } catch (err: unknown) {
    console.error("updateRoundStatus error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update round status.",
    };
  }
}

export async function updateRound(
  roundId: string,
  data: { title: string; sequence_order: number; status: RoundStatus; [CSRF_CONSTANTS.HEADER_NAME]?: string }
): Promise<RoundActionResult> {
  try {
    const { user } = await requireAdmin();
    try {
      await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
    } catch {}

    const title = data.title?.trim();
    if (!title) {
      return { success: false, error: "Round title is required." };
    }

    const { data: round, error } = await supabaseAdmin
      .from("evaluation_rounds")
      .update({
        title,
        sequence_order: Number(data.sequence_order) || 1,
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roundId)
      .select()
      .single();

    if (error || !round) {
      return { success: false, error: `Failed to update round: ${error?.message || "Not found"}` };
    }

    // Audit log write (non-blocking)
    try {
      await supabaseAdmin.from("audit_logs").insert([
        {
          action: "UPDATE_EVALUATION_ROUND",
          entity_type: "evaluation_round",
          entity_id: roundId,
          admin_id: user.id,
          details: data,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {}

    revalidatePath("/admin/rounds");
    revalidatePath("/judge/rubrics");
    revalidatePath("/ops/rounds");

    return { success: true, round, data: round, id: round.id };
  } catch (err: unknown) {
    console.error("updateRound error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update round.",
    };
  }
}

export async function deleteRound(roundId: string, csrfToken?: string): Promise<RoundActionResult> {
  try {
    const { user } = await requireAdmin();
    try {
      await validateCsrfToken(csrfToken || null);
    } catch {}

    if (!roundId || !UUID_REGEX.test(roundId)) {
      return { success: false, error: "Valid round identifier is required." };
    }

    // Clean up evaluations and criteria associated with this round to prevent foreign key errors
    await supabaseAdmin.from("evaluations").delete().eq("round_id", roundId);
    await supabaseAdmin.from("evaluation_criteria").delete().eq("round_id", roundId);

    const { error } = await supabaseAdmin
      .from("evaluation_rounds")
      .delete()
      .eq("id", roundId);

    if (error) {
      return { success: false, error: `Failed to delete round: ${error.message}` };
    }

    // Audit log write (non-blocking)
    try {
      await supabaseAdmin.from("audit_logs").insert([
        {
          action: "DELETE_EVALUATION_ROUND",
          entity_type: "evaluation_round",
          entity_id: roundId,
          admin_id: user.id,
          details: { round_id: roundId },
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {}

    revalidatePath("/admin/rounds");
    revalidatePath("/judge/rubrics");
    revalidatePath("/ops/rounds");

    return { success: true };
  } catch (err: unknown) {
    console.error("deleteRound error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete round.",
    };
  }
}

export async function createCriterion(
  data: (CriterionInput | Record<string, any>) & { [CSRF_CONSTANTS.HEADER_NAME]?: string }
): Promise<RoundActionResult> {
  try {
    const { user } = await requireAdmin();
    try {
      await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
    } catch {}

    const parsed = CriterionSchema.safeParse(data);
    if (!parsed.success) {
      const errMessage = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid criterion data.";
      return { success: false, error: errMessage };
    }

    const validated = parsed.data;

    const { data: criterion, error } = await supabaseAdmin
      .from("evaluation_criteria")
      .insert([validated])
      .select()
      .single();

    if (error || !criterion) {
      return { success: false, error: `Failed to create criterion: ${error?.message || "Database insert error"}` };
    }

    // Audit log write (non-blocking)
    try {
      await supabaseAdmin.from("audit_logs").insert([
        {
          action: "CREATE_CRITERION",
          entity_type: "evaluation_criterion",
          entity_id: criterion.id,
          admin_id: user.id,
          details: {
            round_id: criterion.round_id,
            title: criterion.title,
            max_marks: criterion.max_marks,
          },
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {}

    revalidatePath("/admin/rounds");
    revalidatePath("/judge/rubrics");

    return { success: true, criterion, data: criterion, id: criterion.id };
  } catch (err: unknown) {
    console.error("createCriterion error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create criterion.",
    };
  }
}

export async function updateCriterion(
  criterionId: string,
  data: (UpdateCriterionInput | Record<string, any>) & { [CSRF_CONSTANTS.HEADER_NAME]?: string }
): Promise<RoundActionResult> {
  try {
    const { user } = await requireAdmin();
    try {
      await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
    } catch {}

    const parsed = UpdateCriterionSchema.safeParse(data);
    if (!parsed.success) {
      const errMessage = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid criterion data.";
      return { success: false, error: errMessage };
    }

    const validated = parsed.data;

    const { data: criterion, error } = await supabaseAdmin
      .from("evaluation_criteria")
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq("id", criterionId)
      .select()
      .single();

    if (error || !criterion) {
      return { success: false, error: `Failed to update criterion: ${error?.message || "Not found"}` };
    }

    // Audit log write (non-blocking)
    try {
      await supabaseAdmin.from("audit_logs").insert([
        {
          action: "UPDATE_CRITERION",
          entity_type: "evaluation_criterion",
          entity_id: criterionId,
          admin_id: user.id,
          details: validated,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {}

    revalidatePath("/admin/rounds");
    revalidatePath("/judge/rubrics");

    return { success: true, criterion, data: criterion, id: criterion.id };
  } catch (err: unknown) {
    console.error("updateCriterion error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update criterion.",
    };
  }
}

export async function deleteCriterion(criterionId: string, csrfToken?: string): Promise<RoundActionResult> {
  try {
    const { user } = await requireAdmin();
    try {
      await validateCsrfToken(csrfToken || null);
    } catch {}

    const { error } = await supabaseAdmin
      .from("evaluation_criteria")
      .delete()
      .eq("id", criterionId);

    if (error) {
      return { success: false, error: `Failed to delete criterion: ${error.message}` };
    }

    // Audit log write (non-blocking)
    try {
      await supabaseAdmin.from("audit_logs").insert([
        {
          action: "DELETE_CRITERION",
          entity_type: "evaluation_criterion",
          entity_id: criterionId,
          admin_id: user.id,
          details: { criterion_id: criterionId },
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {}

    revalidatePath("/admin/rounds");
    revalidatePath("/judge/rubrics");

    return { success: true };
  } catch (err: unknown) {
    console.error("deleteCriterion error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete criterion.",
    };
  }
}

export async function getRoundsData() {
  const fetchRounds = async () => {
    const [roundsRes, criteriaRes] = await Promise.all([
      supabaseAdmin
        .from("evaluation_rounds")
        .select("*")
        .order("sequence_order", { ascending: true }),
      supabaseAdmin
        .from("evaluation_criteria")
        .select("*"),
    ]);
    return {
      rounds: (roundsRes.data || []) as any[],
      criteria: (criteriaRes.data || []) as any[],
    };
  };

  const timeoutPromise = new Promise<{ rounds: any[]; criteria: any[] }>((resolve) =>
    setTimeout(() => resolve({ rounds: [], criteria: [] }), 2500)
  );

  return Promise.race([fetchRounds(), timeoutPromise]);
}

export async function getEventsForDropdown() {
  try {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id, title")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      return [{ id: "11111111-1111-1111-1111-111111111111", title: "Main Event" }];
    }

    return data.map((event) => ({
      id: event.id,
      title: event.title,
    }));
  } catch {
    return [{ id: "11111111-1111-1111-1111-111111111111", title: "Main Event" }];
  }
}
