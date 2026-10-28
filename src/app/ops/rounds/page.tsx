import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireOperationsRole } from "@/lib/auth/operations";
import {
  Layers,
  FileCheck2,
  Award,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  Users,
} from "lucide-react";
import RealtimeRoundsListener from "@/components/RealtimeRoundsListener";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Event Rounds & Rubrics | Club Operations",
  description: "Live operational telemetry of ideathon rounds, evaluation rubrics, and judging progress.",
};

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
    cls: "bg-accent-tertiary/15 text-accent-tertiary border-accent-tertiary/50",
    dot: "bg-accent-tertiary animate-pulse",
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

export default async function OpsRoundsPage() {
  try {
    await requireOperationsRole();
  } catch {
    // layout handles auth verification
  }

  let rounds: Round[] = [];
  let criteria: Criterion[] = [];
  const evaluationsCountByRound = new Map<string, number>();

  try {
    const [roundsRes, criteriaRes, evalsRes] = await Promise.all([
      supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, sequence_order, status")
        .order("sequence_order", { ascending: true }),
      supabaseAdmin
        .from("evaluation_criteria")
        .select("id, round_id, title, description, max_marks, weightage, is_required"),
      supabaseAdmin
        .from("evaluations")
        .select("round_id, status"),
    ]);

    if (roundsRes.data) rounds = roundsRes.data;
    if (criteriaRes.data) criteria = criteriaRes.data;

    if (evalsRes.data) {
      for (const ev of evalsRes.data) {
        evaluationsCountByRound.set(
          ev.round_id,
          (evaluationsCountByRound.get(ev.round_id) || 0) + 1
        );
      }
    }
  } catch (err) {
    console.error("Failed to load ops rounds telemetry:", err);
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
      <RealtimeRoundsListener channelName="ops-rounds-telemetry" />

      {/* Page Header */}
      <div className="border-b border-border-color pb-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-accent-tertiary animate-pulse" />
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-tertiary font-bold m-0">
            Operations // Evaluation Matrix
          </p>
        </div>
        <h1 className="text-2xl md:text-4xl font-heading text-text-primary tracking-wider uppercase m-0">
          Event Rounds & Criteria Monitor
        </h1>
        <p className="font-tech text-text-secondary text-xs mt-1.5 m-0 max-w-2xl">
          Live coordination telemetry of competition evaluation rounds, scoring criteria, and active jury scoring status.
        </p>
      </div>

      {/* Active Round Live Status Capsule */}
      {activeRound ? (
        <div className="p-4 bg-status-success/10 border border-status-success/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-status-success animate-pulse" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-status-success m-0">
                Live Active Evaluation Round
              </p>
              <h3 className="text-lg text-text-primary font-heading uppercase m-0">
                {activeRound.title}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-status-success font-mono uppercase border border-status-success/40 px-2.5 py-1 bg-status-success/5">
              Round {activeRound.sequence_order} {"//"} LIVE
            </span>
            <span className="text-xs text-text-secondary font-mono border border-border-color px-2.5 py-1">
              {evaluationsCountByRound.get(activeRound.id) || 0} Submissions Recorded
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-status-warning/10 border border-status-warning/40 flex items-center gap-3">
          <AlertCircle size={18} className="text-status-warning shrink-0" />
          <p className="text-xs text-status-warning font-bold uppercase tracking-wider m-0">
            No active evaluation round right now. The admin has not set any round to Open.
          </p>
        </div>
      )}

      {/* Rounds & Criteria Accordion/Cards */}
      <div className="space-y-6">
        {rounds.length === 0 ? (
          <div className="glass-panel p-12 border border-border-color text-center text-text-secondary text-sm">
            No evaluation rounds have been created yet.
          </div>
        ) : (
          rounds.map((round) => {
            const roundCriteria = getCriteriaForRound(round.id);
            const totalMarks = getTotalMaxMarks(round.id);
            const statusInfo = statusConfig[round.status] || statusConfig.draft;
            const isActive = round.status === "open" || round.status === "reopened";
            const recordedEvals = evaluationsCountByRound.get(round.id) || 0;

            return (
              <div
                key={round.id}
                className={`glass-panel border transition-all ${
                  isActive
                    ? "border-accent-tertiary/40 shadow-[0_0_20px_rgba(0,240,255,0.06)]"
                    : "border-border-color"
                }`}
              >
                {/* Round Header */}
                <div className="p-5 border-b border-border-color flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded border ${
                        isActive
                          ? "bg-accent-tertiary/10 border-accent-tertiary/40 text-accent-tertiary"
                          : "bg-surface-color-light border-border-color text-text-secondary"
                      }`}
                    >
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
                          Stage {round.sequence_order}
                        </span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-status-success text-black font-bold uppercase tracking-wider">
                            ACTIVE NOW
                          </span>
                        )}
                      </div>
                      <h2 className="font-heading text-xl text-text-primary uppercase m-0 mt-0.5">
                        {round.title}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold uppercase ${statusInfo.cls}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                      {statusInfo.label}
                    </span>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-color border border-border-color text-xs font-bold text-text-primary">
                      <Award size={13} className="text-accent-secondary" />
                      <span>{totalMarks} Max Pts</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-color border border-border-color text-xs font-bold text-text-secondary">
                      <FileCheck2 size={13} />
                      <span>{roundCriteria.length} Criteria</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-color border border-border-color text-xs font-bold text-accent-tertiary">
                      <Activity size={13} />
                      <span>{recordedEvals} Evals In</span>
                    </div>
                  </div>
                </div>

                {/* Criteria Table */}
                {roundCriteria.length === 0 ? (
                  <div className="p-5 text-center text-text-secondary text-xs italic">
                    No criteria defined for this round.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border-color bg-surface-color-light/40 text-text-secondary uppercase tracking-wider text-[10px]">
                          <th className="p-3 pl-5">#</th>
                          <th className="p-3">Criterion Name</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-center">Max Marks</th>
                          <th className="p-3 text-center">Weight</th>
                          <th className="p-3 text-center">Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-color/30">
                        {roundCriteria.map((c, idx) => (
                          <tr key={c.id} className="hover:bg-surface-color-light/20 transition-colors">
                            <td className="p-3 pl-5 font-mono text-text-secondary/60">
                              {String(idx + 1).padStart(2, "0")}
                            </td>
                            <td className="p-3">
                              <p className="font-heading text-xs text-text-primary uppercase m-0">
                                {c.title}
                              </p>
                            </td>
                            <td className="p-3 text-text-secondary text-[11px] max-w-sm">
                              {c.description || <span className="italic text-text-secondary/40">N/A</span>}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-accent-tertiary">
                              {c.max_marks} pts
                            </td>
                            <td className="p-3 text-center font-mono text-text-secondary">
                              {c.weightage != null ? `${c.weightage}%` : "—"}
                            </td>
                            <td className="p-3 text-center">
                              {c.is_required ? (
                                <span className="inline-flex items-center gap-1 text-status-success text-[10px] font-bold uppercase">
                                  <CheckCircle2 size={12} />
                                  Yes
                                </span>
                              ) : (
                                <span className="text-text-secondary/50 text-[10px]">Optional</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
