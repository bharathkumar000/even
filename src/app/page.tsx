import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vice Verse 1.0 — IVC PULSE",
  description:
    "Unified Multi-Portal Event Network for Club Member, Judge, TEAM_LEADER, and Admin Portals — Innovators & Visionaries Club (IVC) × InUnity",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Determine user's portal
  let role =
    (user.user_metadata?.role as string | undefined) ||
    (user.app_metadata?.role as string | undefined);

  if (!role) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role) role = profile.role;
    } catch {
      // fallback
    }
  }

  if (role === "admin") redirect("/admin");
  if (role === "judge") redirect("/judge");
  if (role === "staff" || role === "organizer") redirect("/ops/scanner");
  redirect("/team");
}
