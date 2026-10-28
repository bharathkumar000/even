import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTeamRegistrationByTeamId } from "@/lib/googleSheet";

import { getTeamScanStatus } from "@/app/actions/operations";
import TeamQrClientView from "./qr-client";




export const dynamic = "force-dynamic";

export default async function TeamQrPage() {
  const { teamId } = await requireAuthenticatedTeamUser();
  const effectiveTeamId = teamId;

  interface TeamInfo {
    id: string;
    name: string;
    track?: string | null;
    leader_name?: string | null;
  }

  let teamInfo: TeamInfo | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("teams")
      .select("id, name, track, leader_name")
      .eq("id", effectiveTeamId)
      .single();
    if (data) teamInfo = data;
  } catch (err) {
    console.error("Failed to load team data for QR:", err);
  }

  // Load QR access setting
      if (!teamInfo) {
        const reg = await getTeamRegistrationByTeamId(effectiveTeamId);
        if (reg) {
          teamInfo = {
            id: effectiveTeamId,
            name: reg["Team Name"] ?? "",
            track: reg["SELECTED DOMAIN"] ?? "",
            leader_name: reg["Team Leader"] ?? "",
          };
        }
      }
  const { data: qrSettings, error: qrError } = await supabaseAdmin
    .from('event_settings')
    .select('team_qr_enabled')
    .maybeSingle();

  // If the settings table or column is missing, or the value is null/undefined, fall back to enabling the QR.
  // This prevents the "Team QR Code Not Available" placeholder from showing unintentionally.
  let qrEnabled = true;
  if (!qrError && qrSettings) {
    // Use the stored flag if present, otherwise default to true.
    qrEnabled = qrSettings.team_qr_enabled ?? true;
  }


  const initialStatus = await getTeamScanStatus(effectiveTeamId);

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto w-full">
      <div className="border-b border-border-color pb-6 text-center">
        <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
          Team Identity // Official Access Pass
        </p>
        <h1 className="text-3xl md:text-4xl font-heading text-text-primary tracking-wider uppercase m-0">
          Team QR Pass
        </h1>
        <p className="font-tech text-text-secondary text-xs mt-2">
          Present this official QR badge at check-in, kit distribution, lunch counters, and refreshments booths.
        </p>
      </div>

      {qrEnabled ? (
        <TeamQrClientView
          teamId={effectiveTeamId}
          teamName={teamInfo?.name || "Team Alpha"}
          track={teamInfo?.track || "Innovation Track"}
          leaderName={teamInfo?.leader_name || "Team Leader"}
          initialStatus={initialStatus}
        />
      ) : (
        <div className="p-4 bg-status-warning/15 border border-status-warning text-status-warning font-tech text-sm rounded">
          <h2 className="text-2xl font-heading text-status-warning mb-2">Team QR Code Not Available</h2>
          <p>Team QR codes are currently unavailable. Please check again when access is enabled by the event administrator.</p>
        </div>
      )}


    </div>
  );
}
