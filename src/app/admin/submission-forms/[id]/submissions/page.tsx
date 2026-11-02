import { getFormSubmissionOverview } from "@/app/actions/team-submissions";
import { requireAdmin } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Download, Search, ChevronDown } from "lucide-react";

interface TeamSubmissionStatus {
  team_id: string;
  team_name: string;
  team_track: string | null;
  team_leader_name: string | null;
  status: "not_started" | "draft" | "submitted";
  submission_id: string | null;
  version: number | null;
  submitted_at: string | null;
  reference_number: string | null;
  answers: Record<string, unknown> | null;
  file_references: any[] | null;
}

export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const { search = "", status: statusFilter = "" } = await searchParams;

  const { overview, error } = await getFormSubmissionOverview(id);

  if (error) {
    redirect(`/admin/submission-forms?error=${encodeURIComponent(error)}`);
  }

  if (!overview) {
    redirect(`/admin/submission-forms?error=Form not found`);
  }

  const { teams: allTeams, totalTeams, notStarted, draftCount, submittedCount, completionPercentage } = overview;

  // Apply search filter
  let filteredTeams = allTeams;
  if (search.trim()) {
    const term = search.trim().toLowerCase();
    filteredTeams = allTeams.filter(
      (t) =>
        t.team_name.toLowerCase().includes(term) ||
        t.team_id.toLowerCase().includes(term) ||
        (t.team_leader_name && t.team_leader_name.toLowerCase().includes(term))
    );
  }

  // Apply status filter
  if (statusFilter) {
    filteredTeams = filteredTeams.filter((t) => t.status === statusFilter);
  }

  const statusCounts: Record<string, number> = {
    not_started: notStarted,
    draft: draftCount,
    submitted: submittedCount,
  };

  return (
    <div className="space-y-8 font-tech">
      <div className="border-b border-border-color pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
              Admin HQ // Project Submissions
            </p>
            <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
              Submission Management
            </h1>
            <p className="font-tech text-text-secondary text-xs mt-2 max-w-2xl">
              Review team project deliverables, track submission status, and manage evaluation workflow.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/submission-forms"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border-color text-accent-secondary rounded text-xs font-bold uppercase tracking-wider transition-all hover:bg-accent-secondary/10"
            >
              <span>Back to Forms</span>
            </Link>
            <a
              href={`/api/admin/submission-forms/${id}/submissions/export`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 shadow-[0_0_18px_rgba(255,0,127,0.28)]"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </a>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="glass-panel p-5 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
            Total Teams
          </p>
          <p className="font-heading text-2xl m-0 mt-1 text-text-primary">{totalTeams}</p>
        </div>
        <div className="glass-panel p-5 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
            Not Started
          </p>
          <p className="font-heading text-2xl m-0 mt-1 text-text-secondary">{notStarted}</p>
        </div>
        <div className="glass-panel p-5 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
            Draft
          </p>
          <p className="font-heading text-2xl m-0 mt-1 text-status-warning">{draftCount}</p>
        </div>
        <div className="glass-panel p-5 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
            Submitted
          </p>
          <p className="font-heading text-2xl m-0 mt-1 text-status-success">{submittedCount}</p>
        </div>
        <div className="glass-panel p-5 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
            Completion %
          </p>
          <p className="font-heading text-2xl m-0 mt-1 text-accent-tertiary">{completionPercentage}%</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="glass-panel p-4 border border-border-color rounded-lg">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary/50" />
            <input
              type="text"
              placeholder="Search by team name, team ID, or leader..."
              defaultValue={search}
              className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-secondary transition-colors pl-9"
            />
          </div>
          <div className="relative">
            <select
              defaultValue={statusFilter}
              className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-text-primary focus:outline-none focus:border-accent-secondary transition-colors appearance-none"
            >
              <option value="">All Statuses</option>
              <option value="not_started">Not Started</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary/50 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="glass-panel p-6 border border-border-color rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-surface-color-light/50 text-text-secondary uppercase tracking-wider">
            <tr>
              <th className="p-3 w-24">Team Name</th>
              <th className="p-3 w-32">Team Leader</th>
              <th className="p-3 w-24 text-center">Status</th>
              <th className="p-3 w-20 text-center">Version</th>
              <th className="p-3 w-32">Reference #</th>
              <th className="p-3">Submitted At</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color/40">
            {filteredTeams.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-text-secondary">
                  <FileText size={24} className="mx-auto mb-3 text-text-secondary/40" />
                  <p className="text-sm text-text-primary uppercase m-0">
                    No teams found
                  </p>
                </td>
              </tr>
            ) : (
              filteredTeams.map((team: TeamSubmissionStatus) => {
                const isSubmitted = team.status === "submitted";
                const isDraft = team.status === "draft";
                const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
                  not_started: { bg: "bg-surface-color-light", text: "text-text-secondary", border: "border-border-color" },
                  draft: { bg: "bg-status-warning/10", text: "text-status-warning", border: "border-status-warning/40" },
                  submitted: { bg: "bg-status-success/10", text: "text-status-success", border: "border-status-success/40" },
                };
                const cfg = statusConfig[team.status];

                return (
                  <tr key={team.team_id} className="hover:bg-surface-color-light/40 transition-colors">
                    <td className="p-3 text-text-primary truncate max-w-xs">
                      {team.team_name}
                      {team.team_track && (
                        <span className="text-[9px] text-text-secondary ml-1 block">
                          ({team.team_track})
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-text-secondary truncate max-w-xs">
                      {team.team_leader_name || "—"}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      >
                        {team.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-center text-text-secondary">
                      {isSubmitted ? `v${team.version}` : "—"}
                    </td>
                    <td className="p-3 font-mono text-text-secondary truncate max-w-xs">
                      {isSubmitted ? team.reference_number : isDraft ? "Draft" : "—"}
                    </td>
                    <td className="p-3 text-text-secondary font-mono">
                      {team.submitted_at ? new Date(team.submitted_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isSubmitted && (
                          <Link
                            href={`/admin/submission-forms/${id}/submissions/${team.submission_id}`}
                            className="p-1.5 border border-border-color rounded text-text-secondary hover:text-accent-tertiary hover:border-accent-secondary/50 transition-colors"
                            title="View Submission"
                          >
                            <FileText size={13} />
                          </Link>
                        )}
                        {isDraft && (
                          <button
                            className="p-1.5 border border-border-color rounded text-text-secondary hover:text-accent-tertiary hover:border-accent-secondary/50 transition-colors"
                            title="View Draft"
                            onClick={() => {
                              alert("Draft answers: " + JSON.stringify(team.answers || {}, null, 2));
                            }}
                          >
                            <FileText size={13} />
                          </button>
                        )}
                        {!isSubmitted && !isDraft && (
                          <span className="p-1.5 text-text-secondary/30">
                            <FileText size={13} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredTeams.length > 0 && (
        <div className="text-xs text-text-secondary/60 mt-2">
          Showing {filteredTeams.length} of {totalTeams} teams •
          {Object.entries(statusCounts)
            .filter(([, count]) => count > 0)
            .map(([key, count]) => `${key.replace("_", " ")}: ${count}`)
            .join(" • ")}
        </div>
      )}
    </div>
  );
}
