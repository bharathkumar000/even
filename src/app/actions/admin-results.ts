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

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export interface ResultsExportResponse {
  success: boolean;
  csvContent?: string;
  filename?: string;
  error?: string;
}

export async function getComprehensiveResultsCsv(eventId?: string): Promise<ResultsExportResponse> {
  try {
    await requireAdmin();

    // 1. Resolve eventId
    let targetEventId = eventId;
    if (!targetEventId || !UUID_REGEX.test(targetEventId)) {
      const { data: defaultEvent } = await supabaseAdmin
        .from("events")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      targetEventId = defaultEvent?.id || "11111111-1111-1111-1111-111111111111";
    }

    // 2. Query event_results
    const { data: results, error: resError } = await supabaseAdmin
      .from("event_results")
      .select("*")
      .eq("event_id", targetEventId)
      .order("average_score", { ascending: false });

    if (resError) {
      return { success: false, error: `Failed to fetch event results: ${resError.message}` };
    }

    // 3. Query all teams
    const { data: teamsData, error: teamsError } = await supabaseAdmin
      .from("teams")
      .select("id, name, code, track, college, leader_name, problem_statement, problem_description");

    if (teamsError) {
      return { success: false, error: `Failed to fetch teams: ${teamsError.message}` };
    }

    const teamMap = new Map((teamsData || []).map((t) => [t.id, t]));

    // 4. Query problem statement assignments for fallback
    const { data: assignments } = await supabaseAdmin
      .from("team_problem_statement_assignments")
      .select("team_id, problem_statements(title, track)");

    const assignmentMap = new Map<string, string>();
    (assignments || []).forEach((a: any) => {
      if (a.team_id && a.problem_statements?.title) {
        assignmentMap.set(a.team_id, a.problem_statements.title);
      }
    });

    // 5. Query evaluations for active event/rounds
    const { data: evaluations, error: evalError } = await supabaseAdmin
      .from("evaluations")
      .select("id, team_id, judge_id, total_score, status, feedback")
      .in("status", ["submitted", "locked"]);

    if (evalError) {
      return { success: false, error: `Failed to fetch evaluations: ${evalError.message}` };
    }

    // 6. Query judge profiles
    const judgeIds = Array.from(
      new Set((evaluations || []).map((e) => e.judge_id).filter(Boolean) as string[])
    );

    const { data: judgeProfiles } = judgeIds.length > 0
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", judgeIds)
      : { data: [] };

    const judgeMap = new Map(
      (judgeProfiles || []).map((p) => [p.id, p.full_name || p.email || `Judge ${p.id.slice(0, 6)}`])
    );

    // Group evaluations by team_id
    const evalsByTeam = new Map<string, Array<{ judgeName: string; judgeId: string; score: number }>>();
    for (const ev of evaluations || []) {
      if (!ev.team_id) continue;
      if (!evalsByTeam.has(ev.team_id)) {
        evalsByTeam.set(ev.team_id, []);
      }
      const judgeName = judgeMap.get(ev.judge_id) || "Anonymous Judge";
      evalsByTeam.get(ev.team_id)!.push({
        judgeName,
        judgeId: ev.judge_id,
        score: Number(ev.total_score) || 0,
      });
    }

    // Determine sorted unique judge list for table columns
    const allJudges = Array.from(judgeMap.entries()).map(([id, name]) => ({ id, name }));

    // Prepare rows
    const teamIdsToProcess = results && results.length > 0
      ? results.map((r) => r.team_id)
      : (teamsData || []).map((t) => t.id);

    const resultMap = new Map((results || []).map((r) => [r.team_id, r]));

    const processedRows = teamIdsToProcess.map((teamId, index) => {
      const team = teamMap.get(teamId);
      const res = resultMap.get(teamId);
      const teamEvals = evalsByTeam.get(teamId) || [];
      const scores = teamEvals.map((e) => e.score);

      const totalScore = scores.reduce((a, b) => a + b, 0);
      const rawAvg = scores.length > 0 ? totalScore / scores.length : (res?.average_score ?? 0);

      // Olympic trimmed score calculation:
      let olympicScore = rawAvg;
      if (scores.length >= 3) {
        const sorted = [...scores].sort((a, b) => a - b);
        const trimmed = sorted.slice(1, -1);
        olympicScore = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      }

      const rank = res?.rank ?? index + 1;
      const teamName = team?.name || `Team ${teamId}`;
      const teamCode = team?.code || "";
      const college = team?.college || "Vidyavardhaka College of Engineering";
      const track = team?.track || "General";
      const problemStatement = team?.problem_statement || assignmentMap.get(teamId) || "N/A";
      const evalsCount = scores.length || (res?.evaluations_count ?? 0);

      // Judge breakdown string
      const judgeBreakdown = teamEvals.length > 0
        ? teamEvals.map((e) => `${e.judgeName}: ${e.score}`).join(" | ")
        : "Pending Evaluation";

      // Individual judge scores map
      const judgeScoreByJudgeId = new Map(teamEvals.map((e) => [e.judgeId, e.score]));

      return {
        rank,
        teamName,
        teamCode,
        college,
        track,
        problemStatement,
        evalsCount,
        rawAvg: Math.round(rawAvg * 100) / 100,
        olympicScore: Math.round(olympicScore * 100) / 100,
        totalScore,
        judgeBreakdown,
        judgeScores: allJudges.map((j) => judgeScoreByJudgeId.get(j.id) ?? ""),
        status: res?.is_locked ? "LOCKED" : res?.is_published ? "PUBLISHED" : "DRAFT",
      };
    });

    // Sort by rank ascending
    processedRows.sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999));

    // Construct CSV Header
    const baseHeaders = [
      "Final Rank",
      "Team Name",
      "Team Code",
      "College / Institution",
      "Track",
      "Problem Statement",
      "Evaluations Count",
      "Average Score",
      "Olympic Trimmed Score",
      "Total Score",
      "Judge Score Breakdown",
    ];

    const dynamicJudgeHeaders = allJudges.map((j) => `Judge: ${j.name}`);
    const finalHeaders = [...baseHeaders, ...dynamicJudgeHeaders, "Leaderboard Status"];

    // Format rows
    const csvRows = processedRows.map((r, idx) => {
      const rowCols = [
        escapeCsv(r.rank || idx + 1),
        escapeCsv(r.teamName),
        escapeCsv(r.teamCode),
        escapeCsv(r.college),
        escapeCsv(r.track),
        escapeCsv(r.problemStatement),
        escapeCsv(r.evalsCount),
        escapeCsv(r.rawAvg.toFixed(2)),
        escapeCsv(r.olympicScore.toFixed(2)),
        escapeCsv(r.totalScore),
        escapeCsv(r.judgeBreakdown),
        ...r.judgeScores.map((s) => escapeCsv(s)),
        escapeCsv(r.status),
      ];
      return rowCols.join(",");
    });

    const metadataLines = [
      `# IVC-EVENTRA Official Deliberation & Final Standings Export`,
      `# Event ID: ${targetEventId}`,
      `# Export Timestamp: ${new Date().toISOString()}`,
      `# Institution: Vidyavardhaka College of Engineering (VVCE), Mysuru`,
      `# Rules: Olympic Trimmed Score drops highest and lowest judge marks for >= 3 evaluations`,
      "",
    ];

    // Prepend UTF-8 BOM \uFEFF for seamless Excel opening
    const csvContent = "\uFEFF" + [...metadataLines, finalHeaders.join(","), ...csvRows].join("\r\n");
    const dateStamp = new Date().toISOString().split("T")[0];
    const filename = `IVC_EVENTRA_Final_Standings_${dateStamp}.csv`;

    return {
      success: true,
      csvContent,
      filename,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to export results to CSV.";
    console.error("[getComprehensiveResultsCsv] Error:", err);
    return { success: false, error: errorMsg };
  }
}

