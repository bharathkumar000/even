import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TeamSidebar from "@/components/team/Sidebar";
import SessionSync from "@/components/auth/SessionSync";
import { getTeamRegistrationByEmail } from "@/lib/googleSheet";
import TeamMobileNav from "@/components/team/MobileNavDrawer";
import { getAuthorizedPortalUrl } from "@/lib/auth/portal-route";
import { isDeliverablesUnlocked } from "@/lib/event-schedule";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single authenticated session lookup — getUser + profile in one call.
  const session = await getAuthenticatedUser();

  if (!session.isAuthenticated || !session.user) {
    redirect("/login");
  }

  const user = session.user;
  const userRole = session.profile?.role;

  const isAuthorized =
    userRole === "participant" || userRole === "leader" || userRole === "admin";

  if (!isAuthorized) {
    const authorizedUrl = userRole ? getAuthorizedPortalUrl(userRole) : "/login";
    redirect(`${authorizedUrl}?access_denied=1&portal=team`);
  }

  let memberRow;
  try {
    const result = await supabaseAdmin
      .from("team_members")
      .select("role, team_id, teams (id, name, track, leader_name)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    memberRow = result.data;
  } catch (err) {
    console.error("Failed to fetch team membership:", err);
    memberRow = null;
  }

  let googleTeam: any = null;
  if (!memberRow && user.email) {
    try {
      const reg = await getTeamRegistrationByEmail(user.email);
      if (reg) {
        googleTeam = {
          name: reg["Team Name"] ?? "",
          track: reg["SELECTED DOMAIN"] ?? "",
          leader_name: reg["Team Leader"] ?? user.email?.split("@")[0],
        };
      }
    } catch (err) {
      console.error("Failed to fetch Google Sheet registration:", err);
    }
  }

  const isLeader =
    userRole === "leader" ||
    (memberRow as { role?: string } | null)?.role === "leader";

  const teamData = (memberRow as any)?.teams;
  const effectiveTeam = teamData ?? googleTeam;
  const teamName = effectiveTeam?.name || "Innovation Team";
  const leaderName = effectiveTeam?.leader_name || user.email?.split("@")[0] || "Leader";
  const track = effectiveTeam?.track || "Innovation";

  const isUnlocked = isDeliverablesUnlocked();

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#050508] text-text-primary">
      <div className="hidden md:block">
        <TeamSidebar
          teamName={teamName}
          leaderName={leaderName}
          track={track}
          isLeader={isLeader}
          isUnlocked={isUnlocked}
        />
      </div>
      <div className="md:hidden sticky top-0 z-30">
        <TeamMobileNav isUnlocked={isUnlocked} />
      </div>
        <main
          className="flex-1 p-3.5 sm:p-6 md:p-10 md:overflow-y-auto overscroll-contain h-full"
          style={{
            background:
              "radial-gradient(circle at top right, rgba(0, 240, 255, 0.05), transparent 500px), radial-gradient(circle at bottom left, rgba(255, 0, 127, 0.05), transparent 500px)",
          }}
        >
        <div className="max-w-6xl mx-auto w-full">
          {children}
        <SessionSync />
        </div>
      </main>
    </div>
  );
}
