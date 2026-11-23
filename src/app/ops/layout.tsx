import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import OpsSidebar from "@/components/ops/Sidebar";
import SessionSync from "@/components/auth/SessionSync";
import OpsMobileNav from "@/components/ops/MobileNavDrawer";
import { getAuthorizedPortalUrl } from "@/lib/auth/portal-route";
import { getAuthenticatedUser } from "@/lib/auth/session";

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
  // Single authenticated session lookup — getUser + profile in one call.
  const session = await getAuthenticatedUser();

  if (!session.isAuthenticated || !session.user) {
    redirect("/login");
  }

  const user = session.user;
  const role = session.profile?.role;

  const isAuthorized =
    role === "staff" ||
    role === "organizer" ||
    role === "admin" ||
    role === "spoc";

  if (!isAuthorized) {
    const authorizedUrl = role ? getAuthorizedPortalUrl(role) : "/login";
    redirect(`${authorizedUrl}?access_denied=1&portal=ops`);
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#050508] text-text-primary">
      <div className="hidden md:block"><OpsSidebar /></div>
      <div className="md:hidden sticky top-0 z-30"><OpsMobileNav /></div>
      <main
        className="flex-1 p-3.5 sm:p-6 md:p-10 pb-24 md:pb-10 md:overflow-y-auto overscroll-contain h-full"
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
