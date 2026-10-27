import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import OpsSidebar from "@/components/ops/Sidebar";
import SessionSync from "@/components/auth/SessionSync";
import OpsMobileNav from "@/components/ops/MobileNavDrawer";
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

export default async function OpsLayout({
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

  const isAuthorized =
    role === "staff" ||
    role === "organizer" ||
    role === "admin" ||
    role === "spoc";

  if (!isAuthorized) {
    const authorizedUrl = getAuthorizedPortalUrl(role);
    redirect(`${authorizedUrl}?access_denied=1&portal=ops`);
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#050508] text-text-primary">
      <div className="hidden md:block"><OpsSidebar /></div>
      <div className="md:hidden"><OpsMobileNav /></div>
        <main
          className="flex-1 p-6 md:p-10 md:overflow-y-auto overscroll-contain h-full mt-14 md:mt-0"
          style={{
            background:
              "radial-gradient(circle at top right, rgba(0, 240, 255, 0.05), transparent 500px), radial-gradient(circle at bottom left, rgba(251, 200, 21, 0.04), transparent 500px)",
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
