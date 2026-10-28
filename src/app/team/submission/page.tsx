import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import TeamSubmissionClientView, {
  ActiveRoundInfo,
  CurrentSubmissionInfo,
} from "./submission-client";

export const dynamic = "force-dynamic";

export default async function TeamSubmissionPage() {
  const { teamId, role } = await requireAuthenticatedTeamUser();

  const effectiveTeamId = teamId; // No fallback mock ID
  let activeRound: ActiveRoundInfo | null = null;
  let currentSubmission: CurrentSubmissionInfo | null = null;

  try {
    const [roundRes, subRes] = await Promise.all([
      supabaseAdmin
        .from("evaluation_rounds")
        .select("*")
        .order("sequence_order", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("team_submissions")
        .select("*")
        .eq("team_id", effectiveTeamId)
        .maybeSingle(),
    ]);

    if (roundRes.data) activeRound = roundRes.data;
    if (subRes.data) currentSubmission = subRes.data;
  } catch (err) {
    console.error("Failed to load team submission context:", err);
  }

  // Load event settings to determine Final Hours gate
  const { data: settings } = await supabaseAdmin
    .from('event_settings')
    .select('final_hours_open')
    .maybeSingle();
  const finalHoursOpen = settings?.final_hours_open ?? false;

  const isLocked = (!finalHoursOpen) || activeRound?.status === "closed" || activeRound?.status === "locked";
  const isLeader = role === "leader" || !teamId;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-border-color pb-6">
        <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
          Team Portal // Deliverables Submission
        </p>
        <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
          Project Deliverables
        </h1>
        <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
          Submit official project presentation slides and repository links for evaluation. Only the Team Leader is authorized to submit or update deliverables.
        </p>
      </div>

        <TeamSubmissionClientView
          teamId={effectiveTeamId}
          activeRound={activeRound}
          currentSubmission={currentSubmission}
          isLocked={isLocked}
          isLeader={isLeader}
          finalHoursOpen={finalHoursOpen}
        />
    </div>
  );
}
