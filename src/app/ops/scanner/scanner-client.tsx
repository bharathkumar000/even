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
  Shield,
  Monitor,
} from "lucide-react";
import {
  fetchTeamMembersForScan,
  recordMemberAction,
  recordTeamBulkAction,
  manualTeamLookup,
  searchTeams,
  getLiveScanActivityStream,
  getRecentlyScannedTeams,
  processAutomatedScan,
  getDeskProgressSummary,
  type ProcessScanResult,
  type LiveActivityFeedItem,
  type EnrichedActivityLog,
  type DeskProgressSummary,
} from "@/app/actions/operations";
import type { ActionType } from "@/lib/validations/operations";
import { HapticFeedback } from "@/lib/haptic";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { CSRF_CONSTANTS } from "@/lib/csrf-constants";
import ScannerDesk from "@/components/ops/ScannerDesk";
import RecentlyScannedTeams from "@/components/ops/RecentlyScannedTeams";

import { createClient } from "@/lib/supabase/client";
import { playScanSuccess, playScanError } from "@/lib/feedback-sound";

import {
  loadRelaythonRegistryCache,
  lookupTokenLocally,
  mergeSingleTeamIntoCache,
} from "@/lib/relaython/cache";
import type { LocalScanRecord } from "@/lib/relaython/storage";
import {
  recordLocalScan,
  getLocalScanCount,
  getScanStats,
  getScans,
  updateScanSyncStatus,
  incrementScanAttempts,
  RELAYTHON_LIMITS,
} from "@/lib/relaython/storage";

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
    } catch { }
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
    value: "lunch_relaython",
    label: "Relaython Lunch",
    description: "Record Relaython lunch distribution (routes by token type)",
    icon: Utensils,
  },
  {
    value: "snacks",
    label: "Snacks / Refreshments",
    description: "Record and verify refreshment claims",
    icon: Coffee,
  },
  {
    value: "snacks_1",
    label: "Relaython Snacks 1",
    description: "Record Relaython first snack distribution",
    icon: Coffee,
  },
  {
    value: "snacks_2",
    label: "Relaython Snacks 2",
    description: "Record Relaython second snack distribution",
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
  status: "success" | "already_completed" | "error" | "not_found" | "ineligible" | "limit_reached";
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
  sheetsSyncStatus?: "pending" | "synced" | "failed";
  sheetsSyncMessage?: string;
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

  // Event mode: "relaython" (default for current event) or "legacy"
  const [eventMode, setEventMode] = useState<"relaython" | "legacy">("relaython");

  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);

  // Network resilience and offline scan queue state
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState<boolean>(false);
  const isSyncingQueueRef = useRef(false);

  // Continuous Multi-QR Scanning Engine
  // Smart per-badge deduplication allows scanning new codes immediately with 0s cooldown
  const [continuousScanCount, setContinuousScanCount] = useState<number>(0);
  const isProcessingRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScanEndTimeRef = useRef<number>(0);
  const processingSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const html5QrCodeRef = useRef<any>(null);
  const scanPurposeRef = useRef<ActionType>(scanPurpose);
  const isPollingRef = useRef(false);
  const [progressSummary, setProgressSummary] = useState<DeskProgressSummary | null>(null);

  // Two-second scan pause after each processed QR scan.
  const scanPauseRef = useRef<boolean>(false);
  const scanPauseEndTimeRef = useRef<number>(0);
  const lastScanResultRef = useRef<{ teamName: string; teamId: string; status: string; message: string } | null>(null);
  const [scanPauseActive, setScanPauseActive] = useState<boolean>(false);
  const [scanPauseSeconds, setScanPauseSeconds] = useState<number>(0);

  // Filtered operation cards based on event mode.
  // Relaython mode: only Registration / Check-In is shown.
  // Legacy Eventra mode: all original operations are shown.
  const filteredScanPurposes = useMemo(() => {
    if (eventMode === "relaython") {
      return SCAN_PURPOSES.filter((p) => p.value === "registration");
    }
    return SCAN_PURPOSES;
  }, [eventMode]);

  useEffect(() => {
    scanPurposeRef.current = scanPurpose;
  }, [scanPurpose]);

  useEffect(() => {
    setLastSyncTime(new Date());
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }
    setOfflineQueueCount(getOfflineQueue().length);

    void getDeskProgressSummary().then(setProgressSummary).catch(() => { });

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
      const [streamData, summary] = await Promise.all([
        getLiveScanActivityStream(35),
        getDeskProgressSummary().catch(() => null),
      ]);
      setLiveStreamLogs(streamData);
      if (summary) setProgressSummary(summary);
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
      if (teamData?.team?.id && !isPollingRef.current) {
        isPollingRef.current = true;
        fetchTeamMembersForScan(teamData.team.id)
          .then((updated) => {
            setTeamData(updated);
            isPollingRef.current = false;
          })
          .catch(() => {
            isPollingRef.current = false;
          });
      }
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
          if (changedTeamId && teamData?.team?.id === changedTeamId) {
            if (!isPollingRef.current) {
              isPollingRef.current = true;
              fetchTeamMembersForScan(changedTeamId)
                .then((updated) => {
                  setTeamData(updated);
                  isPollingRef.current = false;
                })
                .catch(() => {
                  isPollingRef.current = false;
                });
            }
          }
        }
      )
      .on("broadcast", { event: "scan_action_recorded" }, (payload) => {
        fetchLiveStream();
        const changedTeamId = payload?.payload?.team_id;
        if (changedTeamId && teamData?.team?.id === changedTeamId) {
          if (!isPollingRef.current) {
            isPollingRef.current = true;
            fetchTeamMembersForScan(changedTeamId)
              .then((updated) => {
                setTeamData(updated);
                isPollingRef.current = false;
              })
              .catch(() => {
                isPollingRef.current = false;
              });
          }
        }
      })
      .on("broadcast", { event: "scan_action_reverted" }, (payload) => {
        fetchLiveStream();
        const changedTeamId = payload?.payload?.team_id;
        if (changedTeamId && teamData?.team?.id === changedTeamId) {
          if (!isPollingRef.current) {
            isPollingRef.current = true;
            fetchTeamMembersForScan(changedTeamId)
              .then((updated) => {
                setTeamData(updated);
                isPollingRef.current = false;
              })
              .catch(() => {
                isPollingRef.current = false;
              });
          }
        }
      })
      .subscribe();

    // Event-driven refresh: when staff returns to tab or window gains focus
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchLiveStream();
      }
    };
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    // Relaxed 60s fallback sync (instead of aggressive 4s polling) to prevent DB CPU spikes
    const gentleFallbackInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchLiveStream();
      }
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      clearInterval(gentleFallbackInterval);
    };
  }, [teamData?.team?.id, fetchLiveStream]);

  const stopScanner = useCallback(async () => {
    try {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        try {
          html5QrCodeRef.current.clear();
        } catch { }
        html5QrCodeRef.current = null;
      }
    } catch (err) {
      console.warn("Camera stop error:", err);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleClearBadgeLock = useCallback(() => {
    lastScannedCodeRef.current = null;
    lastScanEndTimeRef.current = 0;
  }, []);

  const handleScanPurposeChange = useCallback((newPurpose: ActionType) => {
    setScanPurpose(newPurpose);
    // Reset badge deduplication cache when changing operation mode so any badge can scan immediately
    lastScannedCodeRef.current = null;
    lastScanEndTimeRef.current = 0;
  }, []);

  const handleEventModeChange = useCallback((newMode: "relaython" | "legacy") => {
    setEventMode(newMode);
    // When switching modes, reset to registration and clear badge lock
    setScanPurpose("registration");
    lastScannedCodeRef.current = null;
    lastScanEndTimeRef.current = 0;
    setScanFeedback(null);
    setTeamData(null);
  }, []);

  // Activate the two-second scan pause after a QR has been processed.
  // Freezes QR detection while keeping the camera preview visible.
  const activateScanPause = useCallback((rawCode: string) => {
    const tokenMatch = rawCode.match(/ryt_[a-f0-9]{32,}/i);
    const token = tokenMatch?.[0] || rawCode;

    scanPauseRef.current = true;
    scanPauseEndTimeRef.current = Date.now() + 2000;
    setScanPauseActive(true);
    setScanPauseSeconds(2);

    // Store the last scan result for display during the pause.
    const feedback = scanFeedback;
    if (feedback) {
      lastScanResultRef.current = {
        teamName: feedback.teamName || "Unknown",
        teamId: feedback.teamId || "Unknown",
        status: feedback.status,
        message: feedback.message,
      };
    }

    // Countdown timer for the pause display.
    let secondsRemaining = 2;
    const countdown = setInterval(() => {
      secondsRemaining -= 1;
      setScanPauseSeconds(secondsRemaining);
      if (secondsRemaining <= 0) {
        clearInterval(countdown);
        scanPauseRef.current = false;
        setScanPauseActive(false);
        setScanPauseSeconds(0);
      }
    }, 1000);
  }, [scanFeedback]);

  const startScanner = useCallback(async () => {
    try {
      await stopScanner();

      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-container");
      html5QrCodeRef.current = scanner;

      const scanConfig = {
        fps: 15, // Responsive 15fps frame capture
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(200, Math.floor(minEdge * 0.75));
          return { width: size, height: size };
        },
      };

      const onScanSuccess = (decodedText: string) => {
        if (!decodedText || isProcessingRef.current) return;

        // Two-second scan pause: freeze QR detection while displaying result.
        if (scanPauseRef.current) {
          const now = Date.now();
          if (now < scanPauseEndTimeRef.current) {
            return; // Still in pause — ignore QR frames.
          }
          // Pause expired — clear and allow scanning.
          scanPauseRef.current = false;
          setScanPauseActive(false);
          setScanPauseSeconds(0);
        }

        const now = Date.now();
        const candidateId = extractTeamId(decodedText) || decodedText.trim();
        const lastId = lastScannedCodeRef.current;

        // 1. Same-badge deduplication:
        // If the exact same QR badge is still in front of the camera, ignore duplicate frames
        // for 3.5s so it won't loop "ALREADY REGISTERED" errors while the participant is lowering their phone.
        if (lastId && (decodedText === lastId || candidateId === lastId)) {
          if (now - lastScannedTimeRef.current < 3500) {
            return;
          }
        }

        // 2. Different / Next badge in queue:
        // Ultra-low 250ms guard after previous scan finishes allows instant continuous multi-scanning!
        if (now - lastScanEndTimeRef.current < 250) {
          return;
        }

        void handleDetectedCode(decodedText);
      };

      try {
        await scanner.start(
          { facingMode: "environment" },
          scanConfig,
          onScanSuccess,
          () => { }
        );
      } catch (camErr) {
        console.warn("Back camera unavailable, attempting default camera:", camErr);
        await scanner.start(
          { facingMode: "user" },
          scanConfig,
          onScanSuccess,
          () => { }
        );
      }
      setScanning(true);
    } catch (err: unknown) {
      console.error("Scanner start failure:", err);
      try {
        if (html5QrCodeRef.current) {
          html5QrCodeRef.current.clear();
        }
      } catch { }
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
  }, [stopScanner, scanPurpose, eventMode]);

  // Relaython Registration — local-first, Google Sheets sync, never calls Supabase RPC.
  // Required flow:
  //   1. Extract ryt_ token from QR code
  //   2. Match against local registry cache
  //   3. Cache miss → authenticated Google Sheets fallback lookup
  //   4. Check for existing local registration (idempotency via scan_id)
  //   5. Save durably in IndexedDB
  //   6. Immediately trigger Google Sheets sync (non-blocking)
  //   7. Preserve pending local record until Sheets confirms
  const handleRelaythonRegistration = useCallback(async (
    rawCode: string,
  ) => {
    // 1. Extract the full ryt_ token
    const tokenMatch = rawCode.match(/ryt_[a-f0-9]{32,}/i);
    const token = tokenMatch?.[0];
    if (!token) {
      isProcessingRef.current = false;
      setLoading(false);
      setScanFeedback({
        status: "error",
        title: "INVALID TOKEN",
        message: "Unable to extract Relaython token from QR code.",
        actionType: "registration",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      return;
    }

    // 2. Match against locally cached Relaython registry
    let teamEntry = lookupTokenLocally(token);

    // 2b. If cache is expired/empty, reload from backend before falling back to Sheets
    if (!teamEntry) {
      try {
        await loadRelaythonRegistryCache();
        teamEntry = lookupTokenLocally(token);
      } catch {
        // Cache reload failed — proceed to Sheets fallback below
      }
    }

    // 3. Cache miss → authenticated Google Sheets fallback lookup
    if (!teamEntry) {
      try {
        const res = await fetch("/api/relaython/sheets-lookup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [CSRF_CONSTANTS.HEADER_NAME]: csrfToken || "",
          },
          body: JSON.stringify({ qr_token: token }),
        });

        if (!res.ok) {
          throw new Error(`Sheets lookup HTTP ${res.status}`);
        }

        const result = await res.json();

        if (result.found && result.team_code) {
          // Merge into local cache so future scans hit locally
          try {
            await mergeSingleTeamIntoCache({
              team_code: result.team_code,
              team_name: result.team_name || "",
              leader_name: result.leader_name || "",
              domain: result.domain || "",
              qr_token: result.qr_token || token,
            });
          } catch { }

          teamEntry = {
            team_code: result.team_code,
            team_name: result.team_name || "",
            leader_name: result.leader_name || "",
            domain: result.domain || "",
            qr_token: result.qr_token || token,
          };
        } else {
          isProcessingRef.current = false;
          setLoading(false);
          setScanFeedback({
            status: "not_found",
            title: "NOT FOUND",
            message: "Unrecognized QR code: No registered Relaython team matched in local registry or Google Sheets.",
            actionType: "registration",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
          return;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Lookup failed";
        isProcessingRef.current = false;
        setLoading(false);
        setScanFeedback({
          status: "error",
          title: "LOOKUP TEMPORARILY UNAVAILABLE",
          message: `Local registry miss and Google Sheets lookup failed: ${msg}. Try again when online.`,
          actionType: "registration",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        return;
      }
    }

    if (!teamEntry) {
      isProcessingRef.current = false;
      setLoading(false);
      setScanFeedback({
        status: "not_found",
        title: "NOT FOUND",
        message: "Unrecognized QR code: No registered Relaython team matched.",
        actionType: "registration",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      return;
    }

    // 4. Check for an existing pending local registration (reuse scan_id if found).
    //    Google Sheets is the authoritative source for registration status —
    //    never return ALREADY REGISTERED based solely on IndexedDB.
    let reuseScanId: string | null = null;
    try {
      const allScans = await getScans({ sync_status: undefined });
      const teamScans = allScans.filter(
        (r: LocalScanRecord) => r.team_code === teamEntry.team_code && r.action_type === "registration"
      );

      const pendingScan = teamScans.find((r: LocalScanRecord) => r.sync_status === "pending");
      if (pendingScan) {
        reuseScanId = pendingScan.scan_id;
      }
    } catch {
      // If reading pending scans fails, proceed to create a new record.
    }

    // 5. Save durably in IndexedDB (or reuse existing pending record).
    let localRecord: any;
    try {
      if (reuseScanId) {
        localRecord = {
          scan_id: reuseScanId,
          team_code: teamEntry.team_code,
          qr_token_ref: token.slice(-8),
          action_type: "registration",
          operator_id: "spoc-user",
          operator_name: "SPOC Operator",
          device_id: "rescan-device",
          scanned_at: new Date().toISOString(),
          local_sequence_number: 1,
          sync_status: "pending",
          sync_attempts: 0,
          last_sync_error: null,
          server_acknowledged_at: null,
        };
      } else {
        localRecord = await recordLocalScan({
          teamCode: teamEntry.team_code,
          qrToken: token,
          actionType: "registration",
          operatorId: "spoc-user",
          operatorName: "SPOC Operator",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Local scan recording failed";
      isProcessingRef.current = false;
      setLoading(false);
      setScanFeedback({
        status: "error",
        title: "LOCAL STORAGE UNAVAILABLE",
        message: `IndexedDB failed: ${msg}. Registration not saved — please retry.`,
        actionType: "registration",
        teamName: teamEntry.team_name,
        teamId: teamEntry.team_code,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      return;
    }

    // 6. Immediately trigger Google Sheets sync (non-blocking, camera keeps running)
    void (async () => {
      try {
        const res = await fetch("/api/relaython/sheets-sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [CSRF_CONSTANTS.HEADER_NAME]: csrfToken || "",
          },
          body: JSON.stringify({
            scans: [
              {
                scan_id: localRecord.scan_id,
                team_code: teamEntry.team_code,
                qr_token_ref: token.slice(-8),
                action_type: "registration",
                operator_id: localRecord.operator_id,
                operator_name: localRecord.operator_name,
                device_id: localRecord.device_id,
                scanned_at: localRecord.scanned_at,
                local_sequence_number: localRecord.local_sequence_number,
              },
            ],
          }),
        });

        if (!res.ok) {
          throw new Error(`Sheets sync HTTP ${res.status}`);
        }

        const result = await res.json();
        const recordResult = result.results?.[0];

        if (recordResult?.status === "synced") {
          // Column L was blank — APPROVED was written by Apps Script.
          try {
            await updateScanSyncStatus(localRecord.scan_id, "synced", null, new Date().toISOString());
          } catch { }
          setScanFeedback((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: "success",
              title: "REGISTRATION CONFIRMED — GOOGLE SHEETS UPDATED",
              message: `Registration for "${teamEntry.team_name}" (${teamEntry.team_code}) confirmed — Column L APPROVED in Google Sheets.`,
              sheetsSyncStatus: "synced",
              sheetsSyncMessage: "Google Sheets confirmed — Column L APPROVED.",
            };
          });
        } else if (recordResult?.status === "already_approved") {
          // Column L was already APPROVED — Sheets is authoritative.
          try {
            await updateScanSyncStatus(localRecord.scan_id, "synced", null, new Date().toISOString());
          } catch { }
          setScanFeedback((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: "already_completed",
              title: "ALREADY REGISTERED — SHEETS CONFIRMED",
              message: `Team "${teamEntry.team_name}" (${teamEntry.team_code}) is already registered — Column L APPROVED in Google Sheets.`,
              sheetsSyncStatus: "synced",
              sheetsSyncMessage: "Google Sheets confirmed — Column L already APPROVED.",
            };
          });
        } else if (recordResult?.status === "deferred") {
          try {
            await updateScanSyncStatus(localRecord.scan_id, "synced");
          } catch { }
        } else {
          throw new Error(recordResult?.error || "Sheets sync returned unexpected status");
        }
      } catch (syncErr: unknown) {
        const syncMsg = syncErr instanceof Error ? syncErr.message : "Sheets sync failed";
        // Record stays PENDING in IndexedDB; reconnect retry will pick it up.
        // Camera keeps operating — never block scanning on Sheets failure.
        try {
          await incrementScanAttempts(localRecord.scan_id);
        } catch { }
        console.warn("[Relaython] Sheets sync deferred for scan", localRecord.scan_id, syncMsg);
        setScanFeedback((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sheetsSyncStatus: "failed",
            sheetsSyncMessage: `Sync failed — ${syncMsg}. Record retained for retry.`,
          };
        });
      }
    })();

    // 7. Show LOCAL SAVED — registration is durable locally even if Sheets is pending
    const now = new Date().toISOString();
    lastScannedCodeRef.current = token;
    lastScannedTimeRef.current = Date.now();
    setContinuousScanCount((c) => c + 1);

    setScanFeedback({
      status: "success",
      title: "REGISTRATION RECORDED",
      message: `LOCAL SAVED: Registration #${localRecord.local_sequence_number} for "${teamEntry.team_name}" — syncing to Google Sheets...`,
      actionType: "registration",
      teamName: teamEntry.team_name,
      teamId: teamEntry.team_code,
      claimedCount: localRecord.local_sequence_number,
      totalMembers: RELAYTHON_LIMITS.registration,
      sheetsSyncStatus: "pending",
      sheetsSyncMessage: "Sending to Google Sheets...",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setProgressSummary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checkedInTeams: prev.checkedInTeams + 1,
      };
    });

    try {
      const stats = await getScanStats();
      setPendingSyncCount(stats.unsynced);
      setOfflineQueueCount(stats.unsynced);
    } catch { }

    if (processingSafetyTimeoutRef.current) clearTimeout(processingSafetyTimeoutRef.current);
    setLoading(false);
    isProcessingRef.current = false;
    lastScanEndTimeRef.current = Date.now();
  }, [csrfToken]);

  /**
   * Executes the selected operation automatically upon QR detection or manual submission.
   * Confirms database transaction, updates roster, and immediately re-arms scanner for continuous multi-scanning.
   */
  const handleDetectedCode = useCallback(async (
    rawCode: string,
    targetParticipantId?: string,
    overrideActionType?: ActionType
  ) => {
    if (!rawCode || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setLoading(true);

    // Mode enforcement: Relaython mode only accepts ryt_ tokens; Legacy mode only accepts UUID badges.
    const isRelaythonToken = /ryt_[a-f0-9]{32,}/i.test(rawCode);
    if (eventMode === "relaython" && !isRelaythonToken) {
      isProcessingRef.current = false;
      setLoading(false);
      setScanFeedback({
        status: "error",
        title: "WRONG EVENT MODE",
        message: "Legacy UUID badge detected. Switch to Legacy Eventra mode to process this badge.",
        actionType: scanPurposeRef.current,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      return;
    }
    if (eventMode === "legacy" && isRelaythonToken) {
      isProcessingRef.current = false;
      setLoading(false);
      setScanFeedback({
        status: "error",
        title: "WRONG EVENT MODE",
        message: "Relaython QR token detected. Switch to Relaython mode to process this badge.",
        actionType: scanPurposeRef.current,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      return;
    }

    // Watchdog safety timeout: prevent scanner from freezing if network hangs
    if (processingSafetyTimeoutRef.current) clearTimeout(processingSafetyTimeoutRef.current);
    processingSafetyTimeoutRef.current = setTimeout(() => {
      isProcessingRef.current = false;
      setLoading(false);
    }, 10000);

    const effectiveActionType = overrideActionType ?? scanPurposeRef.current;
    const candidateId = extractTeamId(rawCode) || rawCode.trim();

    // Relaython Registration never calls Supabase RPC — use local-first flow instead.
    if (eventMode === "relaython" && effectiveActionType === "registration") {
      await handleRelaythonRegistration(rawCode);
      activateScanPause(rawCode);
      return;
    }

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
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([80, 40, 80]);
        }
        setContinuousScanCount((c) => c + 1);

        // Smart deduplication: cache this badge so holding it won't re-trigger duplicate scans
        lastScannedCodeRef.current = candidateId;
        lastScannedTimeRef.current = Date.now();

        // Increment in-memory Desk Progress HUD counters in 0ms without hitting database
        setProgressSummary((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            checkedInTeams:
              res.action_type === "registration" ? prev.checkedInTeams + 1 : prev.checkedInTeams,
            lunchClaimedCount:
              res.action_type === "lunch" ? prev.lunchClaimedCount + 1 : prev.lunchClaimedCount,
            goodiesClaimedCount:
              res.action_type === "goodies" ? prev.goodiesClaimedCount + 1 : prev.goodiesClaimedCount,
            snacks1ClaimedCount:
              res.action_type === "snacks_1"
                ? prev.snacks1ClaimedCount + 1
                : prev.snacks1ClaimedCount,
            snacks2ClaimedCount:
              res.action_type === "snacks_2"
                ? prev.snacks2ClaimedCount + 1
                : prev.snacks2ClaimedCount,
          };
        });

        HapticFeedback.success();

        setScanFeedback({
          status: "success",
          title: `${res.action_type.toUpperCase()} RECORDED`,
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
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(200);
        }
        // Cache this code so it doesn't repeatedly loop the error buzzer
        lastScannedCodeRef.current = candidateId;
        lastScannedTimeRef.current = Date.now();

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
      } else if (res.status === "limit_reached") {
        playScanError();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        lastScannedCodeRef.current = candidateId;
        lastScannedTimeRef.current = Date.now();

        setScanFeedback({
          status: "limit_reached",
          title: `${res.action_type.toUpperCase()} LIMIT REACHED`,
          message: res.message,
          actionType: res.action_type,
          teamName: res.team?.name,
          teamId: res.team?.id,
          claimedCount: res.claimedCount,
          totalMembers: res.totalMembers,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        });
      } else {
        playScanError();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(200);
        }
        // Shorter deduplication on rejection so retry is possible after 1.5s
        lastScannedCodeRef.current = candidateId;
        lastScannedTimeRef.current = Date.now() - 2000;

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
        actionType: scanPurposeRef.current,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } finally {
      if (processingSafetyTimeoutRef.current) clearTimeout(processingSafetyTimeoutRef.current);
      setLoading(false);
      isProcessingRef.current = false;
      lastScanEndTimeRef.current = Date.now();
      // Activate two-second scan pause for legacy flow scans too.
      if (eventMode === "legacy") {
        activateScanPause(rawCode);
      }
    }
  }, [csrfToken, fetchLiveStream, playScanError, playScanSuccess, handleRelaythonRegistration, activateScanPause]);

  // Manual team lookup with smart resolution (UUID or Team Name/Code search)
  const handleManualLookup = async (queryOrId: string) => {
    if (!queryOrId) return;
    const trimmed = queryOrId.trim();
    if (!trimmed) return;

    // Relaython mode: manual entry of ryt_ tokens routes to registration flow.
    // UUID/manual team lookup goes through Supabase and is disabled in Relaython mode.
    const isRelaythonToken = /ryt_[a-f0-9]{32,}/i.test(trimmed);
    if (eventMode === "relaython") {
      if (isRelaythonToken) {
        // Manual token entry — route through Relaython registration flow
        await handleRelaythonRegistration(trimmed);
        return;
      }
      setLoading(false);
      setScanFeedback({
        status: "error",
        title: "WRONG EVENT MODE",
        message: "Legacy UUID/manual lookup is disabled in Relaython mode. Scan a ryt_ QR badge instead.",
        actionType: "registration",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      return;
    }

    setLoading(true);
    try {
      const isUuid = UUID_REGEX.test(trimmed);
      let targetId = trimmed;

      if (!isUuid) {
        // Fallback: search team by name or code
        const searchRes = await searchTeams(trimmed, 5);
        if (searchRes.error || !searchRes.teams || searchRes.teams.length === 0) {
          throw new Error(`No team found matching "${trimmed}". Try searching by team name, code, or UUID.`);
        }
        targetId = searchRes.teams[0].id;
      }

      const res = await manualTeamLookup(targetId);
      playScanSuccess();
      setTeamData(res);
      setRecentScans((prev) => {
        const filtered = prev.filter((id) => id !== res.team.id);
        return [res.team.id, ...filtered].slice(0, 3);
      });
      setScanFeedback({
        status: "success",
        title: "TEAM LOADED",
        message: `Loaded roster for "${res.team.name}" (${res.members.length} members).`,
        actionType: scanPurpose,
        teamName: res.team.name,
        teamId: res.team.id,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err: unknown) {
      playScanError();
      setScanFeedback({
        status: "error",
        title: "LOOKUP ERROR",
        message: err instanceof Error ? err.message : "Failed to fetch team details",
        actionType: scanPurposeRef.current,
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

  // Number of team members that have NOT yet claimed the active action
  const unclaimedMembersCount = useMemo(() => {
    if (!teamData?.members) return 0;
    return teamData.members.filter((m) => {
      const pid = m.user_id || m.id;
      return !getLogForAction(pid, scanPurpose);
    }).length;
  }, [teamData, scanPurpose]);

  // 1-Tap Bulk Action for entire team (e.g. Check In All or Distribute Kits to All)
  const handleBulkTeamAction = async () => {
    if (!teamData?.team?.id) return;
    setLoading(true);
    try {
      const res = await recordTeamBulkAction(teamData.team.id, scanPurpose, csrfToken, {
        method: "manual",
      });
      playScanSuccess();
      HapticFeedback.success();
      setScanFeedback({
        status: "success",
        title: `ALL MEMBERS ${scanPurpose.toUpperCase()} RECORDED`,
        message: `Successfully recorded ${scanPurpose} for ${res.claimedCount} member(s) of "${teamData.team.name}".`,
        actionType: scanPurpose,
        teamName: teamData.team.name,
        teamId: teamData.team.id,
        claimedCount: res.claimedCount,
        totalMembers: teamData.members.length,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });

      // Refresh team data
      const updated = await fetchTeamMembersForScan(teamData.team.id);
      setTeamData(updated);
      fetchLiveStream();
    } catch (err: unknown) {
      playScanError();
      const msg = err instanceof Error ? err.message : "Bulk action failed.";
      setScanFeedback({
        status: "error",
        title: "BULK ACTION FAILED",
        message: msg,
        actionType: scanPurpose,
        teamName: teamData?.team?.name,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } finally {
      setLoading(false);
    }
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
      if (processingSafetyTimeoutRef.current) clearTimeout(processingSafetyTimeoutRef.current);
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop();
        } catch { }
      }
    };
  }, []);

  const handleLookup = useCallback((id: string) => {
    void handleDetectedCode(id);
  }, [csrfToken, scanPurpose, eventMode]);

  return (
    <PullToRefresh onRefresh={fetchLiveStream}>
      <div className="space-y-6">
        {/* EVENT MODE SELECTOR */}
        <div className="glass-panel p-4 border border-border-color space-y-3 font-tech">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-border-color pb-3">
            <div>
              <h2 className="font-heading text-lg text-text-primary uppercase m-0 flex items-center gap-2">
                <Shield size={18} className="text-accent-primary" />
                Event Mode
              </h2>
              <p className="text-xs text-text-secondary m-0 mt-0.5">
                Select the event mode. Relaython mode processes ryt_ QR tokens for
                registration only. Legacy Eventra mode processes UUID badges for all
                operations.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleEventModeChange("relaython")}
                className={`px-4 py-2 rounded border text-xs font-bold uppercase transition-all ${
                  eventMode === "relaython"
                    ? "bg-accent-primary/20 border-accent-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                    : "bg-surface-color/40 border-border-color/60 text-text-secondary hover:border-accent-secondary/50 hover:text-text-primary"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Monitor size={12} />
                  RELAYTHON
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleEventModeChange("legacy")}
                className={`px-4 py-2 rounded border text-xs font-bold uppercase transition-all ${
                  eventMode === "legacy"
                    ? "bg-accent-primary/20 border-accent-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                    : "bg-surface-color/40 border-border-color/60 text-text-secondary hover:border-accent-secondary/50 hover:text-text-primary"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Shield size={12} />
                  LEGACY EVENTRA
                </span>
              </button>
            </div>
          </div>

          {/* Relaython team count badge */}
          {eventMode === "relaython" && progressSummary && (
            <div className="flex items-center justify-between p-3 bg-surface-color/30 border border-border-color rounded">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-accent-primary" />
                <span className="text-xs text-text-primary font-bold uppercase">Cached Relaython Teams</span>
              </div>
              <span className="font-mono text-sm font-bold text-text-primary">
                {progressSummary.totalTeams ?? "—"}
              </span>
            </div>
          )}
        </div>

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
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border transition-colors ${isOnline
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
            {filteredScanPurposes.map((p) => {
              const Icon = p.icon;
              const isSelected = scanPurpose === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleScanPurposeChange(p.value)}
                  className={`p-3 rounded border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${isSelected
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

        {/* 1.5 LIVE DESK PROGRESS HUD (Ultra-light, in-memory cached metric strip) */}
        {progressSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-tech text-xs">
            <div className="glass-panel p-3 border border-border-color rounded flex items-center justify-between">
              <span className="text-text-secondary uppercase">Teams Checked In</span>
              <span className="font-heading text-sm text-status-success font-bold font-mono">
                {progressSummary.checkedInTeams} / {progressSummary.totalTeams || "—"}
              </span>
            </div>
            <div className="glass-panel p-3 border border-border-color rounded flex items-center justify-between">
              <span className="text-text-secondary uppercase">Check-In Rate</span>
              <span className="font-heading text-sm text-accent-primary font-bold font-mono">
                {progressSummary.totalTeams > 0
                  ? `${Math.round((progressSummary.checkedInTeams / progressSummary.totalTeams) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div className="glass-panel p-3 border border-border-color rounded flex items-center justify-between">
              <span className="text-text-secondary uppercase">Lunch Claimed</span>
              <span className="font-heading text-sm text-status-warning font-bold font-mono">
                {progressSummary.lunchClaimedCount}
              </span>
            </div>
            <div className="glass-panel p-3 border border-border-color rounded flex items-center justify-between">
              <span className="text-text-secondary uppercase">Kits / Goodies</span>
              <span className="font-heading text-sm text-accent-secondary font-bold font-mono">
                {progressSummary.goodiesClaimedCount}
              </span>
            </div>
          </div>
        )}

        {/* 1.75 SCAN PAUSE INDICATOR (2-second freeze after each processed QR) */}
        {scanPauseActive && lastScanResultRef.current && (
          <div className="glass-panel p-4 sm:p-6 rounded-xl border border-accent-primary/50 bg-accent-primary/5 animate-fade-in font-tech">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock size={20} className="text-accent-primary animate-pulse" />
                <div>
                  <h3 className="font-heading text-sm sm:text-base text-text-primary uppercase m-0">
                    SCAN PAUSE — {scanPauseSeconds}s
                  </h3>
                  <p className="text-xs text-text-secondary m-0 mt-0.5">
                    QR detection frozen. Camera remains active.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-accent-primary">
                  {lastScanResultRef.current.teamName}
                </div>
                <div className="font-mono text-xs text-text-secondary">
                  {lastScanResultRef.current.teamId}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {lastScanResultRef.current.message}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TRANSACTION RESULT BANNER (Instant, High-Visibility Feedback) */}
        {scanFeedback && (
          <div
            className={`p-4 sm:p-5 rounded-xl border font-tech transition-all animate-fade-in relative ${
              scanFeedback.sheetsSyncStatus === "synced"
                ? "bg-status-success/15 border-status-success text-status-success shadow-[0_0_25px_rgba(0,255,157,0.15)]"
                : scanFeedback.sheetsSyncStatus === "pending" ||
                  scanFeedback.sheetsSyncStatus === "failed"
                  ? "bg-yellow-500/15 border-yellow-500 text-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.15)]"
                  : scanFeedback.status === "already_completed"
                    ? "bg-yellow-500/15 border-yellow-500 text-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.15)]"
                    : "bg-status-error/15 border-status-error text-status-error shadow-[0_0_25px_rgba(255,59,48,0.15)]"
              }`}
          >
            <button
              type="button"
              onClick={() => setScanFeedback(null)}
              className="absolute top-3 right-3 text-text-secondary hover:text-white transition-colors p-1"
              title="Dismiss"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pr-6 sm:pr-0">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {scanFeedback.sheetsSyncStatus === "synced" ? (
                  <CheckCircle2 size={24} className="text-status-success shrink-0 mt-0.5" />
                ) : scanFeedback.sheetsSyncStatus === "pending" || scanFeedback.sheetsSyncStatus === "failed" ? (
                  <AlertCircle size={24} className="text-yellow-400 shrink-0 mt-0.5" />
                ) : scanFeedback.status === "already_completed" ? (
                  <AlertCircle size={24} className="text-yellow-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert size={24} className="text-status-error shrink-0 mt-0.5" />
                )}

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading text-sm sm:text-base uppercase tracking-wider m-0">
                      {scanFeedback.sheetsSyncStatus === "synced"
                        ? "REGISTRATION CONFIRMED — GOOGLE SHEETS UPDATED"
                        : scanFeedback.sheetsSyncStatus === "pending"
                          ? "SAVED LOCALLY — GOOGLE SHEETS SYNCING"
                          : scanFeedback.sheetsSyncStatus === "failed"
                            ? "SAVED LOCALLY — SYNC PENDING"
                            : scanFeedback.title}
                    </h3>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-current opacity-80">
                      {scanFeedback.actionType}
                    </span>
                    <span className="text-[10px] font-mono opacity-60">
                      {scanFeedback.timestamp}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-bold m-0 text-white break-words">
                    {scanFeedback.sheetsSyncStatus === "synced"
                      ? `Registration for "${scanFeedback.teamName}" (${scanFeedback.teamId}) confirmed — Column L APPROVED.`
                      : scanFeedback.sheetsSyncStatus === "pending"
                        ? `LOCAL SAVED: Registration #${scanFeedback.claimedCount ?? 1} for "${scanFeedback.teamName}" — syncing to Google Sheets...`
                        : scanFeedback.sheetsSyncStatus === "failed"
                          ? `LOCAL SAVED: Registration for "${scanFeedback.teamName}" (${scanFeedback.teamId}). Google Sheets sync pending — record retained for retry.`
                          : scanFeedback.message}
                  </p>

                  {/* Sheets sync status detail */}
                  {scanFeedback.sheetsSyncStatus && scanFeedback.sheetsSyncStatus !== "synced" && (
                    <div className="p-2.5 bg-black/40 border border-yellow-500/30 rounded text-xs space-y-0.5 mt-2">
                      <p className="text-yellow-200/90 m-0">
                        <strong>Sheets Sync:</strong>{" "}
                        <span className="font-mono text-white">
                          {scanFeedback.sheetsSyncMessage || "Pending..."}
                        </span>
                      </p>
                    </div>
                  )}

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

              {/* Continuous Ready Indicator & Re-scan Button */}
              <div className="flex items-center sm:items-end justify-between sm:justify-start gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t border-current/20 sm:border-t-0 shrink-0">
                <div className="px-2.5 py-1 bg-black/60 border border-status-success/50 text-status-success rounded text-[10px] font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-ping" />
                  <span>Ready for Next QR</span>
                </div>
                {lastScannedCodeRef.current && (
                  <button
                    type="button"
                    onClick={handleClearBadgeLock}
                    className="text-[10px] text-text-secondary hover:text-accent-primary underline font-mono cursor-pointer transition-colors"
                  >
                    Scan Same Badge Again
                  </button>
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
            onLookup={handleLookup}
            onManualLookup={handleManualLookup}
            recentScans={recentScans}
            continuousScanCount={continuousScanCount}
            onClearBadgeLock={handleClearBadgeLock}
          />
        </div>

        {/* 4. SCANNED TEAM ROSTER PANEL WITH 1-TAP INDIVIDUAL PARTICIPANT ACTIONS */}
        {teamData && (
          <div className="glass-panel p-4 sm:p-6 border border-accent-primary/40 space-y-6 animate-fade-in font-tech rounded-xl">
            {/* Team Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-color pb-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
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
                <h2 className="font-heading text-xl sm:text-2xl text-text-primary uppercase m-0 mt-2 truncate">
                  {teamData.team.name}
                </h2>
                <p className="text-xs text-text-secondary m-0 mt-1 break-words">
                  Leader: <span className="text-text-primary font-bold">{teamData.team.leader_name}</span>
                  <span className="hidden sm:inline"> | UUID: </span>
                  <span className="block sm:inline font-mono text-[11px] text-text-primary break-all">{teamData.team.id}</span>
                </p>
              </div>

              <button
                onClick={() => {
                  setTeamData(null);
                  setScanFeedback(null);
                  handleClearBadgeLock();
                }}
                className="w-full sm:w-auto px-4 py-2.5 border border-border-color hover:border-accent-primary rounded-lg text-text-secondary hover:text-text-primary font-tech uppercase text-xs transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <RefreshCw size={13} />
                <span>Clear / Ready Next</span>
              </button>
            </div>

            {/* Team Distribution Progress: Lunch & Snacks */}
            <div className="border border-border-color rounded-xl bg-surface-color/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-sm text-text-primary uppercase m-0 tracking-wider flex items-center gap-2">
                  <Users size={14} className="text-accent-primary" />
                  Team Distribution Progress
                </h3>
                <span className="text-[10px] font-mono text-text-secondary">
                  {teamData.members.length} member(s)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Lunch Progress */}
                <div className="border border-border-color rounded-lg p-3 flex flex-col bg-surface-color/30">
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
                    disabled={loading || lunchCount >= 3}
                    className={`mt-2.5 w-full min-h-[36px] py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 ${lunchCount >= 3
                      ? "bg-status-error/20 border border-status-error/40 text-status-error disabled:opacity-100 cursor-not-allowed"
                      : "bg-surface-color-light border border-accent-secondary text-accent-secondary hover:bg-accent-secondary/10 disabled:opacity-50"
                      }`}
                  >
                    {lunchCount >= 3 ? (
                      <>
                        <X size={12} className="mr-1" />
                        <span>Lunch Complete (3/3)</span>
                      </>
                    ) : (
                      <>
                        <Utensils size={12} className="mr-1" />
                        <span>Scan Lunch</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Snacks Progress */}
                <div className="border border-border-color rounded-lg p-3 flex flex-col bg-surface-color/30">
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
                    disabled={loading || snacksCount >= 3}
                    className={`mt-2.5 w-full min-h-[36px] py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 ${snacksCount >= 3
                      ? "bg-status-error/20 border border-status-error/40 text-status-error disabled:opacity-100 cursor-not-allowed"
                      : "bg-surface-color-light border border-accent-secondary text-accent-secondary hover:bg-accent-secondary/10 disabled:opacity-50"
                      }`}
                  >
                    {snacksCount >= 3 ? (
                      <>
                        <X size={12} className="mr-1" />
                        <span>Snacks Complete (3/3)</span>
                      </>
                    ) : (
                      <>
                        <Coffee size={12} className="mr-1" />
                        <span>Scan Snacks</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {(lunchCount >= 3 || snacksCount >= 3) && (
                <div className="mt-3 p-2.5 bg-surface-color border border-border-color rounded-lg text-[10px] font-mono text-text-secondary flex items-center gap-2">
                  <AlertCircle size={12} className="text-text-secondary shrink-0" />
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

            {/* Team-Wide 1-Tap Bulk Action Banner */}
            <div className="p-3.5 sm:p-4 bg-accent-primary/10 border border-accent-primary/30 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-tech">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-primary/20 border border-accent-primary flex items-center justify-center shrink-0">
                  <Sparkles className="text-accent-primary" size={16} />
                </div>
                <div>
                  <p className="text-xs font-heading uppercase text-text-primary m-0">
                    Team-Wide Quick Action
                  </p>
                  <p className="text-[11px] text-text-secondary m-0">
                    {unclaimedMembersCount > 0
                      ? `${unclaimedMembersCount} of ${teamData.members.length} member(s) pending for ${scanPurpose}`
                      : `All ${teamData.members.length} members already recorded for ${scanPurpose}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleBulkTeamAction}
                disabled={loading || unclaimedMembersCount === 0}
                className={`min-h-[40px] px-4 py-2 text-xs font-bold font-tech uppercase rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${unclaimedMembersCount === 0
                  ? "bg-status-success/15 border border-status-success/40 text-status-success disabled:opacity-100 cursor-not-allowed"
                  : "bg-accent-primary hover:bg-accent-primary/80 text-black shadow-[0_0_15px_rgba(0,240,255,0.3)] disabled:opacity-50"
                  }`}
              >
                {unclaimedMembersCount === 0 ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>All Recorded ({teamData.members.length}/{teamData.members.length})</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>
                      1-Tap: {scanPurpose === "registration" ? "Check In All" : `Claim ${scanPurpose} for All`} ({unclaimedMembersCount})
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Mobile Participant Cards (md:hidden) */}
            <div className="block md:hidden space-y-3">
              <h3 className="font-heading text-sm text-text-primary uppercase m-0 flex items-center gap-2">
                <Users size={14} className="text-accent-secondary" />
                Participants ({teamData.members.length})
              </h3>

              {teamData.members.length === 0 ? (
                <div className="p-4 text-center text-text-secondary italic border border-border-color rounded-lg">
                  No registered members mapped in roster.
                </div>
              ) : (
                teamData.members.map((m: TeamScanMember) => {
                  const participantId = m.user_id || m.id;
                  const regLog = getLogForAction(participantId, "registration");
                  const goodiesLog = getLogForAction(participantId, "goodies");
                  const lunchLog = getLogForAction(participantId, "lunch");
                  const snacksLog = getLogForAction(participantId, "snacks");
                  const certLog = getLogForAction(participantId, "certificates");
                  const currentLog = getLogForAction(participantId, scanPurpose);

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 bg-surface-color/60 border border-border-color rounded-xl space-y-3"
                    >
                      {/* Top Row: Name, Role & 1-Tap Action Button */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-heading text-sm text-text-primary uppercase m-0 leading-tight">
                              {m.name || "Member"}
                            </p>
                            <span
                              className={`px-1.5 py-0.5 border text-[9px] uppercase font-bold rounded ${m.role === "leader"
                                ? "bg-accent-secondary/15 text-accent-secondary border-accent-secondary"
                                : "bg-surface-color text-text-secondary border-border-color"
                                }`}
                            >
                              {m.role || "Member"}
                            </span>
                          </div>
                          <p className="font-mono text-[10px] text-text-secondary m-0 mt-0.5 truncate">
                            {m.email || m.id.slice(0, 8)}
                          </p>
                        </div>

                        {/* 1-Tap Action Button */}
                        <div className="shrink-0">
                          {currentLog ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border bg-status-success/15 text-status-success border-status-success/40 font-mono">
                              <CheckCircle2 size={11} /> Recorded
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDetectedCode(teamData.team.id, participantId)}
                              disabled={loading}
                              className="min-h-[34px] px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-black text-xs font-bold uppercase rounded-lg font-tech transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.25)]"
                            >
                              {scanPurpose === "registration" ? "Check In" : `Claim ${scanPurpose}`}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Micro Badge Strip for All 5 Perks */}
                      <div className="grid grid-cols-3 xs:grid-cols-5 gap-1.5 pt-2 border-t border-border-color/30 text-center">
                        <div className={`p-1 rounded border text-[9px] font-bold uppercase ${regLog ? "bg-status-success/15 text-status-success border-status-success/40" : "bg-surface-color text-text-secondary/60 border-border-color/40"}`}>
                          <span>Check-In</span>
                          {regLog && <CheckCircle2 size={9} className="inline ml-0.5" />}
                        </div>
                        <div className={`p-1 rounded border text-[9px] font-bold uppercase ${goodiesLog ? "bg-status-success/15 text-status-success border-status-success/40" : "bg-surface-color text-text-secondary/60 border-border-color/40"}`}>
                          <span>Goodies</span>
                          {goodiesLog && <CheckCircle2 size={9} className="inline ml-0.5" />}
                        </div>
                        <div className={`p-1 rounded border text-[9px] font-bold uppercase ${lunchLog ? "bg-status-success/15 text-status-success border-status-success/40" : "bg-surface-color text-text-secondary/60 border-border-color/40"}`}>
                          <span>Lunch</span>
                          {lunchLog && <CheckCircle2 size={9} className="inline ml-0.5" />}
                        </div>
                        <div className={`p-1 rounded border text-[9px] font-bold uppercase ${snacksLog ? "bg-status-success/15 text-status-success border-status-success/40" : "bg-surface-color text-text-secondary/60 border-border-color/40"}`}>
                          <span>Snacks</span>
                          {snacksLog && <CheckCircle2 size={9} className="inline ml-0.5" />}
                        </div>
                        <div className={`p-1 rounded border text-[9px] font-bold uppercase ${certLog ? "bg-status-success/15 text-status-success border-status-success/40" : "bg-surface-color text-text-secondary/60 border-border-color/40"}`}>
                          <span>Cert</span>
                          {certLog && <CheckCircle2 size={9} className="inline ml-0.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Members Table (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
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
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1 ${claimed
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
                              className={`px-2 py-0.5 border text-[10px] uppercase font-bold ${m.role === "leader"
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
                                disabled={loading}
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
    </PullToRefresh>
  );
}
