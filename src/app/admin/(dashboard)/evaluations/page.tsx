import Link from "next/link";
import { getAllTeamsWithEvaluations } from "@/app/actions/admin-evaluations";
import type { TeamEvaluationRecord } from "@/app/actions/admin-evaluations";
import EvaluationsClientView, {
  RoundItem,
} from "./evaluations-client";
import { FileCheck2, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminEvaluationsPage() {
  let teams: TeamEvaluationRecord[] = [];
  let rounds: RoundItem[] = [];

  try {
    const fetchData = async () => {
      const { teams: teamsData, rounds: roundsData } =
        await getAllTeamsWithEvaluations();
      return {
        teams: teamsData || [],
        rounds: roundsData || [],
      };
    };

    const timeoutPromise = new Promise<{ teams: TeamEvaluationRecord[]; rounds: RoundItem[] }>(
      (resolve) => setTimeout(() => resolve({ teams: [], rounds: [] }), 2500)
    );

    const data = await Promise.race([fetchData(), timeoutPromise]);
    teams = data.teams;
    rounds = data.rounds;
  } catch (err) {
    console.error("Failed to load evaluation data:", err);
  }

  return (
    <div className="space-y-8 animate-fade-in font-tech max-w-7xl mx-auto pb-12">
      <div className="border-b border-border-color pb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
              Administration // Monitoring & Governance
            </p>
            <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
              Evaluation Overrides & Governance
            </h1>
            <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
              Inspect submitted evaluations, audit evaluation states, and perform audited status overrides.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-surface-color/60 border border-border-color rounded-xl p-1.5 self-start">
            <Link
              href="/admin/evaluation"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-surface-color transition-colors"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Matrix View</span>
            </Link>
            <Link
              href="/admin/evaluations"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent-secondary/15 border border-accent-secondary/40 text-accent-secondary shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Status Overrides</span>
            </Link>
          </div>
        </div>
      </div>

      <EvaluationsClientView initialTeams={teams} rounds={rounds} />
    </div>
  );
}
