import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireJudge } from "@/lib/auth/judge";
import {
  Layers,
  FileCheck2,
  Award,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import RealtimeRoundsListener from "@/components/RealtimeRoundsListener";

export const dynamic = "force-dynamic";

interface Round {
  id: string;
  title: string;
  sequence_order: number;
  status: string;
}

interface Criterion {
  id: string;
  round_id: string;
  title: string;
  description?: string | null;
  max_marks: number;
  weightage?: number | null;
  is_required?: boolean | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; cls: string; dot: string }> = {
  open: {
    label: "Active / Open",
    icon: <Unlock size={13} />,
    cls: "bg-status-success/10 text-status-success border-status-success/50",
    dot: "bg-status-success animate-pulse",
  },
  reopened: {
    label: "Reopened",
    icon: <Unlock size={13} />,
    cls: "bg-status-success/10 text-status-success border-status-success/50",
    dot: "bg-status-success animate-pulse",
  },
  draft: {
    label: "Draft",
    icon: <Clock size={13} />,
    cls: "bg-surface-color-light text-text-secondary border-border-color",
    dot: "bg-text-secondary/60",
  },
  closed: {
    label: "Closed",
    icon: <CheckCircle2 size={13} />,
    cls: "bg-status-warning/10 text-status-warning border-status-warning/40",
    dot: "bg-status-warning",
  },
  locked: {
    label: "Locked",
    icon: <Lock size={13} />,
    cls: "bg-status-error/10 text-status-error border-status-error/40",
    dot: "bg-status-error",
  },
};

export default async function JudgeRubricsPage() {
  // Require judge auth
  try {
    await requireJudge();
  } catch {
    // layout handles redirect, this is a safety fallback
  }

  let rounds: Round[] = [];
  let criteria: Criterion[] = [];

  try {
    const [roundsRes, criteriaRes] = await Promise.all([
      supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, sequence_order, status")
        .order("sequence_order", { ascending: true }),
      supabaseAdmin
        .from("evaluation_criteria")
        .select("id, round_id, title, description, max_marks, weightage, is_required"),
    ]);

    if (roundsRes.data) rounds = roundsRes.data;
    if (criteriaRes.data) criteria = criteriaRes.data;
  } catch (err) {
    console.error("Failed to load rubrics:", err);
  }

  const getCriteriaForRound = (roundId: string) =>
    criteria.filter((c) => c.round_id === roundId);

  const getTotalMaxMarks = (roundId: string) =>
    getCriteriaForRound(roundId).reduce((sum, c) => sum + (c.max_marks || 0), 0);

  const activeRound = rounds.find(
    (r) => r.status === "open" || r.status === "reopened"
  );

  return (
    <div className="space-y-8 animate-fade-in font-tech">
      <RealtimeRoundsListener channelName="judge-rubrics-rounds" />
      {/* Page Header */}
      <div className="border-b border-border-color pb-6">
        <p className="text-xs uppercase tracking-[3px] text-accent-primary font-bold mb-1">
          Evaluation Criteria // Read-Only View
        </p>
        <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
          Judging Rubrics
        </h1>
        <p className="text-text-secondary text-sm mt-2 max-w-2xl">
          All evaluation rounds, scoring criteria, and maximum mark allocations for this ideathon. This is a read-only reference — grading is done on each team&apos;s evaluation page.
        </p>
      </div>

      {/* Active Round Banner */}
      {activeRound ? (
        <div className="p-4 bg-status-success/10 border border-status-success/40 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-status-success m-0">
              Current Active Round
            </p>
            <p className="text-sm text-text-primary font-heading uppercase m-0">
              {activeRound.title}
            </p>
          </div>
          <span className="ml-auto text-xs text-status-success font-mono uppercase border border-status-success/40 px-2 py-0.5">
            Round {activeRound.sequence_order}
          </span>
        </div>
      ) : (
        <div className="p-4 bg-status-warning/10 border border-status-warning/40 flex items-center gap-3">
          <AlertCircle size={18} className="text-status-warning" />
          <p className="text-xs text-status-warning font-bold uppercase tracking-wider m-0">
            No active evaluation round at this time. Check back when a round is opened by the administrator.
          </p>
        </div>
      )}

      {/* Rounds & Criteria List */}
      {rounds.length === 0 ? (
        <div className="glass-panel p-12 border border-border-color text-center">
          <Layers size={40} className="mx-auto mb-3 text-text-secondary/40" />
          <p className="text-text-secondary text-sm">No evaluation rounds have been configured yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {rounds.map((round) => {
            const roundCriteria = getCriteriaForRound(round.id);
            const totalMarks = getTotalMaxMarks(round.id);
            const statusInfo = statusConfig[round.status] || statusConfig.draft;
            const isActive = round.status === "open" || round.status === "reopened";

            return (
              <div
                key={round.id}
                className={`glass-panel border transition-all ${
                  isActive
                    ? "border-accent-primary/40 shadow-[0_0_20px_rgba(251,200,21,0.06)]"
                    : "border-border-color"
                }`}
              >
                {/* Round Header */}
                <div
                  className={`p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isActive ? "border-accent-primary/20" : "border-border-color"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded border ${
                        isActive
                          ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                          : "bg-surface-color-light border-border-color text-text-secondary"
                      }`}
                    >
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
                          Round {round.sequence_order}
                        </span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-accent-primary text-black font-bold uppercase tracking-wider">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <h2 className="font-heading text-xl text-text-primary uppercase m-0 mt-0.5">
                        {round.title}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold uppercase ${statusInfo.cls}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                      {statusInfo.label}
                    </span>

                    {/* Max Score */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-color border border-border-color text-xs font-bold text-text-primary">
                      <Award size={13} className="text-accent-secondary" />
                      <span>Max: {totalMarks} pts</span>
                    </div>

                    {/* Criteria Count */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-color border border-border-color text-xs font-bold text-text-secondary">
                      <FileCheck2 size={13} />
                      <span>{roundCriteria.length} Criteria</span>
                    </div>
                  </div>
                </div>

                {/* Criteria Table */}
                {roundCriteria.length === 0 ? (
                  <div className="p-6 text-center text-text-secondary text-xs italic">
                    No scoring criteria have been defined for this round yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border-color bg-surface-color-light/40 text-text-secondary uppercase tracking-wider text-[11px]">
                          <th className="p-3 pl-5">#</th>
                          <th className="p-3">Criterion</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-center">Max Score</th>
                          <th className="p-3 text-center">Weightage</th>
                          <th className="p-3 text-center">Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-color/30">
                        {roundCriteria.map((c, idx) => (
                          <tr
                            key={c.id}
                            className="hover:bg-surface-color-light/20 transition-colors"
                          >
                            <td className="p-3 pl-5 font-mono text-text-secondary/60">
                              {String(idx + 1).padStart(2, "0")}
                            </td>
                            <td className="p-3">
                              <p className="font-heading text-sm text-text-primary uppercase m-0">
                                {c.title}
                              </p>
                            </td>
                            <td className="p-3 max-w-xs">
                              <p className="text-text-secondary m-0 leading-relaxed">
                                {c.description || (
                                  <span className="italic text-text-secondary/50">No description</span>
                                )}
                              </p>
                            </td>
                            <td className="p-3 text-center">
                              <span className="font-mono font-bold text-accent-primary text-sm">
                                {c.max_marks}
                              </span>
                              <span className="text-text-secondary text-[10px] ml-0.5">pts</span>
                            </td>
                            <td className="p-3 text-center">
                              {c.weightage != null ? (
                                <span className="font-mono text-accent-secondary font-bold">
                                  {c.weightage}%
                                </span>
                              ) : (
                                <span className="text-text-secondary/50 italic text-[11px]">—</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {c.is_required ? (
                                <span className="inline-flex items-center gap-1 text-status-success text-[10px] font-bold uppercase">
                                  <CheckCircle2 size={13} />
                                  Yes
                                </span>
                              ) : (
                                <span className="text-text-secondary/50 text-[10px]">Optional</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Totals Footer */}
                      <tfoot>
                        <tr className="border-t border-border-color bg-surface-color/60 text-text-secondary uppercase tracking-wider text-[11px]">
                          <td colSpan={3} className="p-3 pl-5 text-right font-bold text-text-primary">
                            Total
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-accent-primary text-sm">
                            {totalMarks}
                            <span className="text-text-secondary text-[10px] ml-0.5">pts</span>
                          </td>
                          <td className="p-3 text-center font-mono text-accent-secondary font-bold">
                            {roundCriteria.reduce((s, c) => s + (c.weightage || 0), 0) > 0
                              ? `${roundCriteria.reduce((s, c) => s + (c.weightage || 0), 0)}%`
                              : "—"}
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-status-success font-bold text-[10px]">
                              {roundCriteria.filter((c) => c.is_required).length} Required
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
