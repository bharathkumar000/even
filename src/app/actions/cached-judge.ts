"use server";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveAnnouncements } from "@/app/actions/announcements";

interface CachedJudgeTeam {
  id: string;
  name: string;
  leader_name?: string | null;
  track?: string | null;
  status?: string | null;
}

interface CachedJudgeRound {
  id: string;
  title: string;
  status: string;
  sequence_order: number;
}

interface CachedJudgeEvaluation {
  round_id: string;
  team_id: string;
  status: string;
  total_score?: number | null;
}

interface CachedJudgeDashboardData {
  teams: CachedJudgeTeam[];
  rounds: CachedJudgeRound[];
  evaluations: CachedJudgeEvaluation[];
  announcements: any[];
  judgeAssignedTeamIds: string[];
  isJudgeSpecific: boolean;
}

/**
 * Server action for cached judge dashboard data.
 * Authenticates the user server-side and returns only authorized data.
 * Results are cached client-side via useCachedData.
 */
export async function getCachedJudgeDashboard(): Promise<
  | { data: CachedJudgeDashboardData; error?: null }
  | { data: null; error: string }
> {
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    return { data: null, error: "Authentication required" };
  }

  const userId = session.user.id;

  // Fetch judge's assigned team IDs (server-side filter)
  const [assignRes, roundsRes, evalsRes, announcementsData] = await Promise.all([
    supabaseAdmin
      .from("judge_assignments")
      .select("team_id")
      .eq("judge_id", userId),
    supabaseAdmin
      .from("evaluation_rounds")
      .select("id, title, status, sequence_order")
      .order("sequence_order", { ascending: true }),
    supabaseAdmin
      .from("evaluations")
      .select("round_id, team_id, status, total_score")
      .eq("judge_id", userId),
    getActiveAnnouncements("judges").catch(() => []),
  ]);

  const rounds: CachedJudgeRound[] = (roundsRes.data || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    sequence_order: r.sequence_order,
  }));

  const evaluations: CachedJudgeEvaluation[] = (evalsRes.data || []).map((e: any) => ({
    round_id: e.round_id,
    team_id: e.team_id,
    status: e.status,
    total_score: e.total_score,
  }));

  let judgeAssignedTeamIds: string[] = [];
  let isJudgeSpecific = false;
  let teams: CachedJudgeTeam[] = [];

  if (assignRes.data && assignRes.data.length > 0) {
    judgeAssignedTeamIds = assignRes.data.map((a: any) => a.team_id);
    isJudgeSpecific = true;

    // Fetch ONLY assigned teams (server-side filter, not full table scan)
    const teamsRes = await supabaseAdmin
      .from("teams")
      .select("id, name, leader_name, track, status")
      .in("id", judgeAssignedTeamIds);

    teams = (teamsRes.data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      leader_name: t.leader_name,
      track: t.track,
      status: t.status,
    }));
  }

  return {
    data: {
      teams,
      rounds,
      evaluations,
      announcements: announcementsData || [],
      judgeAssignedTeamIds,
      isJudgeSpecific,
    },
    error: null,
  };
}
