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

export async function requireAuthenticatedTeamUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Find user's team membership
  const { data: membership } = await supabaseAdmin
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return { user, teamId: membership?.team_id || null, role: membership?.role || "member" };
}
