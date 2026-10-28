import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import AnnouncementBanner from "@/components/AnnouncementBanner";
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
  const announcements = await getActiveAnnouncements();

    return (
    <>
      <AnnouncementBanner announcements={announcements} portalName="Participants Portal" audience="all" />
      <ParticipantsPortal />
    </>
  );
}
