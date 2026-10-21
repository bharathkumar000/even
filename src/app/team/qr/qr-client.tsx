"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import {
  Download,
  ShieldCheck,
  CheckCircle2,
  Gift,
  UserCheck,
  Utensils,
  Coffee,
  Sparkles,
  Lock,
  Clock,
  Radio,
} from "lucide-react";
import { getTeamScanStatus } from "@/app/actions/operations";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface TeamQrClientViewProps {
  teamId: string;
  teamName: string;
  track: string;
  leaderName: string;
  initialStatus?: {
    claimedActions: string[];
    logs: Array<{
      id: string;
      action_type: string;
      created_at: string;
      scanner_name?: string;
    }>;
    lastUpdated: string;
    qrToken: string;
  };
}

export default function TeamQrClientView({
  teamId,
  teamName,
  track,
  leaderName,
  initialStatus,
}: TeamQrClientViewProps) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [claimedActions, setClaimedActions] = useState<string[]>(
    initialStatus?.claimedActions || []
  );
  const [logs, setLogs] = useState(initialStatus?.logs || []);
  const [qrToken, setQrToken] = useState<string>(initialStatus?.qrToken || "");
  const [lastUpdated, setLastUpdated] = useState<string>(
    initialStatus?.lastUpdated || new Date().toISOString()
  );
  const [justClaimedAlert, setJustClaimedAlert] = useState<string | null>(null);

  // Refresh latest status from server
  const refreshStatus = useCallback(async () => {
    try {
      const status = await getTeamScanStatus(teamId);
      // Detect if goodies or a new item was newly claimed
      const prevGoodies = claimedActions.includes("goodies");
      const nextGoodies = status.claimedActions.includes("goodies");

      if (!prevGoodies && nextGoodies) {
        setJustClaimedAlert("Goodies & Welcome Kit successfully claimed from Operations Desk!");
      }

      setClaimedActions(status.claimedActions);
      setLogs(status.logs);
      setQrToken(status.qrToken);
      setLastUpdated(status.lastUpdated);
    } catch (err) {
      console.warn("Live QR status sync notice:", err);
    }
  }, [teamId, claimedActions]);

  // Realtime subscription for instant auto-update when scanned by any club member
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`team-qr-live-${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_activity_logs",
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          refreshStatus();
        }
      )
      .on("broadcast", { event: "scan_action_recorded" }, (payload) => {
        if (payload?.payload?.team_id === teamId) {
          refreshStatus();
        }
      })
      .subscribe();

    // Fallback polling interval every 3 seconds to guarantee instant refresh
    const interval = setInterval(() => {
      refreshStatus();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [teamId, refreshStatus]);

  // Re-generate QR code whenever claims change or QR token updates (Fraud Prevention)
  useEffect(() => {
    // Generate anti-fraud dynamic QR payload
    const payload = JSON.stringify({
      team_id: teamId,
      name: teamName,
      v: claimedActions.length + 1,
      token: qrToken || `SEC-${teamId.slice(0, 8).toUpperCase()}`,
      claimed: claimedActions,
      ts: Date.now(),
    });

    QRCode.toDataURL(
      payload,
      {
        width: 320,
        margin: 2,
        color: {
          dark: "#050508",
          light: "#ffffff",
        },
      },
      (err: Error | null | undefined, url: string) => {
        if (!err && url) {
          setQrUrl(url);
        }
      }
    );
  }, [teamId, teamName, claimedActions, qrToken]);

  const hasGoodies = claimedActions.includes("goodies");
  const goodiesLog = logs.find((l) => l.action_type === "goodies");

  const perksList = [
    {
      id: "registration",
      label: "Check-In / Registration",
      icon: UserCheck,
      claimed: claimedActions.includes("registration"),
      log: logs.find((l) => l.action_type === "registration"),
    },
    {
      id: "goodies",
      label: "Goodies & Swag Kit",
      icon: Gift,
      claimed: hasGoodies,
      log: goodiesLog,
    },
    {
      id: "lunch",
      label: "Lunch Counter Token",
      icon: Utensils,
      claimed: claimedActions.includes("lunch"),
      log: logs.find((l) => l.action_type === "lunch"),
    },
    {
      id: "snacks",
      label: "Evening Refreshments",
      icon: Coffee,
      claimed: claimedActions.includes("snacks"),
      log: logs.find((l) => l.action_type === "snacks"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Real-time Alert Toast when newly scanned */}
      {justClaimedAlert && (
        <div className="p-4 bg-status-success/20 border-2 border-status-success text-status-success font-tech text-xs flex items-center justify-between rounded animate-bounce">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span className="font-bold">{justClaimedAlert}</span>
          </div>
          <button
            onClick={() => setJustClaimedAlert(null)}
            className="text-xs uppercase font-bold text-status-success hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Official QR Card */}
      <div className="glass-panel p-8 border border-accent-secondary/40 space-y-6 text-center shadow-2xl relative overflow-hidden font-tech">
        {/* Anti-Fraud Rotating Watermark Banner */}
        <div className="flex items-center justify-between border-b border-border-color pb-3">
          <span className="flex items-center gap-1.5 text-[10px] text-status-success font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success"></span>
            </span>
            <span>Live Sync Active</span>
          </span>

          <span className="text-[10px] text-accent-tertiary font-mono uppercase bg-surface-color px-2 py-0.5 border border-border-color flex items-center gap-1">
            <Lock size={10} />
            <span>Anti-Fraud Token: {qrToken.slice(0, 14)}...</span>
          </span>
        </div>

        {/* Team Identity */}
        <div className="space-y-1">
          <span className="text-xs text-accent-secondary uppercase font-bold tracking-wider px-2.5 py-0.5 bg-accent-secondary/15 border border-accent-secondary inline-block">
            {track}
          </span>
          <h2 className="font-heading text-3xl text-text-primary uppercase m-0 pt-2 tracking-wide">
            {teamName}
          </h2>
          <p className="text-xs text-text-secondary m-0">
            Leader: <span className="text-text-primary font-bold">{leaderName}</span>
          </p>
        </div>

        {/* Goodies Claimed Anti-Fraud Banner */}
        {hasGoodies && (
          <div className="p-3.5 bg-status-success/15 border border-status-success text-status-success text-xs rounded animate-fade-in flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-sm">
              <Gift size={16} />
              <span>Goodies Claimed & Verified ✓</span>
            </div>
            {goodiesLog && (
              <p className="text-[11px] text-text-secondary m-0">
                Dispensed by <strong className="text-white">{goodiesLog.scanner_name}</strong> at{" "}
                <span className="font-mono text-white">
                  {new Date(goodiesLog.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </p>
            )}
            <p className="text-[10px] text-status-success/80 m-0 uppercase font-bold tracking-wide">
              QR Code Automatically Updated • Duplicate Claim Locked
            </p>
          </div>
        )}

        {/* QR Render with dynamic border */}
        <div className="flex justify-center my-3 relative">
          <div
            className={`p-4 bg-white rounded-lg shadow-2xl inline-block border-4 transition-all duration-300 relative ${
              hasGoodies ? "border-status-success shadow-status-success/20" : "border-accent-primary"
            }`}
          >
            {qrUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
<Image
                      key={qrUrl}
                      src={qrUrl}
                      alt="Team Official QR Code"
                      width={224}
                      height={224}
                      className="w-56 h-56 object-contain"
                    />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-black text-xs">
                Generating QR...
              </div>
            )}

            {/* Dynamic Version Stamp */}
            <div className="absolute bottom-1 right-2 bg-black/80 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
              v{claimedActions.length + 1}.0
            </div>
          </div>
        </div>

        {/* Security & Verification Metadata */}
        <div className="space-y-1 text-xs text-text-secondary">
            <p className="font-mono text-[11px] text-text-primary m-0">
              Team ID: {teamId} | Team Name: {teamName}
            </p>
          <p className="text-[11px] text-text-secondary m-0">
            Dynamic QR automatically updates upon each scan to prevent fraud. Screenshots of previous states are void.
          </p>
        </div>

        {/* Download Action */}
        {qrUrl && (
          <div className="pt-1">
            <a
              href={qrUrl}
              download={`team-${teamName.toLowerCase().replace(/\s+/g, "-")}-badge.png`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/80 text-black font-bold uppercase text-xs transition-colors shadow-lg"
            >
              <Download size={15} />
              <span>Save Official Badge</span>
            </a>
          </div>
        )}
      </div>

      {/* Live Perks & Distribution Status Breakdown */}
      <div className="glass-panel p-6 border border-border-color space-y-4 font-tech">
        <div className="flex items-center justify-between border-b border-border-color pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent-tertiary" />
            <h3 className="font-heading text-lg text-text-primary uppercase m-0">
              Live Perk & Logistics Status
            </h3>
          </div>
          <span className="text-[10px] text-text-secondary font-mono">
            {claimedActions.length}/4 Perks Claimed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {perksList.map((perk) => {
            const Icon = perk.icon;
            return (
              <div
                key={perk.id}
                className={`p-3.5 border transition-all flex items-start gap-3 rounded ${
                  perk.claimed
                    ? "bg-status-success/10 border-status-success/60 text-text-primary"
                    : "bg-surface-color/50 border-border-color text-text-secondary"
                }`}
              >
                <div
                  className={`p-2 rounded border ${
                    perk.claimed
                      ? "bg-status-success/20 border-status-success text-status-success"
                      : "bg-surface-color-light border-border-color text-text-secondary"
                  }`}
                >
                  <Icon size={16} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-heading text-xs uppercase m-0 font-bold">
                      {perk.label}
                    </p>
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        perk.claimed
                          ? "bg-status-success/20 text-status-success border border-status-success"
                          : "bg-surface-color-light text-text-secondary"
                      }`}
                    >
                      {perk.claimed ? "Claimed ✓" : "Pending"}
                    </span>
                  </div>

                  {perk.claimed && perk.log ? (
                    <p className="text-[10px] text-text-secondary m-0 mt-1 font-mono">
                      By {perk.log.scanner_name || "Club Member"} •{" "}
                      {new Date(perk.log.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : (
                    <p className="text-[10px] text-text-secondary/70 m-0 mt-1">
                      Present QR at verification desk
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
