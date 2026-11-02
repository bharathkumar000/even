import { SkeletonDashboard, SkeletonGrid } from "@/components/ui/skeleton-loader";
import { Shield, Phone, Search } from "lucide-react";

export default function AssignedTeamsLoadingSkeleton() {
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
            <Shield className="w-8 h-8 md:w-10 md:h-10 text-accent-secondary animate-pulse" />
            <span className="h-10 w-40 bg-surface-color/60 rounded animate-pulse" />
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-3xl m-0">
            View and manage all teams assigned to you as an SPOC/Staff member.
            Team details, members, submissions, and assignment information in one place.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-surface-color/50 border border-border-color rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent-secondary/15 border border-accent-secondary/40 flex items-center justify-center animate-pulse">
              <Shield className="w-6 h-6 text-accent-secondary" />
            </div>
            <div>
              <h2 className="font-heading text-lg text-text-primary m-0">
                <span className="h-5 w-32 bg-surface-color/60 rounded animate-pulse" />
              </h2>
              <p className="text-xs text-text-secondary font-mono m-0">
                <span className="h-4 w-64 bg-surface-color/40 rounded animate-pulse" />
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-accent-secondary animate-pulse" />
              <span className="h-4 w-24 bg-surface-color/60 rounded animate-pulse" />
            </span>
          </div>
        </div>
      </div>

      <div className="bg-surface-color/50 border border-border-color rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search by team name, code, or ID..."
              className="w-full pl-9 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-secondary outline-none font-mono"
              readOnly
            />
          </div>
          <select className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 outline-none focus:border-accent-secondary uppercase" disabled>
            <option value="all">All Statuses</option>
          </select>
          <select className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 outline-none focus:border-accent-secondary uppercase" disabled>
            <option value="all">All Tracks</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <SkeletonGrid count={6} />
      </div>
    </div>
  );
}
