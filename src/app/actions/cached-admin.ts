"use server";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface CachedAdminUser {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  team_name?: string | null;
}

interface CachedAdminTeam {
  id: string;
  name: string;
  code?: string | null;
  track?: string | null;
  status?: string | null;
  leader_name?: string | null;
}

interface CachedAdminUsersData {
  users: CachedAdminUser[];
  teams: CachedAdminTeam[];
}

interface CachedAdminRound {
  id: string;
  title: string;
  status: string;
  sequence_order: number;
  event_id: string;
}

interface CachedAdminCriterion {
  id: string;
  round_id: string;
  title: string;
  description?: string | null;
  max_marks: number;
  weightage?: number | null;
  is_required?: boolean;
}

interface CachedAdminRoundsData {
  rounds: CachedAdminRound[];
  criteria: CachedAdminCriterion[];
}

/**
 * Server action for cached admin users/teams data.
 * Authenticates admin server-side and returns only authorized data.
 */
export async function getCachedAdminUsers(): Promise<
  | { data: CachedAdminUsersData; error?: null }
  | { data: null; error: string }
> {
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    return { data: null, error: "Authentication required" };
  }

  const role = session.profile?.role;
  if (role !== "admin") {
    return { data: null, error: "Admin role required" };
  }

  const [usersRes, teamsRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, team_name")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("teams")
      .select("id, name, code, track, status, leader_name")
      .order("name", { ascending: true }),
  ]);

  const users: CachedAdminUser[] = (usersRes.data || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    team_name: u.team_name,
  }));

  const teams: CachedAdminTeam[] = (teamsRes.data || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    track: t.track,
    status: t.status,
    leader_name: t.leader_name,
  }));

  return {
    data: { users, teams },
    error: null,
  };
}

/**
 * Server action for cached admin rounds/criteria data.
 * Authenticates admin server-side and returns only authorized data.
 */
export async function getCachedAdminRounds(): Promise<
  | { data: CachedAdminRoundsData; error?: null }
  | { data: null; error: string }
> {
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    return { data: null, error: "Authentication required" };
  }

  const role = session.profile?.role;
  if (role !== "admin") {
    return { data: null, error: "Admin role required" };
  }

  const [roundsRes, criteriaRes] = await Promise.all([
    supabaseAdmin
      .from("evaluation_rounds")
      .select("id, title, status, sequence_order, event_id")
      .order("sequence_order", { ascending: true }),
    supabaseAdmin
      .from("evaluation_criteria")
      .select("id, round_id, title, description, max_marks, weightage, is_required"),
  ]);

  const rounds: CachedAdminRound[] = (roundsRes.data || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    sequence_order: r.sequence_order,
    event_id: r.event_id,
  }));

  const criteria: CachedAdminCriterion[] = (criteriaRes.data || []).map((c: any) => ({
    id: c.id,
    round_id: c.round_id,
    title: c.title,
    description: c.description,
    max_marks: c.max_marks,
    weightage: c.weightage,
    is_required: c.is_required,
  }));

  return {
    data: { rounds, criteria },
    error: null,
  };
}
