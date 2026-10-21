import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import GatewayClient from "@/components/gateway/GatewayClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vice Verse 1.0 — Central Gateway & Portals",
  description:
    "Unified Multi-Portal Event Network for Club Member, Judge, TEAM_LEADER, and Admin Portals — Innovators & Visionaries Club (IVC) × InUnity",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userProfile: {
    id: string;
    email?: string;
    role?: string;
    fullName?: string;
  } | null = null;

  if (user) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      const resolvedRole =
        profile?.role ||
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        "participant";

      const resolvedName =
        profile?.full_name ||
        (user.user_metadata?.full_name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Authenticated User";

      userProfile = {
        id: user.id,
        email: user.email,
        role: resolvedRole,
        fullName: resolvedName,
      };
    } catch {
      userProfile = {
        id: user.id,
        email: user.email,
        role: (user.user_metadata?.role as string | undefined) || "participant",
        fullName: user.email?.split("@")[0],
      };
    }
  }

  // Fetch real-time announcements
  const announcements = await getActiveAnnouncements("all");

  // Fetch telemetry: active evaluation round, teams count, judges count
  let activeRoundTitle = "Round 1: Innovation & Pitch";
  let teamsCount = 20;
  let judgesCount = 5;

  try {
    const { data: activeRound } = await supabaseAdmin
      .from("evaluation_rounds")
      .select("title")
      .eq("status", "open")
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (activeRound?.title) {
      activeRoundTitle = activeRound.title;
    }

    const { count: tCount } = await supabaseAdmin
      .from("teams")
      .select("*", { count: "exact", head: true });
    if (typeof tCount === "number" && tCount > 0) {
      teamsCount = tCount;
    }

    const { count: jCount } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "judge");
    if (typeof jCount === "number" && jCount > 0) {
      judgesCount = jCount;
    }
  } catch (err) {
    console.warn("Telemetry fetch fallback utilized:", err);
  }

  return (
    <GatewayClient
      user={userProfile}
      announcements={announcements}
      stats={{
        teamsCount,
        judgesCount,
        activeRoundTitle,
      }}
    />
  );
}
