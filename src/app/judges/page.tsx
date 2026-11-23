import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import JudgesPortal from "./judges-client";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function JudgesPage() {
  const session = await getAuthenticatedUser();
  const user = session.user;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff", "spoc"].includes(profile.role)) {
    redirect("/login");
  }

  return <JudgesPortal />;
}
