"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Coffee,
  Utensils,
  Gift,
  UserCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  fetchTeamMembersForScan,
  manualTeamLookup,
  getLiveScanActivityStream,
  getRecentlyScannedTeams,
  type LiveActivityFeedItem,
  type EnrichedActivityLog,
} from "@/app/actions/operations";
import ScannerDesk from "@/components/ops/ScannerDesk";
import RecentlyScannedTeams from "@/components/ops/RecentlyScannedTeams";

import { createClient } from "@/lib/supabase/client";
import { playScanSuccess, playScanError } from "@/lib/feedback-sound";

// Matches a full 36-character UUID (8-4-4-4-12 hex segments). Used to extract
// the team UUID even when the QR payload appends a distribution index such as
// "UUID-0". We deliberately do NOT split on hyphens, because UUIDs themselves
// contain hyphens.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Extracts the team UUID from any supported QR payload:
//   1. Plain UUID: "892e7590-..."
//   2. JSON object: {"team_id":"892e7590-...","name":"...","v":1}
//   3. UUID with a separate distribution index: "892e7590-...-0"
const extractTeamId = (rawCode: string): string => {
  let candidate = rawCode.trim();

  // JSON payload: read the designated team_id field.
  if (candidate.startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        candidate = parsed.team_id ?? parsed.id ?? candidate;
      }
    } catch {
      // Not valid JSON; fall through to raw candidate handling below.
    }
  }

  // UUID possibly followed by a distribution index. Match the UUID pattern
  // directly instead of split("-") so the hyphens inside the UUID are preserved.
  const uuidMatch = candidate.match(UUID_PATTERN);
  if (uuidMatch) {
    return uuidMatch[0];
  }

  return candidate;
};

export interface TeamScanMember {
  id: string;
  user_id?: string;
  name?: string | null;
  role?: string | null;
  email?: string | null;
}

export interface TeamScanData {
  team: {
    id: string;
    name: string;
    track?: string | null;
    leader_name?: string | null;
    code?: string | null;
    qr_token?: string | null;
    last_scanned_at?: string | null;
  };
  members: TeamScanMember[];
  activityLogs: EnrichedActivityLog[];
}

// Scan purposes mapped to existing action types (verification only).
export interface ScanPurposeOption {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SCAN_PURPOSES: ScanPurposeOption[] = [
  {
    value: "registration",
    label: "Registration / Check-In",
    description: "Verify registration and check-in status (read-only)",
    icon: UserCheck,
  },
  {
    value: "verification",
    label: "Team QR Pass Verification",
    description: "Verify team QR pass validity (read-only)",
    icon: ShieldAlert,
  },
  {
    value: "goodies",
    label: "Kit Distribution Status",
    description: "Verify existing kit distribution status (read-only)",
    icon: Gift,
  },
  {
    value: "lunch",
    label: "Lunch Status",
    description: "Verify existing lunch claim status (read-only)",
    icon: Utensils,
  },
  {
    value: "snacks",
    label: "Snacks Status",
    description: "Verify existing snack claim status (read-only)",
    icon: Coffee,
  },
] as const;

export default function ScannerClientView() {
  const [scanning, setScanning] = useState(false);
  const [manualId, setManualId] = useState("");
  const [teamData, setTeamData] = useState<TeamScanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanPurpose, setScanPurpose] = useState<string>("registration");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveStreamLogs, setLiveStreamLogs] = useState<LiveActivityFeedItem[]>([]);
   const [streamLoading, setStreamLoading] = useState(false);
    const [recentScans, setRecentScans] = useState<string[]>([]);

   const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
useEffect(() => {
  setLastSyncTime(new Date());
}, []);
  const html5QrCodeRef = useRef<any>(null);

  // Fetch live activity audit stream across all club members
  const fetchLiveStream = useCallback(async () => {
    try {
      setStreamLoading(true);
      const data = await getLiveScanActivityStream(35);
      setLiveStreamLogs(data);
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn("Notice: Real-time stream sync notice:", err);
    } finally {
      setStreamLoading(false);
    }
  }, []);

  // Real-time synchronization subscription for all club members
  useEffect(() => {
    fetchLiveStream();

    const supabase = createClient();
    const channel = supabase
      .channel("ops-realtime-activity")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_activity_logs",
        },
        (payload) => {
          fetchLiveStream();
          const changedTeamId = (payload.new as any)?.team_id;
          if (changedTeamId) {
            setTeamData((current) => {
              if (current && current.team.id === changedTeamId) {
                fetchTeamMembersForScan(changedTeamId)
                  .then((updated) => setTeamData(updated))
                  .catch(() => {});
              }
              return current;
            });
          }
        }
      )
      .on("broadcast", { event: "scan_action_recorded" }, (payload) => {
        fetchLiveStream();
        const changedTeamId = payload?.payload?.team_id;
        if (changedTeamId) {
          setTeamData((current) => {
            if (current && current.team.id === changedTeamId) {
              fetchTeamMembersForScan(changedTeamId)
                .then((updated) => setTeamData(updated))
                .catch(() => {});
            }
            return current;
          });
        }
      })
      .subscribe();

    // Fallback polling interval every 4 seconds to guarantee sync even across proxy firewalls
    const pollInterval = setInterval(() => {
      fetchLiveStream();
      setTeamData((current) => {
        if (current?.team?.id) {
          fetchTeamMembersForScan(current.team.id)
            .then((updated) => setTeamData(updated))
            .catch(() => {});
        }
        return current;
      });
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [fetchLiveStream]);

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        try {
          html5QrCodeRef.current.clear();
        } catch {}
        html5QrCodeRef.current = null;
      }
    } catch (err) {
      console.warn("Camera stop error:", err);
    } finally {
      setScanning(false);
    }
  };

  const startScanner = async () => {
    try {
      setErrorMsg(null);
      await stopScanner();

      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-container");
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 350, height: 350 },
        },
        (decodedText) => {
          handleDetectedCode(decodedText);
          stopScanner();
        },
        () => {}
      );
      setScanning(true);
    } catch (err: unknown) {
      console.error("Scanner start failure:", err);
      try {
        if (html5QrCodeRef.current) {
          html5QrCodeRef.current.clear();
        }
      } catch {}
      html5QrCodeRef.current = null;
      setScanning(false);

      const rawMsg = err instanceof Error ? err.message : String(err || "");
      if (
        rawMsg.toLowerCase().includes("notreadableerror") ||
        rawMsg.toLowerCase().includes("shutter") ||
        rawMsg.toLowerCase().includes("could not start video source")
      ) {
        setErrorMsg(
          "Camera blocked or unavailable: Please open your laptop/webcam physical privacy shutter or switch and try again."
        );
      } else if (
        rawMsg.toLowerCase().includes("notallowederror") ||
        rawMsg.toLowerCase().includes("permission")
      ) {
        setErrorMsg(
          "Camera access denied: Please grant camera permission in your browser URL bar."
        );
      } else if (rawMsg.toLowerCase().includes("notfounderror")) {
        setErrorMsg("No camera device was detected on this system.");
      } else {
        setErrorMsg(
          rawMsg || "Failed to initialize camera scanner. You can use Manual ID Lookup below."
        );
      }
    }
  };

  const handleDetectedCode = async (rawCode: string) => {
    const teamId = extractTeamId(rawCode);

    // Validate the extracted ID before querying Supabase UUID columns.
    if (!teamId || !UUID_REGEX.test(teamId)) {
      playScanError();
      setErrorMsg(
        "Invalid QR code: could not extract a valid Team ID from the scanned badge."
      );
      return;
    }

    // SPOC scanner is read-only: load team data for verification only.
    // No claims, distributions, check-ins, or certificate records are created.
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetchTeamMembersForScan(teamId);
      playScanSuccess();
      setTeamData(res);
      setSuccessMsg(
        `Team Verified: "${res.team.name}" (${teamId.slice(0, 8)}...)`
      );
      // Update recent scans (keep up to 3 items: current + two previous)
      setRecentScans((prev) => {
        const filtered = prev.filter((id) => id !== res.team.id);
        const newList = [res.team.id, ...filtered];
        return newList.slice(0, 3);
      });
    } catch (err: unknown) {
      playScanError();
      setErrorMsg(err instanceof Error ? err.message : "Team verification failed");
      setTeamData(null);
    } finally {
      setLoading(false);
    }
  };

  // Manual team lookup (read-only, no bulk actions, no CSRF needed)
  const handleManualLookup = async (teamId: string) => {
    if (!teamId) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await manualTeamLookup(teamId);
      playScanSuccess();
      setTeamData(res);
      setSuccessMsg(`Loaded roster for team "${res.team.name}"`);
      // Update recent scans (keep up to 3 items: current + two previous)
      setRecentScans(prev => {
        const filtered = prev.filter(id => id !== res.team.id);
        const newList = [res.team.id, ...filtered];
        return newList.slice(0, 3);
      });
    } catch (err: unknown) {
      playScanError();
      setErrorMsg(err instanceof Error ? err.message : "Failed to fetch team details");
      setTeamData(null);
    } finally {
      setLoading(false);
    }
  };

  const getLogForAction = (participantId: string, actionType: string) => {
    return teamData?.activityLogs?.find(
      (log) => log.participant_id === participantId && log.action_type === actionType
    );
  };

  // Anti-fraud summary for the active team
  const hasAnyGoodiesClaimed = teamData?.activityLogs?.some((l) => l.action_type === "goodies");
  const firstGoodiesLog = teamData?.activityLogs?.find((l) => l.action_type === "goodies");

useEffect(() => {
      return () => {
        if (html5QrCodeRef.current) {
          try {
            html5QrCodeRef.current.stop();
          } catch {}
        }
      };
    }, []);

    // Scroll to hash sections (e.g., #manual-lookup or #live-activity) when the hash changes or on initial load
    useEffect(() => {
      const scrollToHash = () => {
        if (typeof window === 'undefined') return;
        const { hash } = window.location;
        if (hash) {
          const id = hash.substring(1);
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }
      };
      // Scroll on component mount (in case hash is already present)
      scrollToHash();
      // Listen for future hash changes (e.g., when navigating via sidebar links)
      window.addEventListener('hashchange', scrollToHash);
      return () => {
        window.removeEventListener('hashchange', scrollToHash);
      };
    }, []);

    return (
      <div className="space-y-6">

      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 bg-status-success/15 border border-status-success text-status-success font-tech text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-status-error/15 border border-status-error text-status-error font-tech text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Link to Live Activity Feed (opens in a separate tab/window) */}
      <a
        href="/ops/scanner/live-activity"
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-primary hover:underline text-sm font-bold"
      >
        Live Activity Feed
      </a>
      {/* Scan Purpose Selector - positioned directly above the scanner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4 bg-surface-color/60 border border-border-color p-3 rounded">
        <label
          htmlFor="scan-purpose-select"
          className="font-bold uppercase text-xs text-text-secondary shrink-0"
        >
          Select Scan Purpose
        </label>
        <select
          id="scan-purpose-select"
          value={scanPurpose}
          onChange={(e) => setScanPurpose(e.target.value)}
          className="bg-surface-color border border-border-color p-2 text-xs font-tech text-text-primary outline-none focus:border-accent-secondary rounded w-full sm:w-auto"
        >
          {SCAN_PURPOSES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <span
          className={`text-[10px] text-text-secondary/70 font-mono shrink-0 ${scanPurpose === "verification" ? "text-accent-tertiary" : ""}`}
        >
          {scanPurpose === "verification"
            ? "Read-only verification — no records modified"
            : `Verification: ${SCAN_PURPOSES.find((p) => p.value === scanPurpose)?.label} (read-only)`
          }
        </span>
      </div>
      
      {/* Scan Next Team - resets scanner for next verification */}
      {teamData && (
        <button
          onClick={() => {
            setTeamData(null);
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className="px-5 py-2.5 border border-accent-tertiary rounded text-accent-tertiary font-tech font-bold uppercase text-xs transition-all hover:bg-accent-tertiary/10 flex items-center gap-2"
        >
          <RefreshCw size={14} />
          <span>Scan Next Team</span>
        </button>
      )}
      
{/* Scanner & Manual Lookup Controls */}
         <div>
           <ScannerDesk
             scanning={scanning}
             manualId={manualId}
             loading={loading}
             onStartScanner={startScanner}
             onStopScanner={stopScanner}
             onManualIdChange={setManualId}
             onLookup={(id) => handleDetectedCode(id)}
             onManualLookup={(id) => handleManualLookup(id)}
             recentScans={recentScans}
           />
        </div>

      {/* Scanned Team Roster Panel */}
      {teamData && (
        <div className="glass-panel p-6 border border-accent-tertiary/40 space-y-6 animate-fade-in font-tech">
          {/* Fraud Protection Alert Banner if Goodies already claimed */}
          {hasAnyGoodiesClaimed && firstGoodiesLog && (
            <div className="p-3.5 bg-yellow-500/15 border border-yellow-500/60 text-yellow-300 text-xs flex items-start gap-3 rounded">
              <ShieldAlert size={18} className="text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wider m-0 text-yellow-300">
                  Fraud Guard Alert: Goodies Already Distributed
                </p>
                <p className="text-[11px] text-yellow-200/90 m-0 mt-0.5">
                  This team has already received Goodies from{" "}
                  <strong className="text-white">{firstGoodiesLog.scanner_name || "Club Member"}</strong> at{" "}
                  <span className="font-mono text-white">
                    {new Date(firstGoodiesLog.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  . Duplicate physical distribution is prohibited across all desks.
                </p>
              </div>
            </div>
          )}

          {/* Team Info Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border-color pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-accent-tertiary uppercase font-bold tracking-wider px-2 py-0.5 bg-accent-tertiary/10 border border-accent-tertiary">
                  {teamData.team.track || "GENERAL TRACK"}
                </span>
                {teamData.team.code && (
                  <span className="text-[10px] text-accent-secondary uppercase font-bold px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary font-mono">
                    {teamData.team.code}
                  </span>
                )}
                <span className="text-[10px] text-status-success uppercase font-bold px-2 py-0.5 bg-status-success/10 border border-status-success">
                  Live Synced
                </span>
              </div>
              <h2 className="font-heading text-2xl text-text-primary uppercase m-0 mt-2">
                {teamData.team.name}
              </h2>
              <p className="text-xs text-text-secondary m-0 mt-0.5">
                Leader: <span className="text-text-primary font-bold">{teamData.team.leader_name}</span> | UUID:{" "}
                <span className="font-mono text-text-primary">{teamData.team.id}</span>
              </p>
            </div>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="border-b border-border-color bg-surface-color-light/40 text-text-secondary uppercase tracking-wider">
                <tr>
                  <th className="p-3">Participant</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 text-center">Registration</th>
                  <th className="p-3 text-center">Kit / Goodies</th>
                  <th className="p-3 text-center">Lunch</th>
                  <th className="p-3 text-center">Snacks</th>
                  <th className="p-3 text-center">Certificates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {teamData.members.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-text-secondary italic">
                      No registered members mapped in roster.
                    </td>
                  </tr>
                ) : (
                  teamData.members.map((m: TeamScanMember) => {
                    const regLog = getLogForAction(m.id, "registration");
                    const goodiesLog = getLogForAction(m.id, "goodies");
                    const lunchLogs = teamData.activityLogs.filter(
                      (l) => l.participant_id === m.id && l.action_type === "lunch" && l.result === "success"
                    );
                    const snacksLogs = teamData.activityLogs.filter(
                      (l) => l.participant_id === m.id && l.action_type === "snacks" && l.result === "success"
                    );
                    const certLog = getLogForAction(m.id, "certificates");

                    const statusBadge = (claimed: boolean, label: string, color: "status-success" | "text-text-secondary") => (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        claimed
                          ? "bg-status-success/10 text-status-success border-status-success/40"
                          : "bg-surface-color text-text-secondary border-border-color"
                      }`}>
                        {claimed ? <CheckCircle2 size={11} className={`text-${color === "status-success" ? "status-success" : "text-text-secondary"}`} /> : ""}
                        {label}
                      </span>
                    );

                    return (
                      <tr key={m.id} className="hover:bg-surface-color-light/20 transition-colors">
                        <td className="p-3">
                          <p className="font-heading text-sm text-text-primary uppercase m-0">
                            {m.name || "Member"}
                          </p>
                          <span className="font-mono text-[10px] text-text-secondary">
                            {m.email || m.id.slice(0, 8)}
                          </span>
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 border text-[10px] uppercase font-bold ${
                              m.role === "leader"
                                ? "bg-accent-secondary/15 text-accent-secondary border-accent-secondary"
                                : "bg-surface-color text-text-secondary border-border-color"
                            }`}
                          >
                            {m.role || "Member"}
                          </span>
                        </td>

                        {/* Registration Status (read-only) */}
                        <td className="p-3 text-center">
                          {statusBadge(Boolean(regLog), regLog ? "Checked-In" : "Pending", "status-success")}
                          {regLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              {new Date(regLog.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </td>

                        {/* Goodies Status (read-only) */}
                        <td className="p-3 text-center">
                          {statusBadge(Boolean(goodiesLog), goodiesLog ? "Distributed" : "Pending", "status-success")}
                          {goodiesLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              {new Date(goodiesLog.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </td>

                        {/* Lunch Status (read-only) */}
                        <td className="p-3 text-center">
                          {statusBadge(lunchLogs.length > 0, `${lunchLogs.length}/3`, "status-success")}
                        </td>

                        {/* Snacks Status (read-only) */}
                        <td className="p-3 text-center">
                          {statusBadge(snacksLogs.length > 0, `${snacksLogs.length}/3`, "status-success")}
                        </td>

                        {/* Certificates Status (read-only) */}
                        <td className="p-3 text-center">
                          {statusBadge(Boolean(certLog), certLog ? "Issued" : "Pending", "status-success")}
                          {certLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              {new Date(certLog.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recently Scanned Teams - at the bottom of the ops overview */}
      <RecentlyScannedTeams limit={3} />

    </div>
  );
}
