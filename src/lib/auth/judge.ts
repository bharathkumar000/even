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

  // Admins can evaluate any team; judges must be assigned to this team (any round).
  // Round-specific validation is handled separately in the evaluation action.
  if (profile?.role !== "admin") {
    const { data: assignment, error: assignError } = await supabaseAdmin
      .from("judge_assignments")
      .select("id, round_id")
      .eq("judge_id", user.id)
      .eq("team_id", teamId)
      .maybeSingle();

    if (assignError || !assignment) {
      throw new Error("Forbidden: You are not assigned to evaluate this team");
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
