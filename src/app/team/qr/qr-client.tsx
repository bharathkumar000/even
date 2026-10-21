"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";

interface SocialLink {
  label: string;
  url: string;
  icon: string;
}

export interface ActionStatus {
  id: string;
  label: string;
  emoji: string;
  claimed: boolean;
  completedCount: number;
  targetCount: number;
  isPerMember: boolean;
  log?: {
    scanner_name: string;
    created_at: string;
  };
}

interface TeamQrClientViewProps {
  teamCode: string;
  teamName: string;
  qrImageDataUrl: string | null;
  qrError: string | null;
  actionStatusList: ActionStatus[];
  socialLinks: SocialLink[];
}

export default function TeamQrClientView({
  teamCode,
  teamName,
  qrImageDataUrl,
  qrError,
  actionStatusList,
  socialLinks,
}: TeamQrClientViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const downloadQr = () => {
    if (!qrImageDataUrl) return;
    const a = document.createElement("a");
    a.href = qrImageDataUrl;
    a.download = `team-${teamCode}-checkin.png`;
    a.click();
  };

  const retry = () => {
    window.location.reload();
  };

  if (qrError) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-status-error">
          QR Generation Failed
        </h2>
        <p className="text-text-secondary">{qrError}</p>
        <button
          onClick={retry}
          className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-black font-bold uppercase text-xs rounded mt-4 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!qrImageDataUrl) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <h2 className="text-2xl font-bold mb-4">Generating QR…</h2>
      </div>
    );
  }

return (
    <div className="space-y-6">
      {/* QR Card */}
      <div className="glass-panel p-8 border border-accent-primary/30 space-y-6 text-center">
        <div className="flex items-center justify-center my-3">
          <div className="p-4 bg-white rounded-lg shadow-2xl inline-block border-4 border-accent-primary">
<img
               src={qrImageDataUrl}
               alt="Team Check‑In QR Code"
               width={224}
               height={224}
               className="w-56 h-56 object-contain"
             />
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-1" suppressHydrationWarning>
            <p className="font-mono text-[11px] text-text-primary">
              Team Code: {teamCode}
            </p>
          <p className="font-heading text-sm text-text-primary uppercase tracking-wide" suppressHydrationWarning>
            {teamName}
          </p>
          <p className="font-tech text-[11px] text-text-secondary/70">
            Present at security & distribution desks
          </p>
        </div>
        <button
          onClick={downloadQr}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-accent-primary hover:bg-accent-primary/80 text-black font-bold uppercase text-xs rounded transition-all shadow-[0_0_20px_rgba(255,215,0,0.25)] cursor-pointer"
        >
          <Download size={15} />
          Download QR
        </button>
      </div>

      {/* Action Status List */}
      <div className="glass-panel p-6 border border-accent-secondary/40 space-y-4 font-tech shadow-[0_0_30px_rgba(255,0,127,0.08)]">
        <div className="flex items-center justify-between border-b border-border-color pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-secondary animate-pulse" />
            <span className="text-accent-secondary font-bold uppercase text-xs tracking-wider">
              Check‑In Status
            </span>
          </div>
          <span className="text-xs text-accent-secondary font-mono font-bold px-2 py-0.5 rounded bg-accent-secondary/15 border border-accent-secondary/30">
            {actionStatusList.filter((a) => a.claimed).length}/{actionStatusList.length} Completed
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {actionStatusList.map((action) => {
            const isComplete = action.claimed;
            const isPartial = !isComplete && action.completedCount > 0;
            return (
              <div
                key={action.id}
                className={`p-4 border rounded-lg transition-all ${
                  isComplete
                    ? "bg-status-success/10 border-status-success/60 text-text-primary shadow-[0_0_15px_rgba(0,255,136,0.08)]"
                    : isPartial
                    ? "bg-accent-primary/10 border-accent-primary/50 text-text-primary shadow-[0_0_15px_rgba(255,215,0,0.08)]"
                    : "bg-surface-color/50 border-border-color text-text-secondary"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg p-1.5 rounded bg-surface-color/80 border border-border-color">
                      {action.emoji}
                    </span>
                    <div>
                      <h4 className="font-heading text-xs uppercase m-0 font-bold tracking-wide">
                        {action.label}
                      </h4>
                      {action.isPerMember ? (
                        <p className="text-[10px] text-text-secondary m-0 font-mono mt-0.5">
                          Per Member Scan • {action.completedCount}/{action.targetCount} members verified
                        </p>
                      ) : (
                        <p className="text-[10px] text-text-secondary m-0 font-mono mt-0.5">
                          Team Level Verification
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-1 rounded border tracking-wider shrink-0 ${
                      isComplete
                        ? "bg-status-success/20 text-status-success border-status-success"
                        : isPartial
                        ? "bg-accent-primary/20 text-accent-primary border-accent-primary"
                        : "bg-surface-color-light text-text-secondary border-border-color"
                    }`}
                  >
                    {isComplete
                      ? action.isPerMember
                        ? "Completed (3/3) ✓"
                        : "Completed ✓"
                      : isPartial
                      ? `${action.completedCount}/${action.targetCount} Scanned`
                      : action.isPerMember
                      ? "Pending (0/3)"
                      : "Pending"}
                  </span>
                </div>
{action.isPerMember && (
  <div className="mt-3 pt-2.5 border-t border-border-color/60 flex flex-wrap items-center gap-2">
    {Array.from({ length: action.targetCount }).map((_, i) => {
      const memberScanned = action.completedCount > i;
      return (
        <div
          key={i}
          className={`text-[10px] font-mono px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors ${
            memberScanned
              ? "bg-status-success/20 border-status-success text-status-success font-bold"
              : "bg-surface-color-light/80 border-border-color text-text-secondary/70"
          }`}
        >
          <span>Member {i + 1}:</span>
          <span className="font-bold">{memberScanned ? "Claimed ✓" : "Pending ○"}</span>
        </div>
      );
    })}
  </div>
)}
                <div className="mt-2 text-[10px] text-text-secondary font-mono">
                  {action.log ? (
                    <span>
                      Latest scan by <strong className="text-text-primary">{action.log.scanner_name}</strong>
                      {" • "}
                      <span suppressHydrationWarning>
                        {mounted
                          ? new Date(action.log.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text-secondary/60">Present QR at verification counter</span>
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

function getSocialIconEmoji(icon: string): string {
  const map: Record<string, string> = {
    linkedin: "💼",
    instagram: "📸",
    twitter: "🐦",
    globe: "🌐",
  };
  return map[icon] || "🔗";
}
