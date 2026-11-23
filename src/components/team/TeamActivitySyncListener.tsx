"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface TeamActivitySyncListenerProps {
  teamId: string;
}

/**
 * Listens for real-time claim status changes and reverts for this specific team.
 * All three channels (postgres_changes + two broadcast channels) funnel through
 * a single throttled, single-flight, visibility-gated refresh handler.
 *
 * Removed: 60s polling interval, per-event router.refresh() on each channel,
 * and visibilitychange/focus full-page refreshes.
 */
export default function TeamActivitySyncListener({ teamId }: TeamActivitySyncListenerProps) {
  const router = useRouter();
  const refreshRef = useRef(router.refresh);
  refreshRef.current = router.refresh;

  const lastChangeTime = useRef(0);
  const isRefreshing = useRef(false);
  const channelsRef = useRef<any[]>([]);

  // Throttled, single-flight, visibility-gated refresh shared across channels.
  const handleChange = useCallback(() => {
    const now = Date.now();
    if (now - lastChangeTime.current < 2_000) return;
    lastChangeTime.current = now;

    if (isRefreshing.current) return;
    if (typeof document === "undefined" || document.visibilityState !== "visible") {
      return;
    }

    isRefreshing.current = true;
    try {
      void refreshRef.current();
    } finally {
      isRefreshing.current = false;
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // 1. Postgres changes on event_activity_logs for this team
    const pgChannel = supabase
      .channel(`team-dashboard-db-${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_activity_logs",
          filter: `team_id=eq.${teamId}`,
        },
        handleChange
      )
      .subscribe();

    // 2. Broadcast revert/scan notifications on team-live channel
    const broadcastChannel = supabase
      .channel(`team-live-${teamId}`)
      .on("broadcast", { event: "scan_action_reverted" }, handleChange)
      .on("broadcast", { event: "scan_action_recorded" }, handleChange)
      .subscribe();

    // 3. Broadcast revert/scan notifications on team-qr-live channel
    const qrBroadcastChannel = supabase
      .channel(`team-qr-live-${teamId}`)
      .on("broadcast", { event: "scan_action_reverted" }, handleChange)
      .on("broadcast", { event: "scan_action_recorded" }, handleChange)
      .subscribe();

    channelsRef.current = [pgChannel, broadcastChannel, qrBroadcastChannel];

    return () => {
      channelsRef.current.forEach((ch) => {
        try {
          supabase.removeChannel(ch);
        } catch {}
      });
      channelsRef.current = [];
    };
  }, [teamId, handleChange]);

  return null;
}
