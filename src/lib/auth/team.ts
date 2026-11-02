import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireTeamLeader(teamId: string) {
  let supabase;
  let user;
  try {
    supabase = await createClient();
    const auth = await supabase.auth.getUser();
    user = auth.data?.user;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  let member;
  try {
    const result = await supabaseAdmin
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .maybeSingle();
    member = result.data;
  } catch (err) {
    console.error("Failed to fetch team membership:", err);
    redirect("/login");
  }

  if (!member || (member as { role?: string }).role !== "leader") {
    throw new Error("Forbidden: Only the Team Leader can perform this action");
  }

  return { user, member };
}

export async function requireAuthenticatedTeamUser() {
  let supabase;
  let user;
  try {
    supabase = await createClient();
    const auth = await supabase.auth.getUser();
    user = auth.data?.user;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

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
    redirect("/login");
  }

  let teamId = membership?.team_id || null;
  let role = membership?.role || "member";

  // Fallback: If user is not in team_members, check teams table by user email
  if (!teamId && user.email) {
    try {
      const { data: teamByLeader } = await supabaseAdmin
        .from("teams")
        .select("id, leader_name")
        .ilike("leader_email", user.email)
        .limit(1)
        .maybeSingle();

      if (teamByLeader) {
        teamId = teamByLeader.id;
        role = "leader";
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
