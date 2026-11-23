import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { validateUuid } from "@/lib/auth/uuid";

export async function requireTeamLeader(teamId: string) {
  // Validate teamId is a proper UUID before any database query.
  const validTeamId = validateUuid(teamId, "team_id");
  if (!validTeamId) {
    throw new Error("FORBIDDEN: Invalid team ID");
  }

  // Single authenticated session lookup.
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }

  const user = session.user;

  let member;
  try {
    const result = await supabaseAdmin
      .from("team_members")
      .select("role")
      .eq("team_id", validTeamId)
      .eq("user_id", user.id)
      .maybeSingle();
    member = result.data;
  } catch (err) {
    console.error("Failed to fetch team membership:", err);
    throw new Error("FORBIDDEN: Failed to verify team membership");
  }

  if (!member || (member as { role?: string }).role !== "leader") {
    throw new Error("FORBIDDEN: Only the Team Leader can perform this action");
  }

  return { user, member };
}

export async function requireAuthenticatedTeamUser() {
  // Single authenticated session lookup.
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }

  const user = session.user;

  let membership;
  try {
    const result = await supabaseAdmin
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    membership = result.data;
  } catch (err) {
    console.error("Failed to fetch team membership:", err);
    throw new Error("UNAUTHENTICATED: Failed to verify team membership");
  }

  let teamId = membership?.team_id || null;
  let role = membership?.role || "member";

  // Fallback: If user is not in team_members, check team_registrations by user email
  if (!teamId && user.email) {
    try {
      const { data: regByLeader } = await supabaseAdmin
        .from("team_registrations")
        .select("team_id, leader_email, login_email")
        .or(`leader_email.ilike.${user.email},login_email.ilike.${user.email}`)
        .limit(1)
        .maybeSingle();

      if (regByLeader?.team_id) {
        const validId = validateUuid(regByLeader.team_id, "team_id");
        if (validId) {
          teamId = validId;
          role = "leader";
        }
      }
    } catch {
      // Ignore fallback query error
    }
  }

  // Check profile role to allow designated leaders/admins
  if (role !== "leader") {
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.role === "leader" || prof?.role === "admin") {
        role = "leader";
      }
    } catch {
      // Ignore
    }
  }

  return { user, teamId, role };
}
