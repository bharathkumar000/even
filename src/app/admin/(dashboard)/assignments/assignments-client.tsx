"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import {
  UserCheck,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  Check,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  JudgeOption,
  TeamOption,
  updateJudgeTeams,
  autoBalanceJudgeAssignments,
  getJudgeAssignmentsData,
} from "@/app/actions/admin-assignments";

interface AssignmentsClientProps {
  initialJudges: JudgeOption[];
  initialTeams: TeamOption[];
}

export default function AssignmentsClientView({
  initialJudges,
  initialTeams,
}: AssignmentsClientProps) {
  const [judges, setJudges] = useState<JudgeOption[]>(initialJudges);
  const [teams, setTeams] = useState<TeamOption[]>(initialTeams);

  // Selected Judge
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>(
    initialJudges[0]?.id || ""
  );

  // Search & Filter state
  const [judgeSearch, setJudgeSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  const [judgesPerTeam, setJudgesPerTeam] = useState<number>(2);

  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Active selected judge object
  const activeJudge = useMemo(
    () => judges.find((j) => j.id === selectedJudgeId) || null,
    [judges, selectedJudgeId]
  );

  // Pending stage state: map of judgeId -> string[] of selected team IDs
  const [pendingAssignedMapState, setPendingAssignedMap] = useState<Record<string, string[]>>(() => {
    const initialMap: Record<string, string[]> = {};
    judges.forEach((j) => {
      initialMap[j.id] = [...j.assigned_team_ids];
    });
    return initialMap;
  });

  // Derive pending map directly from judges using useMemo - no useEffect needed
  const pendingAssignedMapFromJudges = useMemo(() => {
    const initialMap: Record<string, string[]> = {};
    judges.forEach((j) => {
      initialMap[j.id] = [...j.assigned_team_ids];
    });
    return initialMap;
  }, [judges]);

  // Sync state with judges when they change
  useEffect(() => {
    setPendingAssignedMap(pendingAssignedMapFromJudges);
  }, [pendingAssignedMapFromJudges]);

  // Use the state for both reading and staging
  const pendingAssignedMap = pendingAssignedMapState;

  // Current staged team IDs for active judge
  const stagedTeamIds = useMemo(() => {
    if (!selectedJudgeId) return new Set<string>();
    return new Set(pendingAssignedMap[selectedJudgeId] || activeJudge?.assigned_team_ids || []);
  }, [selectedJudgeId, pendingAssignedMap, activeJudge]);

  // Check if active judge has unsaved pending changes
  const hasUnsavedChanges = useMemo(() => {
    if (!activeJudge) return false;
    const original = new Set(activeJudge.assigned_team_ids || []);
    if (original.size !== stagedTeamIds.size) return true;
    for (const id of stagedTeamIds) {
      if (!original.has(id)) return true;
    }
    return false;
  }, [activeJudge, stagedTeamIds]);

  // Distinct tracks
  const tracks = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.track) set.add(t.track);
    });
    return Array.from(set);
  }, [teams]);

  // Filtered judges
  const filteredJudges = useMemo(() => {
    return judges.filter((j) => {
      const q = judgeSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        j.full_name?.toLowerCase().includes(q) ||
        j.email?.toLowerCase().includes(q)
      );
    });
  }, [judges, judgeSearch]);

  // Filter & view mode state
  const [showOtherAssigned, setShowOtherAssigned] = useState(false);

  // Filtered teams:
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (trackFilter !== "all" && t.track !== trackFilter) return false;

      const isStagedInThis = stagedTeamIds.has(t.id);
      const isAssignedToOther = t.assigned_judge_ids.some((id) => id !== selectedJudgeId);

      if (!showOtherAssigned && isAssignedToOther && !isStagedInThis) {
        return false;
      }

      const q = teamSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q)
      );
    });
  }, [teams, teamSearch, trackFilter, selectedJudgeId, showOtherAssigned, stagedTeamIds]);

  // Toggle team assignment for active judge (Staging in pendingAssignedMap only)
  const handleToggleTeam = (team: TeamOption) => {
    if (!activeJudge) return;
    const teamId = team.id;

    setPendingAssignedMap((prev) => {
      const currentList = prev[activeJudge.id] || [...activeJudge.assigned_team_ids];
      const set = new Set(currentList);
      if (set.has(teamId)) {
        set.delete(teamId);
      } else {
        set.add(teamId);
      }
      return {
        ...prev,
        [activeJudge.id]: Array.from(set),
      };
    });
  };

  // Bulk select all filtered teams for active judge locally (Staging only)
  const handleSelectAllFiltered = () => {
    if (!activeJudge) return;
    setPendingAssignedMap((prev) => {
      const currentList = prev[activeJudge.id] || [...activeJudge.assigned_team_ids];
      const set = new Set(currentList);
      filteredTeams.forEach((t) => set.add(t.id));
      return {
        ...prev,
        [activeJudge.id]: Array.from(set),
      };
    });
  };

  // Bulk clear all teams for active judge locally (Staging only)
  const handleClearAll = () => {
    if (!activeJudge) return;
    setPendingAssignedMap((prev) => ({
      ...prev,
      [activeJudge.id]: [],
    }));
  };

  // Discard pending changes and reset to current saved DB state
  const handleResetStaged = () => {
    if (!activeJudge) return;
    setPendingAssignedMap((prev) => ({
      ...prev,
      [activeJudge.id]: [...activeJudge.assigned_team_ids],
    }));
  };

  // Explicit Confirm Allotment handler -> writes to database
  const handleConfirmAllotment = () => {
    if (!activeJudge) return;
    const nextArray = Array.from(stagedTeamIds);
    setNotification(null);

    // Optimistically update
    setJudges((prev) =>
      prev.map((j) =>
        j.id === activeJudge.id
          ? { ...j, assigned_team_ids: nextArray }
          : { ...j, assigned_team_ids: j.assigned_team_ids.filter((tId) => !nextArray.includes(tId)) }
      )
    );

    setTeams((prev) =>
      prev.map((t) => {
        if (nextArray.includes(t.id)) {
          return {
            ...t,
            assigned_judge_ids: [activeJudge.id],
            assigned_judge_names: [activeJudge.full_name || activeJudge.email || "Judge"],
          };
        } else if (t.assigned_judge_ids.includes(activeJudge.id)) {
          return {
            ...t,
            assigned_judge_ids: t.assigned_judge_ids.filter((id) => id !== activeJudge.id),
            assigned_judge_names: (t.assigned_judge_names || []).filter(
              (n) => n !== (activeJudge.full_name || activeJudge.email)
            ),
          };
        }
        return t;
      })
    );

    // Save to database
    startTransition(async () => {
      try {
        await updateJudgeTeams({
          judgeId: activeJudge.id,
          teamIds: nextArray,
        });
        setNotification({
          type: "success",
          message: `Allotment confirmed! Successfully saved ${nextArray.length} teams to ${activeJudge.full_name || "judge"}.`,
        });
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to confirm allotment.",
        });
      }
    });
  };

  const handleAutoBalance = (countToAssign: number = judgesPerTeam) => {
    if (judges.length === 0) {
      setNotification({ type: "error", message: "Please create judges before auto-balancing." });
      return;
    }

    if (!confirm(`Auto-balance teams evenly across all judges (${countToAssign} judge${countToAssign > 1 ? "s" : ""} per team)?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await autoBalanceJudgeAssignments({ judgesPerTeam: countToAssign });
        const fresh = await getJudgeAssignmentsData();
        setJudges(fresh.judges);
        setTeams(fresh.teams);
        setNotification({
          type: "success",
          message: `Auto-balance complete! Generated ${res.totalAssignments} judge-team evaluation pairs (${countToAssign} per team) across ${res.judgesCount} judges.`,
        });
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to auto-balance judge assignments.",
        });
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 border flex items-center justify-between text-xs transition-all ${
            notification.type === "success"
              ? "bg-status-success/15 border-status-success text-status-success"
              : "bg-status-error/15 border-status-error text-status-error"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="font-bold tracking-wide">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-text-secondary hover:text-text-primary uppercase text-[10px] tracking-wider cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Dual-Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Judge Selector (4 cols) */}
        <div className="lg:col-span-4 border border-border-color bg-surface-color/50 rounded-lg p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-color/60">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-accent-secondary" />
              <h2 className="font-heading text-lg text-text-primary uppercase m-0">
                Judges ({judges.length})
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center border border-border-color rounded bg-surface-color px-1.5 py-0.5"
                title="Number of judges to assign per team (Configurable by admin)"
              >
                <span className="text-[10px] text-text-secondary font-tech mr-1 uppercase">Per Team:</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, judges.length)}
                  value={judgesPerTeam}
                  onChange={(e) => setJudgesPerTeam(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-8 bg-transparent text-center font-bold font-mono text-xs text-accent-secondary outline-none"
                />
              </div>
              <button
                onClick={() => handleAutoBalance(judgesPerTeam)}
                disabled={isPending}
                title={`Automatically distribute teams across judges (${judgesPerTeam} judges per team)`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-color-light border border-accent-secondary/50 hover:border-accent-secondary text-accent-secondary font-tech font-bold uppercase tracking-wider text-[11px] rounded transition-all hover:bg-accent-secondary/10 cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={12} />
                <span>Auto-Balance</span>
              </button>
            </div>
          </div>

          {/* Judge Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search judge by name/email..."
              value={judgeSearch}
              onChange={(e) => setJudgeSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-secondary outline-none font-mono"
            />
          </div>

          {/* Judges List */}
          <div className="space-y-2 overflow-y-auto max-h-[620px] pr-1">
            {filteredJudges.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-xs">
                No judges found.
              </div>
            ) : (
              filteredJudges.map((j) => {
                const isSelected = j.id === selectedJudgeId;
                const assignedCount = j.assigned_team_ids.length;

                return (
                  <button
                    key={j.id}
                    onClick={() => setSelectedJudgeId(j.id)}
                    className={`w-full text-left p-3.5 rounded border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-accent-secondary/[0.06] border-accent-secondary/50 shadow-[0_0_15px_rgba(255,0,127,0.12)]"
                        : "bg-surface-color/40 border-border-color/70 hover:border-accent-secondary/40 hover:bg-surface-color"
                    }`}
                  >
                    <div>
                      <p className="font-heading text-sm text-text-primary m-0 uppercase tracking-wide">
                        {j.full_name || "Unnamed Judge"}
                      </p>
                      <p className="text-[11px] text-text-secondary font-mono m-0 truncate max-w-[200px]">
                        {j.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                          assignedCount > 0
                            ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/40"
                            : "bg-surface-color-light text-text-secondary border border-border-color"
                        }`}
                      >
                        {assignedCount} {assignedCount === 1 ? "Team" : "Teams"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Teams Allocation Matrix (8 cols) */}
        <div className="lg:col-span-8 border border-border-color bg-surface-color/50 rounded-lg p-5 flex flex-col space-y-4">
          {activeJudge ? (
            <>
              {/* Active Judge Status Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-color/60">
                <div>
                  <span className="font-tech text-[10px] uppercase tracking-[2px] text-accent-secondary font-bold">
                    Active Assignee
                  </span>
                  <h2 className="font-heading text-xl text-text-primary uppercase m-0 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-accent-secondary" />
                    {activeJudge.full_name || "Judge"}
                    <span className="text-xs font-mono text-text-secondary normal-case">
                      ({activeJudge.email})
                    </span>
                  </h2>
                </div>

                {/* Bulk Actions & Confirm Allotment */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSelectAllFiltered}
                    disabled={isPending || filteredTeams.length === 0}
                    className="px-3 py-1.5 bg-surface-color-light border border-border-color hover:border-accent-primary text-text-primary text-xs uppercase font-bold tracking-wider rounded transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Select Filtered ({filteredTeams.length})
                  </button>
                  <button
                    onClick={handleClearAll}
                    disabled={isPending || stagedTeamIds.size === 0}
                    className="px-3 py-1.5 bg-status-error/10 border border-status-error/40 hover:bg-status-error/20 text-status-error text-xs uppercase font-bold tracking-wider rounded transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Clear Selected
                  </button>
                  {hasUnsavedChanges && (
                    <button
                      onClick={handleResetStaged}
                      disabled={isPending}
                      className="px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary underline font-mono cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={handleConfirmAllotment}
                    disabled={isPending || !hasUnsavedChanges}
                    className={`px-4 py-1.5 rounded font-tech text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      hasUnsavedChanges
                        ? "bg-accent-primary text-black hover:bg-accent-primary/90 shadow-[0_0_15px_rgba(0,240,255,0.4)] animate-pulse"
                        : "bg-surface-color-light text-text-secondary border border-border-color opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <Check size={14} className="stroke-[3]" />
                    <span>Confirm Allotment ({stagedTeamIds.size})</span>
                  </button>
                </div>
              </div>

              {/* Unsaved changes notice banner */}
              {hasUnsavedChanges && (
                <div className="bg-accent-primary/10 border border-accent-primary/40 px-3 py-2 rounded flex items-center justify-between text-xs text-accent-primary animate-fade-in">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
                    <strong>{stagedTeamIds.size} team(s) selected.</strong> Click &quot;Confirm Allotment&quot; to apply changes to this judge.
                  </span>
                  <button
                    onClick={handleConfirmAllotment}
                    disabled={isPending}
                    className="underline font-bold uppercase tracking-wider hover:text-text-primary cursor-pointer"
                  >
                    Save Allotment Now
                  </button>
                </div>
              )}

              {/* Filters for Teams */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  <input
                    type="text"
                    placeholder="Search available teams by name or code..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-primary outline-none font-mono"
                  />
                </div>

                {/* Track Filter */}
                <select
                  value={trackFilter}
                  onChange={(e) => setTrackFilter(e.target.value)}
                  className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 font-mono outline-none focus:border-accent-primary uppercase"
                >
                  <option value="all">All Tracks</option>
                  {tracks.map((tr) => (
                    <option key={tr} value={tr}>
                      Track: {tr}
                    </option>
                  ))}
                </select>

                {/* Show All Toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-secondary hover:text-text-primary shrink-0 px-2 py-1 bg-surface-color/40 border border-border-color rounded">
                  <input
                    type="checkbox"
                    checked={showOtherAssigned}
                    onChange={(e) => setShowOtherAssigned(e.target.checked)}
                    className="accent-accent-secondary cursor-pointer"
                  />
                  <span>Show already allotted</span>
                </label>
              </div>

              {/* Teams Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[580px] pr-1">
                {filteredTeams.length === 0 ? (
                  <div className="sm:col-span-2 p-10 text-center text-text-secondary text-xs">
                    No unassigned teams available for allotment. All teams are allocated or filtered.
                  </div>
                ) : (
                  filteredTeams.map((team) => {
                    const isAssignedToThis = stagedTeamIds.has(team.id);
                    const isAssignedToOther = team.assigned_judge_ids.some(
                      (id) => id !== activeJudge.id
                    );
                    const otherJudgeNames = isAssignedToOther
                      ? (team.assigned_judge_names || []).join(", ")
                      : "";

                    return (
                      <div
                        key={team.id}
                        onClick={() => handleToggleTeam(team)}
                        className={`p-3.5 rounded border transition-all cursor-pointer flex items-center justify-between ${
                          isAssignedToThis
                            ? "bg-gradient-to-r from-accent-primary/15 to-transparent border-accent-primary shadow-[0_0_15px_rgba(0,240,255,0.15)]"
                            : isAssignedToOther
                            ? "bg-surface-color/20 border-status-warning/40 opacity-75 hover:opacity-100"
                            : "bg-surface-color/40 border-border-color/70 hover:border-accent-primary/40 hover:bg-surface-color"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-sm text-text-primary uppercase tracking-wide">
                              {team.name}
                            </span>
                            {team.code && (
                              <span className="font-mono text-[10px] text-accent-tertiary px-1.5 py-0.2 bg-accent-tertiary/10 border border-accent-tertiary/30 rounded">
                                {team.code}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] font-mono text-text-secondary">
                            {team.track && (
                              <span className="uppercase text-accent-secondary">
                                [{team.track}]
                              </span>
                            )}
                            {isAssignedToOther && (
                              <>
                                <span>•</span>
                                <span className="text-status-warning font-semibold">
                                  Allotted to: {otherJudgeNames || "Other Judge"}
                                </span>
                              </>
                            )}
                            {!isAssignedToOther && !isAssignedToThis && (
                              <>
                                <span>•</span>
                                <span className="text-status-success font-semibold">
                                  Available for Allotment
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Checkbox indicator */}
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                            isAssignedToThis
                              ? "bg-accent-primary border-accent-primary text-black"
                              : isAssignedToOther
                              ? "border-status-warning/60 bg-status-warning/10 text-status-warning text-xs font-bold"
                              : "border-border-color/80 bg-surface-color/60 text-transparent"
                          }`}
                        >
                          {isAssignedToThis ? (
                            <Check size={14} className="stroke-[3]" />
                          ) : isAssignedToOther ? (
                            "!"
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-text-secondary font-tech">
              Please register or select a Judge on the left to configure assignments.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
