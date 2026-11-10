import type { Metadata } from "next";
import { getRegistrations } from "@/app/actions/team-registration";
import RegistrationsClientView from "./registrations-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team Registrations & Payment Proofs · Admin HQ | Eventra",
  description: "Review submitted registrations, verify payment screenshots, and auto-provision team credentials.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminRegistrationsPage() {
  const result = await getRegistrations("all");
  const initialRegistrations = result.registrations || [];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-border-color pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-tech text-xs uppercase tracking-[3px] text-cyan-400 font-bold mb-1">
              Admin HQ // Verification Pipeline
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading text-text-primary tracking-wider uppercase m-0">
              Registrations & Payment Verification
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-tech text-xs font-bold uppercase rounded-lg">
              Live Applications
            </span>
          </div>
        </div>
        <p className="font-tech text-text-secondary text-xs mt-2">
          Review participant squad rosters, inspect payment proof screenshots, and approve registrations to automatically provision login credentials and official QR passes.
        </p>
      </div>

      <RegistrationsClientView initialRegistrations={initialRegistrations} />
    </div>
  );
}
