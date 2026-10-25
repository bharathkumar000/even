"use client";

import { useEffect, useState } from "react";
import { Megaphone, AlertTriangle, CheckCircle, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { playPitchCallAlert } from "@/lib/feedback-sound";

interface PitchCallPayload {
  team_id: string;
  team_name: string;
  round_title: string;
  track?: string;
  timestamp: number;
}

export default function PitchAlertListener({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName?: string;
}) {
  const [activeCall, setActiveCall] = useState<PitchCallPayload | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!teamId) return;

    const supabase = createClient();
    const channel = supabase
      .channel("team-pitch-alerts")
      .on("broadcast", { event: "pitch_call" }, (event) => {
        const payload = event?.payload as PitchCallPayload;
        if (payload && payload.team_id === teamId) {
          setActiveCall(payload);
          setAcknowledged(false);
          // Play synthesized alert sound
          playPitchCallAlert();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  if (!activeCall || acknowledged) return null;

  return (
    <div className="relative animate-bounce-short mb-6">
      <div className="p-5 rounded-lg border-2 border-accent-secondary bg-surface-color/95 backdrop-blur shadow-[0_0_30px_rgba(0,240,255,0.35)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-full bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/50 animate-pulse">
            <Megaphone size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-tech text-xs uppercase px-2 py-0.5 rounded bg-status-warning/20 border border-status-warning text-status-warning font-bold tracking-wider">
                Action Required
              </span>
              <span className="font-tech text-xs text-text-secondary">
                {new Date(activeCall.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <h2 className="font-heading text-lg md:text-xl text-text-primary uppercase m-0 mt-1">
              Jury Pitch Call // {activeCall.round_title}
            </h2>
            <p className="font-tech text-xs md:text-sm text-text-secondary mt-1 m-0">
              Attention <strong className="text-accent-secondary">{activeCall.team_name || teamName}</strong>: The panel judges are ready for your presentation. Please assemble your team at the designated evaluation area now.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => playPitchCallAlert()}
            title="Replay Alert Sound"
            className="p-2 rounded border border-border-color bg-surface-color-light text-text-secondary hover:text-text-primary transition-colors"
          >
            <Volume2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setAcknowledged(true)}
            className="flex-1 md:flex-initial px-4 py-2 font-tech text-xs uppercase tracking-wider font-bold rounded bg-accent-secondary text-bg-color hover:bg-accent-secondary/90 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle size={14} />
            <span>Acknowledged — On Our Way</span>
          </button>
        </div>
      </div>
    </div>
  );
}
