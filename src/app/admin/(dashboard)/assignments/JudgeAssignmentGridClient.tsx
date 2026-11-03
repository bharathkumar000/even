"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  User,
  Users,
  Shield,
  Minus,
  Plus,
  Filter,
  Loader2,
  Gavel,
  Layers,
  Trash2,
} from "lucide-react";
import {
  assignJudgeToTeam,
  removeJudgeFromTeam,
  replaceJudgeAssignment,
  deleteAllJudgeAssignments,
  getJudgeAssignmentGrid,
  getJudgesSummary,
  getJudgeAssignmentStats,
  type JudgeAssignmentGridRow,
  type JudgeAssignmentStats,
  type JudgeSummary,
} from "@/app/actions/admin-judge-assignments";
import { withCsrfToken } from "@/lib/csrf-client";

type Slot = 1 | 2;

interface ConfirmDialog {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
}

export default function JudgeAssignmentGridClient({
  roundId,
  initialRows,
  initialJudges,
  initialStats,
}: {
  roundId: string;
  initialRows: JudgeAssignmentGridRow[];
  initialJudges: JudgeSummary[];
  initialStats: JudgeAssignmentStats | null;
}) {
  const [rows, setRows] = useState<JudgeAssignmentGridRow[]>(initialRows);
  const [judges, setJudges] = useState<JudgeSummary[]>(initialJudges);
  const [stats, setStats] = useState<JudgeAssignmentStats | null>(initialStats);
  const [loading, setLoading] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set()); // teamId -> saving
  const [notify, setNotifyState] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const showNotify = (type: "success" | "error", message: string) => {
    setNotifyState({ type, message });
    setTimeout(() => setNotifyState(null), 5000);
  };

  // Confirmation dialog for replace / remove
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);

  // Per-team, per-slot staged judge id (for dropdown pre-selection)
  const [staged, setStaged] = useState<
    Record<string, { [key in Slot]?: string }>
  >({});

  const [filter, setFilter] = useState<"all" | "unassigned" | "partial" | "complete">("all");

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { unassigned: 0, partial: 0, complete: 0 };
    rows.forEach((r) => (c[r.status] = (c[r.status] || 0) + 1));
    return c;
  }, [rows]);

  const availableJudgesForSlot = useCallback(
    (teamId: string, slot: Slot, excludeCurrent?: string) => {
      const row = rows.find((r) => r.team_id === teamId);
      if (!row) return judges;
      const otherSlot = slot === 1 ? 2 : 1;
      const otherJudge = otherSlot === 1 ? row.judge_1_id : row.judge_2_id;
      return judges.filter((j) => {
        if (j.id === excludeCurrent) return false;
        if (j.id === otherJudge) return false; // same judge not allowed in both slots
        return true;
      });
    },
    [judges, rows]
  );

  const openConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>
  ) => {
    setConfirm({ open: true, title, message, onConfirm });
  };

  /* ---------------------------------------------------------------- ASSIGN */
  const handleAssign = async (
    teamId: string,
    slot: Slot,
    judgeId: string
  ) => {
    if (!judgeId) return;
    setSaving((prev) => new Set([...prev, teamId]));
    try {
      await assignJudgeToTeam({
        roundId,
        teamId,
        judgeId,
        ...withCsrfToken(),
      });
      showNotify("success", `Judge assigned to slot ${slot}.`);
      await refresh();
    } catch (err: unknown) {
      showNotify("error", err instanceof Error ? err.message : "Assignment failed.");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(teamId);
        return next;
      });
    }
  };

  /* ---------------------------------------------------------------- REMOVE */
  const handleRemove = async (teamId: string, slot: Slot, judgeId: string) => {
    const row = rows.find((r) => r.team_id === teamId);
    if (!row) return;
    const hasEval = slot === 1 ? Boolean(row.judge_1_evaluation_id) : Boolean(row.judge_2_evaluation_id);
    if (hasEval) {
      openConfirm(
        "Remove judge with existing evaluation?",
        "This judge already has an evaluation on this team. Removing the assignment will preserve the evaluation history but the judge will no longer be assigned. Continue?",
        async () => {
          setConfirm(null);
          await performRemove(teamId, slot, judgeId);
        }
      );
      return;
    }
    await performRemove(teamId, slot, judgeId);
  };

  const performRemove = async (teamId: string, slot: Slot, judgeId: string) => {
    setSaving((prev) => new Set([...prev, teamId]));
    try {
      await removeJudgeFromTeam({
        roundId,
        teamId,
        judgeId,
        confirmed: true,
        ...withCsrfToken(),
      });
      showNotify("success", `Judge removed from slot ${slot}.`);
      await refresh();
    } catch (err: unknown) {
      showNotify("error", err instanceof Error ? err.message : "Removal failed.");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(teamId);
        return next;
      });
    }
  };

  /* --------------------------------------------------------------- REPLACE */
  const handleReplace = async (
    teamId: string,
    slot: Slot,
    fromJudgeId: string,
    toJudgeId: string
  ) => {
    if (!toJudgeId) return;
    const row = rows.find((r) => r.team_id === teamId);
    if (!row) return;
    const hasEval = slot === 1 ? Boolean(row.judge_1_evaluation_id) : Boolean(row.judge_2_evaluation_id);
    if (hasEval) {
      openConfirm(
        "Replace judge with existing evaluation?",
        "This judge already has an evaluation on this team. Replacing will preserve the evaluation history. Continue?",
        async () => {
          setConfirm(null);
          await performReplace(teamId, slot, fromJudgeId, toJudgeId, true);
        }
      );
      return;
    }
    await performReplace(teamId, slot, fromJudgeId, toJudgeId, false);
  };

  const performReplace = async (
    teamId: string,
    slot: Slot,
    fromJudgeId: string,
    toJudgeId: string,
    confirmed: boolean
  ) => {
    setSaving((prev) => new Set([...prev, teamId]));
    try {
      await replaceJudgeAssignment({
        roundId,
        teamId,
        fromJudgeId,
        toJudgeId,
        confirmed,
        ...withCsrfToken(),
      });
      showNotify("success", `Judge in slot ${slot} replaced.`);
      await refresh();
    } catch (err: unknown) {
      showNotify("error", err instanceof Error ? err.message : "Replacement failed.");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(teamId);
        return next;
      });
    }
  };

  /* ------------------------------------------------------------ DELETE ALL */
  const handleDeleteAllAssignments = async () => {
    setConfirm(null);
    setDeletingAll(true);
    try {
      await deleteAllJudgeAssignments({
        roundId,
        ...withCsrfToken(),
      });
      showNotify(
        "success",
        `All judge assignments for round ${roundId.slice(0, 8)}… have been deleted.`
      );
      await refresh();
    } catch (err: unknown) {
      showNotify(
        "error",
        err instanceof Error ? err.message : "Failed to delete all assignments."
      );
    } finally {
      setDeletingAll(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [rowsData, judgesData, statsData] = await Promise.all([
        getJudgeAssignmentGrid(roundId),
        getJudgesSummary(),
        getJudgeAssignmentStats(roundId),
      ]);
      setRows(rowsData);
      setJudges(judgesData);
      setStats(statsData);
    } catch (err) {
      showNotify("error", err instanceof Error ? err.message : "Failed to refresh.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------- RENDER */
  const statusChip = (status: JudgeAssignmentGridRow["status"]) => {
    const conf: Record<string, { color: string; border: string; bg: string }> = {
      unassigned: { color: "text-text-secondary", border: "border-border-color", bg: "bg-surface-color/40" },
      partial: { color: "text-status-warning", border: "border-status-warning/40", bg: "bg-status-warning/10" },
      complete: { color: "text-status-success", border: "border-status-success/40", bg: "bg-status-success/10" },
    };
    const c = conf[status];
    const label = status === "complete" ? "Complete (2/2)" : status === "partial" ? "1/2 Assigned" : "Unassigned";
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${c.color} ${c.border} ${c.bg}`}>
        {label}
      </span>
    );
  };

  const slotBadge = (judgeId: string | null, judgeName: string | null) => {
    if (!judgeId) return <span className="text-text-secondary text-xs font-mono">Empty</span>;
    const j = judges.find((x) => x.id === judgeId);
    return (
      <div className="flex items-center gap-2">
        <User className="w-3 h-3 text-accent-secondary" />
        <span className="text-xs font-mono text-text-primary truncate max-w-[140px]">
          {judgeName || "Unknown"}
        </span>
        <span className="text-[10px] text-text-secondary/60 font-mono">
          {j ? (j.email || "").split("@")[0] : ""}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      {notify && (
        <div
          className={`p-4 border flex items-center justify-between text-xs transition-all ${
            notify.type === "success"
              ? "bg-status-success/15 border-status-success text-status-success"
              : "bg-status-error/15 border-status-error text-status-error"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notify.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
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

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <StatMini label="Total Teams" value={stats.total_teams} icon={Users} color="text-text-primary" />
          <StatMini
            label="Required Slots"
            value={stats.required_slots}
            icon={Layers}
            color="text-accent-secondary"
          />
          <StatMini label="Filled Slots" value={stats.filled_slots} icon={CheckCircle2} color="text-status-success" />
          <StatMini label="Remaining Slots" value={stats.remaining_slots} icon={Minus} color="text-status-warning" />
          <StatMini label="Fully Assigned" value={stats.fully_assigned} icon={Shield} color="text-status-success" />
          <StatMini label="Partially Assigned" value={stats.partially_assigned} icon={Users} color="text-status-warning" />
          <StatMini label="Unassigned" value={stats.unassigned} icon={AlertCircle} color="text-text-secondary" />
        </div>
      )}

      {/* Header + controls */}
      <div className="border-b border-border-color pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold m-0">
            Administration // Judge Assignment
          </p>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
            <Gavel className="w-8 h-8 text-accent-secondary" />
            Dual-Judge Assignments
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-1 max-w-xl m-0">
            Maximum two distinct judges per team per round. Judge 1 and Judge 2 each submit an
            independent evaluation out of 50 (combined out of 100).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-secondary font-mono uppercase">Round</span>
            <span className="text-xs font-mono text-text-primary bg-surface-color border border-border-color rounded px-2 py-1">
              {roundId.slice(0, 8)}…
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-secondary hover:text-text-primary shrink-0 px-2 py-1 bg-surface-color/40 border border-border-color rounded">
            <Filter className="w-3 h-3" />
            <span>Filter: {filter}</span>
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "unassigned" | "partial" | "complete")}
            className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-2.5 py-1 font-mono outline-none focus:border-accent-primary"
          >
            <option value="all">All Teams</option>
            <option value="unassigned">Unassigned</option>
            <option value="partial">Partially Assigned (1/2)</option>
            <option value="complete">Fully Assigned (2/2)</option>
          </select>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-1.5 bg-surface-color-light border border-border-color hover:border-accent-secondary text-accent-secondary text-xs font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Loader2 className={loading ? "w-3 h-3 animate-spin" : "w-3 h-3"} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() =>
              openConfirm(
                "Delete All Judge Assignments?",
                `This will permanently remove all judge assignments for round ${roundId.slice(0, 8)}… . This action cannot be undone. Teams will return to unassigned status for this round. Continue?`,
                handleDeleteAllAssignments
              )
            }
            disabled={loading || deletingAll}
            className="px-4 py-1.5 bg-status-error/10 border border-status-error/40 hover:bg-status-error/20 text-status-error text-xs font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            <span>Delete All Assignments</span>
          </button>
        </div>
      </div>

      {/* Counts summary */}
      <div className="flex gap-4 text-xs font-mono">
        <span className={`px-2 py-1 rounded border ${counts.complete > 0 ? "bg-status-success/10 border-status-success/40 text-status-success" : "bg-surface-color/40 border-border-color/60 text-text-secondary"}`}>
          Complete: {counts.complete}
        </span>
        <span className={`px-2 py-1 rounded border ${counts.partial > 0 ? "bg-status-warning/10 border-status-warning/40 text-status-warning" : "bg-surface-color/40 border-border-color/60 text-text-secondary"}`}>
          Partial: {counts.partial}
        </span>
        <span className={`px-2 py-1 rounded border ${counts.unassigned > 0 ? "bg-surface-color/10 border-border-color/40 text-text-secondary" : "bg-surface-color/40 border-border-color/60 text-text-secondary"}`}>
          Unassigned: {counts.unassigned}
        </span>
      </div>

      {/* Assignment grid */}
      <div className="border border-border-color rounded-lg overflow-hidden bg-surface-color/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-color/60 border-b border-border-color">
              <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary w-1/3">Team</th>
              <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">Judge 1</th>
              <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">Judge 2</th>
              <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">Status</th>
              <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color/50">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-text-secondary text-xs">
                  No teams match the selected filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.team_id} className="hover:bg-surface-color/30 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="font-heading text-sm text-text-primary m-0 uppercase tracking-wide">
                      {row.team_name}
                    </div>
                    {row.team_code && (
                      <span className="font-mono text-[10px] text-accent-tertiary block mt-0.5">
                        {row.team_code}
                      </span>
                    )}
                    {row.track && (
                      <span className="font-mono text-[10px] text-text-secondary/60 block mt-0.5 uppercase">
                        [{row.track}]
                      </span>
                    )}
                  </td>

                  {/* Judge 1 slot */}
                  <td className="px-4 py-4">
                    {row.judge_1_id ? (
                      <div className="space-y-2">
                        {slotBadge(row.judge_1_id, row.judge_1_name)}
                        <div className="flex items-center gap-2">
                          <select
                            value={staged[row.team_id]?.["1"] || ""}
                            onChange={(e) =>
                              setStaged((prev) => ({
                                ...prev,
                                [row.team_id]: { ...prev[row.team_id], "1": e.target.value || undefined },
                              }))
                            }
                            className="bg-surface-color border border-border-color rounded text-[10px] text-text-primary px-2 py-1 font-mono outline-none focus:border-accent-primary w-full"
                          >
                            <option value="">Replace with…</option>
                            {availableJudgesForSlot(row.team_id, 1, row.judge_1_id).map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.full_name || j.email}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              staged[row.team_id]?.["1"]
                                ? handleReplace(row.team_id, 1, row.judge_1_id!, staged[row.team_id]["1"]!)
                                : null
                            }
                            disabled={saving.has(row.team_id) || !staged[row.team_id]?.["1"]}
                            className="px-2 py-1 bg-accent-secondary/10 border border-accent-secondary/40 text-accent-secondary text-[10px] font-bold uppercase tracking-wider rounded hover:bg-accent-secondary/20 disabled:opacity-50"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => handleRemove(row.team_id, 1, row.judge_1_id!)}
                            disabled={saving.has(row.team_id)}
                            className="px-2 py-1 bg-status-error/10 border border-status-error/40 text-status-error text-[10px] font-bold uppercase tracking-wider rounded hover:bg-status-error/20 disabled:opacity-50"
                          >
                            <Minus size={10} className="mr-1" /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-text-secondary text-xs font-mono">Empty</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={staged[row.team_id]?.["1"] || ""}
                            onChange={(e) =>
                              setStaged((prev) => ({
                                ...prev,
                                [row.team_id]: { ...prev[row.team_id], "1": e.target.value || undefined },
                              }))
                            }
                            className="bg-surface-color border border-border-color rounded text-[10px] text-text-primary px-2 py-1 font-mono outline-none focus:border-accent-primary w-full"
                          >
                            <option value="">Select judge…</option>
                            {availableJudgesForSlot(row.team_id, 1).map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.full_name || j.email}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              staged[row.team_id]?.["1"]
                                ? handleAssign(row.team_id, 1, staged[row.team_id]["1"]!)
                                : null
                            }
                            disabled={saving.has(row.team_id) || !staged[row.team_id]?.["1"]}
                            className="flex-1 py-1 bg-surface-color-light border border-border-color hover:border-accent-primary text-accent-primary text-[10px] font-bold uppercase tracking-wider rounded disabled:opacity-50"
                          >
                            <Plus size={10} className="mr-1" /> Assign
                          </button>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Judge 2 slot */}
                  <td className="px-4 py-4">
                    {row.judge_2_id ? (
                      <div className="space-y-2">
                        {slotBadge(row.judge_2_id, row.judge_2_name)}
                        <div className="flex items-center gap-2">
                          <select
                            value={staged[row.team_id]?.["2"] || ""}
                            onChange={(e) =>
                              setStaged((prev) => ({
                                ...prev,
                                [row.team_id]: { ...prev[row.team_id], "2": e.target.value || undefined },
                              }))
                            }
                            className="bg-surface-color border border-border-color rounded text-[10px] text-text-primary px-2 py-1 font-mono outline-none focus:border-accent-primary w-full"
                          >
                            <option value="">Replace with…</option>
                            {availableJudgesForSlot(row.team_id, 2, row.judge_2_id).map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.full_name || j.email}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              staged[row.team_id]?.["2"]
                                ? handleReplace(row.team_id, 2, row.judge_2_id!, staged[row.team_id]["2"]!)
                                : null
                            }
                            disabled={saving.has(row.team_id) || !staged[row.team_id]?.["2"]}
                            className="px-2 py-1 bg-accent-secondary/10 border border-accent-secondary/40 text-accent-secondary text-[10px] font-bold uppercase tracking-wider rounded hover:bg-accent-secondary/20 disabled:opacity-50"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => handleRemove(row.team_id, 2, row.judge_2_id!)}
                            disabled={saving.has(row.team_id)}
                            className="px-2 py-1 bg-status-error/10 border border-status-error/40 text-status-error text-[10px] font-bold uppercase tracking-wider rounded hover:bg-status-error/20 disabled:opacity-50"
                          >
                            <Minus size={10} className="mr-1" /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-text-secondary text-xs font-mono">Empty</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={staged[row.team_id]?.["2"] || ""}
                            onChange={(e) =>
                              setStaged((prev) => ({
                                ...prev,
                                [row.team_id]: { ...prev[row.team_id], "2": e.target.value || undefined },
                              }))
                            }
                            className="bg-surface-color border border-border-color rounded text-[10px] text-text-primary px-2 py-1 font-mono outline-none focus:border-accent-primary w-full"
                          >
                            <option value="">Select judge…</option>
                            {availableJudgesForSlot(row.team_id, 2).map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.full_name || j.email}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              staged[row.team_id]?.["2"]
                                ? handleAssign(row.team_id, 2, staged[row.team_id]["2"]!)
                                : null
                            }
                            disabled={saving.has(row.team_id) || !staged[row.team_id]?.["2"]}
                            className="flex-1 py-1 bg-surface-color-light border border-border-color hover:border-accent-primary text-accent-primary text-[10px] font-bold uppercase tracking-wider rounded disabled:opacity-50"
                          >
                            <Plus size={10} className="mr-1" /> Assign
                          </button>
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4">{statusChip(row.status)}</td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      {row.judge_1_evaluation_id && (
                        <span className={`flex items-center gap-1 px-1.5 rounded ${row.judge_1_evaluation_status === "submitted" ? "bg-status-success/10 text-status-success border border-status-success/40" : "bg-surface-color/40 text-text-secondary border border-border-color/60"}`}>
                          <CheckCircle2 size={10} className="text-status-success" />
                          J1 {row.judge_1_evaluation_status || "eval"}
                        </span>
                      )}
                      {row.judge_2_evaluation_id && (
                        <span className={`flex items-center gap-1 px-1.5 rounded ${row.judge_2_evaluation_status === "submitted" ? "bg-status-success/10 text-status-success border border-status-success/40" : "bg-surface-color/40 text-text-secondary border border-border-color/60"}`}>
                          <CheckCircle2 size={10} className="text-status-success" />
                          J2 {row.judge_2_evaluation_status || "eval"}
                        </span>
                      )}
                      {!row.judge_1_evaluation_id && !row.judge_2_evaluation_id && (
                        <span className="text-text-secondary/60">No evaluations</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="bg-surface-color border border-border-color rounded-lg p-6 w-full max-w-md shadow-2xl relative">
            <h3 className="font-heading text-base text-text-primary uppercase tracking-wider m-0 mb-3">
              {confirm.title}
            </h3>
            <p className="text-text-secondary text-xs mb-6 font-mono leading-relaxed">
              {confirm.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="px-3 py-1.5 bg-surface-color-light border border-border-color text-text-secondary text-xs font-bold uppercase rounded hover:bg-surface-color"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await confirm.onConfirm();
                  } catch {
                    // errors already notified by the action
                  } finally {
                    setConfirm(null);
                  }
                }}
                className="px-3 py-1.5 bg-accent-primary text-black font-bold uppercase text-xs rounded hover:bg-accent-primary/90"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatMini({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="p-3 rounded border border-border-color/60 bg-surface-color/50">
      <div className="flex items-center justify-between mb-1">
        <span className="font-tech text-[10px] uppercase tracking-wider text-text-secondary font-bold">
          {label}
        </span>
        <div className="p-1 bg-surface-color border border-border-color rounded">
          <Icon className={`${color} w-3 h-3`} />
        </div>
      </div>
      <p className={`font-heading text-lg md:text-xl ${color} m-0 font-bold`}>{value}</p>
    </div>
  );
}
