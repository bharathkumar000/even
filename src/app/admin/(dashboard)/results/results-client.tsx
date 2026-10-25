"use client";

import { useState } from "react";
import { RefreshCw, Globe, Lock, ShieldCheck, CheckCircle2 } from "lucide-react";
import { triggerResultsEngine } from "@/app/actions/admin-results";

export interface ResultItem {
  id: string;
  team_id?: string;
  rank?: number | null;
  total_score?: number | null;
  evaluations_count?: number | null;
  average_score?: number | null;
  award_title?: string | null;
  is_published?: boolean;
}

export default function ResultsClientView({
  eventId,
  initialResults,
  initialIsPublished,
  initialIsLocked,
}: {
  eventId: string;
  initialResults: ResultItem[];
  initialIsPublished: boolean;
  initialIsLocked: boolean;
}) {
  const [results] = useState(initialResults);
  const [isPublished, setIsPublished] = useState(initialIsPublished);
  const [isLocked, setIsLocked] = useState(initialIsLocked);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [olympicMode, setOlympicMode] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState(false);

  // Compute statistical mean and standard deviation for Z-score normalization
  const scoresArray = results.map((r) => r.average_score ?? 0).filter((s) => s > 0);
  const meanScore = scoresArray.length > 0 ? scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length : 0;
  const variance =
    scoresArray.length > 1
      ? scoresArray.reduce((acc, s) => acc + Math.pow(s - meanScore, 2), 0) / (scoresArray.length - 1)
      : 1;
  const stdDev = Math.sqrt(variance) || 1;

  const handleExportCSV = () => {
    if (results.length === 0) {
      alert("No standings to export.");
      return;
    }

    const headers = [
      "Rank",
      "Team ID",
      "Evaluations Count",
      "Raw Average Score",
      "Total Score",
      "Calibrated Z-Score",
      "Normalized Score (Scale 100)",
      "Status",
    ];
    const rows = results.map((r, idx) => {
      const avg = typeof r.average_score === "number" ? r.average_score : 0;
      const zScore = (avg - meanScore) / stdDev;
      // Map z-score (-2 to +2) onto 50-100 scale for intuitive reading
      const normalizedScore = Math.max(0, Math.min(100, Math.round((50 + zScore * 15) * 10) / 10));

      return [
        r.rank || idx + 1,
        `"${r.team_id || "Team"}"`,
        r.evaluations_count || 0,
        avg.toFixed(2),
        r.total_score ?? 0,
        zScore.toFixed(2),
        normalizedScore.toFixed(1),
        isLocked ? "LOCKED" : isPublished ? "PUBLISHED" : "DRAFT",
      ];
    });

    const metadataRows = [
      `# IVC-EVENTRA Leaderboard Deliberation Report`,
      `# Generated At: ${new Date().toISOString()}`,
      `# Scoring Mode: ${olympicMode ? "Olympic (Trimmed Outliers)" : "Standard Aggregate"}`,
      `# Sample Mean: ${meanScore.toFixed(2)} | StdDev: ${stdDev.toFixed(2)}`,
      "",
    ];

    const csvContent = [...metadataRows, headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `IVC_Deliberation_Standings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAction = async (action: "recalculate" | "publish" | "lock") => {
    let confirmPrompt = "";
    if (action === "recalculate") {
      confirmPrompt = olympicMode
        ? "Recalculate using Olympic Scoring (dropping highest & lowest outliers for teams with 3+ reviews)?"
        : "Recalculate total scores for all teams from submitted evaluations?";
    } else if (action === "publish") {
      confirmPrompt = "Publish official results to participant dashboards and leaderboards?";
    } else if (action === "lock") {
      confirmPrompt = "Lock results permanently against score changes?";
    }

    if (!confirm(confirmPrompt)) return;

    setLoadingAction(action);
    setFeedback(null);
    try {
      await triggerResultsEngine({
        event_id: eventId,
        action,
        olympic: action === "recalculate" ? olympicMode : undefined,
      });

      if (action === "publish") {
        setIsPublished(true);
        setFeedback("Official results published successfully.");
      } else if (action === "lock") {
        setIsLocked(true);
        setFeedback("Official results locked successfully.");
      } else {
        setFeedback(
          olympicMode
            ? "Results recalculated with Olympic Scoring (outliers trimmed)."
            : "Results recalculated across active evaluations."
        );
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to trigger results action");
    } finally {
      setLoadingAction(null);
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

      {/* Control Panel Header */}
      <div className="glass-panel p-6 border border-border-color flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="font-tech text-xs uppercase tracking-wider text-text-secondary font-bold">
            State Status
          </span>
          <div className="flex items-center gap-3 mt-1">
            {isLocked ? (
              <span className="px-3 py-1 bg-status-error/15 border border-status-error text-status-error font-tech text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Lock size={14} /> LOCKED
              </span>
            ) : isPublished ? (
              <span className="px-3 py-1 bg-status-success/15 border border-status-success text-status-success font-tech text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Globe size={14} /> PUBLISHED
              </span>
            ) : (
              <span className="px-3 py-1 bg-accent-primary/15 border border-accent-primary text-accent-primary font-tech text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} /> DRAFT MODE
              </span>
            )}

            <label className="flex items-center gap-2 ml-2 cursor-pointer font-tech text-xs text-text-secondary hover:text-text-primary">
              <input
                type="checkbox"
                checked={olympicMode}
                onChange={(e) => setOlympicMode(e.target.checked)}
                className="accent-accent-secondary"
              />
              <span>Olympic (Trim Outliers)</span>
            </label>

            <label className="flex items-center gap-2 ml-2 cursor-pointer font-tech text-xs text-accent-primary hover:text-accent-primary/80">
              <input
                type="checkbox"
                checked={calibrationMode}
                onChange={(e) => setCalibrationMode(e.target.checked)}
                className="accent-accent-primary"
              />
              <span className="font-bold">Z-Score Calibration</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleAction("recalculate")}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-color-light border border-border-color hover:border-accent-secondary text-text-primary font-tech font-bold uppercase text-xs transition-colors"
          >
            <RefreshCw size={15} className={loadingAction === "recalculate" ? "animate-spin" : ""} />
            {loadingAction === "recalculate" ? "Calculating..." : "Recalculate Results"}
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-color border border-border-color hover:border-accent-primary text-text-primary font-tech font-bold uppercase text-xs transition-colors"
          >
            Export Comprehensive CSV
          </button>

          <button
            onClick={() => handleAction("publish")}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-secondary hover:bg-accent-secondary/80 text-white font-tech font-bold uppercase text-xs transition-colors"
          >
            <Globe size={15} />
            {loadingAction === "publish" ? "Publishing..." : "Publish Results"}
          </button>

          <button
            onClick={() => handleAction("lock")}
            disabled={!!loadingAction || isLocked}
            className="flex items-center gap-2 px-4 py-2.5 bg-status-error/80 hover:bg-status-error text-white font-tech font-bold uppercase text-xs transition-colors disabled:opacity-50"
          >
            <Lock size={15} />
            {loadingAction === "lock" ? "Locking..." : isLocked ? "Locked" : "Lock Results"}
          </button>
        </div>
      </div>

      {/* Standings Table */}
      <div className="glass-panel overflow-x-auto">
        <div className="p-4 border-b border-border-color flex items-center justify-between">
          <h2 className="font-heading text-lg text-text-primary uppercase m-0">
            Current Standings & Totals
          </h2>
          {calibrationMode && (
            <span className="font-tech text-[11px] text-accent-primary font-bold">
              Calibrated via Z-Score Normalization (μ={meanScore.toFixed(1)}, σ={stdDev.toFixed(1)})
            </span>
          )}
        </div>
        <table className="w-full text-left border-collapse font-tech text-xs">
          <thead>
            <tr className="border-b border-border-color bg-surface-color-light/40 text-text-secondary uppercase tracking-wider">
              <th className="p-3">Rank</th>
              <th className="p-3">Team ID / Name</th>
              <th className="p-3">Evaluations</th>
              <th className="p-3">Average Score</th>
              {calibrationMode && <th className="p-3 text-accent-primary">Calibrated (100pt)</th>}
              <th className="p-3">Total Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color/30">
            {results.length === 0 ? (
              <tr>
                <td colSpan={calibrationMode ? 6 : 5} className="p-6 text-center text-text-secondary italic">
                  No calculated standings available yet. Run &quot;Recalculate Results&quot; to generate from judge scores.
                </td>
              </tr>
            ) : (
              results.map((r, idx) => {
                const avg = typeof r.average_score === "number" ? r.average_score : 0;
                const zScore = (avg - meanScore) / stdDev;
                const normScore = Math.max(0, Math.min(100, Math.round((50 + zScore * 15) * 10) / 10));

                return (
                  <tr key={r.id || idx} className="hover:bg-surface-color-light/20 transition-colors">
                    <td className="p-3 font-heading text-accent-primary font-bold">
                      #{idx + 1}
                    </td>
                    <td className="p-3 text-text-primary font-medium">
                      {r.team_id || "Team Alpha"}
                    </td>
                    <td className="p-3 text-text-secondary">
                      {r.evaluations_count || 1} submitted
                    </td>
                    <td className="p-3 text-text-secondary">
                      {avg.toFixed(1)}
                    </td>
                    {calibrationMode && (
                      <td className="p-3 font-mono font-bold text-accent-primary">
                        {normScore.toFixed(1)} <span className="text-[10px] text-text-secondary font-normal">({zScore >= 0 ? `+${zScore.toFixed(2)}` : zScore.toFixed(2)}σ)</span>
                      </td>
                    )}
                    <td className="p-3 font-bold text-accent-secondary text-sm">
                      {r.total_score ?? 0} PTS
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
