"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RealtimeSyncOptions {
  /** Channel name for Supabase Realtime */
  channelName: string;
  /** Tables to listen to for postgres_changes events */
  tables: string[];
  /** Callback when a relevant change arrives */
  onChange: () => void;
  /** Fallback polling interval in ms (default 60000) */
  pollIntervalMs?: number;
  /** Whether to enable realtime subscription (default true) */
  enabled?: boolean;
  /** Whether to enable fallback polling (default true) */
  pollEnabled?: boolean;
  /** Whether to refresh on window focus (default true) */
  focusRefresh?: boolean;
}

/**
 * useRealtimeSync provides a shared mechanism for:
 * 1. Subscribing to Supabase Realtime postgres_changes events
 * 2. Periodic fallback polling
 * 3. Refresh on tab visibility/focus
 * 4. Cleanup on unmount
 *
 * It deduplicates rapid changes and prevents overlapping requests.
 */
export function useRealtimeSync({
  channelName,
  tables,
  onChange,
  pollIntervalMs = 60000,
  enabled = true,
  pollEnabled = true,
  focusRefresh = true,
}: RealtimeSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const onChangeRef = useRef(onChange);
  const lastChangeTime = useRef(0);
  const isRefreshing = useRef(false);

  // Keep onChange callback fresh
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Throttled change handler - prevents overlapping requests during bursts
  const handleChange = useCallback(() => {
    const now = Date.now();
    // Throttle: ignore changes within 1 second of last change
    if (now - lastChangeTime.current < 1000) {
      return;
    }
    lastChangeTime.current = now;

    if (isRefreshing.current) {
      return;
    }

    isRefreshing.current = true;
    setLastSynced(new Date());
    onChangeRef.current();
    isRefreshing.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const supabase = createClient();

    // Build postgres_changes filters for each table
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        handleChange
      );
    });

    channel.subscribe((status) => {
      setIsConnected(status === "SUBSCRIBED");
    });

    // Fallback polling
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (pollEnabled) {
      intervalId = setInterval(handleChange, pollIntervalMs);
    }

    // Refresh on visibility change / focus
    let visibilityHandler: (() => void) | null = null;
    let focusHandler: (() => void) | null = null;

    if (focusRefresh) {
      const lastFocusTime = useRef(0);

      visibilityHandler = () => {
        if (document.visibilityState === "visible") {
          const now = Date.now();
          // Only refresh if it's been more than 10 seconds since last focus
          if (now - lastFocusTime.current > 10000) {
            lastFocusTime.current = now;
            handleChange();
          }
        }
      };

      focusHandler = () => {
        const now = Date.now();
        if (now - lastFocusTime.current > 10000) {
          lastFocusTime.current = now;
          handleChange();
        }
      };

      document.addEventListener("visibilitychange", visibilityHandler);
      window.addEventListener("focus", focusHandler);
    }

    return () => {
      channel.unsubscribe();
      if (intervalId) clearInterval(intervalId);
      if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
      if (focusHandler) window.removeEventListener("focus", focusHandler);
    };
  }, [channelName, tables, enabled, pollEnabled, pollIntervalMs, focusRefresh, handleChange]);

  return { isConnected, lastSynced };
}
