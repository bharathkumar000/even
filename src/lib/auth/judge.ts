import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { validateUuid } from "@/lib/auth/uuid";

export async function requireActiveJudgeForTeam(teamId: string, roundId?: string) {
  // Validate teamId is a proper UUID before any database query.
  const validTeamId = validateUuid(teamId, "team_id");
  if (!validTeamId) {
    throw new Error("FORBIDDEN: Invalid team ID");
  }

  // Validate roundId if provided.
  const validRoundId = roundId ? validateUuid(roundId, "round_id") : null;
  if (roundId && !validRoundId) {
    throw new Error("FORBIDDEN: Invalid round ID");
  }

  // Single authenticated session lookup — getUser + profile in one call.
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }

  const user = session.user;
  const profile = session.profile;

  // profiles.role is the canonical source of truth for user roles.
  // Never trust auth metadata (user_metadata.role, app_metadata.role).
  const isJudge = profile?.role === "judge" || profile?.role === "admin";

  if (!isJudge) {
    throw new Error("FORBIDDEN: Judge role required");
  }

  // Admins can evaluate any team; judges must be assigned to this team for this round.
  if (profile?.role !== "admin") {
    let jaQuery = supabaseAdmin
      .from("judge_assignments")
      .select("id, round_id")
      .eq("judge_id", user.id)
      .eq("team_id", validTeamId);

    if (validRoundId) {
      jaQuery = jaQuery.eq("round_id", validRoundId);
    }

    const { data: assignment, error: assignError } = await jaQuery.maybeSingle();

    if (assignError || !assignment) {
      const detail = validRoundId
        ? `You are not assigned to evaluate team ${validTeamId} for round ${validRoundId}.`
        : "You are not assigned to evaluate this team.";
      throw new Error(`FORBIDDEN: ${detail}`);
    }
  }

  return { user, profile };
}

export async function requireJudge() {
  // Single authenticated session lookup — getUser + profile in one call.
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }

  const user = session.user;
  const profile = session.profile;

  // profiles.role is the canonical source of truth for user roles.
  // Never trust auth metadata (user_metadata.role, app_metadata.role).
  if (profile?.role !== "judge" && profile?.role !== "admin") {
    throw new Error("FORBIDDEN: Judge role required");
  }

  return { user, profile };
}

export const requireJudgeAuth = requireJudge;
