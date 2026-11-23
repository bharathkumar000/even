import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { validateUuid } from "@/lib/auth/uuid";
import TeamDashboardClient from "./team-dashboard-client";

export const dynamic = "force-dynamic";

export default async function TeamDashboardPage() {
  // Single authenticated session lookup via shared helper.
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }
  const user = session.user;
  const userRole = session.profile?.role ?? "participant";

  // Resolve team membership from team_members table.
  let teamId: string | null = null;
  let role = "member";

  try {
    const memberRes = await supabaseAdmin
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (memberRes.data) {
      teamId = memberRes.data.team_id;
      role = memberRes.data.role || "member";
    }
  } catch {
    // Membership lookup failed; continue without team context.
  }

  // Fallback: check team_registrations by email if no team_members record.
  if (!teamId && user.email) {
    try {
      const regRes = await supabaseAdmin
        .from("team_registrations")
        .select("team_id, leader_email, login_email, role")
        .or(`leader_email.ilike.${user.email},login_email.ilike.${user.email}`)
        .limit(1)
        .maybeSingle();
      if (regRes?.data?.team_id) {
        const validTeamId = validateUuid(regRes.data.team_id, "team_id");
        if (validTeamId) {
          teamId = validTeamId;
          role = "leader";
        }
      }
    } catch {
      // Ignore fallback query error
    }
  }

  // Allow designated leaders/admins without team_members record.
  if (role !== "leader" && (userRole === "leader" || userRole === "admin")) {
    role = "leader";
  }

  const effectiveTeamId = teamId;

  return (
    <TeamDashboardClient
      initialTeamId={effectiveTeamId || ""}
      initialTeam={null}
      initialMembers={[]}
      initialActivityLogs={[]}
      initialSubmission={null}
      initialActiveRound={null}
      initialResults={null}
      initialAnnouncements={[]}
      initialAssignedSpoc={null}
      initialAssignedPS={null}
    />
  );
}
