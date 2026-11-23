import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCachedPublicAnnouncements } from "@/app/actions/cached-public";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import ParticipantsPortal from "./participants-client";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage() {
  const session = await getAuthenticatedUser();
  const user = session.user;

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
    const result = await getCachedPublicAnnouncements();
    announcements = result.data || [];
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
