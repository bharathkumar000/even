"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  AlertTriangle,
  Info,
  Flame,
  ChevronDown,
  ChevronUp,
  Radio,
  X,
  Volume2,
} from "lucide-react";
import type { AnnouncementItem } from "@/app/actions/announcements";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import { createClient } from "@/lib/supabase/client";

interface AnnouncementBannerProps {
  announcements: AnnouncementItem[];
  portalName?: string;
  audience?: "all" | "teams" | "judges" | "ops";
}

export default function AnnouncementBanner({
  announcements = [],
  portalName = "Event Broadcast",
  audience = "all",
}: AnnouncementBannerProps) {
  const [items, setItems] = useState<AnnouncementItem[]>(announcements);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Load dismissed items from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem("ivc_dismissed_announcements");
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const refreshAnnouncements = useCallback(async () => {
    try {
      const fresh = await getActiveAnnouncements(audience);
      setItems(fresh);
    } catch {
      // ignore
    }
  }, [audience]);

  // Subscribe to real-time broadcasts
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`announcements_realtime_${audience}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
        },
        () => {
          refreshAnnouncements();
        }
      )
      .subscribe();

    // Fallback polling every 15s
    const interval = setInterval(refreshAnnouncements, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [audience, refreshAnnouncements]);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      sessionStorage.setItem("ivc_dismissed_announcements", JSON.stringify(updated));
    } catch {}
  };

  const visibleItems = items.filter((a) => !dismissedIds.includes(a.id));

  if (visibleItems.length === 0) {
    return null;
  }

  const latest = visibleItems[0];
  const urgentCount = visibleItems.filter((a) => a.priority === "urgent").length;

  return (
    <div className="space-y-2 font-tech animate-fade-in">
      {/* Primary Highlight Banner */}
      <div
        className={`p-3.5 border transition-all rounded shadow-md ${
          latest.priority === "urgent"
            ? "bg-status-error/15 border-status-error text-status-error shadow-status-error/10"
            : latest.priority === "important"
            ? "bg-accent-secondary/15 border-accent-secondary text-text-primary shadow-accent-secondary/10"
            : "bg-surface-color-light/70 border-border-color text-text-primary"
        } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={`p-1.5 rounded shrink-0 ${
              latest.priority === "urgent"
                ? "bg-status-error/20 text-status-error animate-pulse"
                : latest.priority === "important"
                ? "bg-accent-secondary/20 text-accent-secondary"
                : "bg-accent-tertiary/20 text-accent-tertiary"
            }`}
          >
            {latest.priority === "urgent" ? (
              <Flame size={16} />
            ) : latest.priority === "important" ? (
              <AlertTriangle size={16} />
            ) : (
              <Radio size={16} />
            )}
          </div>

          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 border bg-surface-color font-mono">
                {latest.priority.toUpperCase()} BROADCAST
              </span>
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
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2.5 py-1 text-[11px] bg-surface-color border border-border-color hover:border-accent-secondary font-bold uppercase transition-colors flex items-center gap-1"
            >
              <span>{visibleItems.length} Alerts</span>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          <button
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

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-surface-color border border-border-color/80 rounded flex items-start justify-between gap-3 hover:border-border-color transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 uppercase font-bold tracking-wider ${
                        item.priority === "urgent"
                          ? "bg-status-error/15 text-status-error border border-status-error/40"
                          : item.priority === "important"
                          ? "bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/40"
                          : "bg-surface-color-light text-text-secondary border border-border-color"
                      }`}
                    >
                      {item.priority}
                    </span>
                    <p className="font-heading text-xs text-text-primary uppercase m-0">
                      {item.title}
                    </p>
                  </div>
                  <p className="text-xs text-text-secondary mt-1 m-0">
                    {item.message}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-text-secondary">
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={(e) => handleDismiss(item.id, e)}
                    className="p-0.5 text-text-secondary hover:text-text-primary transition-colors"
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
