"use client";

import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore, startTransition } from "react";
import { usePathname } from "next/navigation";
import {
  Radio,
  Flame,
  AlertTriangle,
  Info,
  X,
  Minimize2,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Pin,
  Clock,
  Bell,
  Volume2,
  VolumeX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveAnnouncements, type AnnouncementItem } from "@/app/actions/announcements";

// Synthesize a pleasant high-tech chime using Web Audio API
function playAlertChime(priority: string) {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const isUrgent = priority === "urgent";
    const freq1 = isUrgent ? 880 : 587.33; // A5 or D5
    const freq2 = isUrgent ? 1174.66 : 880; // D6 or A5

    const now = ctx.currentTime;
    
    // First note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(freq1, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second note
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq2, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch {
    // Audio context may be restricted by autoplay policy until user gesture
  }
}

function formatRelativeTime(isoString?: string | null) {
  if (!isoString) return "Just now";
  try {
    const d = new Date(isoString);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "Recent";
  }
}

export default function FloatingBroadcastNotification() {
  const pathname = usePathname();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissedAll, setIsDismissedAll] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Determine current audience target from pathname
  const getAudienceForPortal = useCallback((): "all" | "teams" | "judges" | "ops" | "admin" => {
    if (!pathname) return "all";
    if (pathname.startsWith("/admin")) return "admin";
    if (pathname.startsWith("/ops")) return "ops";
    if (pathname.startsWith("/judge")) return "judges";
    if (pathname.startsWith("/team") || pathname.startsWith("/participants")) return "teams";
    return "all";
  }, [pathname]);

  // Load dismissed IDs from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("eventra_dismissed_broadcasts");
      if (stored) {
        startTransition(() => {
          setDismissedIds(JSON.parse(stored));
        });
      }
    } catch {}
  }, []);

  const audience = getAudienceForPortal();

  // Fetch active announcements
  const fetchAnnouncements = useCallback(async (isRealtimeEvent = false) => {
    try {
      const activeList = await getActiveAnnouncements(audience);
      
      setAnnouncements(activeList);

      // Check if there are newly arrived items
      if (isRealtimeEvent && activeList.length > 0) {
        const newest = activeList[0];
        if (!knownIdsRef.current.has(newest.id)) {
          knownIdsRef.current.add(newest.id);
          setIsDismissedAll(false);
          setIsMinimized(false);
          setHasNewAlert(true);
          setCurrentIndex(0);
          if (soundEnabled) {
            playAlertChime(newest.priority || "normal");
          }
        }
      } else {
        // Track known IDs on initial load
        activeList.forEach((item) => knownIdsRef.current.add(item.id));
      }
    } catch (err) {
      console.warn("Failed to fetch floating broadcast announcements:", err);
    }
  }, [audience, soundEnabled]);

  // Initial load and periodic refresh
  useEffect(() => {
    if (!mounted) return;
    const initialTimer = setTimeout(() => {
      void fetchAnnouncements(false);
    }, 0);

    const interval = setInterval(() => {
      void fetchAnnouncements(false);
    }, 25000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [mounted, fetchAnnouncements]);

  // Supabase Realtime subscription for instant pop-up
  useEffect(() => {
    if (!mounted) return;
    const supabase = createClient();

    const channel = supabase
      .channel("global_floating_broadcasts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => {
          void fetchAnnouncements(true);
        }
      )
      .on(
        "broadcast",
        { event: "new_announcement" },
        () => {
          void fetchAnnouncements(true);
        }
      )
      .on(
        "broadcast",
        { event: "clear_all_broadcasts" },
        () => {
          setAnnouncements([]);
          setIsDismissedAll(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mounted, fetchAnnouncements]);

  // Filter out dismissed items
  const visibleAnnouncements = announcements.filter(
    (item) => !dismissedIds.includes(item.id)
  );

  const handleDismissCurrent = (id: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      sessionStorage.setItem("eventra_dismissed_broadcasts", JSON.stringify(updated));
    } catch {}

    if (visibleAnnouncements.length <= 1) {
      setIsDismissedAll(true);
    } else if (currentIndex >= visibleAnnouncements.length - 1) {
      setCurrentIndex(Math.max(0, visibleAnnouncements.length - 2));
    }
  };

  const handleDismissAll = () => {
    const allIds = announcements.map((a) => a.id);
    const updated = Array.from(new Set([...dismissedIds, ...allIds]));
    setDismissedIds(updated);
    try {
      sessionStorage.setItem("eventra_dismissed_broadcasts", JSON.stringify(updated));
    } catch {}
    setIsDismissedAll(true);
  };

  if (!mounted) return null;
  if (visibleAnnouncements.length === 0 || isDismissedAll) return null;

  const current = visibleAnnouncements[currentIndex] || visibleAnnouncements[0];
  if (!current) return null;

  const priority = current.priority || "normal";
  const isUrgent = priority === "urgent";
  const isImportant = priority === "important" || priority === "high";

  // Minimized Pill view
  if (isMinimized) {
    return (
      <aside
        aria-label="Event Broadcasts"
        className="fixed bottom-6 right-6 z-[99999] animate-bounce-subtle pointer-events-auto"
      >
        <button
          onClick={() => {
            setIsMinimized(false);
            setHasNewAlert(false);
          }}
          className={`px-3.5 py-2.5 rounded-full border shadow-2xl flex items-center gap-2.5 backdrop-blur-xl transition-all cursor-pointer font-tech text-xs uppercase font-bold tracking-wider ${
            isUrgent
              ? "bg-[#1f0a0a]/95 border-red-500 text-red-400 shadow-red-500/30 hover:bg-red-950"
              : isImportant
              ? "bg-[#1c1407]/95 border-amber-500 text-amber-400 shadow-amber-500/30 hover:bg-amber-950"
              : "bg-[#0a1220]/95 border-cyan-500 text-cyan-400 shadow-cyan-500/30 hover:bg-cyan-950"
          }`}
          title="Click to expand event broadcast alert"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isUrgent ? "bg-red-400" : isImportant ? "bg-amber-400" : "bg-cyan-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isUrgent ? "bg-red-500" : isImportant ? "bg-amber-500" : "bg-cyan-500"
              }`}
            />
          </span>
          <Radio size={14} className={isUrgent ? "animate-pulse" : ""} />
          <span>Broadcast ({visibleAnnouncements.length})</span>
          <Maximize2 size={13} className="opacity-70 hover:opacity-100" />
        </button>
      </aside>
    );
  }

  // Expanded Floating Notification Banner (top of viewport)
  return (
    <aside
      aria-label="Live Event Broadcast Banner"
      className="fixed top-4 inset-x-0 mx-auto max-w-3xl px-3 sm:px-4 z-[99999] pointer-events-none transition-all duration-300 font-tech"
    >
      <div
        className={`pointer-events-auto rounded-lg border backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-300 animate-slide-down ${
          isUrgent
            ? "bg-[#0d0404]/95 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.35)]"
            : isImportant
            ? "bg-[#0d0b04]/95 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]"
            : "bg-[#060a12]/95 border-cyan-500/80 shadow-[0_0_25px_rgba(6,182,212,0.25)]"
        }`}
      >
        {/* Top glowing accent line */}
        <div
          className={`h-1 w-full ${
            isUrgent
              ? "bg-gradient-to-r from-red-600 via-rose-400 to-red-600 animate-pulse"
              : isImportant
              ? "bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 animate-pulse"
              : "bg-gradient-to-r from-cyan-600 via-teal-400 to-cyan-600"
          }`}
        />

        <div className="p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Left Icon + Badge */}
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`p-2 rounded border shrink-0 mt-0.5 ${
                  isUrgent
                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : isImportant
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                    : "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                }`}
              >
                {isUrgent ? (
                  <Flame size={18} className="animate-pulse" />
                ) : isImportant ? (
                  <AlertTriangle size={18} />
                ) : (
                  <Radio size={18} className="animate-pulse" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                {/* Meta pills */}
                <div className="flex items-center gap-2 flex-wrap text-[10px] uppercase font-bold tracking-wider mb-1">
                  <span
                    className={`px-2 py-0.5 rounded border font-mono ${
                      isUrgent
                        ? "bg-red-500/25 border-red-500 text-red-300"
                        : isImportant
                        ? "bg-amber-500/25 border-amber-500 text-amber-300"
                        : "bg-cyan-500/25 border-cyan-500 text-cyan-300"
                    }`}
                  >
                    {priority.toUpperCase()} BROADCAST
                  </span>

                  {(current.pin_to_top || current.is_pinned) && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/50 text-purple-300 font-mono">
                      <Pin size={10} /> PINNED
                    </span>
                  )}

                  <span className="text-text-secondary/70 font-mono flex items-center gap-1">
                    <Clock size={10} />
                    {formatRelativeTime(current.published_at || current.created_at)}
                  </span>

                  {Array.isArray(current.target_audience) ? (
                    <span className="text-text-secondary/70 font-mono">
                      To: {current.target_audience.join(", ").toUpperCase()}
                    </span>
                  ) : current.target_audience && current.target_audience !== "all" ? (
                    <span className="text-text-secondary/70 font-mono">
                      To: {current.target_audience.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-text-secondary/70 font-mono">To: ALL PORTALS</span>
                  )}
                </div>

                {/* Title */}
                <h4 className="font-heading text-sm sm:text-base text-text-primary uppercase tracking-wide m-0 break-words font-bold">
                  {current.title}
                </h4>

                {/* Message Body */}
                <p className="font-sans text-xs sm:text-sm text-text-secondary mt-1 m-0 leading-relaxed break-words whitespace-pre-wrap">
                  {current.message}
                </p>
              </div>
            </div>

            {/* Right Action Controls */}
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-color/50 transition-colors"
                title={soundEnabled ? "Mute alert chimes" : "Unmute alert chimes"}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-color/50 transition-colors"
                title="Minimize broadcast notification"
              >
                <Minimize2 size={14} />
              </button>

              <button
                type="button"
                onClick={() => handleDismissCurrent(current.id)}
                className="p-1.5 rounded text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Dismiss this notification"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Footer Carousel (if multiple broadcasts exist) */}
          {visibleAnnouncements.length > 1 && (
            <div className="mt-3 pt-2.5 border-t border-border-color/40 flex items-center justify-between text-xs font-mono text-text-secondary">
              <div className="flex items-center gap-2">
                <span className="text-[11px]">
                  Alert {currentIndex + 1} of {visibleAnnouncements.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((i) =>
                        i > 0 ? i - 1 : visibleAnnouncements.length - 1
                      )
                    }
                    className="p-1 rounded border border-border-color hover:bg-surface-color text-text-primary transition-colors"
                    title="Previous announcement"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((i) =>
                        i < visibleAnnouncements.length - 1 ? i + 1 : 0
                      )
                    }
                    className="p-1 rounded border border-border-color hover:bg-surface-color text-text-primary transition-colors"
                    title="Next announcement"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismissAll}
                className="text-[10px] text-text-secondary hover:text-accent-tertiary transition-colors uppercase underline"
              >
                Dismiss All ({visibleAnnouncements.length})
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
