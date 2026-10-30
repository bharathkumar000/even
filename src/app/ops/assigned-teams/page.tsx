import { Suspense } from "react";
import { getMyAssignedTeams } from "@/app/actions/staff-assigned-teams";
import AssignedTeamsClientView from "./assigned-teams-client";
import { Loader2, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AssignedTeamsPage() {
  const data = await getMyAssignedTeams();

  return (
    <div className="space-y-8 animate-fade-in font-tech">
      <div className="border-b border-border-color pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent-secondary animate-pulse" />
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold m-0">
              Operations // SPOC Dashboard
            </p>
          </div>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
            <Shield className="w-8 h-8 md:w-10 md:h-10 text-accent-secondary" />
            My Assigned Teams
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-3xl m-0">
            View and manage all teams assigned to you as an SPOC/Staff member.
            Team details, members, submissions, and assignment information in one place.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="min-h-[400px] flex flex-col items-center justify-center border border-border-color bg-surface-color/50 rounded p-8">
            <Loader2 className="w-8 h-8 text-accent-secondary animate-spin mb-3" />
            <p className="font-tech text-text-secondary text-sm uppercase tracking-wider">
              Loading your assigned teams…
            </p>
          </div>
        }
      >
        <AssignedTeamsClientView
          initialData={data}
        />
      </Suspense>
    </div>
  );
}