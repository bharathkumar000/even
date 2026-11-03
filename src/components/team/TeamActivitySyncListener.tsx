"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface TeamActivitySyncListenerProps {
  teamId: string;
}

/**
 * Listens for real-time claim status changes and reverts for this specific team.
 * Automatically refreshes the team dashboard (distribution counters, member claims, progress bars)
 * instantly when an admin reverts or records an activity log in Supabase.
 */
export default function TeamActivitySyncListener({ teamId }: TeamActivitySyncListenerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!teamId) return;

    const supabase = createClient();

    // 1. Listen for PostgreSQL changes on event_activity_logs filtered to this team
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
        () => {
          router.refresh();
        }
      )
      .subscribe();

    // 2. Listen for broadcast revert/scan notifications targeted to this team
    const broadcastChannel = supabase
      .channel(`team-live-${teamId}`)
      .on("broadcast", { event: "scan_action_reverted" }, (payload) => {
        if (!payload?.payload?.team_id || payload.payload.team_id === teamId) {
          router.refresh();
        }
      })
      .on("broadcast", { event: "scan_action_recorded" }, (payload) => {
        if (!payload?.payload?.team_id || payload.payload.team_id === teamId) {
          router.refresh();
        }
      })
      .subscribe();

    // Also listen to the QR live channel for this team
    const qrBroadcastChannel = supabase
      .channel(`team-qr-live-${teamId}`)
      .on("broadcast", { event: "scan_action_reverted" }, (payload) => {
        if (!payload?.payload?.team_id || payload.payload.team_id === teamId) {
          router.refresh();
        }
      })
      .on("broadcast", { event: "scan_action_recorded" }, (payload) => {
        if (!payload?.payload?.team_id || payload.payload.team_id === teamId) {
          router.refresh();
        }
      })
      .subscribe();

    // 3. Fallback interval every 5 seconds to guarantee eventual consistency
    const pollInterval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => {
      supabase.removeChannel(pgChannel);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(qrBroadcastChannel);
      clearInterval(pollInterval);
    };
  }, [teamId, router]);

  return null;
}
