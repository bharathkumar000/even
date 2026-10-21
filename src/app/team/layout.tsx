import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTeamRegistrationByEmail } from "@/lib/googleSheet";

import TeamSidebar from "@/components/team/Sidebar";

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile as { role?: string })?.role || (user.user_metadata?.role as string | undefined);
  if (!profile || (userRole !== "participant" && userRole !== "leader" && userRole !== "admin")) {
    redirect("/login");
  }

  // Find team details
  const { data: memberRow } = await supabaseAdmin
    .from("team_members")
    .select("role, team_id, teams (id, name, track, leader_name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  // Check portal_account_links if team_members has no record
  let linkTeam: any = null;
  if (!memberRow) {
    const { data: link } = await supabaseAdmin
      .from("portal_account_links")
      .select("team_id, teams (id, name, track, leader_name)")
      .or(`user_id.eq.${user.id},login_email.eq.${user.email}`)
      .limit(1)
      .maybeSingle();
    if (link?.teams) {
      linkTeam = link.teams;
    }
  }

  // Attempt to fetch registration data from Google Sheet (by team code or user email)
  let googleTeam: any = null;
  const teamCode = (memberRow as any)?.teams?.code || (linkTeam as any)?.code || user.user_metadata?.team_code;
  if (teamCode) {
    try {
      const { getTeamRegistrationByTeamId } = await import("@/lib/googleSheet");
      const reg = await getTeamRegistrationByTeamId(teamCode);
      if (reg && reg["Team Name"]) {
        googleTeam = {
          name: reg["Team Name"],
          track: reg["SELECTED DOMAIN"] ?? (memberRow as any)?.teams?.track,
          leader_name: reg["Team Leader"] ?? user.email?.split("@")[0],
        };
      }
    } catch {
      // fallback
    }
  }
  if (!googleTeam && user.email) {
    try {
      const reg = await getTeamRegistrationByEmail(user.email);
      if (reg && reg["Team Name"]) {
        googleTeam = {
          name: reg["Team Name"],
          track: reg["SELECTED DOMAIN"] ?? "",
          leader_name: reg["Team Leader"] ?? user.email?.split("@")[0],
        };
      }
    } catch {
      // fallback
    }
  }

  const isLeader =
    userRole === "leader" ||
    (memberRow as { role?: string } | null)?.role === "leader";

  const teamData = (memberRow as any)?.teams || linkTeam;
  const effectiveTeam = googleTeam ?? teamData;
  const teamName = effectiveTeam?.name || "Innovation Team";
  const track = effectiveTeam?.track || "Innovation";
  const leaderName = effectiveTeam?.leader_name || user.email?.split("@")[0] || "Leader";

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#050508] text-text-primary">
      <TeamSidebar
        teamName={teamName}
        leaderName={leaderName}
        track={track}
        isLeader={isLeader}
      />
      <main
        className="flex-1 p-6 md:p-10 md:overflow-y-auto overscroll-contain h-full"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(0, 240, 255, 0.05), transparent 500px), radial-gradient(circle at bottom left, rgba(255, 0, 127, 0.05), transparent 500px)",
        }}
      >
        <div className="max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
