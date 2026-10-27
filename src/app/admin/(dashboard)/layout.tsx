import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AdminSidebar from "@/components/admin/Sidebar";
import PortalAccessDenied from "@/components/navigation/PortalAccessDenied";

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

  // Fast-path metadata check first
  const metaRole =
    (user.user_metadata?.role as string | undefined) ||
    (user.app_metadata?.role as string | undefined);

  let profile: { role?: string } | null = null;
  if (metaRole !== "admin") {
    try {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      profile = data;
    } catch {}
  }

  const isAdmin = profile?.role === "admin" || metaRole === "admin";

  if (!isAdmin) {
    return (
      <PortalAccessDenied
        portalTitle="Admin HQ Mission Control"
        requiredRoleLabel="System Administrator"
        accentColor="purple"
        currentUser={{
          id: user.id,
          email: user.email,
          role: metaRole || profile?.role || "participant",
          fullName: (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0],
        }}
      />
    );
  }

  // 2. Checkpoint Verification: Admin passcode verification required
  const cookieStore = await cookies();
  const isVerified = cookieStore.get("admin_session_verified")?.value === "true";
  if (!isVerified) {
    redirect("/admin/login");
  }

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
        {children}
      </main>
    </div>
  );
}
