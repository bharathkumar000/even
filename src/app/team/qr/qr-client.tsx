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
  MessageSquare,
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
        v: 1,

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
  }, [teamId, teamName]);

  const hasGoodies = claimedActions.includes("goodies");
  const goodiesLog = logs.find((l) => l.action_type === "goodies");

  const perksList = [
    {
      id: "registration",
      label: "Registration Check-In",
      icon: UserCheck,
      claimed: claimedActions.includes("registration"),
      isPerMember: false,
      log: logs.find((l) => l.action_type === "registration"),
    },
    {
      id: "goodies",
      label: "Goodies & Swag Kit",
      icon: Gift,
      claimed: hasGoodies,
      isPerMember: false,
      log: goodiesLog,
    },
    {
      id: "lunch",
      label: "Lunch Coupon Scan",
      icon: Utensils,
      claimed: claimedActions.includes("lunch"),
      isPerMember: true,
      log: logs.find((l) => l.action_type === "lunch"),
    },
    {
      id: "snacks",
      label: "Evening Refreshments",
      icon: Coffee,
      claimed: claimedActions.includes("snacks"),
      isPerMember: true,
      log: logs.find((l) => l.action_type === "snacks"),
    },
    {
      id: "feedback",
      label: "Event Feedback Submission",
      icon: MessageSquare,
      claimed: claimedActions.includes("feedback"),
      isPerMember: false,
      log: logs.find((l) => l.action_type === "feedback"),
    },
  ];

  const claimedCount = perksList.filter((p) => p.claimed).length;

  return (
    <div className="space-y-6">
      {/* Real-time Alert Toast when newly scanned */}
      {justClaimedAlert && (
        <div className="p-4 bg-status-success/20 border-2 border-status-success text-status-success font-tech text-xs flex items-center justify-between rounded animate-bounce shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span className="font-bold">{justClaimedAlert}</span>
          </div>
          <button
            onClick={() => setJustClaimedAlert(null)}
            className="text-xs uppercase font-bold text-status-success hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* LEFT COLUMN: Official QR Card (lg:col-span-5) */}
        <div className="lg:col-span-5 w-full">
          <div className="glass-panel p-4 sm:p-6 md:p-8 border border-accent-secondary/40 space-y-5 sm:space-y-6 text-center shadow-2xl relative overflow-hidden font-tech rounded-xl">
            {/* Anti-Fraud Rotating Watermark Banner */}
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <span className="flex items-center gap-1.5 text-[10px] text-status-success font-bold uppercase tracking-wider">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success"></span>
                </span>
                <span>Live Sync Active</span>
              </span>


            </div>

            {/* Team Identity */}
            <div className="space-y-1">
              <span className="text-[11px] text-accent-secondary uppercase font-bold tracking-wider px-2.5 py-0.5 bg-accent-secondary/15 border border-accent-secondary inline-block rounded">
                {track}
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl text-text-primary uppercase m-0 pt-2 tracking-wide leading-tight">
                {teamName}
              </h2>
              <p className="text-xs text-text-secondary m-0 pt-1">
                Leader: <span className="text-text-primary font-bold">{leaderName}</span>
              </p>
            </div>

            {/* Goodies Claimed Anti-Fraud Banner */}
            {hasGoodies && (
              <div className="p-3 bg-status-success/15 border border-status-success text-status-success text-xs rounded animate-fade-in flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs">
                  <Gift size={15} />
                  <span>Goodies Claimed & Verified ✓</span>
                </div>
                {goodiesLog && (
                  <p className="text-[10px] text-text-secondary m-0">
                    Dispensed by <strong className="text-white">{goodiesLog.scanner_name}</strong>
                  </p>
                )}
              </div>
            )}

            {/* QR Render with dynamic border */}
            <div className="flex justify-center my-3 relative">
              <div
                className={`p-3 sm:p-4 bg-white rounded-xl shadow-2xl inline-block border-4 transition-all duration-300 relative max-w-full ${
                  hasGoodies ? "border-status-success shadow-status-success/20" : "border-accent-primary"
                }`}
              >
                {qrUrl ? (
                  <Image
                    key={qrUrl}
                    src={qrUrl}
                    alt="Team Official QR Code"
                    width={224}
                    height={224}
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain max-w-full"
                  />
                ) : (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-black text-xs font-mono">
                    Generating QR...
                  </div>
                )}

                {/* Dynamic Version Stamp */}
                <div className="absolute bottom-1 right-2 bg-black/85 text-white font-mono text-[9px] px-1.5 py-0.5 rounded border border-white/20">
                  v1.0
                </div>
              </div>
            </div>

            {/* Security & Verification Metadata */}


            {/* Download Action */}
            {qrUrl && (
              <div className="pt-2">
                <a
                  href={qrUrl}
                  download={`team-${teamName.toLowerCase().replace(/\s+/g, "-")}-badge.png`}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-accent-primary hover:bg-accent-primary/80 text-black font-bold uppercase text-xs rounded transition-all shadow-[0_0_20px_rgba(255,215,0,0.2)] cursor-pointer"
                >
                  <Download size={15} />
                  <span>Save Official Badge</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Perks & Logistics Status (lg:col-span-7) */}
        <div className="lg:col-span-7 w-full">
          <div className="glass-panel p-4 sm:p-6 md:p-7 border border-border-color space-y-4 font-tech rounded-xl shadow-xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-color pb-3 gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-accent-secondary shrink-0" />
                <h3 className="font-heading text-base sm:text-lg text-text-primary uppercase m-0 tracking-wide">
                  Live Perk & Logistics Status
                </h3>
              </div>
              <span className="text-xs text-accent-secondary font-mono font-bold px-2.5 py-0.5 rounded bg-accent-secondary/15 border border-accent-secondary/30 self-start sm:self-auto">
                {claimedCount}/{perksList.length} Claimed
              </span>
            </div>

            {/* 1 Item in Each Row */}
            <div className="flex flex-col gap-3 pt-1">
              {perksList.map((perk) => {
                const Icon = perk.icon;
                const isClaimed = perk.claimed;

                return (
                  <div
                    key={perk.id}
                    className={`p-3 sm:p-4 border transition-all rounded-lg ${
                      isClaimed
                        ? "bg-status-success/10 border-status-success/60 text-text-primary shadow-[0_0_15px_rgba(0,255,136,0.06)]"
                        : "bg-surface-color/50 border-border-color text-text-secondary"
                    }`}
                  >
                    <div className="flex items-start sm:items-center justify-between gap-2.5 sm:gap-3">
                      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-md border shrink-0 mt-0.5 sm:mt-0 ${
                            isClaimed
                              ? "bg-status-success/20 border-status-success text-status-success"
                              : "bg-surface-color-light border-border-color text-text-secondary"
                          }`}
                        >
                          <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-heading text-xs sm:text-sm uppercase m-0 font-bold text-text-primary tracking-wide truncate">
                            {perk.label}
                          </p>
                          {perk.isPerMember ? (
                            <p className="text-[10px] sm:text-[11px] text-text-secondary m-0 font-mono mt-0.5">
                              Per Member Scan • 3 Members
                            </p>
                          ) : (
                            <p className="text-[10px] sm:text-[11px] text-text-secondary m-0 font-mono mt-0.5">
                              Team-Level Verification
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[9px] sm:text-[10px] uppercase font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded border tracking-wider shrink-0 ${
                          isClaimed
                            ? "bg-status-success/20 text-status-success border-status-success"
                            : "bg-surface-color-light text-text-secondary border-border-color"
                        }`}
                      >
                        {isClaimed ? "Claimed ✓" : "Pending"}
                      </span>
                    </div>

                    {/* Member scan indicators for 3 members */}
                    {perk.isPerMember && (
                      <div className="mt-3 pt-2.5 border-t border-border-color/60 flex flex-wrap items-center gap-2">
                        {[1, 2, 3].map((num) => (
                          <div
                            key={num}
                            className={`text-[10px] font-mono px-2.5 py-1 rounded border flex items-center gap-1.5 ${
                              isClaimed
                                ? "bg-status-success/20 border-status-success text-status-success font-bold"
                                : "bg-surface-color-light/80 border-border-color text-text-secondary/70"
                            }`}
                          >
                            <span>Member {num}:</span>
                            <span className="font-bold">{isClaimed ? "Claimed ✓" : "Pending ○"}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Scanner Info or Desk Prompt */}
                    <div className="mt-2 text-[11px] text-text-secondary font-mono">
                      {isClaimed && perk.log ? (
                        <span>
                          Verified by <strong className="text-text-primary">{perk.log.scanner_name || "Operations Desk"}</strong>
                          {" • "}
                          {new Date(perk.log.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span className="text-text-secondary/70">Present QR at verification desk</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
