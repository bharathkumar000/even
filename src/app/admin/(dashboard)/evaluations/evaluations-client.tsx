"use client";

import { useState } from "react";
import { Filter, AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { overrideEvaluationStatus } from "@/app/actions/admin-evaluations";
import CustomSelect from "@/components/ui/CustomSelect";

export interface EvaluationItem {
  id: string;
  total_score?: number | null;
  status: string;
  created_at?: string;
  updated_at?: string;
  round_id: string;
  judge_id?: string | null;
  team_id?: string | null;
}

export interface RoundItem {
  id: string;
  title: string;
  sequence_order?: number;
  status?: string;
}

export default function EvaluationsClientView({
  initialEvaluations,
  rounds,
}: {
  initialEvaluations: EvaluationItem[];
  rounds: RoundItem[];
}) {
  const [evaluations, setEvaluations] = useState(initialEvaluations);
  const [roundFilter, setRoundFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Override dialog state
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [selectedEval, setSelectedEval] = useState<EvaluationItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<"draft" | "submitted" | "locked" | "reopened">("reopened");
  const [overrideReason, setOverrideReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = evaluations.filter((ev) => {
    if (roundFilter !== "all" && ev.round_id !== roundFilter) return false;
    if (statusFilter !== "all" && ev.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTeam = ev.team_id?.toLowerCase().includes(q);
      const matchJudge = ev.judge_id?.toLowerCase().includes(q);
      const matchId = ev.id?.toLowerCase().includes(q);
      if (!matchTeam && !matchJudge && !matchId) return false;
    }
    return true;
  });

  const handleOpenOverride = (ev: EvaluationItem) => {
    setSelectedEval(ev);
    setTargetStatus(ev.status === "locked" ? "reopened" : "locked");
    setOverrideReason("");
    setIsOverrideOpen(true);
  };

  const handleSubmitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEval) return;
    setLoading(true);
    setFeedback(null);
    try {
      await overrideEvaluationStatus({
        evaluation_id: selectedEval.id,
        status: targetStatus,
        reason: overrideReason,
      });

      setEvaluations((prev) =>
        prev.map((ev) =>
          ev.id === selectedEval.id ? { ...ev, status: targetStatus } : ev
        )
      );
      setFeedback(`Evaluation ${selectedEval.id.slice(0, 8)} successfully updated to ${targetStatus}`);
      setIsOverrideOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to override evaluation");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <span className="px-2 py-0.5 bg-status-success/10 border border-status-success text-status-success text-[10px] font-tech font-bold uppercase">SUBMITTED</span>;
      case "locked":
        return <span className="px-2 py-0.5 bg-status-error/10 border border-status-error text-status-error text-[10px] font-tech font-bold uppercase">LOCKED</span>;
      case "reopened":
        return <span className="px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary text-accent-secondary text-[10px] font-tech font-bold uppercase">REOPENED</span>;
      default:
        return <span className="px-2 py-0.5 bg-accent-primary/10 border border-accent-primary text-accent-primary text-[10px] font-tech font-bold uppercase">DRAFT</span>;
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3 bg-status-success/10 border border-status-success text-status-success text-xs font-tech flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-text-secondary text-xs font-tech">
            <Filter size={16} />
            <span className="uppercase font-bold">Filters:</span>
          </div>

          <div className="w-44 shrink-0">
            <CustomSelect
              value={roundFilter}
              onChange={setRoundFilter}
              options={[
                { value: "all", label: "ALL ROUNDS" },
                ...rounds.map((r) => ({
                  value: r.id,
                  label: r.title,
                })),
              ]}
              size="sm"
            />
          </div>

          <div className="w-44 shrink-0">
            <CustomSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "ALL STATUSES" },
                { value: "draft", label: "DRAFT", badge: "DRAFT", badgeColor: "bg-surface-color-light text-text-secondary border-border-color" },
                { value: "submitted", label: "SUBMITTED", badge: "SUBMIT", badgeColor: "bg-status-success/20 text-status-success border-status-success/40" },
                { value: "locked", label: "LOCKED", badge: "LOCK", badgeColor: "bg-red-500/20 text-red-400 border-red-500/40" },
                { value: "reopened", label: "REOPENED", badge: "REOPEN", badgeColor: "bg-accent-tertiary/20 text-accent-tertiary border-accent-tertiary/40" },
              ]}
              size="sm"
            />
          </div>
        </div>

        <input
          type="text"
          placeholder="Search by ID, Team, or Judge..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-64 bg-surface-color border border-border-color text-text-primary text-xs font-sans tracking-normal px-3 py-1.5 focus:border-accent-secondary outline-none"
        />
      </div>

      {/* Table */}
      <div className="glass-panel overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-color bg-surface-color-light/40 text-text-secondary font-tech text-xs uppercase tracking-wider">
              <th className="p-3">Evaluation ID</th>
              <th className="p-3">Team</th>
              <th className="p-3">Judge</th>
              <th className="p-3">Score</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last Updated</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color/30 font-tech text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-text-secondary italic">
                  No evaluation records matching current filters.
                </td>
              </tr>
            ) : (
              filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-surface-color-light/20 transition-colors">
                  <td className="p-3 font-mono text-text-primary">
                    {ev.id.slice(0, 8)}...
                  </td>
                  <td className="p-3 text-text-primary">
                    {ev.team_id ? ev.team_id.slice(0, 8) : "N/A"}
                  </td>
                  <td className="p-3 text-text-secondary">
                    {ev.judge_id ? ev.judge_id.slice(0, 8) : "Anonymous"}
                  </td>
                  <td className="p-3 font-bold text-accent-primary">
                    {ev.total_score ?? "-"} PTS
                  </td>
                  <td className="p-3">{getStatusBadge(ev.status)}</td>
                  <td className="p-3 text-text-secondary">
                    {new Date(ev.updated_at || ev.created_at || Date.now()).toLocaleTimeString()}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleOpenOverride(ev)}
                      className="px-2.5 py-1 bg-surface-color-light border border-border-color hover:border-accent-secondary text-text-primary font-bold uppercase text-[11px] transition-colors"
                    >
                      Override
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Override Dialog */}
      {isOverrideOpen && selectedEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="glass-panel max-w-md w-full p-6 border border-status-warning/60 space-y-4">
            <div className="flex items-center gap-3 text-status-warning">
              <AlertTriangle size={24} />
              <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                Administrative Override
              </h3>
            </div>

            <p className="font-tech text-xs text-text-secondary">
              Overriding will modify the state of evaluation{" "}
              <span className="text-text-primary font-mono">{selectedEval.id}</span>.
              This action will be strictly recorded in the audit logs.
            </p>

            <form onSubmit={handleSubmitOverride} className="space-y-4 font-tech">
              <div>
                <label className="block text-xs uppercase text-text-secondary mb-1">
                  Target Status
                </label>
                <CustomSelect
                  value={targetStatus}
                  onChange={(val) =>
                    setTargetStatus(
                      val as "draft" | "submitted" | "locked" | "reopened"
                    )
                  }
                  options={[
                    { value: "reopened", label: "REOPEN (Allow Judge Edit)" },
                    { value: "locked", label: "LOCK (Freeze Scoring)" },
                    { value: "submitted", label: "FORCE SUBMIT" },
                    { value: "draft", label: "REVERT TO DRAFT" },
                  ]}
                  colorVariant="yellow"
                  size="md"
                />
              </div>

              <div>
                <label className="block text-xs uppercase text-text-secondary mb-1">
                  Audit Reason (Mandatory)
                </label>
                <textarea
                  required
                  minLength={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="State the administrative or technical justification..."
                  className="w-full bg-surface-color border border-border-color p-2 text-text-primary text-sm focus:border-accent-secondary outline-none h-24 font-sans tracking-normal"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOverrideOpen(false)}
                  className="px-4 py-2 border border-border-color text-text-secondary hover:text-text-primary font-bold uppercase text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-status-warning text-black font-bold uppercase text-xs hover:bg-status-warning/80"
                >
                  <ShieldCheck size={16} />
                  {loading ? "Recording..." : "Confirm Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
