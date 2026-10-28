import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { getPublishedProblemStatements } from "@/app/actions/admin-problem-statements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import StatementCard from "./StatementCard";


export const dynamic = "force-dynamic";

export default async function TeamProblemStatementsPage() {
  await requireAuthenticatedTeamUser(); // Ensure team auth
  const statements = await getPublishedProblemStatements();

  // Resolve current assignment counts for each statement (simple N+1 approach – acceptable for small sets)
  const counts: Record<string, number> = {};
  for (const stmt of statements) {
    const { data: rows, error } = await supabaseAdmin
      .from("team_problem_statement_assignments")
      .select("team_id")
      .eq("problem_statement_id", stmt.id);
    if (!error && rows) counts[stmt.id] = rows.length;
    else counts[stmt.id] = 0;
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

      {statements.length === 0 ? (
        <p className="text-center text-text-secondary">No problem statements have been published yet.</p>
      ) : (
        <div className="grid gap-4">
          {statements.map((stmt) => (
            <StatementCard key={stmt.id} stmt={stmt} assignedCount={counts[stmt.id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}
