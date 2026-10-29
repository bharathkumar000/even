import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import TeamSidebar from "@/components/team/Sidebar";
import SessionSync from "@/components/auth/SessionSync";
import { getTeamRegistrationByEmail } from "@/lib/googleSheet";
import TeamMobileNav from "@/components/team/MobileNavDrawer";
import { getAuthorizedPortalUrl } from "@/lib/auth/portal-route";

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

  let profile;
  try {
    const result = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    profile = result.data;
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    profile = null;
  }

  const userRole =
    profile?.role ||
    (user.user_metadata?.role as string | undefined) ||
    (user.app_metadata?.role as string | undefined);

  const isAuthorized =
    userRole === "participant" || userRole === "leader" || userRole === "admin";

  if (!isAuthorized) {
    const authorizedUrl = getAuthorizedPortalUrl(userRole);
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

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#050508] text-text-primary">
      <div className="hidden md:block">
        <TeamSidebar
          teamName={teamName}
          leaderName={leaderName}
          track={track}
          isLeader={isLeader}
        />
      </div>
      <div className="md:hidden sticky top-0 z-30">
        <TeamMobileNav />
      </div>
        <main
          className="flex-1 p-3.5 sm:p-6 md:p-10 md:overflow-y-auto overscroll-contain h-full mt-14 md:mt-0"
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
