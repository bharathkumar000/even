import { redirect } from "next/navigation";
import { requireOperationsRole } from "@/lib/auth/operations";
import OpsSidebar from "@/components/ops/Sidebar";
import OpsMobileNav from "@/components/ops/MobileNavDrawer";

export const dynamic = "force-dynamic";

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireOperationsRole();
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#050508] text-text-primary">
      <div className="hidden md:block"><OpsSidebar /></div>
      <div className="md:hidden"><OpsMobileNav /></div>
      <main
        className="flex-1 p-6 md:p-10 md:overflow-y-auto overscroll-contain h-full"
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
