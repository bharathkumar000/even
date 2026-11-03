import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { getPublishedProblemStatements, getAssignmentCounts } from "@/app/actions/admin-problem-statements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import DepartmentProblemStatements from "./department-problem-statements";

export const dynamic = "force-dynamic";

export default async function TeamProblemStatementsPage() {
  const { user, teamId } = await requireAuthenticatedTeamUser();

  // Default to CSE/AIML as initial domain
  const defaultDepartment = "cse-aiml";

  // Fetch all published statements for default domain
  const allStatements = await getPublishedProblemStatements(defaultDepartment);

  // Resolve current assignment counts
  const counts = await getAssignmentCounts(allStatements.map((s) => s.id));

  // Fetch this team's existing selection
  let teamSelection: string | null = null;
  if (teamId) {
    const { data: assignment } = await supabaseAdmin
      .from("team_problem_statement_assignments")
      .select("problem_statement_id")
      .eq("team_id", teamId)
      .maybeSingle();
    teamSelection = assignment?.problem_statement_id ?? null;
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="border-b border-border-color pb-6 text-center">
        <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
          Team Resources // Problem Statements
        </p>
        <h1 className="text-3xl md:text-4xl font-heading text-text-primary tracking-wider uppercase m-0">
          Problem Statements
        </h1>
        <p className="font-tech text-text-secondary text-xs mt-2">
          Browse the officially published problem statements for the Ideathon.
        </p>
      </div>

      <DepartmentProblemStatements
        initialStatements={allStatements}
        initialCounts={counts}
        defaultDepartment={defaultDepartment}
        teamSelection={teamSelection}
      />
    </div>
  );
}
