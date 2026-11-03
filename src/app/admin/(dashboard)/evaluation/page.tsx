import Link from "next/link";
import { getJudgeEvaluationMatrix } from "@/app/actions/admin-evaluation-matrix";
import JudgeEvaluationMatrixClient from "./evaluation-matrix-client";
import { Layers, FileCheck2, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminJudgeEvaluationMatrixPage() {
  const result = await getJudgeEvaluationMatrix();

  const rows = result.rows || [];
  const kpis = result.kpis || {
    total_teams: 0,
    fully_evaluated: 0,
    pending_evaluations: 0,
    not_evaluated: 0,
    discrepancies: 0,
    average_final_score: null,
    highest_final_score: null,
  };
  const criteria = result.criteria || [];
  const uniqueJudges = result.uniqueJudges || [];
  const roundTitle = result.round?.title || "FINAL JUDGING";

  return (
    <div className="space-y-8 animate-fade-in font-tech max-w-7xl mx-auto pb-12">
      {/* Top Header & Navigation Banner */}
      <div className="border-b border-border-color pb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
              Administration // Monitoring & Governance
            </p>
            <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
              Judge Evaluation Matrix
            </h1>
            <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
              Consolidated evaluation matrix displaying all 60 participating teams and their two assigned judges for the {roundTitle} round.
            </p>
          </div>

          {/* Quick Sub-navigation / Mode Switcher */}
          <div className="flex items-center gap-2 bg-surface-color/60 border border-border-color rounded-xl p-1.5 self-start">
            <Link
              href="/admin/evaluation"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent-secondary/15 border border-accent-secondary/40 text-accent-secondary shadow-sm"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Matrix View</span>
            </Link>
            <Link
              href="/admin/evaluations"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-surface-color transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Status Overrides</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Client Matrix */}
      <JudgeEvaluationMatrixClient
        initialRows={rows}
        initialKpis={kpis}
        criteria={criteria}
        uniqueJudges={uniqueJudges}
        roundTitle={roundTitle}
      />
    </div>
  );
}

