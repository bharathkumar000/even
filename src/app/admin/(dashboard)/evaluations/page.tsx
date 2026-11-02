import { getAllTeamsWithEvaluations } from "@/app/actions/admin-evaluations";
import type { TeamEvaluationRecord } from "@/app/actions/admin-evaluations";
import EvaluationsClientView, {
  RoundItem,
} from "./evaluations-client";

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
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-border-color pb-6">
        <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
          Administration // Monitoring & Governance
        </p>
        <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
          Evaluation Monitor
        </h1>
        <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
          View all registered team evaluations, inspect marks, and perform audited status overrides.
        </p>
      </div>

      <EvaluationsClientView initialTeams={teams} rounds={rounds} />
    </div>
  );
}
