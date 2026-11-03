import { requireOperationsRole } from "@/lib/auth/operations";
import TeamLookupClientView from "./team-lookup-client";

export const dynamic = "force-dynamic";

export default async function TeamLookupPage() {
  await requireOperationsRole();

  return (
    <div className="space-y-8 animate-fade-in font-tech">
      <div className="border-b border-border-color pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
            Operations // Team Verification
          </p>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
            Team Lookup
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-3xl m-0">
            Search any registered team by Team ID or name. View team details, member roster, and activity history.
            Perform check-in and distribution actions manually without requiring a QR scan.
          </p>
        </div>
      </div>

      <TeamLookupClientView />
    </div>
  );
}
