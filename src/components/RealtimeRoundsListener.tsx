"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeSync } from "@/lib/realtime/use-realtime-sync";

interface RealtimeRoundsListenerProps {
  channelName?: string;
}

/**
 * Realtime-driven updates for evaluation rounds/criteria.
 *
 * The previous 6s unconditional router.refresh() polling loop is removed.
 * Changes arrive via Supabase Realtime and are routed through useRealtimeSync,
 * which throttles rapid events, prevents concurrent duplicate refreshes, and
 * skips updates when the tab is backgrounded. Full-page refresh is therefore
 * reserved for genuine round/criteria changes that affect judge & team
 * dashboards.
 */
export default function RealtimeRoundsListener({
  channelName = "realtime-rounds-and-criteria",
}: RealtimeRoundsListenerProps) {
  const router = useRouter();

  const handleChange = useCallback(() => {
    if (
      typeof document === "undefined" ||
      document.visibilityState !== "visible"
    ) {
      return;
    }
    void router.refresh();
  }, [router]);

  useRealtimeSync({
    channelName,
    tables: ["evaluation_rounds", "evaluation_criteria"],
    onChange: handleChange,
    // Polling disabled: realtime is the source of truth.
    pollIntervalMs: 60_000,
    pollEnabled: false,
    focusRefresh: true,
    throttleMs: 2_000,
  });

  return null;
}
