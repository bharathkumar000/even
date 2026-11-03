export const FINAL_JUDGING_ROUND_ID = "f308e0cb-211a-4dbc-992a-9d7af291adb1";

export interface EvaluationCriterion {
  id: string;
  round_id: string;
  title: string;
  description: string | null;
  max_marks: number;
  is_required: boolean;
  sequence_order?: number;
}

export interface CriterionScoreBreakdown {
  criterion_id: string;
  title: string;
  max_marks: number;
  score: number;
}

export interface JudgeEvaluationMatrixRow {
  team_id: string;
  team_code: string;
  team_name: string;
  track: string | null;
  status_record: string | null;

  // Judge 1
  judge1_id: string | null;
  judge1_name: string;
  judge1_email: string | null;
  judge1_marks: number | null; // null if not submitted or draft
  judge1_marks_display: string; // e.g. "44/50", "Draft", "—"
  judge1_status: "submitted" | "draft" | "pending" | "unassigned";
  judge1_breakdown: CriterionScoreBreakdown[];
  judge1_feedback: string | null;
  judge1_submitted_at: string | null;

  // Judge 2
  judge2_id: string | null;
  judge2_name: string;
  judge2_email: string | null;
  judge2_marks: number | null; // null if not submitted or draft
  judge2_marks_display: string; // e.g. "45/50", "Draft", "—"
  judge2_status: "submitted" | "draft" | "pending" | "unassigned";
  judge2_breakdown: CriterionScoreBreakdown[];
  judge2_feedback: string | null;
  judge2_submitted_at: string | null;

  // Assignments & Discrepancies
  assignment_count: number;
  has_discrepancy: boolean;
  discrepancy_message: string | null;

  // Final Combined Score out of 100
  final_score: number | null; // Sum of J1 + J2 when both submitted, otherwise null
  final_score_display: string; // e.g. "87/100", "PENDING", "NOT EVALUATED"

  // Status
  status: "FULLY EVALUATED" | "PARTIALLY EVALUATED" | "IN PROGRESS" | "NOT EVALUATED" | "ASSIGNMENT DISCREPANCY";
  status_badge_text: string;
}

export interface JudgeEvaluationMatrixKPIs {
  total_teams: number;
  fully_evaluated: number;
  pending_evaluations: number;
  not_evaluated: number;
  discrepancies: number;
  average_final_score: number | null;
  highest_final_score: number | null;
}

export interface JudgeEvaluationMatrixResponse {
  success: boolean;
  error?: string;
  round?: {
    id: string;
    title: string;
    status: string;
  } | null;
  criteria?: EvaluationCriterion[];
  rows?: JudgeEvaluationMatrixRow[];
  kpis?: JudgeEvaluationMatrixKPIs;
  uniqueJudges?: string[];
}
