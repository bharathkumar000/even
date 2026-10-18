"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { updateEventSettings } from "@/app/actions/admin-settings";

export default function SettingsClientView({
  initialFinalHoursOpen,
  initialTeamQrEnabled,
}: {
  initialFinalHoursOpen: boolean;
  initialTeamQrEnabled: boolean;
}) {
  const [finalHoursOpen, setFinalHoursOpen] = useState(initialFinalHoursOpen);
  const [teamQrEnabled, setTeamQrEnabled] = useState(initialTeamQrEnabled);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<
    | { type: "success"; message: string }
    | { type: "error"; message: string }
    | null
  >(null);

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);
    try {
      await updateEventSettings({
        final_hours_open: finalHoursOpen,
        team_qr_enabled: teamQrEnabled,
      });
      setNotification({ type: "success", message: "Settings saved successfully." });
    } catch (err: any) {
      setNotification({ type: "error", message: err?.message ?? "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 font-tech text-text-primary">
          <input
            type="checkbox"
            checked={finalHoursOpen}
            onChange={() => setFinalHoursOpen(!finalHoursOpen)}
            className="h-4 w-4 rounded border-text-secondary"
          />
          Enable Final Hours (Project Submission)
        </label>
        <p className="text-sm text-text-secondary mt-1">
          When enabled, teams can submit final deliverables.
        </p>
      </div>
      <div>
        <label className="flex items-center gap-2 font-tech text-text-primary">
          <input
            type="checkbox"
            checked={teamQrEnabled}
            onChange={() => setTeamQrEnabled(!teamQrEnabled)}
            className="h-4 w-4 rounded border-text-secondary"
          />
          Enable Team QR Codes
        </label>
        <p className="text-sm text-text-secondary mt-1">
          When enabled, team members can view their QR badge for access.
        </p>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-3 bg-accent-primary text-text-primary font-tech font-bold uppercase tracking-wider rounded disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>

      {notification && (
        <div
          className={`p-4 border text-sm font-tech flex items-center gap-2 ${
            notification.type === "success"
              ? "bg-status-success/15 border-status-success text-status-success"
              : "bg-status-error/15 border-status-error text-status-error"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
}
