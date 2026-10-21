import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireTeamLeader(teamId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Verify membership and leader role in team_members
  const { data: member, error: memberError } = await supabaseAdmin
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError || !member || (member as { role?: string }).role !== "leader") {
    throw new Error("Forbidden: Only the Team Leader can perform this action");
  }

  return { user, member };
}

import { getTeamRegistrationByEmail } from "@/lib/googleSheet";

export async function requireAuthenticatedTeamUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // 1. Check team_members table
  const { data: membership } = await supabaseAdmin
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let teamId = membership?.team_id || null;
  let role = membership?.role || (user.user_metadata?.role as string) || "member";

  // 2. Check portal_account_links by user_id or email
  if (!teamId) {
    const { data: link } = await supabaseAdmin
      .from("portal_account_links")
      .select("team_id")
      .or(`user_id.eq.${user.id},login_email.eq.${user.email}`)
      .limit(1)
      .maybeSingle();

    if (link?.team_id) {
      teamId = link.team_id;
    }
  }

  // 3. Check user metadata
  if (!teamId && user.user_metadata?.team_id) {
    teamId = user.user_metadata.team_id;
  }

  // 4. Check user metadata team_code
  if (!teamId && user.user_metadata?.team_code) {
    const { data: teamByCode } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("code", user.user_metadata.team_code)
      .limit(1)
      .maybeSingle();

    if (teamByCode?.id) {
      teamId = teamByCode.id;
    }
  }

  // 5. Fallback: Google Sheet registration by user's email
  if (!teamId && user.email) {
    try {
      const reg = await getTeamRegistrationByEmail(user.email);
      if (reg) {
        const teamCode = reg["Team ID"] || reg["Team Code"];
        const teamName = reg["Team Name"];
        if (teamCode || teamName) {
          const { data: matchedTeam } = await supabaseAdmin
            .from("teams")
            .select("id")
            .or(`code.eq.${teamCode || ""},name.eq.${teamName || ""}`)
            .limit(1)
            .maybeSingle();

          if (matchedTeam?.id) {
            teamId = matchedTeam.id;
          }
        }
      }
    } catch (err) {
      console.warn("Failed to lookup team from Google Sheet:", err);
    }
  }

  return { user, teamId, role };
}
