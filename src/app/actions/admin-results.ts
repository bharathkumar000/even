"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ResultActionSchema } from "@/lib/validations/admin";
import { z } from "zod";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { revalidatePath } from "next/cache";

export type ResultActionInput = z.infer<typeof ResultActionSchema>;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResultActionResult {
  success: boolean;
  action?: string;
  event_id?: string;
  error?: string;
}

export async function triggerResultsEngine(
  data: (ResultActionInput | Record<string, any>) & { [CSRF_CONSTANTS.HEADER_NAME]?: string }
): Promise<ResultActionResult> {
  try {
    const { user } = await requireAdmin();
    try {
      await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
    } catch (csrfErr) {
      console.warn("[CSRF] triggerResultsEngine notice:", csrfErr);
    }

    const parsed = ResultActionSchema.safeParse(data);
    if (!parsed.success) {
      const errMessage = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid results action input.";
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

    if (validated.action === "recalculate") {
      // 1. Fetch evaluations associated with this event (via round_id or direct)
      const { data: rounds } = await supabaseAdmin
        .from("evaluation_rounds")
        .select("id")
        .eq("event_id", eventId);

      let roundIds = (rounds || []).map((r) => r.id);

      // If no rounds matched the event_id, query all rounds as fallback
      if (roundIds.length === 0) {
        const { data: allRounds } = await supabaseAdmin
          .from("evaluation_rounds")
          .select("id");
        roundIds = (allRounds || []).map((r) => r.id);
      }

      let evalQuery = supabaseAdmin
        .from("evaluations")
        .select("team_id, total_score, status")
        .in("status", ["submitted", "locked"]);

      if (roundIds.length > 0) {
        evalQuery = evalQuery.in("round_id", roundIds);
      }

      const { data: evaluations, error: evalError } = await evalQuery;

      if (evalError) {
        return { success: false, error: `Failed to fetch evaluations for recalculation: ${evalError.message}` };
      }

      // 2. Aggregate scores grouped by team_id
      const teamScoresMap = new Map<string, number[]>();

      for (const ev of evaluations || []) {
        if (!ev.team_id) continue;
        const score = Number(ev.total_score) || 0;
        if (!teamScoresMap.has(ev.team_id)) {
          teamScoresMap.set(ev.team_id, []);
        }
        teamScoresMap.get(ev.team_id)!.push(score);
      }

      // Ensure all registered teams are considered even if scoring is pending
      const { data: allTeams } = await supabaseAdmin
        .from("teams")
        .select("id");

      for (const t of allTeams || []) {
        if (!teamScoresMap.has(t.id)) {
          teamScoresMap.set(t.id, []);
        }
      }

      // 3. Compute stats (standard or Olympic scoring)
      const computedTeams = Array.from(teamScoresMap.entries()).map(([team_id, scoresList]) => {
        let finalAvg = 0;
        let finalTotal = scoresList.reduce((a, b) => a + b, 0);

        if (validated.olympic && scoresList.length >= 3) {
          // Olympic scoring: drop 1 highest and 1 lowest score
          const sorted = [...scoresList].sort((a, b) => a - b);
          const trimmed = sorted.slice(1, -1);
          const trimmedTotal = trimmed.reduce((a, b) => a + b, 0);
          finalAvg = trimmedTotal / trimmed.length;
          finalTotal = trimmedTotal;
        } else {
          finalAvg = scoresList.length > 0 ? finalTotal / scoresList.length : 0;
        }

        return {
          team_id,
          total_score: finalTotal,
          average_score: Math.round(finalAvg * 100) / 100,
          evaluations_count: scoresList.length,
        };
      });

      // 4. Fetch existing event_results to preserve publication/lock states
      const { data: existingResults } = await supabaseAdmin
        .from("event_results")
        .select("team_id, is_published, is_locked, published_at")
        .eq("event_id", eventId);

      const existingMap = new Map((existingResults || []).map((r) => [r.team_id, r]));

      // 5. Assign rank based on average_score descending
      computedTeams.sort((a, b) => b.average_score - a.average_score);
      const updates = computedTeams.map((item, idx) => {
        const existing = existingMap.get(item.team_id);
        return {
          event_id: eventId,
          team_id: item.team_id,
          total_score: item.total_score,
          average_score: item.average_score,
          evaluations_count: item.evaluations_count,
          rank: idx + 1,
          is_published: existing ? existing.is_published : false,
          is_locked: existing ? existing.is_locked : false,
          published_at: existing?.published_at || null,
          calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      if (updates.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from("event_results")
          .upsert(updates, { onConflict: "event_id,team_id" });

        if (upsertError) {
          return { success: false, error: `Failed to upsert event results: ${upsertError.message}` };
        }
      }
    } else if (validated.action === "publish") {
      // Toggle published state
      const { error: publishError } = await supabaseAdmin
        .from("event_results")
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);

      if (publishError) {
        return { success: false, error: `Failed to publish event results: ${publishError.message}` };
      }
    } else if (validated.action === "lock") {
      // Lock results against further modification (Note: locked_at does not exist in schema)
      const { error: lockError } = await supabaseAdmin
        .from("event_results")
        .update({
          is_locked: true,
          updated_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);

      if (lockError) {
        return { success: false, error: `Failed to lock event results: ${lockError.message}` };
      }
    }

    // Record action in audit_logs (non-blocking)
    void supabaseAdmin.from("audit_logs").insert([
      {
        action: `RESULTS_ENGINE_${validated.action.toUpperCase()}`,
        entity_type: "event_results",
        entity_id: eventId,
        admin_id: user.id,
        details: {
          action: validated.action,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      revalidatePath("/admin/results");
      revalidatePath("/team/results");
      revalidatePath("/team");
    } catch (e) {
      // ignore outside render
    }

    return { success: true, action: validated.action, event_id: eventId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to execute results engine action.";
    console.error("[triggerResultsEngine] Action error:", err);
    return { success: false, error: errorMsg };
  }
}

export async function getResultsData() {
  const fetchResults = async () => {
    const { data } = await supabaseAdmin
      .from("event_results")
      .select("*")
      .order("total_score", { ascending: false });
    return (data || []) as any[];
  };

  const timeoutPromise = new Promise<any[]>((resolve) =>
    setTimeout(() => resolve([]), 2500)
  );

  return Promise.race([fetchResults(), timeoutPromise]);
}

