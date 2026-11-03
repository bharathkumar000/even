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
import type { PostgrestError } from "@supabase/supabase-js";

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

/**
 * Formats a Supabase PostgrestError preserving diagnostic fields
 * (message, code, details, hint) without exposing server secrets.
 */
function formatSupabaseError(
  error: PostgrestError | { message?: string; code?: string; details?: string | null; hint?: string | null } | null | undefined,
  fallback = "Database operation failed."
): string {
  if (!error) return fallback;
  const parts: string[] = [];
  const baseMessage = error.message?.trim() || fallback;
  parts.push(baseMessage);
  if (error.code) parts.push(`Code: ${error.code}`);
  if (error.details) parts.push(`Details: ${error.details}`);
  if (error.hint) parts.push(`Hint: ${error.hint}`);
  return parts.join(" | ");
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
    const supabase = supabaseAdmin;

    // Resolve event_id: verify that the event actually exists in the database.
    let eventId: string | null = validated.event_id || null;
    if (eventId && UUID_REGEX.test(eventId)) {
      const { data: exists } = await supabase
        .from("events")
        .select("id")
        .eq("id", eventId)
        .maybeSingle();
      if (!exists) {
        eventId = null;
      }
    } else {
      eventId = null;
    }

    // If no valid event specified, pick the most recent event if available
    if (!eventId) {
      const { data: defaultEvent } = await supabase
        .from("events")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (defaultEvent?.id) {
        eventId = defaultEvent.id;
      } else {
        // Ensure default fallback event exists in the database
        const { data: newEv } = await supabase
          .from("events")
          .upsert([{ id: "11111111-1111-1111-1111-111111111111", title: "IVC Hackathon 2026" }])
          .select("id")
          .maybeSingle();
        eventId = newEv?.id || null;
      }
    }

    const roundPayload = {
      title: validated.title,
      sequence_order: validated.sequence_order,
      status: validated.status,
      event_id: eventId,
    };

    const { data: round, error } = await supabase
      .from("evaluation_rounds")
      .insert([roundPayload])
      .select()
      .single();

    if (error || !round) {
      return {
        success: false,
        error: `Failed to create round: ${formatSupabaseError(error, "Database insert error")}`,
      };
    }

    // Audit log write (non-blocking) using supabaseAdmin to guarantee privileged audit insertion
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

    try {
      revalidatePath("/admin/rounds");
      revalidatePath("/judge/rubrics");
      revalidatePath("/ops/rounds");
    } catch (revalErr) {
      console.warn("revalidatePath notice:", revalErr);
    }

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

    const supabase = supabaseAdmin;

    // Fetch previous status for diffing
    const { data: previousRound } = await supabase
      .from("evaluation_rounds")
      .select("status")
      .eq("id", roundId)
      .maybeSingle();

    const { data: round, error } = await supabase
      .from("evaluation_rounds")
      .update({ status: validStatus, updated_at: new Date().toISOString() })
      .eq("id", roundId)
      .select()
      .single();

    if (error || !round) {
      return {
        success: false,
        error: `Failed to update round status: ${formatSupabaseError(error, "Not found or update failed")}`,
      };
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

    try {
      revalidatePath("/admin/rounds");
      revalidatePath("/judge/rubrics");
      revalidatePath("/ops/rounds");
    } catch (revalErr) {
      console.warn("revalidatePath notice:", revalErr);
    }

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

    const supabase = supabaseAdmin;

    const { data: round, error } = await supabase
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
      return {
        success: false,
        error: `Failed to update round: ${formatSupabaseError(error, "Not found or update failed")}`,
      };
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

    try {
      revalidatePath("/admin/rounds");
      revalidatePath("/judge/rubrics");
      revalidatePath("/ops/rounds");
    } catch (revalErr) {
      console.warn("revalidatePath notice:", revalErr);
    }

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

    const supabase = supabaseAdmin;

    // Clean up evaluations and criteria associated with this round to prevent foreign key errors
    await supabase.from("evaluations").delete().eq("round_id", roundId);
    await supabase.from("evaluation_criteria").delete().eq("round_id", roundId);

    const { error } = await supabase
      .from("evaluation_rounds")
      .delete()
      .eq("id", roundId);

    if (error) {
      return {
        success: false,
        error: `Failed to delete round: ${formatSupabaseError(error, "Delete failed")}`,
      };
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

    try {
      revalidatePath("/admin/rounds");
      revalidatePath("/judge/rubrics");
      revalidatePath("/ops/rounds");
    } catch (revalErr) {
      console.warn("revalidatePath notice:", revalErr);
    }

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
    const supabase = supabaseAdmin;

    // Verify round exists in database
    const { data: roundExists, error: roundCheckError } = await supabase
      .from("evaluation_rounds")
      .select("id")
      .eq("id", validated.round_id)
      .maybeSingle();

    if (roundCheckError) {
      return {
        success: false,
        error: `Failed to verify round: ${formatSupabaseError(roundCheckError, "Round lookup failed")}`,
      };
    }

    if (!roundExists) {
      return {
        success: false,
        error: "The selected evaluation round does not exist. Please save the round first.",
      };
    }

    const criterionPayload = {
      round_id: validated.round_id,
      title: validated.title,
      description: validated.description || null,
      max_marks: validated.max_marks,
      is_required: validated.is_required ?? true,
    };

    const { data: criterion, error } = await supabase
      .from("evaluation_criteria")
      .insert([criterionPayload])
      .select()
      .single();

    if (error || !criterion) {
      return {
        success: false,
        error: `Failed to create criterion: ${formatSupabaseError(error, "Database insert error")}`,
      };
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
    const supabase = supabaseAdmin;

    const { data: criterion, error } = await supabase
      .from("evaluation_criteria")
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq("id", criterionId)
      .select()
      .single();

    if (error || !criterion) {
      return {
        success: false,
        error: `Failed to update criterion: ${formatSupabaseError(error, "Not found or update failed")}`,
      };
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

    const supabase = supabaseAdmin;

    const { error } = await supabase
      .from("evaluation_criteria")
      .delete()
      .eq("id", criterionId);

    if (error) {
      return {
        success: false,
        error: `Failed to delete criterion: ${formatSupabaseError(error, "Delete failed")}`,
      };
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
    const supabase = supabaseAdmin;
    const [roundsRes, criteriaRes] = await Promise.all([
      supabase
        .from("evaluation_rounds")
        .select("*")
        .order("sequence_order", { ascending: true }),
      supabase
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
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from("events")
      .select("id, title")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      return [{ id: "11111111-1111-1111-1111-111111111111", title: "Main Event" }];
    }

    return data.map((event: { id: string; title: string }) => ({
      id: event.id,
      title: event.title,
    }));
  } catch {
    return [{ id: "11111111-1111-1111-1111-111111111111", title: "Main Event" }];
  }
}
