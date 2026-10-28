import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ParticipantsPortal from "./participants-client";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage() {
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

  if (!profile || !["admin", "staff", "organizer", "spoc"].includes(profile.role)) {
    redirect("/login");
  }

  return <ParticipantsPortal />;
}
