import "server-only";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireActiveJudgeForTeam(teamId: string, roundId?: string) {
  const supabase = await createClient();

  // Use getUser() for secure server-side identity verification.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized: Authentication required");
  }

  // profiles.role is the canonical source of truth for user roles.
  // Never trust auth metadata (user_metadata.role, app_metadata.role).
  let profile: { role?: string } | null = null;
  try {
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = profileData;
  } catch (err) {
    throw new Error(
      "Failed to verify judge privileges. Please contact support."
    );
  }

  const isJudge = profile?.role === "judge" || profile?.role === "admin";

  if (!isJudge) {
    throw new Error("Forbidden: Judge role required");
  }

  // Admins can evaluate any team; judges must be assigned to this team for this round.
  if (profile?.role !== "admin") {
    let jaQuery = supabaseAdmin
      .from("judge_assignments")
      .select("id, round_id")
      .eq("judge_id", user.id)
      .eq("team_id", teamId);

    if (roundId) {
      jaQuery = jaQuery.eq("round_id", roundId);
    }

    const { data: assignment, error: assignError } = await jaQuery.maybeSingle();

    if (assignError || !assignment) {
      const detail = roundId
        ? `You are not assigned to evaluate team ${teamId} for round ${roundId}.`
        : "You are not assigned to evaluate this team.";
      throw new Error(`Forbidden: ${detail}`);
    }
  }

  return { user, profile };
}

export async function requireJudge() {
  const supabase = await createClient();

  // Use getUser() for secure server-side identity verification.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized: Authentication required");
  }

  // profiles.role is the canonical source of truth for user roles.
  // Never trust auth metadata (user_metadata.role, app_metadata.role).
  let profile: { role?: string } | null = null;
  try {
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = profileData;
  } catch (err) {
    // Profile query error is distinct from authentication failure.
    throw new Error(
      "Failed to verify judge privileges. Please contact support."
    );
  }

  if (profile?.role !== "judge" && profile?.role !== "admin") {
    throw new Error("Forbidden: Judge role required");
  }

  return { user, profile };
}

export const requireJudgeAuth = requireJudge;
