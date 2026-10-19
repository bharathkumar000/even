import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import TeamSidebar from "@/components/team/Sidebar";
import PortalAccessDenied from "@/components/navigation/PortalAccessDenied";

export const dynamic = "force-dynamic";

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
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const userRole =
    profile?.role ||
    (user.user_metadata?.role as string | undefined) ||
    (user.app_metadata?.role as string | undefined);

  if (userRole !== "participant" && userRole !== "leader" && userRole !== "admin") {
    return (
      <PortalAccessDenied
        portalTitle="TEAM_LEADER & Participant Console"
        requiredRoleLabel="Team Leader / Participant"
        accentColor="pink"
        currentUser={{
          id: user.id,
          email: user.email,
          role: userRole || "judge",
          fullName: profile?.full_name || (user.user_metadata?.full_name as string | undefined),
        }}
      />
    );
  }

  // Find team details
  const { data: memberRow } = await supabaseAdmin
    .from("team_members")
    .select("role, team_id, teams (id, name, track, leader_name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const isLeader =
    userRole === "leader" ||
    (memberRow as { role?: string } | null)?.role === "leader";

  const teamData = (memberRow as any)?.teams;
  const teamName = teamData?.name || "Innovation Team";
  const track = teamData?.track || "Innovation";
  const leaderName = teamData?.leader_name || user.email?.split("@")[0] || "Leader";

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
