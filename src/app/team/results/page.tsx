import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { getTeamRegistrationByTeamId } from "@/lib/googleSheet";

import { Trophy, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";
interface TeamBasicInfo {
  id: string;
  name: string;
  track?: string | null;
}

interface TeamPublishedResult {
  total_score?: number | null;
  average_score?: number | null;
  evaluations_count?: number | null;
  is_published?: boolean;
  published_at?: string | null;
  rank?: number | null;
}

export default async function TeamResultsPage() {
  const { teamId } = await requireAuthenticatedTeamUser();
  const effectiveTeamId = teamId;

  let publishedResult: TeamPublishedResult | null = null;
  let teamInfo: TeamBasicInfo | null = null;

  try {
    const [teamRes, resultRes] = await Promise.all([
      supabaseAdmin.from("teams").select("id, name, track").eq("id", effectiveTeamId).single(),
      // BACKEND-ENFORCED: Query ONLY the authenticated team's published results.
      supabaseAdmin
        .from("event_results")
        .select("total_score, average_score, evaluations_count, is_published, published_at, rank")
        .eq("team_id", effectiveTeamId)
        .eq("is_published", true)
        .maybeSingle(),
    ]);

    if (teamRes.data) teamInfo = teamRes.data;
    // Fallback to Google Sheet using the team ID when Supabase has no entry.
    if (!teamInfo) {
      const reg = await getTeamRegistrationByTeamId(effectiveTeamId);
      if (reg) {
        teamInfo = {
          id: effectiveTeamId,
          name: reg["Team Name"] ?? "",
          track: reg["SELECTED DOMAIN"] ?? "",
        };
      }
    }
    if (resultRes.data) publishedResult = resultRes.data;
  } catch (err) {
    console.error("Failed to load team result:", err);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-border-color pb-6">
        <p className="font-tech text-xs uppercase tracking-[3px] text-accent-primary font-bold mb-1">
          Team Portal // Official Standings
        </p>
        <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
          Team Results
        </h1>
        <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
          Authorized result scorecard for {teamInfo?.name || "Your Team"}. Scores are released exclusively after official publication.
        </p>
      </div>

      {!publishedResult ? (
        <div className="glass-panel p-10 text-center border border-border-color space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-accent-primary/10 border border-accent-primary/40 flex items-center justify-center">
            <Trophy className="text-accent-primary w-8 h-8" />
          </div>
          <h2 className="font-heading text-xl text-text-primary uppercase m-0">
            Results Under Evaluation
          </h2>
          <p className="font-tech text-text-secondary text-xs max-w-md mx-auto">
            The evaluation results for your team have not been published yet. The judging committee and admins are currently tabulating scores. Please check back after the round concludes.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-panel p-4 sm:p-8 border border-status-success/40 bg-gradient-to-r from-status-success/5 to-transparent space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-color pb-4">
              <div>
                <span className="font-tech text-[10px] text-status-success uppercase font-bold tracking-wider px-2 py-0.5 bg-status-success/15 border border-status-success">
                  OFFICIALLY PUBLISHED
                </span>
                <h2 className="font-heading text-xl sm:text-2xl text-text-primary uppercase m-0 mt-2">
                  {teamInfo?.name || "Team Evaluation Scorecard"}
                </h2>
                <p className="font-tech text-xs text-text-secondary m-0 mt-0.5">
                  Track: <span className="text-text-primary">{teamInfo?.track || "Innovation"}</span>
                </p>
              </div>

              {publishedResult.rank && (
                <div className="text-left sm:text-right">
                  <span className="font-tech text-xs text-text-secondary uppercase block">
                    Official Standing
                  </span>
                  <span className="font-heading text-2xl sm:text-3xl text-accent-primary font-bold">
                    Rank #{publishedResult.rank}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
              <div className="p-4 bg-surface-color-light/40 border border-border-color">
                <span className="font-tech text-xs text-text-secondary uppercase block">
                  Total Tabulated Score
                </span>
                <span className="font-heading text-3xl text-accent-primary font-bold mt-1 block">
                  {publishedResult.total_score} PTS
                </span>
              </div>

              <div className="p-4 bg-surface-color-light/40 border border-border-color">
                <span className="font-tech text-xs text-text-secondary uppercase block">
                  Average Judge Score
                </span>
                <span className="font-heading text-3xl text-accent-secondary font-bold mt-1 block">
                  {typeof publishedResult.average_score === "number"
                    ? publishedResult.average_score.toFixed(1)
                    : publishedResult.total_score}{" "}
                  PTS
                </span>
              </div>

              <div className="p-4 bg-surface-color-light/40 border border-border-color">
                <span className="font-tech text-xs text-text-secondary uppercase block">
                  Evaluations Considered
                </span>
                <span className="font-heading text-3xl text-accent-tertiary font-bold mt-1 block">
                  {publishedResult.evaluations_count || 1}
                </span>
              </div>
            </div>

            {publishedResult.published_at && (
              <p className="font-tech text-[11px] text-text-secondary flex items-center gap-1.5 pt-2 m-0">
                <Calendar size={13} />
                <span>Certified on {new Date(publishedResult.published_at).toLocaleString()}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
