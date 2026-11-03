"use client";

import {
  useState,
  useMemo,
} from "react";
import {
  Filter,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Eye,
  Search,
  RefreshCw,
  MoreHorizontal,
  X,
} from "lucide-react";
import {
  overrideEvaluationStatus,
  getEvaluationDetails,
  type TeamEvaluationRecord,
} from "@/app/actions/admin-evaluations";
import { withCsrfToken } from "@/lib/csrf-client";

export interface RoundItem {
  id: string;
  title: string;
  sequence_order?: number;
  status?: string;
}

export interface EvaluationDetail {
  id: string;
  team_id: string;
  round_id: string;
  judge_id: string;
  event_id: string | null;
  scores: any;
  scores_breakdown: any;
  total_score: number | null;
  status: string;
  feedback: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function EvaluationsClientView({
  initialTeams,
  rounds,
}: {
  initialTeams: TeamEvaluationRecord[];
  rounds: RoundItem[];
}) {
  const [teams, setTeams] = useState<TeamEvaluationRecord[]>(initialTeams);
  const [roundFilter, setRoundFilter] = useState("all");
  const [judgeFilter, setJudgeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [overrideFilter, setOverrideFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(60);

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedEval, setSelectedEval] = useState<TeamEvaluationRecord | null>(null);
  const [evalDetails, setEvalDetails] = useState<EvaluationDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<TeamEvaluationRecord | null>(null);
  const [targetStatus, setTargetStatus] = useState<"draft" | "submitted" | "locked" | "reopened">("reopened");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");

  const uniqueJudges = useMemo(() => {
    const judges = new Set<string>();
    teams.forEach((t) => {
      if (t.judge1_name) judges.add(t.judge1_name);
      if (t.judge2_name) judges.add(t.judge2_name);
    });
    return Array.from(judges).sort();
  }, [teams]);

  const getDisplayStatus = (team: TeamEvaluationRecord): string => {
    if (team.override_info) return "Overridden";
    return team.overall_status || "Pending";
  };

  const getOverrideStatus = (team: TeamEvaluationRecord): string | null => {
    if (!team.override_info) return null;
    return "Overridden to " + team.override_info.new_status;
  };

  const stats = useMemo(() => {
    const total = teams.length;
    const fullyEvaluated = teams.filter((t) => t.overall_status === "Fully Evaluated").length;
    const partiallyEvaluated = teams.filter((t) => t.overall_status === "Partially Evaluated").length;
    const inProgress = teams.filter((t) => t.overall_status === "In Progress").length;
    const pending = teams.filter((t) => t.overall_status === "Pending").length;
    const overridden = teams.filter((t) => t.override_info).length;

    return { total, fullyEvaluated, partiallyEvaluated, inProgress, pending, overridden };
  }, [teams]);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      if (roundFilter !== "all" && team.round_id !== roundFilter) return false;
      if (
        judgeFilter !== "all" &&
        team.judge1_name !== judgeFilter &&
        team.judge2_name !== judgeFilter
      )
        return false;

      const displayStatus = getDisplayStatus(team);
      if (statusFilter !== "all") {
        const statusMap: Record<string, string> = {
          "Not Evaluated": "not_evaluated",
          Draft: "draft",
          Submitted: "submitted",
          Overridden: "overridden",
          Locked: "locked",
          Reopened: "reopened",
        };
        if (
          statusMap[statusFilter] !== displayStatus.toLowerCase() &&
          statusFilter !== displayStatus
        )
          return false;
      }

      if (overrideFilter !== "all") {
        const hasOverride = !!team.override_info;
        if (overrideFilter === "yes" && !hasOverride) return false;
        if (overrideFilter === "no" && hasOverride) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchTeamCode = team.team_code?.toLowerCase().includes(q);
        const matchTeamName = team.team_name?.toLowerCase().includes(q);
        const matchLeader = team.leader_name?.toLowerCase().includes(q);
        const matchJudge1 = team.judge1_name?.toLowerCase().includes(q);
        const matchJudge2 = team.judge2_name?.toLowerCase().includes(q);
        if (
          !matchTeamCode &&
          !matchTeamName &&
          !matchLeader &&
          !matchJudge1 &&
          !matchJudge2
        )
          return false;
      }

      return true;
    });
  }, [teams, roundFilter, judgeFilter, statusFilter, overrideFilter, searchQuery]);

  const sortedTeams = useMemo(() => {
    return [...filteredTeams].sort((a, b) => {
      const codeA = a.team_code || "";
      const codeB = b.team_code || "";
      return codeA.localeCompare(codeB);
    });
  }, [filteredTeams]);

  const totalPages = Math.ceil(sortedTeams.length / pageSize);
  const currentPageTeams = sortedTeams.slice((page - 1) * pageSize, page * pageSize);

  const handleViewEvaluation = async (team: TeamEvaluationRecord) => {
    const evalId = team.judge1_evaluation_id || team.judge2_evaluation_id;
    if (!evalId) return;
    setSelectedEval(team);
    setViewLoading(true);
    setEvalDetails(null);
    setIsViewOpen(true);

    try {
      const result = await getEvaluationDetails(evalId);
      if (!result.success) throw new Error("Failed to load evaluation details");
      setEvalDetails(result.evaluation);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to load evaluation details");
      setFeedbackType("error");
    } finally {
      setViewLoading(false);
    }
  };

  const handleOpenOverride = (team: TeamEvaluationRecord) => {
    setOverrideTarget(team);
    setTargetStatus((team.judge1_evaluation_status as any) || "reopened");
    setOverrideReason("");
    setIsOverrideOpen(true);
  };

  const handleSubmitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideTarget) return;
    setOverrideLoading(true);
    setFeedback(null);
    try {
      const evalId = overrideTarget.judge1_evaluation_id || overrideTarget.judge2_evaluation_id;
      if (!evalId) throw new Error("No evaluation to override");

      const res = await overrideEvaluationStatus({
        evaluation_id: evalId,
        status: targetStatus,
        reason: overrideReason,
        ...withCsrfToken(),
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to override evaluation");
      }

      setTeams((prev) =>
        prev.map((t) =>
          t.team_id === overrideTarget!.team_id
            ? { ...t, overall_status: targetStatus === "submitted" ? "Fully Evaluated" : targetStatus }
            : t
        )
      );

      setFeedback("Evaluation successfully updated to " + targetStatus);
      setFeedbackType("success");
      setIsOverrideOpen(false);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to override evaluation");
      setFeedbackType("error");
    } finally {
      setOverrideLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; border: string; text: string }> = {
      "Not Evaluated": { bg: "bg-surface-color-light/40", border: "border-border-color", text: "text-text-secondary" },
      Draft: { bg: "bg-accent-primary/10", border: "border-accent-primary", text: "text-accent-primary" },
      Submitted: { bg: "bg-status-success/10", border: "border-status-success", text: "text-status-success" },
      Overridden: { bg: "bg-status-error/10", border: "border-status-error", text: "text-status-error" },
      Locked: { bg: "bg-status-error/10", border: "border-status-error", text: "text-status-error" },
      Reopened: { bg: "bg-accent-secondary/10", border: "border-accent-secondary", text: "text-accent-secondary" },
    };
    const c = config[status] || config["Not Evaluated"];
    return (
      <span className={"px-2 py-0.5 " + c.bg + " " + c.border + " " + c.text + " text-[10px] font-tech font-bold uppercase"}>
        {status}
      </span>
    );
  };

  const getOverrideBadge = (team: TeamEvaluationRecord) => {
    if (!team.override_info) return null;
    return (
      <span className="px-2 py-0.5 bg-[#FF007F]/10 border border-[#FF007F]/40 text-[#FF007F] text-[10px] font-tech font-bold uppercase">
        OVERRIDDEN
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={"p-3 rounded-lg text-xs font-tech flex items-center gap-2 " + (feedbackType === "success" ? "bg-status-success/10 border border-status-success text-status-success" : "bg-status-error/10 border border-status-error text-status-error")}>
          {feedbackType === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="glass-panel p-4 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-1">
            Total Registered Teams
          </p>
          <p className="font-heading text-2xl font-bold text-text-primary">{stats.total}</p>
        </div>
        <div className="glass-panel p-4 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-1">
            Fully Evaluated
          </p>
          <p className="font-heading text-2xl font-bold text-accent-secondary">
            {stats.fullyEvaluated}
          </p>
        </div>
        <div className="glass-panel p-4 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-1">
            Partially Evaluated
          </p>
          <p className="font-heading text-2xl font-bold text-status-success">
            {stats.partiallyEvaluated}
          </p>
        </div>
        <div className="glass-panel p-4 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-1">
            In Progress
          </p>
          <p className="font-heading text-2xl font-bold text-text-secondary">
            {stats.inProgress}
          </p>
        </div>
        <div className="glass-panel p-4 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-1">
            Overridden
          </p>
          <p className="font-heading text-2xl font-bold text-[#FF007F]">{stats.overridden}</p>
        </div>
      </div>

      <div className="glass-panel p-4 border border-border-color rounded-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-text-secondary text-xs font-tech">
            <Filter size={16} />
            <span className="uppercase font-bold">Filters:</span>
          </div>

          <select
            value={roundFilter}
            onChange={(e) => {
              setRoundFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-color border border-border-color text-text-primary text-xs font-tech px-3 py-1.5 focus:border-accent-secondary outline-none uppercase font-semibold"
          >
            <option value="all">ALL ROUNDS</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>

          <select
            value={judgeFilter}
            onChange={(e) => {
              setJudgeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-color border border-border-color text-text-primary text-xs font-tech px-3 py-1.5 focus:border-accent-secondary outline-none uppercase font-semibold"
          >
            <option value="all">ALL JUDGES</option>
            {uniqueJudges.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-color border border-border-color text-text-primary text-xs font-tech px-3 py-1.5 focus:border-accent-secondary outline-none uppercase font-semibold"
          >
            <option value="all">ALL STATUSES</option>
            <option value="Not Evaluated">NOT EVALUATED</option>
            <option value="Draft">DRAFT</option>
            <option value="Submitted">SUBMITTED</option>
            <option value="Overridden">OVERRIDDEN</option>
            <option value="Locked">LOCKED</option>
            <option value="Reopened">REOPENED</option>
          </select>

          <select
            value={overrideFilter}
            onChange={(e) => {
              setOverrideFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-color border border-border-color text-text-primary text-xs font-tech px-3 py-1.5 focus:border-accent-secondary outline-none uppercase font-semibold"
          >
            <option value="all">ALL OVERRIDES</option>
            <option value="yes">HAS OVERRIDE</option>
            <option value="no">NO OVERRIDE</option>
          </select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary/50" />
            <input
              type="text"
              placeholder="Search by Team ID, Name, Leader, or Judge..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-color border border-border-color text-text-primary text-xs font-sans px-3 py-1.5 pl-9 focus:border-accent-secondary outline-none"
            />
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-x-auto border border-border-color rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-color bg-surface-color-light/40 text-text-secondary font-tech text-xs uppercase tracking-wider">
              <th className="p-3 w-20">Team ID</th>
              <th className="p-3 w-40">Team Name</th>
              <th className="p-3 w-32">Team Leader</th>
              <th className="p-3 w-32">Judge</th>
              <th className="p-3 w-24 text-center">Marks</th>
              <th className="p-3 w-24">Status</th>
              <th className="p-3 w-24">Override</th>
              <th className="p-3 w-40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color/30 font-tech text-xs">
            {currentPageTeams.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-text-secondary italic">
                  No teams matching current filters.
                </td>
              </tr>
            ) : (
              currentPageTeams.map((team) => {
                const displayStatus = getDisplayStatus(team);
                const overrideStatus = getOverrideStatus(team);
                const j1Score = team.judge1_total_score !== null ? team.judge1_total_score : "—";
                const j2Score = team.judge2_total_score !== null ? team.judge2_total_score : "—";
                const combinedScore = team.combined_score !== null ? team.combined_score : "—";
                const hasJudge1Eval = !!team.judge1_evaluation_id;
                const hasJudge2Eval = !!team.judge2_evaluation_id;

                return (
                  <tr
                    key={team.team_id}
                    className="hover:bg-surface-color-light/20 transition-colors group"
                  >
                    <td className="p-3 font-mono text-text-primary">
                      {team.team_code}
                    </td>
                    <td className="p-3 text-text-primary">
                      {team.team_name}
                      {team.team_track && (
                        <span className="text-[9px] text-text-secondary ml-1 block">
                          ({team.team_track})
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-text-secondary">
                      {team.leader_name || "—"}
                      {team.leader_email && (
                        <span className="text-[9px] text-text-secondary/60 ml-1 block">
                          {team.leader_email}
                        </span>
                      )}
                    </td>
                    {/* Judge 1 */}
                    <td className="p-3 text-text-secondary">
                      {team.judge1_name || "—"}
                      {team.judge1_email && (
                        <span className="text-[9px] text-text-secondary/60 ml-1 block">
                          {team.judge1_email}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span
                        className={`font-bold ${
                          team.judge1_total_score !== null
                            ? "text-text-primary"
                            : "text-text-secondary/50"
                        }`}
                      >
                        {j1Score}
                      </span>
                    </td>
                    <td className="p-3">
                      {team.judge1_evaluation_status ? (
                        <span className={`px-2 py-0.5 ${
                          team.judge1_evaluation_status === "submitted"
                            ? "bg-status-success/10 text-status-success border border-status-success/40"
                            : team.judge1_evaluation_status === "draft"
                            ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/40"
                            : "bg-surface-color-light/40 text-text-secondary border border-border-color"
                        } text-[9px] font-tech font-bold uppercase`}>
                          {team.judge1_evaluation_status.charAt(0).toUpperCase() + team.judge1_evaluation_status.slice(1)}
                        </span>
                      ) : (
                        <span className="text-[9px] text-text-secondary/50">—</span>
                      )}
                    </td>
                    {/* Judge 2 */}
                    <td className="p-3 text-text-secondary">
                      {team.judge2_name || "—"}
                      {team.judge2_email && (
                        <span className="text-[9px] text-text-secondary/60 ml-1 block">
                          {team.judge2_email}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span
                        className={`font-bold ${
                          team.judge2_total_score !== null
                            ? "text-text-primary"
                            : "text-text-secondary/50"
                        }`}
                      >
                        {j2Score}
                      </span>
                    </td>
                    <td className="p-3">
                      {team.judge2_evaluation_status ? (
                        <span className={`px-2 py-0.5 ${
                          team.judge2_evaluation_status === "submitted"
                            ? "bg-status-success/10 text-status-success border border-status-success/40"
                            : team.judge2_evaluation_status === "draft"
                            ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/40"
                            : "bg-surface-color-light/40 text-text-secondary border border-border-color"
                        } text-[9px] font-tech font-bold uppercase`}>
                          {team.judge2_evaluation_status.charAt(0).toUpperCase() + team.judge2_evaluation_status.slice(1)}
                        </span>
                      ) : (
                        <span className="text-[9px] text-text-secondary/50">—</span>
                      )}
                    </td>
                    {/* Combined */}
                    <td className="p-3 text-center font-mono">
                      <span
                        className={`font-bold ${
                          team.combined_score !== null ? "text-accent-secondary" : "text-text-secondary/50"
                        }`}
                      >
                        {combinedScore}
                      </span>
                    </td>
                    {/* Overall Status */}
                    <td className="p-3">
                      {displayStatus === "Overridden" ? (
                        <>
                          <span className={`px-2 py-0.5 ${
                            "bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/40 text-[9px] font-tech font-bold uppercase"
                          }`}>
                            OVERRIDDEN
                          </span>
                        </>
                      ) : (
                        <span
                          className={`px-2 py-0.5 ${
                            displayStatus === "Fully Evaluated"
                              ? "bg-status-success/10 text-status-success border border-status-success/40"
                              : displayStatus === "Partially Evaluated"
                              ? "bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/40"
                              : displayStatus === "In Progress"
                              ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/40"
                              : "bg-surface-color-light/40 text-text-secondary border border-border-color"
                          } text-[9px] font-tech font-bold uppercase`}>
                          {displayStatus}
                        </span>
                      )}
                    </td>
                    {/* Override */}
                    <td className="p-3">
                      {overrideStatus ? (
                        <span className="text-[10px] text-[#FF007F] font-tech font-bold uppercase">
                          {overrideStatus}
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-secondary/50">—</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-1.5">
                        {(hasJudge1Eval || hasJudge2Eval) && (
                          <button
                            onClick={() => handleViewEvaluation(team)}
                            className="px-2.5 py-1 bg-surface-color-light border border-border-color rounded text-text-primary font-bold uppercase text-[11px] transition-colors hover:border-accent-secondary hover:text-accent-secondary"
                            title="View Evaluation"
                          >
                            <Eye size={13} /> View
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenOverride(team)}
                          className="px-2.5 py-1 bg-surface-color-light border border-border-color rounded text-[#FF007F] font-bold uppercase text-[11px] transition-colors hover:bg-[#FF007F]/10 hover:text-[#FF007F]"
                          title="Override Evaluation"
                        >
                          <MoreHorizontal size={13} /> Override
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-border-color">
          <p className="text-[10px] text-text-secondary">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sortedTeams.length)} of {sortedTeams.length}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-border-color rounded text-text-primary text-xs font-tech disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-border-color rounded text-text-primary text-xs font-tech disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {isViewOpen && selectedEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="glass-panel max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-[#FF007F]/40 shadow-[0_0_40px_rgba(255,0,127,0.15)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading text-lg font-bold text-text-primary uppercase m-0">
                  Evaluation Details
                </h3>
                <p className="text-[10px] text-text-secondary m-0 mt-1">
                  Team: {selectedEval.team_name} ({selectedEval.team_code})
                </p>
              </div>
              <button
                onClick={() => setIsViewOpen(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {viewLoading ? (
              <div className="h-64 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-accent-secondary" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase text-text-secondary font-bold">Evaluation ID</p>
                    <p className="font-mono text-text-primary">
                      {selectedEval.judge1_evaluation_id || selectedEval.judge2_evaluation_id || "—"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase text-text-secondary font-bold">Round</p>
                    <p className="text-text-primary">{selectedEval.round_title || "—"}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase text-text-secondary font-bold">Judge</p>
                    <p className="text-text-primary">
                      {selectedEval.judge1_name || selectedEval.judge2_name || "—"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase text-text-secondary font-bold">Status</p>
                    {getStatusBadge(getDisplayStatus(selectedEval))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase text-text-secondary font-bold">Total Marks</p>
                    <p className="font-mono font-bold text-text-primary">
                      {selectedEval.judge1_total_score !== null
                        ? selectedEval.judge1_total_score
                        : selectedEval.judge2_total_score !== null
                          ? selectedEval.judge2_total_score
                          : "—"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase text-text-secondary font-bold">Updated At</p>
                    <p className="text-text-secondary">
                      {selectedEval.judge1_updated_at || selectedEval.judge2_updated_at
                        ? new Date(
                            (selectedEval.judge1_updated_at ||
                              selectedEval.judge2_updated_at) as string
                          ).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                </div>

                {evalDetails?.feedback && (
                  <div className="mb-6">
                    <p className="text-[10px] uppercase text-text-secondary font-bold mb-1">Judge Feedback</p>
                    <div className="bg-surface-color border border-border-color rounded-lg p-3">
                      <p className="text-text-secondary text-sm leading-relaxed">
                        {evalDetails.feedback}
                      </p>
                    </div>
                  </div>
                )}

                {evalDetails?.scores_breakdown && Array.isArray(evalDetails.scores_breakdown) && evalDetails.scores_breakdown.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] uppercase text-text-secondary font-bold mb-1">Rubric Scores</p>
                    <div className="bg-surface-color border border-border-color rounded-lg p-3">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border-color text-text-secondary">
                            <th className="p-2">Criterion</th>
                            <th className="p-2 text-right">Marks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color/30">
                          {evalDetails.scores_breakdown.map((criterion: any, idx: number) => (
                            <tr key={idx}>
                              <td className="p-2 text-text-primary">{criterion.title || ("Criterion " + (idx + 1))}</td>
                              <td className="p-2 text-right font-mono text-text-primary">{criterion.score ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedEval.override_info && (
                  <div className="bg-[#FF007F]/10 border border-[#FF007F]/30 rounded-lg p-3">
                    <p className="text-[10px] uppercase text-[#FF007F] font-bold mb-1">Administrative Override</p>
                    <p className="text-[10px] text-text-secondary leading-relaxed">
                      Previous status:{" "}
                      <span className="text-text-primary">{selectedEval.override_info.previous_status}</span>{" "}
                      New status:{" "}
                      <span className="text-text-primary">{selectedEval.override_info.new_status}</span>{" "}
                      Reason:{" "}
                      <span className="text-text-primary">{selectedEval.override_info.reason || "—"}</span>{" "}
                      By:{" "}
                      <span className="text-text-primary">{selectedEval.override_info.admin_name || "—"}</span>{" "}
                      At:{" "}
                      <span className="text-text-primary">
                        {selectedEval.override_info.created_at ? new Date(selectedEval.override_info.created_at).toLocaleString() : "—"}
                      </span>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {isOverrideOpen && overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="glass-panel max-w-md w-full p-6 border border-status-warning/60 space-y-4">
            <div className="flex items-center gap-3 text-status-warning">
              <AlertTriangle size={24} />
              <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                Administrative Override
              </h3>
            </div>

            <p className="font-tech text-xs text-text-secondary">
              Overriding evaluation for{" "}
              <span className="text-text-primary font-mono">{overrideTarget.team_name}</span>.{" "}
              This action will be strictly recorded in the audit logs.
            </p>

            <form onSubmit={handleSubmitOverride} className="space-y-4 font-tech">
              <div>
                <label className="block text-xs uppercase text-text-secondary mb-1">
                  Target Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) =>
                    setTargetStatus(
                      e.target.value as "draft" | "submitted" | "locked" | "reopened"
                    )
                  }
                  className="w-full bg-surface-color border border-border-color p-2 text-text-primary text-sm focus:border-accent-secondary outline-none uppercase font-semibold"
                >
                  <option value="reopened">REOPEN (Allow Judge Edit)</option>
                  <option value="locked">LOCK (Freeze Scoring)</option>
                  <option value="submitted">FORCE SUBMIT</option>
                  <option value="draft">REVERT TO DRAFT</option>
                </select>
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
                  disabled={overrideLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-status-warning text-black font-bold uppercase text-xs hover:bg-status-warning/80"
                >
                  <ShieldCheck size={16} />
                  {overrideLoading ? "Recording..." : "Confirm Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
