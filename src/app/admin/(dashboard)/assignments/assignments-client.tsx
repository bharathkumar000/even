"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  getJudgeAssignmentStats,
  getJudgesForRound,
  type JudgeAssignmentStats,
} from "@/app/actions/admin-judge-assignments";
import JudgeAllocationWorkspace from "./JudgeAllocationWorkspace";

interface AssignmentsClientViewProps {
  defaultRoundId: string;
  rounds: { id: string; title: string }[];
}

export default function AssignmentsClientView({
  defaultRoundId,
  rounds,
}: AssignmentsClientViewProps) {
  const [roundId, setRoundId] = useState(defaultRoundId);
  const [judges, setJudges] = useState<Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    assigned_team_count: number;
  }>>([]);
  const [stats, setStats] = useState<JudgeAssignmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load whenever the round changes (including initial mount).
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (!roundId) {
        setJudges([]);
        setStats(null);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      void Promise.all([
        getJudgesForRound(roundId),
        getJudgeAssignmentStats(roundId),
      ]).then(([judgesData, statsData]) => {
        if (!cancelled) {
          if (judgesData.error) {
            setError(judgesData.error);
          } else {
            setJudges(judgesData.judges);
          }
          setStats(statsData);
          setLoading(false);
        }
      }).catch((err) => {
        console.error("Failed to load judge assignments:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data.");
          setLoading(false);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-mono uppercase tracking-wider text-text-secondary shrink-0">
          Evaluation Round
        </label>
        <select
          value={roundId}
          onChange={(e) => setRoundId(e.target.value)}
          disabled={loading}
          className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 font-mono outline-none focus:border-accent-primary min-w-[260px]"
        >
          <option value="">-- Select a round --</option>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
        {loading && (
          <span className="text-[10px] text-text-secondary/60 font-mono animate-pulse">
            Loading…
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 border border-status-error/40 bg-status-error/10 rounded text-xs text-status-error flex items-start gap-2">
          <Loader2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {roundId ? (
        <JudgeAllocationWorkspace
          roundId={roundId}
          initialJudges={judges}
          initialStats={stats}
        />
      ) : (
        <div className="p-16 text-center text-text-secondary font-tech">
          Please select an evaluation round to view and manage judge assignments.
        </div>
      )}
    </div>
  );
}
