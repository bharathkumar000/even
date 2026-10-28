import { Suspense } from "react";
import { getSpocPortalData } from "@/app/actions/admin-spoc";
import SpocClientView from "./spoc-client";
import { Contact2, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSpocPage() {
  const data = await getSpocPortalData();

  return (
    <div className="space-y-8 animate-fade-in font-tech">
      {/* Header */}
      <div className="border-b border-border-color pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent-secondary animate-pulse" />
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold m-0">
              Administration // Coordination Desk
            </p>
          </div>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
            <Contact2 className="w-8 h-8 md:w-10 md:h-10 text-accent-secondary" />
            SPOC Management & Team Allotment
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl m-0">
            Every Staff / Club Member is automatically available as a Single Point
            of Contact (SPOC). Allot registered teams to staff members for
            mentoring and operational assistance.
          </p>
        </div>
      </div>

      {/* Main Dual-Panel View wrapped with Suspense */}
      <Suspense
        fallback={
          <div className="min-h-[400px] flex flex-col items-center justify-center border border-border-color bg-surface-color/50 rounded p-8">
            <Loader2 className="w-8 h-8 text-accent-primary animate-spin mb-3" />
            <p className="font-tech text-text-secondary text-sm uppercase tracking-wider">
              Loading SPOC directory and allotments...
            </p>
          </div>
        }
      >
        <SpocClientView
          initialSpocs={data.spocs}
          initialTeams={data.teams}
        />
      </Suspense>
    </div>
  );
}
