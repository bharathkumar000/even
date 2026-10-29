import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import ParticipantsPortal from "./participants-client";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage() {
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
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = result.data;
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    profile = null;
  }

  if (!profile || !["admin", "staff", "organizer", "spoc"].includes(profile.role)) {
    redirect("/login");
  }

  let announcements: any[] = [];
  try {
    announcements = await getActiveAnnouncements();
  } catch (err) {
    console.error("Failed to fetch announcements:", err);
  }

  return (
    <>
      <AnnouncementBanner announcements={announcements} portalName="Participants Portal" audience="all" />
      <ParticipantsPortal />
    </>
  );
}
