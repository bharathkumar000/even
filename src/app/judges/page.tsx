import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import JudgesPortal from "./judges-client";

export const dynamic = "force-dynamic";

export default async function JudgesPage() {
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

  if (!profile || !["admin", "staff", "spoc"].includes(profile.role)) {
    redirect("/login");
  }

  return <JudgesPortal />;
}
