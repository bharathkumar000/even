"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ResultActionSchema } from "@/lib/validations/admin";
import { z } from "zod";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export type ResultActionInput = z.infer<typeof ResultActionSchema>;

export async function triggerResultsEngine(data: ResultActionInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
  const validated = ResultActionSchema.parse(data);

  if (validated.action === "recalculate") {
    // 1. Fetch evaluations associated with this event (via round_id or direct)
    const { data: rounds } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("id")
      .eq("event_id", validated.event_id);

    const roundIds = (rounds || []).map((r) => r.id);

    let evalQuery = supabaseAdmin
      .from("evaluations")
      .select("team_id, total_score, status")
      .in("status", ["submitted", "locked"]);

    if (roundIds.length > 0) {
      evalQuery = evalQuery.in("round_id", roundIds);
    }

    const { data: evaluations, error: evalError } = await evalQuery;

    if (evalError) {
      throw new Error(`Failed to fetch evaluations for recalculation: ${evalError.message}`);
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

    // 4. Assign rank based on average_score descending
    computedTeams.sort((a, b) => b.average_score - a.average_score);
    const updates = computedTeams.map((item, idx) => ({
      event_id: validated.event_id,
      team_id: item.team_id,
      total_score: item.total_score,
      average_score: item.average_score,
      evaluations_count: item.evaluations_count,
      rank: idx + 1,
      updated_at: new Date().toISOString(),
    }));

    if (updates.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("event_results")
        .upsert(updates, { onConflict: "event_id,team_id" });

      if (upsertError) {
        throw new Error(`Failed to upsert event results: ${upsertError.message}`);
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
      .eq("event_id", validated.event_id);

    if (publishError) {
      throw new Error(`Failed to publish event results: ${publishError.message}`);
    }
  } else if (validated.action === "lock") {
    // Lock results against further modification
    const { error: lockError } = await supabaseAdmin
      .from("event_results")
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", validated.event_id);

    if (lockError) {
      throw new Error(`Failed to lock event results: ${lockError.message}`);
    }
  }

  // Record action in audit_logs (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: `RESULTS_ENGINE_${validated.action.toUpperCase()}`,
      entity_type: "event_results",
      entity_id: validated.event_id,
      admin_id: user.id,
      details: {
        action: validated.action,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    },
  ]);

  return { success: true, action: validated.action, event_id: validated.event_id };
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
