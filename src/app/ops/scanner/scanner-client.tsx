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
  Users,
  Sparkles,
} from "lucide-react";
import {
  fetchTeamMembersForScan,
  recordMemberAction,
  recordTeamBulkAction,
  getLiveScanActivityStream,
  type LiveActivityFeedItem,
  type EnrichedActivityLog,
} from "@/app/actions/operations";
import type { ActionType } from "@/lib/validations/operations";
import ScannerDesk from "@/components/ops/ScannerDesk";
import LiveActivityStream from "@/components/ops/LiveActivityStream";
import { CSRF_CONSTANTS } from "@/lib/csrf-constants";
import { createClient } from "@/lib/supabase/client";
import { playScanSuccess, playScanError } from "@/lib/feedback-sound";

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

export default function ScannerClientView() {
  const [scanning, setScanning] = useState(false);
  const [manualId, setManualId] = useState("");
  const [teamData, setTeamData] = useState<TeamScanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<string>("registration");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveStreamLogs, setLiveStreamLogs] = useState<LiveActivityFeedItem[]>([]);
  const [streamLoading, setStreamLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
// Initialize last sync timestamp and fetch CSRF token on client mount
useEffect(() => {
  setLastSyncTime(new Date());
  // Fetch CSRF token from server
  void fetch("/api/csrf/init")
    .then((res) => res.json())
    .then((data) => {
      if (data?.token) {
        setCsrfToken(data.token);
      }
    })
    .catch((err) => {
      console.warn("CSRF init fetch failed:", err);
    });
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
    let teamId = rawCode.trim();
    if (teamId.startsWith("{")) {
      try {
        const parsed = JSON.parse(teamId);
        teamId = parsed.team_id || parsed.id || teamId;
      } catch {}
    }

    // If an operation is selected, attempt bulk claim; otherwise just load team data
    const op = selectedOperation;
    const supportedOps = ["registration", "goodies", "lunch", "snacks"];
    if (supportedOps.includes(op)) {
      // Bulk claim for the selected operation
      setActionLoading(`bulk-${op}`);
      setErrorMsg(null);
      try {
        const res = await recordTeamBulkAction(teamId, op as ActionType, csrfToken);
        playScanSuccess();
        setSuccessMsg(
          `Bulk Claim Complete: Distributed "${op.toUpperCase()}" to ${res.claimedCount} members.`
        );
        broadcastScanEvent(teamId, undefined, op as ActionType);
        fetchLiveStream();
        loadTeamData(teamId);
      } catch (err: unknown) {
        playScanError();
        setErrorMsg(err instanceof Error ? err.message : `Bulk ${op} claim failed`);
      } finally {
        setActionLoading(null);
      }
    } else if (op === "feedback") {
      playScanError();
      setErrorMsg("Feedback operation is not supported in Ops scanner.");
    } else {
      // No operation selected or unsupported, just load team roster
      loadTeamData(teamId);
    }
  };

  const loadTeamData = async (teamId: string) => {
    if (!teamId) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetchTeamMembersForScan(teamId);
      playScanSuccess();
      setTeamData(res);
      setSuccessMsg(`Loaded roster for team "${res.team.name}"`);
    } catch (err: unknown) {
      playScanError();
      setErrorMsg(err instanceof Error ? err.message : "Failed to fetch team details");
      setTeamData(null);
    } finally {
      setLoading(false);
    }
  };

  const broadcastScanEvent = (teamId: string, participantId?: string, actionType?: ActionType) => {
    try {
      const supabase = createClient();
      const channel = supabase.channel("ops-realtime-activity");
      channel.send({
        type: "broadcast",
        event: "scan_action_recorded",
        payload: {
          team_id: teamId,
          participant_id: participantId,
          action_type: actionType,
        },
      });
    } catch {}
  };

  const handleActionClick = async (participantId: string, actionType: ActionType) => {
    if (!teamData?.team?.id) return;
    const actionKey = `${participantId}-${actionType}`;
    setErrorMsg(null);
    setActionLoading(actionKey);

    // Optimistic update
    const optimisticLog: EnrichedActivityLog = {
      id: `temp-${Date.now()}`,
      participant_id: participantId,
      action_type: actionType,
      created_at: new Date().toISOString(),
      scanner_name: "You (Just now)",
      scanner_email: "",
    };

    setTeamData((prev) =>
      !prev
        ? null
        : {
            ...prev,
            activityLogs: [...prev.activityLogs, optimisticLog],
          }
    );

    try {
const res = await recordMemberAction({
  team_id: teamData.team.id,
  participant_id: participantId,
  action_type: actionType,
  [CSRF_CONSTANTS.HEADER_NAME]: csrfToken,
});

      playScanSuccess();
      setSuccessMsg(
        `Recorded "${actionType.toUpperCase()}"! Distributed by ${res.record.scanner_name}.`
      );

      // Broadcast to other club members
      broadcastScanEvent(teamData.team.id, participantId, actionType);

      // Refresh live stream & team
      fetchLiveStream();
      loadTeamData(teamData.team.id);
    } catch (err: unknown) {
      playScanError();
      // Revert optimistic update on failure
      setTeamData((prev) =>
        !prev
          ? null
          : {
              ...prev,
              activityLogs: prev.activityLogs.filter(
                (log) => !(log.participant_id === participantId && log.action_type === actionType)
              ),
            }
      );
      setErrorMsg(err instanceof Error ? err.message : "Action claim failed");
      setSuccessMsg(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkActionClick = async (actionType: ActionType) => {
    if (!teamData?.team?.id) return;
    setActionLoading(`bulk-${actionType}`);
    setErrorMsg(null);

    try {
      const res = await recordTeamBulkAction(teamData.team.id, actionType, csrfToken);
      playScanSuccess();
      setSuccessMsg(
        `Bulk Claim Complete: Distributed "${actionType.toUpperCase()}" to ${res.claimedCount} members.`
      );
      broadcastScanEvent(teamData.team.id, undefined, actionType);
      fetchLiveStream();
      loadTeamData(teamData.team.id);
    } catch (err: unknown) {
      playScanError();
      setErrorMsg(err instanceof Error ? err.message : `Bulk ${actionType} claim failed`);
    } finally {
      setActionLoading(null);
    }
  };

  const getLogForAction = (participantId: string, actionType: string) => {
    return teamData?.activityLogs?.find(
      (log) => log.participant_id === participantId && log.action_type === actionType
    );
  };

  const isClaimed = (participantId: string, actionType: string) => {
    return Boolean(getLogForAction(participantId, actionType));
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

      {/* Operation Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4 bg-surface-color/60 border border-border-color p-3 rounded">
        <label htmlFor="operation-select" className="font-bold uppercase text-xs text-text-secondary shrink-0">Select Active Desk / Operation</label>
        <select
          id="operation-select"
          value={selectedOperation}
          onChange={(e) => setSelectedOperation(e.target.value)}
          className="bg-surface-color border border-border-color p-2 text-xs font-tech text-text-primary outline-none focus:border-accent-secondary rounded w-full sm:w-auto"
        >
          <option value="registration">Registration / Check‑In Desk</option>
          <option value="goodies">Goodies / Swag Kit Desk</option>
          <option value="lunch">Lunch Token Desk</option>
          <option value="snacks">Snacks / Refreshments Desk</option>
          <option value="feedback">Feedback Desk</option>
        </select>
      </div>
      
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

            {/* Quick Bulk Distribution Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkActionClick("goodies")}
                disabled={actionLoading === "bulk-goodies" || teamData.members.every((m) => isClaimed(m.id, "goodies"))}
                className="px-3 py-1.5 bg-accent-primary/20 hover:bg-accent-primary hover:text-black border border-accent-primary text-accent-primary font-bold text-xs uppercase flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Claim goodies for all members in one click"
              >
                <Gift size={13} />
                <span>Distribute All Goodies</span>
              </button>

              <button
                onClick={() => handleBulkActionClick("registration")}
                disabled={actionLoading === "bulk-registration" || teamData.members.every((m) => isClaimed(m.id, "registration"))}
                className="px-3 py-1.5 bg-accent-tertiary/20 hover:bg-accent-tertiary hover:text-black border border-accent-tertiary text-accent-tertiary font-bold text-xs uppercase flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserCheck size={13} />
                <span>Check-In All</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-color bg-surface-color-light/40 text-text-secondary uppercase tracking-wider">
                  <th className="p-3">Participant</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 text-center">Registration</th>
                  <th className="p-3 text-center">Goodies / Kit</th>
                  <th className="p-3 text-center">Lunch</th>
                  <th className="p-3 text-center">Snacks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {teamData.members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-text-secondary italic">
                      No registered members mapped in roster.
                    </td>
                  </tr>
                ) : (
                  teamData.members.map((m: TeamScanMember) => {
                    const regLog = getLogForAction(m.id, "registration");
                    const goodiesLog = getLogForAction(m.id, "goodies");
                    const lunchLog = getLogForAction(m.id, "lunch");
                    const snacksLog = getLogForAction(m.id, "snacks");

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

                        {/* Registration Button & Audit info */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleActionClick(m.id, "registration")}
                            disabled={Boolean(regLog) || actionLoading === `${m.id}-registration`}
                            className={`px-3 py-1 text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 mx-auto ${
                              regLog
                                ? "bg-status-success/15 text-status-success border border-status-success cursor-default"
                                : "bg-surface-color hover:bg-accent-tertiary hover:text-black border border-border-color"
                            }`}
                          >
                            <UserCheck size={13} />
                            {regLog ? "Checked-In" : "Check In"}
                          </button>
                          {regLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              By {regLog.scanner_name?.split(" ")[0]} •{" "}
                              {new Date(regLog.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </td>

                        {/* Goodies Button & Audit info */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleActionClick(m.id, "goodies")}
                            disabled={Boolean(goodiesLog) || actionLoading === `${m.id}-goodies`}
                            className={`px-3 py-1 text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 mx-auto ${
                              goodiesLog
                                ? "bg-status-success/15 text-status-success border border-status-success cursor-default"
                                : "bg-surface-color hover:bg-accent-primary hover:text-black border border-border-color"
                            }`}
                          >
                            <Gift size={13} />
                            {goodiesLog ? "Claimed" : "Distribute"}
                          </button>
                          {goodiesLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              By {goodiesLog.scanner_name?.split(" ")[0]} •{" "}
                              {new Date(goodiesLog.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </td>

                        {/* Lunch Button & Audit info */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleActionClick(m.id, "lunch")}
                            disabled={((teamData.activityLogs?.filter(l => l.participant_id === m.id && l.action_type === "lunch").length) || 0) >= 3 || actionLoading === `${m.id}-lunch`}
                            className={`px-3 py-1 text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 mx-auto ${
                              lunchLog
                                ? "bg-status-success/15 text-status-success border border-status-success cursor-default"
                                : "bg-surface-color hover:bg-accent-secondary hover:text-white border border-border-color"
                            }`}
                          >
                            <Utensils size={13} />
                            {lunchLog ? "Claimed" : "Claim"}
                          </button>
                          {lunchLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              By {lunchLog.scanner_name?.split(" ")[0]} •{" "}
                              {new Date(lunchLog.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </td>

                        {/* Snacks Button & Audit info */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleActionClick(m.id, "snacks")}
                            disabled={((teamData.activityLogs?.filter(l => l.participant_id === m.id && l.action_type === "snacks").length) || 0) >= 3 || actionLoading === `${m.id}-snacks`}
                            className={`px-3 py-1 text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 mx-auto ${
                              snacksLog
                                ? "bg-status-success/15 text-status-success border border-status-success cursor-default"
                                : "bg-surface-color hover:bg-yellow-400 hover:text-black border border-border-color"
                            }`}
                          >
                            <Coffee size={13} />
                            {snacksLog ? "Claimed" : "Claim"}
                          </button>
                          {snacksLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              By {snacksLog.scanner_name?.split(" ")[0]} •{" "}
                              {new Date(snacksLog.created_at).toLocaleTimeString([], {
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

      {/* Live Realtime Audit & Activity Feed */}
      <LiveActivityStream
        logs={liveStreamLogs}
        loading={streamLoading}
        onRefresh={fetchLiveStream}
        lastSyncTime={lastSyncTime ?? undefined}
      />
    </div>
  );
}
