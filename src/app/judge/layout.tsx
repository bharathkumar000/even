import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JudgeSidebar from "@/components/judge/Sidebar";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import SessionSync from "@/components/auth/SessionSync";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { getAuthorizedPortalUrl } from "@/lib/auth/portal-route";

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

export default async function JudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const role =
    profile?.role ||
    (user.user_metadata?.role as string | undefined) ||
    (user.app_metadata?.role as string | undefined);

  const isAuthorized = role === "judge" || role === "admin";

  const announcements = await getActiveAnnouncements("judges");
  if (!isAuthorized) {
    const authorizedUrl = getAuthorizedPortalUrl(role);
    redirect(`${authorizedUrl}?access_denied=1&portal=judge`);
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#050508] text-text-primary">
      <JudgeSidebar />
      <main
        className="flex-1 p-4 sm:p-6 md:p-10 pb-28 sm:pb-24 md:pb-10 md:overflow-y-auto overscroll-contain h-full"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(251, 200, 21, 0.04), transparent 500px), radial-gradient(circle at bottom left, rgba(255, 0, 127, 0.04), transparent 500px)",
        }}
      >
        <div className="max-w-7xl mx-auto w-full">
                    <AnnouncementBanner announcements={announcements} portalName="Judge Portal" />
        {children}
        <SessionSync />
        </div>
      </main>
    </div>
  );
}
