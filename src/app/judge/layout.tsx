import type { Metadata } from "next";
import { redirect } from "next/navigation";
import JudgeSidebar from "@/components/judge/Sidebar";
import SessionSync from "@/components/auth/SessionSync";
import { getAuthenticatedUser, requireJudgeOrAdminUser } from "@/lib/auth/session";
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

export default async function JudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single authenticated session lookup — getUser + profile in one call.
  // No redundant getUser() in child pages/actions.
  const session = await getAuthenticatedUser();

  if (!session.isAuthenticated || !session.user) {
    redirect("/login");
  }

  const role = session.profile?.role;
  const isAuthorized = role === "judge" || role === "admin";

  if (!isAuthorized) {
    const authorizedUrl = role ? getAuthorizedPortalUrl(role) : "/login";
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
          {children}
          <SessionSync />
        </div>
      </main>
    </div>
  );
}
