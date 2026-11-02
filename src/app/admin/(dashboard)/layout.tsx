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
  // 1. Verify basic Supabase Auth & Admin Profile Role
  let user: any = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      redirect("/login");
    }
    user = data.user;
  } catch (err: any) {
    if (err?.message === "NEXT_REDIRECT" || err?.digest?.includes("NEXT_REDIRECT")) {
      throw err;
    }
    redirect("/login");
  }

  // Canonical: Fetch profile role from database using the authenticated user's UUID.
  // Do not trust user_metadata.role or app_metadata.role for authorization;
  // the database profiles table is the authoritative source.
  let profile: { role?: string } | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  } catch (err) {
    // Profile query error is distinct from authentication failure.
    // Re-throw as a clear error rather than silently redirecting.
    throw new Error(
      "Failed to verify admin privileges. Please contact support."
    );
    // Note: Do not use metadata as a fallback; missing profile = authorization failure.
  }

  // Grant access only when the database profile role is "admin".
  // Metadata must not bypass this check.
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    // Redirect to the user's authorized portal based on their database role.
    const authorizedUrl = getAuthorizedPortalUrl(profile?.role);
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
