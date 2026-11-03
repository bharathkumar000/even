"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  Award,
  Wifi,
  WifiOff,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Camera,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  fetchTeamMembersForScan,
  recordMemberAction,
  recordTeamBulkAction,
  manualTeamLookup,
  getLiveScanActivityStream,
  getRecentlyScannedTeams,
  processAutomatedScan,
  type ProcessScanResult,
  type LiveActivityFeedItem,
  type EnrichedActivityLog,
} from "@/app/actions/operations";
import type { ActionType } from "@/lib/validations/operations";
import { CSRF_CONSTANTS } from "@/lib/csrf-constants";
import ScannerDesk from "@/components/ops/ScannerDesk";
import RecentlyScannedTeams from "@/components/ops/RecentlyScannedTeams";

import { createClient } from "@/lib/supabase/client";
import { playScanSuccess, playScanError } from "@/lib/feedback-sound";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const extractTeamId = (rawCode: string): string => {
  let candidate = rawCode.trim();

  if (candidate.startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        candidate = parsed.team_id ?? parsed.id ?? parsed.teamId ?? candidate;
      }
    } catch {}
  }

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

export interface ScanPurposeOption {
  value: ActionType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
}

export const SCAN_PURPOSES: ScanPurposeOption[] = [
  {
    value: "registration",
    label: "Registration / Check-In",
    description: "Mark attendance & check-in participant/team",
    icon: UserCheck,
  },
  {
    value: "goodies",
    label: "Goodies / Kit Distribution",
    description: "Distribute official kits and merchandise",
    icon: Gift,
  },
  {
    value: "lunch",
    label: "Lunch Claims",
    description: "Record and verify lunch distribution",
    icon: Utensils,
  },
  {
    value: "snacks",
    label: "Snacks / Refreshments",
    description: "Record and verify refreshment claims",
    icon: Coffee,
  },
  {
    value: "certificates",
    label: "Certificates",
    description: "Record and issue participation certificates",
    icon: Award,
  },
];

export interface ScanFeedbackState {
  status: "success" | "already_completed" | "error" | "not_found" | "ineligible";
  title: string;
  message: string;
  actionType: ActionType;
  teamName?: string;
  teamId?: string;
  participantName?: string;
  previousClaim?: {
    time: string;
    operator: string;
  };
  claimedCount?: number;
  totalMembers?: number;
  timestamp: string;
}

export interface OfflineScanQueueItem {
  id: string;
  team_id: string;
  team_name?: string;
  participant_id?: string;
  participant_name?: string;
  action_type: ActionType;
  method: "qr" | "manual";
  is_bulk: boolean;
  correlationId: string;
  timestamp: number;
  scanned_at: string;
  crypto_hash: string;
  retryCount: number;
}

const OFFLINE_QUEUE_KEY = "ivc_eventra_scanner_offline_queue";

function getOfflineQueue(): OfflineScanQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineScanQueueItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("Failed to persist offline scan queue:", err);
  }
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) return true;
  const msg = (err instanceof Error ? err.message : String(err || "")).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("offline") ||
    msg.includes("abort") ||
    msg.includes("timeout") ||
    msg.includes("load failed") ||
    msg.includes("connection")
  );
}

export default function ScannerClientView() {
  const [scanning, setScanning] = useState(false);
  const [manualId, setManualId] = useState("");
  const [teamData, setTeamData] = useState<TeamScanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanPurpose, setScanPurpose] = useState<ActionType>("registration");
  const [scanFeedback, setScanFeedback] = useState<ScanFeedbackState | null>(null);
  const [liveStreamLogs, setLiveStreamLogs] = useState<LiveActivityFeedItem[]>([]);
  const [streamLoading, setStreamLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<string[]>([]);

  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);

  // Network resilience and offline scan queue state
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState<boolean>(false);
  const isSyncingQueueRef = useRef(false);

  // Auto-cooldown to prevent duplicate reads and auto-resume live scanning
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const isProcessingRef = useRef(false);
  const isCoolingDownRef = useRef(false);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const html5QrCodeRef = useRef<any>(null);

  useEffect(() => {
    setLastSyncTime(new Date());
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }
    setOfflineQueueCount(getOfflineQueue().length);

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

  // Fetch live activity audit stream across all operations desks
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

  const flushOfflineQueue = useCallback(async () => {
    if (isSyncingQueueRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const queue = getOfflineQueue();
    if (queue.length === 0) {
      setOfflineQueueCount(0);
      return;
    }

    isSyncingQueueRef.current = true;
    setIsSyncingQueue(true);

    let syncedCount = 0;
    const remainingQueue: OfflineScanQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.is_bulk) {
          await recordTeamBulkAction(item.team_id, item.action_type, csrfToken, {
            method: item.method,
            correlationId: item.correlationId,
          });
        } else if (item.participant_id) {
          await recordMemberAction({
            team_id: item.team_id,
            participant_id: item.participant_id,
            action_type: item.action_type,
            [CSRF_CONSTANTS.HEADER_NAME]: csrfToken,
            method: item.method,
            correlationId: item.correlationId,
          });
        }
        syncedCount++;
      } catch (err: unknown) {
        if (isNetworkError(err)) {
          remainingQueue.push(item);
          const currentIndex = queue.indexOf(item);
          remainingQueue.push(...queue.slice(currentIndex + 1));
          break;
        }
        console.warn(`[OfflineSync] Item ${item.id} resolved or invalid:`, err);
        syncedCount++;
      }
    }

    saveOfflineQueue(remainingQueue);
    setOfflineQueueCount(remainingQueue.length);
    setIsSyncingQueue(false);
    isSyncingQueueRef.current = false;

    if (syncedCount > 0) {
      playScanSuccess();
      fetchLiveStream();
      setTeamData((current) => {
        if (current?.team?.id) {
          fetchTeamMembersForScan(current.team.id)
            .then((updated) => setTeamData(updated))
            .catch(() => {});
        }
        return current;
      });
    }
  }, [csrfToken, fetchLiveStream]);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void flushOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const syncInterval = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const count = getOfflineQueue().length;
        setOfflineQueueCount(count);
        if (count > 0 && !isSyncingQueueRef.current) {
          void flushOfflineQueue();
        }
      }
    }, 8000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(syncInterval);
    };
  }, [flushOfflineQueue]);

  // Real-time synchronization subscription for all operations and team events
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
      .on("broadcast", { event: "scan_action_reverted" }, (payload) => {
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
          // Continuous scanning: ignore incoming camera frames while busy or in cooldown
          if (isProcessingRef.current || isCoolingDownRef.current) return;
          void handleDetectedCode(decodedText);
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
      setScanFeedback({
        status: "error",
        title: "CAMERA ERROR",
        message: rawMsg || "Failed to initialize camera scanner. You can use Manual ID Lookup below.",
        actionType: scanPurpose,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }
  };

  /**
   * Executes the selected operation automatically upon QR detection or manual submission.
   * Confirms database transaction, updates roster, triggers cooldown, and re-arms scanner.
   */
  const handleDetectedCode = async (
    rawCode: string,
    targetParticipantId?: string,
    overrideActionType?: ActionType
  ) => {
    if (isProcessingRef.current || isCoolingDownRef.current) return;
    isProcessingRef.current = true;
    setLoading(true);

    const effectiveActionType = overrideActionType ?? scanPurpose;

    try {
      const res = await processAutomatedScan({
        rawCode,
        actionType: effectiveActionType,
        participantId: targetParticipantId,
        [CSRF_CONSTANTS.HEADER_NAME]: csrfToken,
      });

      const currentPurposeLabel =
        SCAN_PURPOSES.find((p) => p.value === effectiveActionType)?.label ||
        effectiveActionType;

      if (res.status === "success") {
        playScanSuccess();
        setScanFeedback({
          status: "success",
          title: `${res.action_type.toUpperCase()} RECORDED SUCCESSFULLY`,
          message: res.message,
          actionType: res.action_type,
          teamName: res.team?.name,
          teamId: res.team?.id,
          participantName: res.participant?.name,
          claimedCount: res.claimedCount,
          totalMembers: res.totalMembers,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        });
      } else if (res.status === "already_completed") {
        playScanError();
        setScanFeedback({
          status: "already_completed",
          title: res.action_type === "registration" ? "ALREADY REGISTERED" : "ALREADY CLAIMED",
          message: res.message,
          actionType: res.action_type,
          teamName: res.team?.name,
          teamId: res.team?.id,
          participantName: res.participant?.name,
          previousClaim: res.previousClaim,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        });
      } else {
        playScanError();
        setScanFeedback({
          status: res.status || "error",
          title: res.status === "not_found" ? "NOT FOUND" : "SCAN REJECTED",
          message: res.message || res.error || "Operation failed to record in database.",
          actionType: res.action_type || effectiveActionType,
          teamName: res.team?.name,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        });
      }

      if (res.teamData) {
        setTeamData(res.teamData);
      }

      if (res.team?.id) {
        setRecentScans((prev) => {
          const filtered = prev.filter((id) => id !== res.team!.id);
          return [res.team!.id, ...filtered].slice(0, 3);
        });
      }

      fetchLiveStream();
    } catch (err: unknown) {
      playScanError();
      const msg = err instanceof Error ? err.message : "Database transaction failed during scan.";
      setScanFeedback({
        status: "error",
        title: "TRANSACTION FAILED",
        message: msg,
        actionType: scanPurpose,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } finally {
      setLoading(false);
      isProcessingRef.current = false;

      // Start automatic cooldown to resume continuous scanning without stopping camera
      isCoolingDownRef.current = true;
      setIsCoolingDown(true);
      setCooldownSeconds(3);

      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      let remaining = 3;
      cooldownTimerRef.current = setInterval(() => {
        remaining -= 1;
        setCooldownSeconds(remaining);
        if (remaining <= 0) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          isCoolingDownRef.current = false;
          setIsCoolingDown(false);
        }
      }, 1000);
    }
  };

  // Manual team lookup for verification / inspection
  const handleManualLookup = async (teamId: string) => {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await manualTeamLookup(teamId);
      playScanSuccess();
      setTeamData(res);
      setRecentScans((prev) => {
        const filtered = prev.filter((id) => id !== res.team.id);
        return [res.team.id, ...filtered].slice(0, 3);
      });
    } catch (err: unknown) {
      playScanError();
      setScanFeedback({
        status: "error",
        title: "LOOKUP ERROR",
        message: err instanceof Error ? err.message : "Failed to fetch team details",
        actionType: scanPurpose,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setTeamData(null);
    } finally {
      setLoading(false);
    }
  };

  const getLogForAction = (participantId: string, actionType: string) => {
    return teamData?.activityLogs?.find(
      (log) => log.participant_id === participantId && log.action_type === actionType && log.result === "success"
    );
  };

  // Team-level distribution counts for lunch and snacks
  const lunchCount = useMemo(
    () =>
      teamData?.activityLogs?.filter(
        (l) => l.action_type === "lunch" && l.result === "success"
      ).length ?? 0,
    [teamData?.activityLogs]
  );

  const snacksCount = useMemo(
    () =>
      teamData?.activityLogs?.filter(
        (l) => l.action_type === "snacks" && l.result === "success"
      ).length ?? 0,
    [teamData?.activityLogs]
  );

  // Team-level single-member distribution scan (one member per scan for lunch/snacks)
  const handleTeamDistributionScan = async (actionType: "lunch" | "snacks") => {
    if (!teamData?.team?.id) return;
    await handleDetectedCode(teamData.team.id, undefined, actionType);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop();
        } catch {}
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. OPERATION SELECTOR (Determines exactly what happens on scan) */}
      <div className="glass-panel p-4 border border-border-color space-y-3 font-tech">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-border-color pb-3">
          <div>
            <h2 className="font-heading text-lg text-text-primary uppercase m-0 flex items-center gap-2">
              <Sparkles className="text-accent-primary" size={18} />
              Active Operation Mode
            </h2>
            <p className="text-xs text-text-secondary m-0 mt-0.5">
              Select the checkpoint operation. Scanned badges will automatically execute this action and persist to the database.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Wi-Fi Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border transition-colors ${
                isOnline
                  ? "bg-status-success/10 border-status-success/30 text-status-success"
                  : "bg-status-warning/15 border-status-warning/40 text-status-warning animate-pulse"
              }`}
            >
              {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span>{isOnline ? "Venue Wi-Fi Online" : "Offline Cache Ready"}</span>
            </div>

            <a
              href="/ops/scanner/live-activity"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-primary hover:underline text-xs font-bold font-tech"
            >
              Live Feed ↗
            </a>
          </div>
        </div>

        {/* Operation Selector Buttons / Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
          {SCAN_PURPOSES.map((p) => {
            const Icon = p.icon;
            const isSelected = scanPurpose === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setScanPurpose(p.value)}
                className={`p-3 rounded border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? "bg-accent-primary/15 border-accent-primary text-text-primary shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                    : "bg-surface-color/40 border-border-color/60 text-text-secondary hover:border-accent-secondary/50 hover:text-text-primary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon
                    size={18}
                    className={isSelected ? "text-accent-primary" : "text-text-secondary"}
                  />
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
                  )}
                </div>
                <div>
                  <p className="font-heading text-xs uppercase m-0 leading-tight">
                    {p.label}
                  </p>
                  <p className="text-[10px] text-text-secondary/70 m-0 mt-0.5 line-clamp-1">
                    {p.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. TRANSACTION RESULT BANNER (Instant, High-Visibility Feedback) */}
      {scanFeedback && (
        <div
          className={`p-5 rounded-lg border font-tech transition-all animate-fade-in ${
            scanFeedback.status === "success"
              ? "bg-status-success/15 border-status-success text-status-success shadow-[0_0_25px_rgba(0,255,157,0.15)]"
              : scanFeedback.status === "already_completed"
              ? "bg-yellow-500/15 border-yellow-500 text-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.15)]"
              : "bg-status-error/15 border-status-error text-status-error shadow-[0_0_25px_rgba(255,59,48,0.15)]"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              {scanFeedback.status === "success" ? (
                <CheckCircle2 size={26} className="text-status-success shrink-0 mt-0.5" />
              ) : scanFeedback.status === "already_completed" ? (
                <AlertCircle size={26} className="text-yellow-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert size={26} className="text-status-error shrink-0 mt-0.5" />
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-heading text-base uppercase tracking-wider m-0">
                    {scanFeedback.title}
                  </h3>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-current opacity-80">
                    {scanFeedback.actionType}
                  </span>
                  <span className="text-[10px] font-mono opacity-60">
                    {scanFeedback.timestamp}
                  </span>
                </div>

                <p className="text-sm font-bold m-0 text-white">
                  {scanFeedback.message}
                </p>

                {/* Previous Claim Attribution Details for duplicates */}
                {scanFeedback.previousClaim && (
                  <div className="p-2.5 bg-black/40 border border-yellow-500/30 rounded text-xs space-y-0.5 mt-2">
                    <p className="text-yellow-200/90 m-0">
                      <strong>Prior Claim Timestamp:</strong>{" "}
                      <span className="font-mono text-white">{scanFeedback.previousClaim.time}</span>
                    </p>
                    <p className="text-yellow-200/90 m-0">
                      <strong>Recorded By:</strong>{" "}
                      <span className="text-white">{scanFeedback.previousClaim.operator}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setScanFeedback(null)}
                className="text-text-secondary hover:text-white transition-colors"
                title="Dismiss"
              >
                <X size={16} />
              </button>

              {/* Live Cooldown & Next Scan Ready Indicator */}
              {isCoolingDown && (
                <div className="px-2.5 py-1 bg-black/60 border border-current rounded text-[10px] font-mono flex items-center gap-1.5 animate-pulse">
                  <Clock size={11} />
                  <span>Next scan in {cooldownSeconds}s</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. CAMERA SCANNER & MANUAL LOOKUP WORKSPACE */}
      <div>
        <ScannerDesk
          scanning={scanning}
          manualId={manualId}
          loading={loading}
          onStartScanner={startScanner}
          onStopScanner={stopScanner}
          onManualIdChange={setManualId}
          onLookup={(id) => handleDetectedCode(id)}
          onManualLookup={(id) => handleDetectedCode(id)}
          recentScans={recentScans}
        />
      </div>

      {/* 4. SCANNED TEAM ROSTER PANEL WITH 1-TAP INDIVIDUAL PARTICIPANT ACTIONS */}
      {teamData && (
        <div className="glass-panel p-6 border border-accent-primary/40 space-y-6 animate-fade-in font-tech">
          {/* Team Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border-color pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-accent-primary uppercase font-bold tracking-wider px-2 py-0.5 bg-accent-primary/10 border border-accent-primary">
                  {teamData.team.track || "GENERAL TRACK"}
                </span>
                {teamData.team.code && (
                  <span className="text-[10px] text-accent-secondary uppercase font-bold px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary font-mono">
                    {teamData.team.code}
                  </span>
                )}
                <span className="text-[10px] text-status-success uppercase font-bold px-2 py-0.5 bg-status-success/10 border border-status-success flex items-center gap-1">
                  <CheckCircle2 size={11} /> Live Synchronized
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

            <button
              onClick={() => {
                setTeamData(null);
                setScanFeedback(null);
              }}
              className="px-4 py-2 border border-border-color hover:border-accent-primary rounded text-text-secondary hover:text-text-primary font-tech uppercase text-xs transition-all flex items-center gap-2 self-start lg:self-center"
            >
              <RefreshCw size={13} />
              <span>Clear / Ready Next</span>
            </button>
          </div>

          {/* Team Distribution Progress: Lunch & Snacks */}
          <div className="border border-border-color rounded-lg bg-surface-color/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-sm text-text-primary uppercase m-0 tracking-wider flex items-center gap-2">
                <Users size={14} className="text-accent-primary" />
                Team Distribution Progress
              </h3>
              <span className="text-[10px] font-mono text-text-secondary">
                {teamData.members.length} member(s)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Lunch Progress */}
              <div className="border border-border-color rounded p-3 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-status-warning" />
                    <span className="font-heading text-xs text-text-primary uppercase m-0">Lunch</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-text-primary">
                    {lunchCount}/3
                  </span>
                </div>
                <div className="w-full bg-surface-color border border-border-color rounded h-2 overflow-hidden">
                  <div
                    className={`h-full bg-status-warning transition-all duration-300 ${lunchCount >= 3 ? "bg-status-error" : ""}`}
                    style={{ width: `${Math.min((lunchCount / 3) * 100, 100)}%` }}
                  />
                </div>
                <button
                  onClick={() => handleTeamDistributionScan("lunch")}
                  disabled={loading || isCoolingDown || lunchCount >= 3}
                  className={`mt-2 w-full py-1.5 text-[10px] font-bold uppercase rounded transition-all flex items-center justify-center gap-1.5 ${
                    lunchCount >= 3
                      ? "bg-status-error/20 border border-status-error/40 text-status-error disabled:opacity-100 cursor-not-allowed"
                      : "bg-surface-color-light border border-accent-secondary text-accent-secondary hover:bg-accent-secondary/10 disabled:opacity-50"
                  }`}
                >
                  {lunchCount >= 3 ? (
                    <>
                      <X size={11} className="mr-1" />
                      <span>Lunch Complete (3/3)</span>
                    </>
                  ) : (
                    <>
                      <Utensils size={11} className="mr-1" />
                      <span>Scan Lunch</span>
                    </>
                  )}
                </button>
              </div>

              {/* Snacks Progress */}
              <div className="border border-border-color rounded p-3 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-accent-secondary" />
                    <span className="font-heading text-xs text-text-primary uppercase m-0">Snacks</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-text-primary">
                    {snacksCount}/3
                  </span>
                </div>
                <div className="w-full bg-surface-color border border-border-color rounded h-2 overflow-hidden">
                  <div
                    className={`h-full bg-accent-secondary transition-all duration-300 ${snacksCount >= 3 ? "bg-status-error" : ""}`}
                    style={{ width: `${Math.min((snacksCount / 3) * 100, 100)}%` }}
                  />
                </div>
                <button
                  onClick={() => handleTeamDistributionScan("snacks")}
                  disabled={loading || isCoolingDown || snacksCount >= 3}
                  className={`mt-2 w-full py-1.5 text-[10px] font-bold uppercase rounded transition-all flex items-center justify-center gap-1.5 ${
                    snacksCount >= 3
                      ? "bg-status-error/20 border border-status-error/40 text-status-error disabled:opacity-100 cursor-not-allowed"
                      : "bg-surface-color-light border border-accent-secondary text-accent-secondary hover:bg-accent-secondary/10 disabled:opacity-50"
                  }`}
                >
                  {snacksCount >= 3 ? (
                    <>
                      <X size={11} className="mr-1" />
                      <span>Snacks Complete (3/3)</span>
                    </>
                  ) : (
                    <>
                      <Coffee size={11} className="mr-1" />
                      <span>Scan Snacks</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {(lunchCount >= 3 || snacksCount >= 3) && (
              <div className="mt-3 p-2.5 bg-surface-color border border-border-color rounded text-[10px] font-mono text-text-secondary flex items-center gap-2">
                <AlertCircle size={12} className="text-text-secondary" />
                <span>
                  {lunchCount >= 3 && snacksCount >= 3
                    ? "All distributions complete for this team."
                    : lunchCount >= 3
                    ? "Lunch limit reached (3/3). Snacks still available."
                    : "Snacks limit reached (3/3). Lunch still available."}
              </span>
              </div>
            )}
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
                  <th className="p-3 text-right">Individual Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {teamData.members.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-text-secondary italic">
                      No registered members mapped in roster.
                    </td>
                  </tr>
                ) : (
                  teamData.members.map((m: TeamScanMember) => {
                    const participantId = m.user_id || m.id;
                    const regLog = getLogForAction(participantId, "registration");
                    const goodiesLog = getLogForAction(participantId, "goodies");
                    const lunchLog = getLogForAction(participantId, "lunch");
                    const snacksLog = getLogForAction(participantId, "snacks");
                    const certLog = getLogForAction(participantId, "certificates");

                    const currentLog = getLogForAction(participantId, scanPurpose);

                    const statusBadge = (
                      claimed: boolean,
                      label: string,
                      logItem?: EnrichedActivityLog
                    ) => (
                      <div className="flex flex-col items-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1 ${
                            claimed
                              ? "bg-status-success/15 text-status-success border-status-success/40"
                              : "bg-surface-color text-text-secondary border-border-color"
                          }`}
                        >
                          {claimed && <CheckCircle2 size={10} />}
                          {label}
                        </span>
                        {logItem && (
                          <span className="text-[9px] text-text-secondary font-mono mt-0.5">
                            {new Date(logItem.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
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

                        <td className="p-3 text-center">
                          {statusBadge(Boolean(regLog), regLog ? "Checked-In" : "Pending", regLog)}
                        </td>

                        <td className="p-3 text-center">
                          {statusBadge(Boolean(goodiesLog), goodiesLog ? "Claimed" : "Pending", goodiesLog)}
                        </td>

                        <td className="p-3 text-center">
                          {statusBadge(Boolean(lunchLog), lunchLog ? "Claimed" : "Pending", lunchLog)}
                        </td>

                        <td className="p-3 text-center">
                          {statusBadge(Boolean(snacksLog), snacksLog ? "Claimed" : "Pending", snacksLog)}
                        </td>

                        <td className="p-3 text-center">
                          {statusBadge(Boolean(certLog), certLog ? "Issued" : "Pending", certLog)}
                        </td>

                        {/* Individual Participant 1-Tap Action Button */}
                        <td className="p-3 text-right">
                          {currentLog ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase border bg-status-success/15 text-status-success border-status-success/40 font-mono">
                              <CheckCircle2 size={11} /> Recorded
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDetectedCode(teamData.team.id, participantId)}
                              disabled={loading || isCoolingDown}
                              className="px-3 py-1 bg-accent-primary hover:bg-accent-primary/80 text-black text-[10px] font-bold uppercase rounded font-tech transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {scanPurpose === "registration" ? "Check In" : `Claim ${scanPurpose}`}
                            </button>
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

      {/* 5. RECENTLY SCANNED TEAMS AUDIT FEED */}
      <RecentlyScannedTeams limit={3} />
    </div>
  );
}
