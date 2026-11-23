"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  AlertTriangle,
  Flame,
  ChevronDown,
  ChevronUp,
  Radio,
  X,
  Pin,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { AnnouncementItem } from "@/app/actions/announcements";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSync } from "@/lib/realtime/use-realtime-sync";
import { fetchWithDedupe, invalidate } from "@/lib/data/request-dedup";
import { publicAnnouncementsKey } from "@/lib/cache/cache-keys";
import { getPolicy, ttlFor } from "@/lib/cache/cache-policy";

interface AnnouncementBannerProps {
  announcements?: AnnouncementItem[];
  portalName?: string;
  audience?: "all" | "teams" | "judges" | "ops" | "admin";
  showEmptyState?: boolean;
}

// Slow, configurable fallback poll used ONLY when Realtime is disconnected.
// Defaults to the announcement cache TTL to avoid a request storm from every connected browser.
const FALLBACK_POLL_INTERVAL_MS = 45_000;

export default function AnnouncementBanner({
  announcements = [],
  portalName = "Event Broadcast",
  audience = "all",
  showEmptyState = true,
}: AnnouncementBannerProps) {
  const [items, setItems] = useState<AnnouncementItem[]>(announcements);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Keep state synced with server props
  useEffect(() => {
    if (announcements !== undefined) {
      setItems(announcements);
    }
  }, [announcements]);

  // Load dismissed items from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem(`ivc_dismissed_announcements_${audience}`);
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {}
  }, [audience]);

  // Deduplicated fetch of active announcements for this audience.
  const refreshAnnouncements = useCallback(async () => {
    try {
      const policy = getPolicy("public:announcements");
      const key = publicAnnouncementsKey(audience);
      // Authorized fetch is not required for public announcements.
      const fresh = await fetchWithDedupe<AnnouncementItem[]>(
        key,
        () => getActiveAnnouncements(audience),
        {
          staleTime: policy.ttlMs ?? 45_000,
          retries: 2,
          retryBaseMs: 1000,
          maxEntryBytes: policy.maxEntryBytes,
        }
      );
      setItems(fresh);
    } catch (err) {
      console.warn("Failed to refresh announcements:", err);
    }
  }, [audience]);

  // Realtime subscription for instant updates. No 15s/30s polling loop:
  // changes arrive via Supabase Realtime. A slow fallback poll runs only
  // while Realtime is disconnected, and only while the tab is visible.
  useRealtimeSync({
    channelName: `announcements_realtime_${audience}`,
    tables: ["announcements"],
    onChange: () => {
      void refreshAnnouncements();
      invalidate(publicAnnouncementsKey(audience));
    },
    pollIntervalMs: FALLBACK_POLL_INTERVAL_MS,
    pollEnabled: true,
    focusRefresh: true,
    throttleMs: 2_000,
  });

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      sessionStorage.setItem(`ivc_dismissed_announcements_${audience}`, JSON.stringify(updated));
    } catch {}
  };

  const handleResetDismissed = () => {
    setDismissedIds([]);
    try {
      sessionStorage.removeItem(`ivc_dismissed_announcements_${audience}`);
    } catch {}
  };

  const visibleItems = items.filter((a) => !dismissedIds.includes(a.id));

  // If no visible announcements, render the clean empty state
  if (visibleItems.length === 0) {
    if (!showEmptyState) return null;

    return (
      <div className="glass-panel p-3.5 border border-border-color/60 bg-surface-color/30 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-tech animate-fade-in mb-6">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-surface-color-light text-text-secondary border border-border-color">
            <Bell size={15} className="text-accent-secondary/70" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 border border-border-color bg-surface-color text-text-secondary font-mono">
                {portalName.toUpperCase()} BROADCASTS
              </span>
              <p className="font-tech text-xs text-text-secondary m-0">
                No active announcements for this portal. All systems operational.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          {dismissedIds.length > 0 && (
            <button
              onClick={handleResetDismissed}
              className="text-[10px] text-accent-tertiary hover:underline uppercase font-mono"
            >
              Restore {dismissedIds.length} dismissed
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-color border border-border-color/60 text-text-secondary text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            Live Sync
          </span>
        </div>
      </div>
    );
  }

  // Primary highlight item is the first visible (pinned/highest priority)
  const latest = visibleItems[0];
  const isPinned = latest.is_pinned || latest.pin_to_top;
  const publishedDate = latest.published_at || latest.created_at;

  return (
    <div className="space-y-2 font-tech animate-fade-in mb-6">
      {/* Primary Highlight Banner */}
      <div
        className={`p-3.5 border transition-all rounded shadow-md ${
          latest.priority === "urgent"
            ? "bg-status-error/15 border-status-error text-status-error shadow-status-error/10"
            : latest.priority === "important" || latest.priority === "high"
            ? "bg-accent-secondary/15 border-accent-secondary text-text-primary shadow-accent-secondary/10"
            : "bg-surface-color-light/70 border-border-color text-text-primary"
        } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={`p-1.5 rounded shrink-0 ${
              latest.priority === "urgent"
                ? "bg-status-error/20 text-status-error animate-pulse"
                : latest.priority === "important" || latest.priority === "high"
                ? "bg-accent-secondary/20 text-accent-secondary"
                : "bg-accent-tertiary/20 text-accent-tertiary"
            }`}
          >
            {latest.priority === "urgent" ? (
              <Flame size={16} />
            ) : latest.priority === "important" || latest.priority === "high" ? (
              <AlertTriangle size={16} />
            ) : (
              <Radio size={16} />
            )}
          </div>

          <div className="truncate">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 border bg-surface-color font-mono">
                {(latest.priority || "normal").toUpperCase()} BROADCAST
              </span>

              {isPinned && (
                <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/40 font-mono">
                  <Pin size={10} />
                  PINNED
                </span>
              )}

              {publishedDate && (
                <span className="text-[10px] text-text-secondary font-mono flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(publishedDate).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {new Date(publishedDate).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}

              <p className="font-heading text-xs uppercase m-0 tracking-wide text-text-primary truncate">
                {latest.title}
              </p>
            </div>
            <p className="text-[11px] text-text-secondary truncate m-0 mt-0.5">
              {latest.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {visibleItems.length > 1 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2.5 py-1 text-[11px] bg-surface-color border border-border-color hover:border-accent-secondary font-bold uppercase transition-colors flex items-center gap-1"
            >
              <span>{visibleItems.length} Broadcasts</span>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => handleDismiss(latest.id, e)}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-surface-color rounded transition-colors"
            title="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Multi-Announcement Drawer */}
      {isExpanded && visibleItems.length > 1 && (
        <div className="glass-panel p-4 border border-border-color space-y-3 animate-fade-in bg-surface-color/95">
          <div className="flex items-center justify-between border-b border-border-color/60 pb-1.5">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold m-0">
              Active Broadcasts ({visibleItems.length})
            </p>
            <span className="text-[10px] text-accent-primary font-mono font-bold">
              {portalName}
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {visibleItems.map((item) => {
              const itemPinned = item.is_pinned || item.pin_to_top;
              const itemDate = item.published_at || item.created_at;

              return (
                <div
                  key={item.id}
                  className="p-3 bg-surface-color border border-border-color/80 rounded flex items-start justify-between gap-3 hover:border-border-color transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 uppercase font-bold tracking-wider ${
                          item.priority === "urgent"
                            ? "bg-status-error/15 text-status-error border border-status-error/40"
                            : item.priority === "important" || item.priority === "high"
                            ? "bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/40"
                            : "bg-surface-color-light text-text-secondary border border-border-color"
                        }`}
                      >
                        {item.priority}
                      </span>

                      {itemPinned && (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/40 font-mono">
                          <Pin size={9} />
                          PINNED
                        </span>
                      )}

                      <p className="font-heading text-xs text-text-primary uppercase m-0">
                        {item.title}
                      </p>
                    </div>

                    <p className="text-xs text-text-secondary m-0">
                      {item.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {itemDate && (
                      <span className="text-[10px] font-mono text-text-secondary">
                        {new Date(itemDate).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(item.id, e)}
                      className="p-0.5 text-text-secondary hover:text-text-primary transition-colors"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
