"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Eye,
  RefreshCw,
  X,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type {
  JudgeEvaluationMatrixRow,
  JudgeEvaluationMatrixKPIs,
  EvaluationCriterion,
} from "@/types/evaluation-matrix";

interface Props {
  initialRows: JudgeEvaluationMatrixRow[];
  initialKpis: JudgeEvaluationMatrixKPIs;
  criteria: EvaluationCriterion[];
  uniqueJudges: string[];
  roundTitle: string;
}

type SortField =
  | "final_score"
  | "team_code"
  | "team_name"
  | "judge1_marks"
  | "judge2_marks"
  | "status";
type SortDirection = "asc" | "desc";

export default function JudgeEvaluationMatrixClient({
  initialRows,
  initialKpis,
  criteria,
  uniqueJudges,
  roundTitle,
}: Props) {
  const router = useRouter();

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [judgeFilter, setJudgeFilter] = useState("all");

  // Sort State (Default: Final Score highest first)
  const [sortField, setSortField] = useState<SortField>("final_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Selected Team Modal for Detailed Criteria Breakdown
  const [selectedTeam, setSelectedTeam] = useState<JudgeEvaluationMatrixRow | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Default to descending for scores, ascending for names/codes
      setSortDirection(
        field === "final_score" || field === "judge1_marks" || field === "judge2_marks"
          ? "desc"
          : "asc"
      );
    }
  };

  // Identify top 3 completed scores for ranking badges
  const topScores = useMemo(() => {
    const scores = Array.from(
      new Set(
        initialRows
          .map((r) => r.final_score)
          .filter((s): s is number => s !== null && s > 0)
      )
    ).sort((a, b) => b - a);

    return {
      rank1: scores[0] ?? null,
      rank2: scores[1] ?? null,
      rank3: scores[2] ?? null,
    };
  }, [initialRows]);

  // Filter & Search Logic
  const filteredRows = useMemo(() => {
    return initialRows.filter((row) => {
      // 1. Search Filter (by Team ID and Team Name)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesCode = row.team_code.toLowerCase().includes(query);
        const matchesName = row.team_name.toLowerCase().includes(query);
        if (!matchesCode && !matchesName) return false;
      }

      // 2. Status Filter
      if (statusFilter !== "all") {
        if (statusFilter === "FULLY_EVALUATED" && row.status !== "FULLY EVALUATED") {
          return false;
        }
        if (
          statusFilter === "PENDING" &&
          row.status !== "PARTIALLY EVALUATED" &&
          row.status !== "IN PROGRESS"
        ) {
          return false;
        }
        if (
          statusFilter === "NOT_EVALUATED" &&
          row.status !== "NOT EVALUATED"
        ) {
          return false;
        }
        if (
          statusFilter === "DISCREPANCY" &&
          row.status !== "ASSIGNMENT DISCREPANCY" &&
          !row.has_discrepancy
        ) {
          return false;
        }
      }

      // 3. Judge Filter
      if (judgeFilter !== "all") {
        const matchesJudge1 = row.judge1_name === judgeFilter;
        const matchesJudge2 = row.judge2_name === judgeFilter;
        if (!matchesJudge1 && !matchesJudge2) return false;
      }

      return true;
    });
  }, [initialRows, searchQuery, statusFilter, judgeFilter]);

  // Sort Logic
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const modifier = sortDirection === "asc" ? 1 : -1;

      if (sortField === "final_score") {
        // Teams with completed final score first
        if (a.final_score !== null && b.final_score !== null) {
          return (a.final_score - b.final_score) * modifier;
        }
        if (a.final_score !== null) return -1;
        if (b.final_score !== null) return 1;

        // Next, teams with partial provisional marks
        const aPart = a.judge1_marks ?? a.judge2_marks;
        const bPart = b.judge1_marks ?? b.judge2_marks;
        if (aPart !== null && bPart !== null) {
          return (aPart - bPart) * modifier;
        }
        if (aPart !== null) return -1;
        if (bPart !== null) return 1;

        // Fallback to Team ID
        return a.team_code.localeCompare(b.team_code, undefined, {
          numeric: true,
        });
      }

      if (sortField === "team_code") {
        return (
          a.team_code.localeCompare(b.team_code, undefined, {
            numeric: true,
          }) * modifier
        );
      }

      if (sortField === "team_name") {
        return a.team_name.localeCompare(b.team_name) * modifier;
      }

      if (sortField === "judge1_marks") {
        const valA = a.judge1_marks ?? -1;
        const valB = b.judge1_marks ?? -1;
        return (valA - valB) * modifier;
      }

      if (sortField === "judge2_marks") {
        const valA = a.judge2_marks ?? -1;
        const valB = b.judge2_marks ?? -1;
        return (valA - valB) * modifier;
      }

      if (sortField === "status") {
        return a.status_badge_text.localeCompare(b.status_badge_text) * modifier;
      }

      return 0;
    });
  }, [filteredRows, sortField, sortDirection]);

  // CSV Export Functionality
  const handleExportCSV = () => {
    if (sortedRows.length === 0) return;

    const headers = [
      "Team ID",
      "Team Name",
      "Judge 1",
      "Marks /50",
      "Judge 2",
      "Marks /50",
      "Final Score /100",
      "Status",
    ];

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.map(escapeCsv).join(",")];

    for (const r of sortedRows) {
      const j1MarksVal =
        r.judge1_status === "submitted" && r.judge1_marks !== null
          ? r.judge1_marks
          : r.judge1_status === "draft"
          ? "Draft"
          : "—";

      const j2MarksVal =
        r.judge2_status === "submitted" && r.judge2_marks !== null
          ? r.judge2_marks
          : r.judge2_status === "draft"
          ? "Draft"
          : "—";

      const finalVal =
        r.final_score !== null ? `${r.final_score}/100` : r.final_score_display;

      const rowData = [
        r.team_code,
        r.team_name,
        r.judge1_name,
        j1MarksVal,
        r.judge2_name,
        j2MarksVal,
        finalVal,
        r.status_badge_text,
      ];

      csvLines.push(rowData.map(escapeCsv).join(","));
    }

    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `judge-evaluation-matrix-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-text-secondary/40 inline ml-1" />
      );
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 text-accent-secondary inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-accent-secondary inline ml-1" />
    );
  };

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Teams */}
        <div className="glass-panel p-4 border border-border-color rounded-xl bg-surface-color/40 relative overflow-hidden group hover:border-accent-secondary/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent-secondary/5 rounded-full blur-2xl group-hover:bg-accent-secondary/10 transition-all" />
          <p className="text-[11px] uppercase tracking-wider text-text-secondary font-bold mb-1">
            Total Teams
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-bold text-text-primary tracking-tight">
              {initialKpis.total_teams}
            </span>
            <span className="text-[10px] text-text-secondary font-mono">
              Participating
            </span>
          </div>
        </div>

        {/* Fully Evaluated */}
        <div className="glass-panel p-4 border border-border-color rounded-xl bg-surface-color/40 relative overflow-hidden group hover:border-status-success/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-status-success/5 rounded-full blur-2xl group-hover:bg-status-success/10 transition-all" />
          <p className="text-[11px] uppercase tracking-wider text-text-secondary font-bold mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-status-success" /> Fully Evaluated
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-bold text-status-success tracking-tight">
              {initialKpis.fully_evaluated}
            </span>
            <span className="text-[10px] text-text-secondary font-mono">
              / {initialKpis.total_teams} (
              {initialKpis.total_teams > 0
                ? Math.round(
                    (initialKpis.fully_evaluated / initialKpis.total_teams) * 100
                  )
                : 0}
              %)
            </span>
          </div>
        </div>

        {/* Pending Evaluations */}
        <div className="glass-panel p-4 border border-border-color rounded-xl bg-surface-color/40 relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
          <p className="text-[11px] uppercase tracking-wider text-text-secondary font-bold mb-1 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-amber-400" /> Pending Evaluations
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-bold text-amber-400 tracking-tight">
              {initialKpis.pending_evaluations}
            </span>
            <span className="text-[10px] text-text-secondary font-mono">
              Partial / In Progress
            </span>
          </div>
        </div>

        {/* Average Final Score */}
        <div className="glass-panel p-4 border border-border-color rounded-xl bg-surface-color/40 relative overflow-hidden group hover:border-accent-primary/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent-primary/5 rounded-full blur-2xl group-hover:bg-accent-primary/10 transition-all" />
          <p className="text-[11px] uppercase tracking-wider text-text-secondary font-bold mb-1 flex items-center gap-1.5">
            <Trophy className="w-3 h-3 text-accent-primary" /> Average Final Score
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-bold text-text-primary tracking-tight">
              {initialKpis.average_final_score !== null
                ? `${initialKpis.average_final_score}`
                : "—"}
            </span>
            <span className="text-[10px] text-text-secondary font-mono">
              / 100 max
            </span>
          </div>
        </div>
      </div>

      {/* Discrepancy Alert Banner (if any teams have != 2 judges assigned) */}
      {initialKpis.discrepancies > 0 && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/40 rounded-xl flex items-center justify-between gap-3 text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <div className="text-xs">
              <span className="font-bold uppercase tracking-wider">
                Assignment Discrepancy Warning:
              </span>{" "}
              {initialKpis.discrepancies} team(s) have fewer or more than two
              assigned judges. Please check assignments in the Judge Allocations
              workspace.
            </div>
          </div>
          <button
            onClick={() => setStatusFilter("DISCREPANCY")}
            className="text-[11px] font-bold uppercase tracking-wider underline hover:text-white shrink-0"
          >
            View Affected Teams
          </button>
        </div>
      )}

      {/* Controls & Toolbar Panel */}
      <div className="glass-panel p-4 border border-border-color rounded-xl bg-surface-color/60 backdrop-blur-md space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary/60" />
            <input
              type="text"
              placeholder="Search by Team ID or Team Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-color/80 border border-border-color text-text-primary text-xs font-sans rounded-lg pl-9 pr-9 py-2 focus:border-accent-secondary focus:ring-1 focus:ring-accent-secondary outline-none transition-all placeholder:text-text-secondary/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary shrink-0">
              Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-color/90 border border-border-color text-text-primary text-xs font-tech rounded-lg px-3 py-2 outline-none focus:border-accent-secondary cursor-pointer uppercase font-semibold"
            >
              <option value="all">ALL STATUSES ({initialRows.length})</option>
              <option value="FULLY_EVALUATED">
                FULLY EVALUATED ({initialKpis.fully_evaluated})
              </option>
              <option value="PENDING">
                PENDING / PARTIAL ({initialKpis.pending_evaluations})
              </option>
              <option value="NOT_EVALUATED">
                NOT EVALUATED ({initialKpis.not_evaluated})
              </option>
              {initialKpis.discrepancies > 0 && (
                <option value="DISCREPANCY">
                  DISCREPANCY ({initialKpis.discrepancies})
                </option>
              )}
            </select>
          </div>

          {/* Judge Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary shrink-0">
              Judge:
            </span>
            <select
              value={judgeFilter}
              onChange={(e) => setJudgeFilter(e.target.value)}
              className="bg-surface-color/90 border border-border-color text-text-primary text-xs font-tech rounded-lg px-3 py-2 outline-none focus:border-accent-secondary cursor-pointer uppercase font-semibold max-w-[200px]"
            >
              <option value="all">ALL JUDGES ({uniqueJudges.length})</option>
              {uniqueJudges.map((judgeName) => (
                <option key={judgeName} value={judgeName}>
                  {judgeName}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh evaluations"
              className="p-2 bg-surface-color border border-border-color rounded-lg text-text-secondary hover:text-text-primary hover:border-accent-secondary transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin text-accent-secondary" : ""}`}
              />
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2 bg-accent-primary/10 border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Active Filter Indicators & Record Count */}
        <div className="flex items-center justify-between text-[11px] text-text-secondary pt-1 border-t border-border-color/30 font-mono">
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <strong className="text-text-primary font-mono">
                {sortedRows.length}
              </strong>{" "}
              of {initialRows.length} teams
            </span>
            {(searchQuery || statusFilter !== "all" || judgeFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setJudgeFilter("all");
                }}
                className="text-accent-secondary underline hover:text-white"
              >
                Clear all filters
              </button>
            )}
          </div>
          <div className="text-[10px] text-text-secondary/70">
            Sorted by: <span className="text-text-primary uppercase">{sortField} ({sortDirection})</span>
          </div>
        </div>
      </div>

      {/* Main Consolidated Matrix Table */}
      <div className="glass-panel border border-border-color rounded-xl overflow-hidden shadow-2xl bg-surface-color/50">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="border-b border-border-color bg-surface-color/90 text-text-secondary font-tech text-xs uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                {/* Team ID */}
                <th
                  onClick={() => handleSort("team_code")}
                  className="p-3.5 pl-5 w-28 cursor-pointer hover:text-text-primary select-none transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Team ID</span>
                    {renderSortIndicator("team_code")}
                  </div>
                </th>

                {/* Team Name */}
                <th
                  onClick={() => handleSort("team_name")}
                  className="p-3.5 min-w-[180px] cursor-pointer hover:text-text-primary select-none transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Team Name</span>
                    {renderSortIndicator("team_name")}
                  </div>
                </th>

                {/* Judge 1 Name */}
                <th className="p-3.5 w-44">
                  <span>Judge 1</span>
                </th>

                {/* Judge 1 Marks /50 */}
                <th
                  onClick={() => handleSort("judge1_marks")}
                  className="p-3.5 w-28 text-right cursor-pointer hover:text-text-primary select-none transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Marks /50</span>
                    {renderSortIndicator("judge1_marks")}
                  </div>
                </th>

                {/* Judge 2 Name */}
                <th className="p-3.5 w-44">
                  <span>Judge 2</span>
                </th>

                {/* Judge 2 Marks /50 */}
                <th
                  onClick={() => handleSort("judge2_marks")}
                  className="p-3.5 w-28 text-right cursor-pointer hover:text-text-primary select-none transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Marks /50</span>
                    {renderSortIndicator("judge2_marks")}
                  </div>
                </th>

                {/* Final Score /100 */}
                <th
                  onClick={() => handleSort("final_score")}
                  className="p-3.5 w-36 text-center cursor-pointer hover:text-text-primary select-none transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Final Score /100</span>
                    {renderSortIndicator("final_score")}
                  </div>
                </th>

                {/* Status */}
                <th
                  onClick={() => handleSort("status")}
                  className="p-3.5 pr-5 w-40 text-center cursor-pointer hover:text-text-primary select-none transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    {renderSortIndicator("status")}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border-color/30 font-sans text-xs">
              {sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-12 text-center text-text-secondary italic"
                  >
                    <HelpCircle className="w-8 h-8 text-text-secondary/40 mx-auto mb-2" />
                    No teams match the current search or filters.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const isFullyEvaluated = row.status === "FULLY EVALUATED";
                  const isRank1 =
                    isFullyEvaluated &&
                    topScores.rank1 !== null &&
                    row.final_score === topScores.rank1;
                  const isRank2 =
                    isFullyEvaluated &&
                    topScores.rank2 !== null &&
                    row.final_score === topScores.rank2;
                  const isRank3 =
                    isFullyEvaluated &&
                    topScores.rank3 !== null &&
                    row.final_score === topScores.rank3;

                  return (
                    <tr
                      key={row.team_id}
                      onClick={() => setSelectedTeam(row)}
                      className={`hover:bg-surface-color/40 transition-colors group cursor-pointer ${
                        isRank1
                          ? "bg-amber-500/[0.04] border-l-2 border-l-amber-400"
                          : isRank2
                          ? "bg-zinc-400/[0.03] border-l-2 border-l-zinc-400"
                          : isRank3
                          ? "bg-amber-700/[0.03] border-l-2 border-l-amber-700"
                          : ""
                      }`}
                    >
                      {/* Team ID */}
                      <td className="p-3.5 pl-5 font-mono text-xs font-bold text-accent-secondary">
                        <div className="flex items-center gap-1.5">
                          <span>{row.team_code}</span>
                        </div>
                      </td>

                      {/* Team Name */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-medium text-text-primary text-xs tracking-wide">
                            {row.team_name}
                          </span>
                          {/* Highest Scoring Rank Badges */}
                          {isRank1 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              <Trophy className="w-2.5 h-2.5" /> #1 TOP
                            </span>
                          )}
                          {isRank2 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-zinc-400/20 text-zinc-300 border border-zinc-400/40">
                              #2
                            </span>
                          )}
                          {isRank3 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-700/20 text-amber-300 border border-amber-700/40">
                              #3
                            </span>
                          )}
                        </div>
                        {row.track && (
                          <span className="font-mono text-[10px] text-text-secondary/60 block mt-0.5 uppercase">
                            [{row.track}]
                          </span>
                        )}
                      </td>

                      {/* Judge 1 Name */}
                      <td className="p-3.5">
                        <span
                          className={`font-medium ${
                            row.judge1_name === "Unassigned"
                              ? "text-rose-400/80 italic font-mono text-[11px]"
                              : "text-text-primary font-mono text-xs"
                          }`}
                        >
                          {row.judge1_name}
                        </span>
                        {row.judge1_email && (
                          <span className="block font-sans text-[10px] text-text-secondary/50 truncate max-w-[150px]">
                            {row.judge1_email}
                          </span>
                        )}
                      </td>

                      {/* Judge 1 Marks /50 */}
                      <td className="p-3.5 text-right font-mono text-xs">
                        {row.judge1_status === "submitted" &&
                        row.judge1_marks !== null ? (
                          <span className="font-bold text-accent-secondary">
                            {row.judge1_marks}
                            <span className="text-[10px] text-text-secondary/60 ml-0.5">
                              /50
                            </span>
                          </span>
                        ) : row.judge1_status === "draft" ? (
                          <span className="px-2 py-0.5 bg-[#FF007F]/10 border border-[#FF007F]/30 text-[#FF007F] text-[10px] font-mono font-bold uppercase rounded">
                            Draft
                          </span>
                        ) : (
                          <span className="text-text-secondary/40 font-mono">—</span>
                        )}
                      </td>

                      {/* Judge 2 Name */}
                      <td className="p-3.5">
                        <span
                          className={`font-medium ${
                            row.judge2_name === "Unassigned"
                              ? "text-rose-400/80 italic font-mono text-[11px]"
                              : "text-text-primary font-mono text-xs"
                          }`}
                        >
                          {row.judge2_name}
                        </span>
                        {row.judge2_email && (
                          <span className="block font-sans text-[10px] text-text-secondary/50 truncate max-w-[150px]">
                            {row.judge2_email}
                          </span>
                        )}
                      </td>

                      {/* Judge 2 Marks /50 */}
                      <td className="p-3.5 text-right font-mono text-xs">
                        {row.judge2_status === "submitted" &&
                        row.judge2_marks !== null ? (
                          <span className="font-bold text-accent-secondary">
                            {row.judge2_marks}
                            <span className="text-[10px] text-text-secondary/60 ml-0.5">
                              /50
                            </span>
                          </span>
                        ) : row.judge2_status === "draft" ? (
                          <span className="px-2 py-0.5 bg-[#FF007F]/10 border border-[#FF007F]/30 text-[#FF007F] text-[10px] font-mono font-bold uppercase rounded">
                            Draft
                          </span>
                        ) : (
                          <span className="text-text-secondary/40 font-mono">—</span>
                        )}
                      </td>

                      {/* Final Score /100 */}
                      <td className="p-3.5 text-center font-mono">
                        {row.final_score !== null ? (
                          <div className="inline-flex items-baseline gap-0.5">
                            <span className="font-heading text-sm font-bold text-status-success">
                              {row.final_score}
                            </span>
                            <span className="text-[10px] text-text-secondary/70">
                              /100
                            </span>
                          </div>
                        ) : row.final_score_display === "PENDING" ? (
                          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/40 text-amber-300 text-[10px] font-bold tracking-wider rounded">
                            PENDING
                          </span>
                        ) : (
                          <span className="text-text-secondary/50 text-[10px] uppercase font-bold tracking-wider">
                            NOT EVALUATED
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 pr-5 text-center">
                        {row.status === "FULLY EVALUATED" ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-tech font-bold uppercase tracking-wider bg-status-success/15 border border-status-success/40 text-status-success">
                            Completed
                          </span>
                        ) : row.status === "PARTIALLY EVALUATED" ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-tech font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-300">
                            Pending (1/2)
                          </span>
                        ) : row.status === "IN PROGRESS" ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-tech font-bold uppercase tracking-wider bg-[#FF007F]/15 border border-[#FF007F]/40 text-[#FF007F]">
                            Draft
                          </span>
                        ) : row.status === "ASSIGNMENT DISCREPANCY" ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-tech font-bold uppercase tracking-wider bg-rose-500/20 border border-rose-500/50 text-rose-300">
                            Discrepancy
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-tech font-bold uppercase tracking-wider bg-surface-color border border-border-color text-text-secondary/70">
                            Not Evaluated
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluation Criteria Breakdown Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="glass-panel border border-border-color rounded-2xl w-full max-w-3xl bg-[#09090F] shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-5 border-b border-border-color flex items-center justify-between bg-surface-color/50">
              <div>
                <p className="font-tech text-xs uppercase tracking-[2px] text-accent-secondary font-bold mb-1">
                  Evaluation Scorecard Breakdown
                </p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-accent-secondary">
                    {selectedTeam.team_code}
                  </span>
                  <span className="text-text-secondary">|</span>
                  <h3 className="font-heading text-lg font-bold text-text-primary tracking-wide uppercase">
                    {selectedTeam.team_name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeam(null)}
                className="p-1.5 rounded-lg border border-border-color text-text-secondary hover:text-text-primary hover:border-accent-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar font-sans">
              {/* Score Summary Banner */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-surface-color/60 border border-border-color font-tech">
                <div className="text-center">
                  <span className="text-[10px] uppercase text-text-secondary block font-bold">
                    Judge 1 ({selectedTeam.judge1_name})
                  </span>
                  <span className="font-mono text-xl font-bold text-accent-secondary">
                    {selectedTeam.judge1_marks !== null
                      ? `${selectedTeam.judge1_marks} / 50`
                      : selectedTeam.judge1_status === "draft"
                      ? "Draft"
                      : "Pending"}
                  </span>
                </div>
                <div className="text-center border-x border-border-color">
                  <span className="text-[10px] uppercase text-text-secondary block font-bold">
                    Judge 2 ({selectedTeam.judge2_name})
                  </span>
                  <span className="font-mono text-xl font-bold text-accent-secondary">
                    {selectedTeam.judge2_marks !== null
                      ? `${selectedTeam.judge2_marks} / 50`
                      : selectedTeam.judge2_status === "draft"
                      ? "Draft"
                      : "Pending"}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] uppercase text-text-secondary block font-bold">
                    Final Combined Score
                  </span>
                  <span className="font-heading text-xl font-bold text-status-success">
                    {selectedTeam.final_score !== null
                      ? `${selectedTeam.final_score} / 100`
                      : selectedTeam.final_score_display}
                  </span>
                </div>
              </div>

              {/* 7 Round Criteria Breakdown Table */}
              <div>
                <h4 className="font-tech text-xs uppercase tracking-wider text-text-secondary font-bold mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-accent-secondary" />
                  Seven Criteria Marks Breakdown (Max 50 Marks per Judge)
                </h4>
                <div className="border border-border-color rounded-xl overflow-hidden bg-surface-color/30">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border-color bg-surface-color/60 font-tech text-text-secondary uppercase">
                        <th className="p-3 w-8 text-center font-mono">#</th>
                        <th className="p-3">Evaluation Criterion</th>
                        <th className="p-3 w-20 text-center">Max Marks</th>
                        <th className="p-3 w-28 text-right">
                          Judge 1 Marks
                        </th>
                        <th className="p-3 w-28 text-right">
                          Judge 2 Marks
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color/30 font-sans">
                      {criteria.map((c, idx) => {
                        const j1Crit = selectedTeam.judge1_breakdown.find(
                          (b) => b.criterion_id === c.id
                        );
                        const j2Crit = selectedTeam.judge2_breakdown.find(
                          (b) => b.criterion_id === c.id
                        );

                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-surface-color/20 transition-colors"
                          >
                            <td className="p-3 text-center font-mono text-text-secondary/60">
                              {idx + 1}
                            </td>
                            <td className="p-3">
                              <span className="font-medium text-text-primary block">
                                {c.title}
                              </span>
                              {c.description && (
                                <span className="text-[10px] text-text-secondary/70 block mt-0.5">
                                  {c.description}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono text-text-secondary font-bold">
                              /{c.max_marks}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">
                              {selectedTeam.judge1_status === "submitted" &&
                              j1Crit ? (
                                <span className="text-accent-secondary">
                                  {j1Crit.score}
                                </span>
                              ) : (
                                <span className="text-text-secondary/40 font-normal">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">
                              {selectedTeam.judge2_status === "submitted" &&
                              j2Crit ? (
                                <span className="text-accent-secondary">
                                  {j2Crit.score}
                                </span>
                              ) : (
                                <span className="text-text-secondary/40 font-normal">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Subtotal row */}
                      <tr className="bg-surface-color/60 font-tech font-bold text-xs uppercase border-t border-border-color">
                        <td colSpan={2} className="p-3 text-right text-text-secondary">
                          Total Submitted Marks:
                        </td>
                        <td className="p-3 text-center font-mono text-text-primary">
                          /50
                        </td>
                        <td className="p-3 text-right font-mono text-accent-secondary text-sm">
                          {selectedTeam.judge1_marks !== null
                            ? `${selectedTeam.judge1_marks} / 50`
                            : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-accent-secondary text-sm">
                          {selectedTeam.judge2_marks !== null
                            ? `${selectedTeam.judge2_marks} / 50`
                            : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Feedback Comments */}
              {(selectedTeam.judge1_feedback || selectedTeam.judge2_feedback) && (
                <div className="space-y-3">
                  <h4 className="font-tech text-xs uppercase tracking-wider text-text-secondary font-bold">
                    Judge Qualitative Feedback
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {selectedTeam.judge1_feedback && (
                      <div className="p-3 rounded-xl bg-surface-color/40 border border-border-color">
                        <span className="text-[10px] font-tech uppercase text-text-secondary font-bold block mb-1">
                          Judge 1: {selectedTeam.judge1_name}
                        </span>
                        <p className="text-text-primary italic">
                          &ldquo;{selectedTeam.judge1_feedback}&rdquo;
                        </p>
                      </div>
                    )}
                    {selectedTeam.judge2_feedback && (
                      <div className="p-3 rounded-xl bg-surface-color/40 border border-border-color">
                        <span className="text-[10px] font-tech uppercase text-text-secondary font-bold block mb-1">
                          Judge 2: {selectedTeam.judge2_name}
                        </span>
                        <p className="text-text-primary italic">
                          &ldquo;{selectedTeam.judge2_feedback}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border-color bg-surface-color/50 flex justify-end">
              <button
                onClick={() => setSelectedTeam(null)}
                className="px-4 py-2 bg-surface-color border border-border-color rounded-lg text-xs font-tech font-bold uppercase tracking-wider text-text-primary hover:border-accent-secondary transition-colors"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

