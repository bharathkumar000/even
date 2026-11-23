import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import EvaluateClientView, {
  TeamDetail,
  SubmissionDetail,
  ActiveRoundDetail,
  CriterionDetail,
  ExistingEvaluationDetail,
} from "./evaluate-client";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EvaluateTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<{ round?: string }>;
}) {
  const { teamId: slugOrId } = await params;
  const { round: queryRoundId } = (await searchParams) || {};

  // Resolve the actual team ID. If the segment looks like a UUID we use it directly; otherwise we treat it as a slug derived from the team name.
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let teamId = slugOrId;
  if (!uuidRegex.test(slugOrId)) {
    // Assume it's a slug; attempt to find the associated team ID.
    try {
      const teamsRes = await supabaseAdmin.from("teams").select("id, name");
      if (teamsRes.data) {
        const match = teamsRes.data.find((t: any) => slugify(t.name) === slugOrId);
        if (match) {
          teamId = match.id;
        } else {
          console.error(`No team found for slug: ${slugOrId}`);
        }
      }
    } catch (e) {
      console.error("Error resolving team slug to ID:", e);
    }
  }

  let team: TeamDetail | null = null;
  let submission: SubmissionDetail | null = null;
  let activeRound: ActiveRoundDetail | null = null;
  let criteria: CriterionDetail[] = [];
  let existingEvaluation: ExistingEvaluationDetail | null = null;

  // Get the authenticated judge's user ID for evaluation isolation
  let currentJudgeId: string | null = null;
  try {
    const session = await getAuthenticatedUser();
    if (session.isAuthenticated && session.user) {
      currentJudgeId = session.user.id;
    }
  } catch {
    // Auth errors are non-fatal here; evaluation will be empty if unauthenticated
  }

  try {
    // 1. Fetch team, submission, and judge-specific assignment in parallel
    const [teamRes, subRes, assignmentRes] = await Promise.all([
      supabaseAdmin
        .from("teams")
        .select("id, name, code, track, leader_name, status")
        .eq("id", teamId)
        .single(),
      supabaseAdmin
        .from("team_submissions")
        .select("id, team_id, form_id, submission_state, answers, file_references, submitted_by, submitted_at, created_at, updated_at")
        .eq("team_id", teamId)
        .maybeSingle(),
      currentJudgeId
        ? supabaseAdmin
            .from("judge_assignments")
            .select("round_id")
            .eq("judge_id", currentJudgeId)
            .eq("team_id", teamId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (teamRes.data) team = teamRes.data;
    if (subRes.data) submission = subRes.data;

    // 2. Resolve target round:
    // Priority a: Explicit round specified in URL (?round=<id>)
    // Priority b: Round explicitly assigned to this judge for this team in judge_assignments
    // Priority c: Active open/reopened round
    // Priority d: Any round (draft/first available)
    let targetRound: ActiveRoundDetail | null = null;

    if (queryRoundId && uuidRegex.test(queryRoundId)) {
      const { data: qRound } = await supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, status, sequence_order, event_id")
        .eq("id", queryRoundId)
        .maybeSingle();
      if (qRound) targetRound = qRound;
    }

    if (!targetRound && assignmentRes?.data?.round_id) {
      const { data: aRound } = await supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, status, sequence_order, event_id")
        .eq("id", assignmentRes.data.round_id)
        .maybeSingle();
      if (aRound) targetRound = aRound;
    }

    if (!targetRound) {
      const { data: openRound } = await supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, status, sequence_order, event_id")
        .in("status", ["open", "reopened"])
        .order("sequence_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (openRound) targetRound = openRound;
    }

    if (!targetRound) {
      const { data: fallbackRound } = await supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, status, sequence_order, event_id")
        .order("sequence_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fallbackRound) targetRound = fallbackRound;
    }

    if (targetRound) {
      activeRound = targetRound;

      let evalQuery = supabaseAdmin
        .from("evaluations")
        .select("id, round_id, team_id, judge_id, status, total_score, scores_breakdown, feedback, created_at, updated_at")
        .eq("round_id", targetRound.id)
        .eq("team_id", teamId);

      if (currentJudgeId) {
        evalQuery = evalQuery.eq("judge_id", currentJudgeId);
      }

      const [critRes, evalRes] = await Promise.all([
        supabaseAdmin
          .from("evaluation_criteria")
          .select("id, round_id, title, description, max_marks, weightage, is_required")
          .eq("round_id", targetRound.id)
          .order("created_at", { ascending: true }),
        evalQuery.maybeSingle(),
      ]);

      if (critRes.data) criteria = critRes.data;
      if (evalRes.data) existingEvaluation = evalRes.data;
    }
  } catch (err) {
    console.error("Failed to load evaluation context:", err);
  }

  return (
    <EvaluateClientView
      teamId={teamId}
      team={team}
      submission={submission}
      activeRound={activeRound}
      criteria={criteria}
      existingEvaluation={existingEvaluation}
    />
  );
}
