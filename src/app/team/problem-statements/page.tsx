import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { getPublishedProblemStatements, getAssignmentCounts } from "@/app/actions/admin-problem-statements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import DepartmentProblemStatements from "./department-problem-statements";

export const dynamic = "force-dynamic";

type Department = "cse-aiml" | "ece-eee" | "me-cv";

const DEPARTMENTS: Array<{
  id: Department;
  label: string;
  subtitle: string;
}> = [
  { id: "cse-aiml", label: "CSE / AIML", subtitle: "Computer Science & AI/ML" },
  { id: "ece-eee", label: "ECE / EEE", subtitle: "Electronics & Electrical" },
  { id: "me-cv", label: "ME / CV", subtitle: "Mechanical & Civil" },
];

export default async function TeamProblemStatementsPage() {
  const { user, teamId, role } = await requireAuthenticatedTeamUser();

  // Fetch all published statements server-side
  const allStatements = await getPublishedProblemStatements();

  // Resolve current assignment counts
  const counts = await getAssignmentCounts(allStatements.map((s) => s.id));

  // Determine user's department from team track
  let userDepartment: Department | null = null;
  if (teamId) {
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("track")
      .eq("id", teamId)
      .maybeSingle();
    const track = team?.track || "";
    const t = track.toLowerCase();
    if (t.includes("cse") || t.includes("aiml") || t.includes("computer")) {
      userDepartment = "cse-aiml";
    } else if (t.includes("ece") || t.includes("eee") || t.includes("electronics") || t.includes("electrical")) {
      userDepartment = "ece-eee";
    } else if (t.includes("me") || t.includes("cv") || t.includes("mechanical") || t.includes("civil")) {
      userDepartment = "me-cv";
    }
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
          {userDepartment && (
            <span className="ml-2 px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary/40 text-accent-secondary text-[10px] font-bold uppercase rounded">
              Your Dept: {DEPARTMENTS.find((d) => d.id === userDepartment)?.label}
            </span>
          )}
        </p>
      </div>

      <DepartmentProblemStatements
        initialStatements={allStatements}
        initialCounts={counts}
        defaultDepartment={userDepartment}
      />
    </div>
  );
}
