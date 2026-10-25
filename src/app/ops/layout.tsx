import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import OpsSidebar from "@/components/ops/Sidebar";
import PortalAccessDenied from "@/components/navigation/PortalAccessDenied";
import OpsMobileNav from "@/components/ops/MobileNavDrawer";

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

  if (role !== "staff" && role !== "organizer" && role !== "admin") {
    return (
      <PortalAccessDenied
        portalTitle="Club Member Operations Desk"
        requiredRoleLabel="Club Member / Operations Staff"
        accentColor="cyan"
        currentUser={{
          id: user.id,
          email: user.email,
          role: role || "participant",
          fullName: profile?.full_name || (user.user_metadata?.full_name as string | undefined),
        }}
      />
    );
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
        </div>
      </main>
    </div>
  );
}
