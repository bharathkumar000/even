"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface RealtimeRoundsListenerProps {
  channelName?: string;
  pollIntervalMs?: number;
}

export default function RealtimeRoundsListener({
  channelName = "realtime-rounds-and-criteria",
  pollIntervalMs = 6000,
}: RealtimeRoundsListenerProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // 1. Realtime push subscription on evaluation_rounds and evaluation_criteria
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evaluation_rounds" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evaluation_criteria" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    // 2. Fallback polling interval to ensure 100% reliability across all network conditions
    const interval = setInterval(() => {
      router.refresh();
    }, pollIntervalMs);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [router, channelName, pollIntervalMs]);

  return null;
}
