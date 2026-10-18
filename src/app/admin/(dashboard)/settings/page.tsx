import { supabaseAdmin } from "@/lib/supabase/admin";
import SettingsClientView from "./settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { data: settings } = await supabaseAdmin
    .from("event_settings")
    .select("final_hours_open, team_qr_enabled")
    .maybeSingle();

  const finalHoursOpen = settings?.final_hours_open ?? false;
  const teamQrEnabled = settings?.team_qr_enabled ?? false;

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
      <div className="border-b border-border-color pb-6 text-center">
        <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
          Event Settings
        </h1>
        <p className="font-tech text-text-secondary text-sm mt-2">
          Control event stage gates and QR access.
        </p>
      </div>

      <SettingsClientView
        initialFinalHoursOpen={finalHoursOpen}
        initialTeamQrEnabled={teamQrEnabled}
      />
    </div>
  );
}
