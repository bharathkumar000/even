"use server";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import { validateUuid } from "@/lib/auth/uuid";
import { isDeliverablesUnlocked } from "@/lib/event-schedule";

interface CachedTeamMember {
  id: string;
  user_id?: string | null;
  role?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface CachedTeamInfo {
  id: string;
  name: string;
  track?: string | null;
  leader_name?: string | null;
  created_at?: string | null;
}

interface CachedTeamActivityLog {
  id: string;
  participant_id?: string | null;
  action_type?: string | null;
  created_at?: string | null;
  result?: string | null;
}

interface CachedTeamSubmission {
  id: string;
  team_id: string;
  ppt_url?: string | null;
  github_url?: string | null;
  demo_url?: string | null;
  problem_statement?: string | null;
  proposed_solution?: string | null;
  created_at?: string | null;
}

interface CachedTeamRound {
  id: string;
  title?: string | null;
  status?: string | null;
  sequence_order?: number | null;
}

interface CachedTeamResult {
  id: string;
  team_id: string;
  rank?: number | null;
  total_score?: number | null;
  is_published?: boolean | null;
}

interface CachedTeamData {
  team: CachedTeamInfo | null;
  members: CachedTeamMember[];
  activityLogs: CachedTeamActivityLog[];
  submission: CachedTeamSubmission | null;
  activeRound: CachedTeamRound | null;
  results: CachedTeamResult | null;
  announcements: any[];
  totalMembers: number;
  assignedSpoc: any;
  assignedPS: any;
}

interface CachedTeamDataOptions {
  teamId: string;
}

/**
 * Server action for cached team dashboard data.
 * Authenticates the user server-side and returns only authorized team data.
 * Results are cached client-side via useCachedData.
 */
export async function getCachedTeamData(options: CachedTeamDataOptions): Promise<
  | { data: CachedTeamData; error?: null }
  | { data: null; error: string }
> {
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    return { data: null, error: "Authentication required" };
  }

  const teamId = options.teamId;
  if (!validateUuid(teamId, "team_id")) {
    return { data: null, error: "Invalid team ID" };
  }

  const [teamRes, membersRes, logsRes, subRes, roundRes, resultRes, annRes, spocAssignRes, psAssignRes] =
    await Promise.all([
      supabaseAdmin
        .from("teams")
        .select("id, name, track, leader_name, created_at")
        .eq("id", teamId)
        .maybeSingle(),
      supabaseAdmin
        .from("team_members")
        .select("id, user_id, role, profiles(id, name, email, phone)")
        .eq("team_id", teamId),
      supabaseAdmin
        .from("event_activity_logs")
        .select("id, participant_id, action_type, created_at, result")
        .eq("team_id", teamId)
        .eq("result", "success"),
      supabaseAdmin
        .from("team_submissions")
        .select("id, team_id, ppt_url, github_url, demo_url, problem_statement, proposed_solution, created_at")
        .eq("team_id", teamId)
        .maybeSingle(),
      supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, status, sequence_order")
        .order("sequence_order", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("event_results")
        .select("id, team_id, rank, total_score, is_published")
        .eq("team_id", teamId)
        .eq("is_published", true)
        .maybeSingle(),
      getActiveAnnouncements("teams").catch(() => []),
      supabaseAdmin
        .from("team_spoc_assignments")
        .select(`
          spoc_id,
          spocs (
            id,
            name,
            email,
            phone,
            department,
            notes,
            avatar_url
          )
        `)
        .eq("team_id", teamId)
        .maybeSingle(),
      supabaseAdmin
        .from("team_problem_statement_assignments")
        .select(`
          problem_statement_id,
          problem_statements (
            id,
            reference_number,
            title
          )
        `)
        .eq("team_id", teamId)
        .maybeSingle(),
    ]);

  const team: CachedTeamInfo | null = teamRes.data
    ? {
        id: teamRes.data.id,
        name: teamRes.data.name,
        track: teamRes.data.track,
        leader_name: teamRes.data.leader_name,
        created_at: teamRes.data.created_at,
      }
    : null;

  const members: CachedTeamMember[] = (membersRes.data || []).map((m: any) => {
    const profile = m.profiles;
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      name: profile?.full_name || m.name,
      email: profile?.email || m.email,
      phone: profile?.phone || null,
    };
  });

  const activityLogs: CachedTeamActivityLog[] = (logsRes.data || []).map((l: any) => ({
    id: l.id,
    participant_id: l.participant_id,
    action_type: l.action_type,
    created_at: l.created_at,
    result: l.result,
  }));

  const submission: CachedTeamSubmission | null = subRes.data
    ? {
        id: subRes.data.id,
        team_id: subRes.data.team_id,
        ppt_url: subRes.data.ppt_url,
        github_url: subRes.data.github_url,
        demo_url: subRes.data.demo_url,
        problem_statement: subRes.data.problem_statement,
        proposed_solution: subRes.data.proposed_solution,
        created_at: subRes.data.created_at,
      }
    : null;

  const activeRound: CachedTeamRound | null = roundRes.data
    ? {
        id: roundRes.data.id,
        title: roundRes.data.title,
        status: roundRes.data.status,
        sequence_order: roundRes.data.sequence_order,
      }
    : null;

  const results: CachedTeamResult | null = resultRes.data
    ? {
        id: resultRes.data.id,
        team_id: resultRes.data.team_id,
        rank: resultRes.data.rank,
        total_score: resultRes.data.total_score,
        is_published: resultRes.data.is_published,
      }
    : null;

  const assignedSpoc = spocAssignRes.data && (spocAssignRes.data as any).spocs
    ? (spocAssignRes.data as any).spocs
    : null;

  const assignedPS = psAssignRes?.data && (psAssignRes.data as any).problem_statements
    ? (psAssignRes.data as any).problem_statements
    : null;

  return {
    data: {
      team,
      members,
      activityLogs,
      submission,
      activeRound,
      results,
      announcements: annRes || [],
      totalMembers: Math.max(members.length, 1),
      assignedSpoc,
      assignedPS,
    },
    error: null,
  };
}
