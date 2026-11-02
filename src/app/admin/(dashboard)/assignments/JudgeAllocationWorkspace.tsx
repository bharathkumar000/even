"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Gift,
  Loader2,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import {
  autoBalanceJudges,
  batchAssignJudges,
  getJudgeAssignmentsForRound,
} from "@/app/actions/admin-judge-assignments";
import { withCsrfToken } from "@/lib/csrf-client";

interface JudgeAllocationWorkspaceProps {
  roundId: string;
  initialJudges?: Array<{ id: string; full_name: string | null; email: string | null; assigned_team_count: number }>;
  initialStats?: any;
}

interface TeamCardData {
  team_id: string;
  team_name: string;
  team_code: string | null;
  track: string | null;
  judge_ids: string[];
  assigned_count: number;
}

export default function JudgeAllocationWorkspace({
  roundId,
  initialJudges,
  initialStats,
}: JudgeAllocationWorkspaceProps) {
  const [teams, setTeams] = useState<TeamCardData[]>([]);
  const [assignmentsMap, setAssignmentsMap] = useState<
    Map<string, string[]>
  >(new Map());
  const [selectedJudgeId, setSelectedJudgeId] = useState<string | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(
    new Set()
  );
  const [judgeSearchQuery, setJudgeSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState<string | null>(null);
  const [showAlreadyAllotted, setShowAlreadyAllotted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoBalanceLoading, setAutoBalanceLoading] = useState(false);
  const [confirmPreview, setConfirmPreview] = useState<
    Array<{ teamId: string; teamName: string; judgeId: string; judgeName: string }>
  >([]);
  const [showPreview, setShowPreview] = useState(false);
  const [notify, setNotifyState] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotify = (type: "success" | "error", message: string) => {
    setNotifyState({ type, message });
    setTimeout(() => setNotifyState(null), 5000);
  };

  // Load assignments for the round whenever round or selected judge changes
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await getJudgeAssignmentsForRound(roundId);
        if (res.error) {
          showNotify("error", res.error);
        } else {
          const map = new Map<string, string[]>();
          res.assignments.forEach((a) => {
            map.set(a.team_id, a.judge_ids);
          });
          setTeams(
            res.assignments.map((a) => ({
              team_id: a.team_id,
              team_name: a.team_name,
              team_code: a.team_code,
              track: a.track,
              judge_ids: a.judge_ids,
              assigned_count: a.assigned_count,
            }))
          );
          setAssignmentsMap(map);
        }
      } catch (err) {
        showNotify(
          "error",
          err instanceof Error ? err.message : "Failed to load assignments."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  const allJudges = useMemo(() => initialJudges ?? [], [initialJudges]);

  const selectedJudge = useMemo(
    () => allJudges.find((j) => j.id === selectedJudgeId),
    [allJudges, selectedJudgeId]
  );

  // Build filtered + eligible teams for the right panel
  const filteredTeams = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return teams.filter((t) => {
      const matchesSearch =
        !query ||
        t.team_name?.toLowerCase().includes(query) ||
        t.team_code?.toLowerCase().includes(query);
      const matchesTrack =
        !trackFilter || t.track === trackFilter;
      if (!matchesSearch || !matchesTrack) return false;

      const assignedJudges = assignmentsMap.get(t.team_id) ?? [];
      const alreadyAssignedToSelected =
        selectedJudgeId && assignedJudges.includes(selectedJudgeId);

      // If not showing already allotted, hide teams assigned to selected judge
      if (!showAlreadyAllotted && alreadyAssignedToSelected) return false;

      return true;
    });
  }, [
    teams,
    searchQuery,
    trackFilter,
    showAlreadyAllotted,
    selectedJudgeId,
    assignmentsMap,
  ]);

  const uniqueTracks = useMemo(
    () =>
      Array.from(
        new Set(
          teams
            .map((t) => t.track)
            .filter((t): t is string => t !== null && t !== "")
        )
      ),
    [teams]
  );

  // Filter judges by search query (name or email)
  const filteredJudges = useMemo(() => {
    const query = judgeSearchQuery.toLowerCase();
    if (!query) return allJudges;
    return allJudges.filter(
      (j) =>
        j.full_name?.toLowerCase().includes(query) ||
        j.email?.toLowerCase().includes(query)
    );
  }, [allJudges, judgeSearchQuery]);

  // Determine status for a team relative to the selected judge
  const getTeamStatus = (team: TeamCardData) => {
    const assignedJudges = assignmentsMap.get(team.team_id) ?? [];
    const count = assignedJudges.length;
    const alreadyAssignedToSelected =
      selectedJudgeId && assignedJudges.includes(selectedJudgeId);

    if (alreadyAssignedToSelected) return "alreadyAssigned";
    if (count === 0) return "available";
    if (count === 1) return "oneJudge";
    if (count >= 2) return "full";
    return "available";
  };

  const isTeamEligible = (team: TeamCardData) => {
    if (!selectedJudgeId) return false;
    const assignedJudges = assignmentsMap.get(team.team_id) ?? [];
    if (assignedJudges.includes(selectedJudgeId)) return false;
    if (assignedJudges.length >= 2) return false;
    return true;
  };

  const isTeamSelected = (teamId: string) =>
    selectedTeamIds.has(teamId);

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const selectFiltered = () => {
    const eligible = filteredTeams.filter(isTeamEligible);
    setSelectedTeamIds(new Set(eligible.map((t) => t.team_id)));
  };

  const clearSelected = () => {
    setSelectedTeamIds(new Set());
  };

  const confirmAllotment = async () => {
    if (!selectedJudgeId) {
      showNotify("error", "Please select a judge first.");
      return;
    }
    if (selectedTeamIds.size === 0) {
      showNotify("error", "Please select at least one team.");
      return;
    }

    const assignments = Array.from(selectedTeamIds).map((teamId) => ({
      teamId,
      judgeId: selectedJudgeId,
    }));

    setLoading(true);
    try {
      const res = await batchAssignJudges({
        roundId,
        assignments,
        ...withCsrfToken(),
      });

      if (res.errors.length > 0) {
        showNotify(
          "error",
          `Assigned ${res.assigned.length}, ${res.errors.length} failed: ${res.errors
            .slice(0, 3)
            .map((e) => e.message)
            .join(", ")}`
        );
      } else {
        showNotify(
          "success",
          `Assigned ${res.assigned.length} team(s) to ${selectedJudge?.full_name || selectedJudge?.email}.`
        );
      }

      // Reload data
      void (async () => {
        const res2 = await getJudgeAssignmentsForRound(roundId);
        if (!res2.error) {
          const map = new Map<string, string[]>();
          res2.assignments.forEach((a) => map.set(a.team_id, a.judge_ids));
          setAssignmentsMap(map);
          setTeams(
            res2.assignments.map((a) => ({
              team_id: a.team_id,
              team_name: a.team_name,
              team_code: a.team_code,
              track: a.track,
              judge_ids: a.judge_ids,
              assigned_count: a.assigned_count,
            }))
          );
        }
        setLoading(false);
        setSelectedTeamIds(new Set());
      })();
    } catch (err) {
      showNotify(
        "error",
        err instanceof Error ? err.message : "Allotment failed."
      );
      setLoading(false);
    }
  };

  const handleAutoBalance = async () => {
    setAutoBalanceLoading(true);
    try {
      const res = await autoBalanceJudges({
        roundId,
        reset: false,
        ...withCsrfToken(),
      });

      if (res.proposed.length === 0) {
        showNotify("success", "No assignments needed - all teams already have 2 judges.");
      } else {
        setConfirmPreview(res.proposed);
        setShowPreview(true);
      }

      // Reload data after a short delay
      setTimeout(() => {
        void (async () => {
          const res2 = await getJudgeAssignmentsForRound(roundId);
          if (!res2.error) {
            const map = new Map<string, string[]>();
            res2.assignments.forEach((a) => map.set(a.team_id, a.judge_ids));
            setAssignmentsMap(map);
            setTeams(
              res2.assignments.map((a) => ({
                team_id: a.team_id,
                team_name: a.team_name,
                team_code: a.team_code,
                track: a.track,
                judge_ids: a.judge_ids,
                assigned_count: a.assigned_count,
              }))
            );
          }
          setAutoBalanceLoading(false);
        })();
      }, 800);
    } catch (err) {
      showNotify("error", err instanceof Error ? err.message : "Auto-balance failed.");
      setAutoBalanceLoading(false);
    }
  };

  const commitPreview = async () => {
    const assignments = confirmPreview.map((p) => ({
      teamId: p.teamId,
      judgeId: p.judgeId,
    }));
    setLoading(true);
    setShowPreview(false);
    try {
      const res = await batchAssignJudges({
        roundId,
        assignments,
        ...withCsrfToken(),
      });
      showNotify(
        "success",
        `Auto-balance committed ${res.assigned.length} assignment(s).`
      );
      // Reload
      const res2 = await getJudgeAssignmentsForRound(roundId);
      if (!res2.error) {
        const map = new Map<string, string[]>();
        res2.assignments.forEach((a) => map.set(a.team_id, a.judge_ids));
        setAssignmentsMap(map);
        setTeams(
          res2.assignments.map((a) => ({
            team_id: a.team_id,
            team_name: a.team_name,
            team_code: a.team_code,
            track: a.track,
            judge_ids: a.judge_ids,
            assigned_count: a.assigned_count,
          }))
        );
      }
    } catch (err) {
      showNotify("error", err instanceof Error ? err.message : "Commit failed.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin mb-3" />
        <p className="font-tech text-text-secondary text-xs uppercase tracking-wider">
          Loading allocation workspace…
        </p>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    available: { label: "Available for Allocation", color: "text-status-success" },
    oneJudge: { label: "One Judge Assigned", color: "text-status-warning" },
    full: { label: "Assignment Full", color: "text-text-secondary" },
    alreadyAssigned: {
      label: "Already Assigned to This Judge",
      color: "text-accent-secondary",
    },
  };

  // Safe fallback so an unexpected status never crashes the UI.
  const DEFAULT_STATUS: { label: string; color: string } = {
    label: "Unknown Status",
    color: "text-text-secondary",
  };

  return (
    <div className="space-y-6 font-tech">
      {notify && (
        <div
          className={`p-4 border flex items-center justify-between text-xs transition-all ${
            notify.type === "success"
              ? "bg-status-success/15 border-status-success text-status-success"
              : "bg-status-error/15 border-status-error text-status-error"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notify.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="font-bold tracking-wide">{notify.message}</span>
          </div>
          <button
            onClick={() => setNotifyState(null)}
            className="text-text-secondary hover:text-text-primary uppercase text-[10px] tracking-wider cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Two-panel workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ===================== LEFT PANEL: JUDGE DIRECTORY ===================== */}
        <div className="lg:col-span-4 space-y-4">
          <div className="border border-border-color rounded-xl bg-surface-color/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-heading text-sm text-text-primary uppercase m-0 tracking-wider">
                  Judges
                </h3>
                <p className="text-[10px] text-text-secondary m-0 mt-0.5 font-mono">
                  {allJudges.length} judges &bull; 2 per team
                </p>
              </div>
              <button
                onClick={handleAutoBalance}
                disabled={autoBalanceLoading || !roundId}
                className="px-3 py-1.5 border border-accent-secondary/40 text-accent-secondary rounded text-[10px] font-bold uppercase tracking-wider hover:bg-accent-secondary/10 disabled:opacity-50 flex items-center gap-1.5"
              >
                {autoBalanceLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Gift size={13} />
                )}
                <span>Auto-Balance</span>
              </button>
            </div>

            {/* Judge search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-text-secondary/50" />
              <input
                type="text"
                placeholder="Search judges by name or email…"
                value={judgeSearchQuery}
                onChange={(e) => setJudgeSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary outline-none focus:border-accent-primary"
              />
            </div>

            {/* Judge list - scrollable */}
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {filteredJudges.length === 0 ? (
                <div className="p-4 text-center text-text-secondary/60 text-xs uppercase">
                  No judges found
                </div>
              ) : (
                filteredJudges.map((judge) => {
                  const isSelected = selectedJudgeId === judge.id;
                  return (
                    <div
                      key={judge.id}
                      onClick={() => setSelectedJudgeId(judge.id)}
                      className={`cursor-pointer p-3 rounded border transition-all ${
                        isSelected
                          ? "bg-accent-secondary/20 border-accent-secondary text-text-primary"
                          : "bg-surface-color/30 border-border-color hover:border-accent-secondary/50 hover:text-text-primary"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-surface-color border border-border-color flex items-center justify-center font-mono text-[10px] text-accent-secondary">
                            {(judge.full_name?.charAt(0) || judge.email?.charAt(0) || "?")
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-heading text-xs text-text-primary m-0">
                              {judge.full_name || "Unnamed Judge"}
                            </div>
                            <div className="text-[10px] text-text-secondary/60 font-mono m-0">
                              {judge.email || ""}
                            </div>
                          </div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                          isSelected
                            ? "bg-accent-secondary text-black"
                            : "bg-surface-color border border-border-color text-text-secondary/60"
                        }`}>
                          {judge.assigned_team_count} teams
                        </span>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border-color/50">
                          <Check className="w-3 h-3 text-accent-secondary" />
                          <span className="text-[10px] font-mono text-accent-secondary font-bold uppercase">
                            Active Assignee
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ===================== RIGHT PANEL: TEAM ALLOCATION ===================== */}
        <div className="lg:col-span-8 space-y-4">
          <div className="border border-border-color rounded-xl bg-surface-color/50 p-4">
            {/* Active Assignee Header */}
            <div className="border-b border-border-color pb-3 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-accent-secondary" />
                <h3 className="font-heading text-sm text-text-primary uppercase m-0 tracking-wider">
                  Active Assignee
                </h3>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="font-heading text-base text-text-primary m-0">
                  {selectedJudge?.full_name || "Select a judge"}
                </div>
                <div className="text-[10px] text-text-secondary font-mono m-0">
                  {selectedJudge?.email || "—"}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectFiltered}
                  disabled={
                    !selectedJudgeId ||
                    filteredTeams.filter(isTeamEligible).length === 0
                  }
                  className="px-3 py-1.5 border border-accent-secondary/40 text-accent-secondary rounded text-[10px] font-bold uppercase tracking-wider hover:bg-accent-secondary/10 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus size={12} />
                  <span>Select Filtered</span>
                </button>
                <button
                  onClick={clearSelected}
                  disabled={selectedTeamIds.size === 0}
                  className="px-3 py-1.5 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary disabled:opacity-50 flex items-center gap-1.5"
                >
                  <X size={12} />
                  <span>Clear Selected</span>
                </button>
              </div>
              <button
                onClick={confirmAllotment}
                disabled={
                  !selectedJudgeId ||
                  selectedTeamIds.size === 0 ||
                  loading
                }
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-bold uppercase text-[10px] tracking-wider rounded hover:opacity-90 disabled:opacity-50 shadow-[0_0_15px_rgba(255,0,127,0.3)] flex items-center gap-1.5"
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                <span>
                  Confirm Allotment ({selectedTeamIds.size})
                </span>
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-text-secondary/50" />
                <input
                  type="text"
                  placeholder="Search team name or code…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary outline-none focus:border-accent-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-1">
                  Track / Domain
                </label>
                <select
                  value={trackFilter ?? ""}
                  onChange={(e) =>
                    setTrackFilter(e.target.value || null)
                  }
                  className="w-full px-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary outline-none focus:border-accent-primary"
                >
                  <option value="">All Tracks</option>
                  {uniqueTracks.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAlreadyAllotted}
                    onChange={(e) => setShowAlreadyAllotted(e.target.checked)}
                    className="w-3 h-3 rounded border-border-color accent-accent-secondary"
                  />
                  <span className="text-[10px] font-mono text-text-secondary">
                    Show Already Allotted
                  </span>
                </label>
              </div>
              <div className="flex items-end justify-end">
                <span className={`px-2 py-1 rounded text-[9px] font-mono font-bold ${
                  selectedTeamIds.size > 0
                    ? "bg-status-success/10 border-status-success/40 text-status-success"
                    : "bg-surface-color/40 border-border-color/60 text-text-secondary/60"
                }`}>
                  {selectedTeamIds.size} selected
                </span>
              </div>
            </div>

            {/* Team grid - two columns */}
            <div className="grid grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-2">
              {filteredTeams.length === 0 ? (
                <div className="col-span-2 p-8 text-center text-text-secondary/60">
                  <p className="text-xs uppercase tracking-wider">
                    No teams match the selected filter.
                  </p>
                </div>
              ) : (
                filteredTeams.map((team) => {
                  const status = getTeamStatus(team);
                  const statusInfo = statusConfig[status] ?? DEFAULT_STATUS;
                  const eligible = isTeamEligible(team);
                  const isSelected = isTeamSelected(team.team_id);
                  const assignedJudges =
                    assignmentsMap.get(team.team_id) ?? [];
                      const judgeNames = assignedJudges
                    .map((id) => {
                      const j = allJudges.find((x) => x.id === id);
                      return j ? j.full_name || j.email : "Unknown";
                    })
                    .join(", ");

                  return (
                    <div
                      key={team.team_id}
                      onClick={() => toggleTeam(team.team_id)}
                      className={`cursor-pointer p-3 rounded border transition-all ${
                        isSelected
                          ? "bg-accent-secondary/20 border-accent-secondary"
                          : "bg-surface-color/30 border-border-color hover:border-accent-secondary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-6 h-6 rounded-full bg-surface-color border border-border-color flex items-center justify-center font-mono text-[9px] text-accent-secondary shrink-0">
                          {team.team_code?.charAt(0) || team.team_name?.charAt(0) || "?"}
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                            statusInfo.color
                          } ${
                            status === "available"
                              ? "bg-status-success/10 border-status-success/40"
                              : status === "alreadyAssigned"
                                ? "bg-accent-secondary/10 border-accent-secondary/40"
                                : status === "full"
                                  ? "bg-surface-color/40 border-border-color/40"
                                  : "bg-status-warning/10 border-status-warning/40"
                          }`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <div className="font-heading text-xs text-text-primary m-0 truncate">
                            {team.team_name || "Unnamed Team"}
                          </div>
                          <div className="text-[9px] text-text-secondary/60 font-mono m-0 uppercase">
                            {team.team_code || team.team_id.slice(0, 8)}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleTeam(team.team_id);
                          }}
                          className="w-3 h-3 rounded border-border-color accent-accent-secondary"
                          disabled={!eligible && !isSelected}
                        />
                      </div>
                      {team.track && (
                        <div className="text-[9px] font-mono text-text-secondary/50 mb-2 uppercase">
                          [{team.track}]
                        </div>
                      )}
                      {assignedJudges.length > 0 && (
                        <div className="text-[9px] font-mono text-text-secondary mb-2">
                          {judgeNames}
                        </div>
                      )}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        className="sr-only"
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleTeam(team.team_id);
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Balance Preview Confirmation */}
      {showPreview && confirmPreview.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="bg-surface-color border border-border-color rounded-xl p-6 w-full max-w-2xl shadow-2xl relative animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-base text-text-primary uppercase m-0 tracking-wider">
                Auto-Balance Preview
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-text-secondary text-xs mb-4 font-mono">
              {confirmPreview.length} proposed assignment(s) for round{" "}
              {roundId.slice(0, 8)}…
            </p>
            <div className="max-h-[40vh] overflow-y-auto space-y-2 mb-4">
              {confirmPreview.map((p) => (
                <div key={`${p.teamId}-${p.judgeId}`} className="p-2 rounded border border-border-color/50 bg-surface-color/30 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-text-primary font-mono">
                      {p.teamName}
                    </div>
                    <div className="text-[9px] text-text-secondary/60">
                      {p.teamId.slice(0, 8)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[9px] font-mono text-text-secondary">
                      {p.judgeName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={commitPreview}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-bold uppercase text-[10px] tracking-wider rounded hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Committing…" : "Commit Allotment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
