"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  FINAL_JUDGING_ROUND_ID,
  type EvaluationCriterion,
  type CriterionScoreBreakdown,
  type JudgeEvaluationMatrixRow,
  type JudgeEvaluationMatrixKPIs,
  type JudgeEvaluationMatrixResponse,
} from "@/types/evaluation-matrix";

export type {
  EvaluationCriterion,
  CriterionScoreBreakdown,
  JudgeEvaluationMatrixRow,
  JudgeEvaluationMatrixKPIs,
  JudgeEvaluationMatrixResponse,
};

/**
 * Helper to compute sum of criterion scores from an evaluation record.
 * Only completed ('submitted') evaluations yield a valid total score.
 * Incomplete/draft evaluations return null so draft marks are never counted as completed.
 */
function extractEvaluationScore(
  evalRecord: any | null,
  criteriaList: EvaluationCriterion[]
): {
  score: number | null;
  breakdown: CriterionScoreBreakdown[];
  status: "submitted" | "draft" | "pending";
  feedback: string | null;
  submittedAt: string | null;
} {
  if (!evalRecord) {
    return {
      score: null,
      breakdown: [],
      status: "pending",
      feedback: null,
      submittedAt: null,
    };
  }

  const status: "submitted" | "draft" | "pending" =
    evalRecord.status === "submitted"
      ? "submitted"
      : evalRecord.status === "draft"
      ? "draft"
      : "pending";

  const feedback = evalRecord.feedback || null;
  const submittedAt = evalRecord.updated_at || evalRecord.created_at || null;

  // Extract raw criterion scores array
  const rawScores: { criterion_id?: string; score?: number }[] = Array.isArray(evalRecord.scores)
    ? evalRecord.scores
    : Array.isArray(evalRecord.scores_breakdown)
    ? evalRecord.scores_breakdown
    : [];

  const rawScoreMap = new Map<string, number>();
  for (const item of rawScores) {
    if (item && item.criterion_id) {
      rawScoreMap.set(item.criterion_id, Number(item.score) || 0);
    }
  }

  // Build breakdown matching round criteria
  const breakdown: CriterionScoreBreakdown[] = criteriaList.map((c) => {
    const s = rawScoreMap.get(c.id);
    return {
      criterion_id: c.id,
      title: c.title,
      max_marks: c.max_marks,
      score: typeof s === "number" ? s : 0,
    };
  });

  // Calculate sum of actual submitted criterion marks
  let calculatedSum = 0;
  if (rawScores.length > 0) {
    calculatedSum = rawScores.reduce(
      (sum, item) => sum + (Number(item?.score) || 0),
      0
    );
  } else if (typeof evalRecord.total_score === "number") {
    calculatedSum = evalRecord.total_score;
  }

  // Only submitted evaluations yield valid marks. Drafts/incompletes return null.
  if (status !== "submitted") {
    return {
      score: null,
      breakdown,
      status,
      feedback,
      submittedAt,
    };
  }

  return {
    score: calculatedSum,
    breakdown,
    status: "submitted",
    feedback,
    submittedAt,
  };
}

/**
 * Fetch the complete Judge Evaluation Matrix for all 60 participating teams
 * and their two assigned judges in the FINAL JUDGING round.
 * Executes without N+1 queries.
 */
export async function getJudgeEvaluationMatrix(
  roundId: string = FINAL_JUDGING_ROUND_ID
): Promise<JudgeEvaluationMatrixResponse> {
  try {
    await requireAdmin();

    const targetRoundId = roundId || FINAL_JUDGING_ROUND_ID;

    // Concurrently fetch all necessary datasets in a single Promise.all
    const [roundRes, criteriaRes, teamsRes, assignmentsRes, evalsRes, judgesRes] =
      await Promise.all([
        supabaseAdmin
          .from("evaluation_rounds")
          .select("id, title, status")
          .eq("id", targetRoundId)
          .maybeSingle(),
        supabaseAdmin
          .from("evaluation_criteria")
          .select("id, round_id, title, description, max_marks, is_required")
          .eq("round_id", targetRoundId)
          .order("max_marks", { ascending: false }),
        supabaseAdmin
          .from("teams")
          .select("id, name, code, track, status, created_at")
          .order("code", { ascending: true }),
        supabaseAdmin
          .from("judge_assignments")
          .select("id, judge_id, team_id, round_id, assigned_at")
          .eq("round_id", targetRoundId)
          .order("assigned_at", { ascending: true }),
        supabaseAdmin
          .from("evaluations")
          .select("id, round_id, team_id, judge_id, total_score, scores, scores_breakdown, status, feedback, created_at, updated_at")
          .eq("round_id", targetRoundId),
        supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("role", "judge"),
      ]);

    if (teamsRes.error) {
      throw new Error(`Failed to load teams: ${teamsRes.error.message}`);
    }
    if (assignmentsRes.error) {
      throw new Error(`Failed to load judge assignments: ${assignmentsRes.error.message}`);
    }
    if (evalsRes.error) {
      throw new Error(`Failed to load evaluations: ${evalsRes.error.message}`);
    }

    const round = roundRes.data || { id: targetRoundId, title: "FINAL JUDGING", status: "open" };
    const criteria: EvaluationCriterion[] = criteriaRes.data || [];
    const teams = teamsRes.data || [];
    const assignments = assignmentsRes.data || [];
    const evaluations = evalsRes.data || [];
    const judges = judgesRes.data || [];

    // Map judges by ID for O(1) profile lookup
    const judgeMap = new Map<string, { full_name: string | null; email: string | null }>();
    for (const j of judges) {
      judgeMap.set(j.id, { full_name: j.full_name, email: j.email });
    }

    // Map assignments by team_id
    const teamAssignmentsMap = new Map<string, typeof assignments>();
    for (const a of assignments) {
      if (!teamAssignmentsMap.has(a.team_id)) {
        teamAssignmentsMap.set(a.team_id, []);
      }
      teamAssignmentsMap.get(a.team_id)!.push(a);
    }

    // Map evaluations by composite key: `${team_id}_${judge_id}`
    const evalMap = new Map<string, (typeof evaluations)[0]>();
    for (const e of evaluations) {
      if (e.team_id && e.judge_id) {
        evalMap.set(`${e.team_id}_${e.judge_id}`, e);
      }
    }

    const uniqueJudgeNamesSet = new Set<string>();

    let fullyEvaluatedCount = 0;
    let pendingCount = 0;
    let notEvaluatedCount = 0;
    let discrepancyCount = 0;
    let totalCompletedScoreSum = 0;
    let maxCompletedScore: number | null = null;

    // Process all registered teams into matrix rows
    const rows: JudgeEvaluationMatrixRow[] = teams.map((team) => {
      const teamId = team.id;
      const teamCode = team.code || `IVC-${String(team.id.slice(-4)).toUpperCase()}`;
      const teamName = team.name || "Unnamed Team";
      const teamTrack = team.track || null;
      const teamStatus = team.status || null;

      const teamAssigns = teamAssignmentsMap.get(teamId) || [];
      const assignmentCount = teamAssigns.length;
      const hasDiscrepancy = assignmentCount !== 2;
      let discrepancyMessage: string | null = null;
      if (assignmentCount === 0) {
        discrepancyMessage = "No judges assigned";
        discrepancyCount++;
      } else if (assignmentCount === 1) {
        discrepancyMessage = "Only 1 judge assigned (expected 2)";
        discrepancyCount++;
      } else if (assignmentCount > 2) {
        discrepancyMessage = `${assignmentCount} judges assigned (expected 2)`;
        discrepancyCount++;
      }

      // Ordered assignments: slot 1 and slot 2
      const a1 = teamAssigns[0] || null;
      const a2 = teamAssigns[1] || null;

      const j1Profile = a1 ? judgeMap.get(a1.judge_id) : null;
      const j2Profile = a2 ? judgeMap.get(a2.judge_id) : null;

      const j1Name = j1Profile?.full_name || (a1 ? j1Profile?.email || "Unknown Judge" : "Unassigned");
      const j2Name = j2Profile?.full_name || (a2 ? j2Profile?.email || "Unknown Judge" : "Unassigned");

      if (a1 && j1Profile?.full_name) uniqueJudgeNamesSet.add(j1Profile.full_name);
      if (a2 && j2Profile?.full_name) uniqueJudgeNamesSet.add(j2Profile.full_name);

      const e1Record = a1 ? evalMap.get(`${teamId}_${a1.judge_id}`) || null : null;
      const e2Record = a2 ? evalMap.get(`${teamId}_${a2.judge_id}`) || null : null;

      const j1Info = extractEvaluationScore(e1Record, criteria);
      const j2Info = extractEvaluationScore(e2Record, criteria);

      const j1Status = !a1 ? "unassigned" : j1Info.status;
      const j2Status = !a2 ? "unassigned" : j2Info.status;

      const j1Marks = j1Info.score;
      const j2Marks = j2Info.score;

      // Judge Marks Display
      let j1Display = "—";
      if (!a1) {
        j1Display = "Unassigned";
      } else if (j1Status === "submitted" && j1Marks !== null) {
        j1Display = `${j1Marks}/50`;
      } else if (j1Status === "draft") {
        j1Display = "Draft";
      }

      let j2Display = "—";
      if (!a2) {
        j2Display = "Unassigned";
      } else if (j2Status === "submitted" && j2Marks !== null) {
        j2Display = `${j2Marks}/50`;
      } else if (j2Status === "draft") {
        j2Display = "Draft";
      }

      // Final Score & Status Calculation
      let finalScore: number | null = null;
      let finalScoreDisplay = "NOT EVALUATED";
      let rowStatus: JudgeEvaluationMatrixRow["status"] = "NOT EVALUATED";
      let statusBadgeText = "Not Evaluated";

      const isJ1Submitted = j1Status === "submitted" && j1Marks !== null;
      const isJ2Submitted = j2Status === "submitted" && j2Marks !== null;

      if (hasDiscrepancy && assignmentCount < 2) {
        rowStatus = "ASSIGNMENT DISCREPANCY";
        statusBadgeText = discrepancyMessage || "Discrepancy";
        finalScoreDisplay = isJ1Submitted || isJ2Submitted ? "PENDING" : "NOT EVALUATED";
      } else if (isJ1Submitted && isJ2Submitted) {
        // Both judges have submitted: Final score is J1 total + J2 total out of 100
        finalScore = j1Marks + j2Marks;
        finalScoreDisplay = `${finalScore}/100`;
        rowStatus = "FULLY EVALUATED";
        statusBadgeText = "Fully Evaluated";
        fullyEvaluatedCount++;
        totalCompletedScoreSum += finalScore;
        if (maxCompletedScore === null || finalScore > maxCompletedScore) {
          maxCompletedScore = finalScore;
        }
      } else if (isJ1Submitted || isJ2Submitted) {
        // One judge submitted, other missing: show available score and mark final score as PENDING
        finalScore = null;
        finalScoreDisplay = "PENDING";
        rowStatus = "PARTIALLY EVALUATED";
        statusBadgeText = "Pending";
        pendingCount++;
      } else if (j1Status === "draft" || j2Status === "draft") {
        // Incomplete / Draft
        finalScore = null;
        finalScoreDisplay = "NOT EVALUATED";
        rowStatus = "IN PROGRESS";
        statusBadgeText = "In Progress";
        pendingCount++;
      } else {
        // Neither judge submitted
        finalScore = null;
        finalScoreDisplay = "NOT EVALUATED";
        rowStatus = "NOT EVALUATED";
        statusBadgeText = "Not Evaluated";
        notEvaluatedCount++;
      }

      return {
        team_id: teamId,
        team_code: teamCode,
        team_name: teamName,
        track: teamTrack,
        status_record: teamStatus,

        // Judge 1
        judge1_id: a1?.judge_id || null,
        judge1_name: j1Name,
        judge1_email: j1Profile?.email || null,
        judge1_marks: j1Marks,
        judge1_marks_display: j1Display,
        judge1_status: j1Status,
        judge1_breakdown: j1Info.breakdown,
        judge1_feedback: j1Info.feedback,
        judge1_submitted_at: j1Info.submittedAt,

        // Judge 2
        judge2_id: a2?.judge_id || null,
        judge2_name: j2Name,
        judge2_email: j2Profile?.email || null,
        judge2_marks: j2Marks,
        judge2_marks_display: j2Display,
        judge2_status: j2Status,
        judge2_breakdown: j2Info.breakdown,
        judge2_feedback: j2Info.feedback,
        judge2_submitted_at: j2Info.submittedAt,

        // Discrepancy
        assignment_count: assignmentCount,
        has_discrepancy: hasDiscrepancy,
        discrepancy_message: discrepancyMessage,

        // Final Score
        final_score: finalScore,
        final_score_display: finalScoreDisplay,

        // Status
        status: rowStatus,
        status_badge_text: statusBadgeText,
      };
    });

    const averageFinalScore =
      fullyEvaluatedCount > 0
        ? Math.round((totalCompletedScoreSum / fullyEvaluatedCount) * 10) / 10
        : null;

    const kpis: JudgeEvaluationMatrixKPIs = {
      total_teams: teams.length,
      fully_evaluated: fullyEvaluatedCount,
      pending_evaluations: pendingCount,
      not_evaluated: notEvaluatedCount,
      discrepancies: discrepancyCount,
      average_final_score: averageFinalScore,
      highest_final_score: maxCompletedScore,
    };

    const uniqueJudges = Array.from(uniqueJudgeNamesSet).sort((a, b) =>
      a.localeCompare(b)
    );

    return {
      success: true,
      round,
      criteria,
      rows,
      kpis,
      uniqueJudges,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Failed to load judge evaluation matrix";
    console.error("[getJudgeEvaluationMatrix] Error:", err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
