"use client";

import { useEffect, useState, useCallback } from "react";
import LiveActivityStream from "@/components/ops/LiveActivityStream";
import { getLiveScanActivityStream } from "@/app/actions/operations";
import { createClient } from "@/lib/supabase/client";
import type { LiveActivityFeedItem } from "@/app/actions/operations";

export default function LiveActivityPage() {
  const [logs, setLogs] = useState<LiveActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLiveScanActivityStream(35);
      setLogs(data);
      setLastSyncTime(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const supabase = createClient();
    const channel = supabase
      .channel("ops-realtime-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_activity_logs" }, () => fetchLogs())
      .on("broadcast", { event: "scan_action_recorded" }, () => fetchLogs())
      .subscribe();
    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchLogs();
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    // 60s gentle fallback sync instead of aggressive 4s polling
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchLogs();
      }
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
      clearInterval(interval);
    };
  }, [fetchLogs]);

  return (
    <div className="space-y-6 p-6">
      <LiveActivityStream
        logs={logs}
        loading={loading}
        onRefresh={fetchLogs}
        lastSyncTime={lastSyncTime ?? undefined}
      />
    </div>
  );
}
