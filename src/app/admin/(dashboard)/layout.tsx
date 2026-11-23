import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AdminSidebar from "@/components/admin/Sidebar";
import SessionSync from "@/components/auth/SessionSync";
import { getAuthorizedPortalUrl } from "@/lib/auth/portal-route";
import { getCsrfToken } from "@/lib/csrf-server";
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

export default async function AdminLayout({
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
  const profile = session.profile;

  // Canonical: role from profiles.table (database source of truth).
  // Never trust user_metadata.role or app_metadata.role for authorization.
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    // Redirect to the user's authorized portal based on their database role.
    const authorizedUrl = profile?.role ? getAuthorizedPortalUrl(profile.role) : "/login";
    redirect(`${authorizedUrl}?access_denied=1&portal=admin`);
  }

  // Generate CSRF token for client-side use
  const csrfToken = await getCsrfToken();

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#050508]">
      <AdminSidebar />
      <main
        className="flex-1 p-5 md:p-10 md:overflow-y-auto overscroll-contain h-full"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(255, 0, 127, 0.08), transparent 500px), radial-gradient(circle at bottom left, rgba(0, 240, 255, 0.05), transparent 500px)",
        }}
      >
        <meta name="csrf-token" content={csrfToken} />
        {children}
        <SessionSync />
      </main>
    </div>
  );
}
