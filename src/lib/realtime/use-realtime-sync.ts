"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RealtimeSyncOptions {
  /** Channel name for Supabase Realtime */
  channelName: string;
  /** Tables to listen to for postgres_changes events */
  tables?: string[];
  /** Broadcast events to listen to: { event, handler } */
  broadcastEvents?: { event: string; handler: (payload: any) => void }[];
  /** Generic callback when a relevant change arrives */
  onChange?: () => void;
  /** Fallback polling interval in ms when realtime is unhealthy (default 60000). Set 0 to disable. */
  pollIntervalMs?: number;
  /** Whether to enable realtime subscription (default true) */
  enabled?: boolean;
  /** Whether to enable fallback polling (default true) */
  pollEnabled?: boolean;
  /** Whether to refresh on window focus / visibility (default true) */
  focusRefresh?: boolean;
  /** Minimum ms between processed change events (throttle, default 1000) */
  throttleMs?: number;
}

/**
 * useRealtimeSync provides a shared, production-grade mechanism for:
 * 1. Subscribing to Supabase Realtime postgres_changes + broadcast events
 * 2. Throttled, single-flight change handling (batches rapid events)
 * 3. Fallback polling ONLY when realtime is disconnected/unhealthy
 * 4. Tab-visibility awareness (no polling from background tabs)
 * 5. Connection-state monitoring with safe reconnection + exponential backoff
 * 6. Single-flight refresh when connections recover
 * 7. Cleanup on unmount
 *
 * Returns { isConnected, lastSynced, error, refresh }
 */
export function useRealtimeSync({
  channelName,
  tables = [],
  broadcastEvents = [],
  onChange,
  pollIntervalMs = 60_000,
  enabled = true,
  pollEnabled = true,
  focusRefresh = true,
  throttleMs = 1_000,
}: RealtimeSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const channelRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const lastChangeTime = useRef(0);
  const isRefreshing = useRef(false);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  const focusHandlerRef = useRef<(() => void) | null>(null);
  const lastFocusTime = useRef(0);
  const mountedRef = useRef(false);
  const isVisibleRef = useRef(
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  );
  const isConnectedRef = useRef(false);
  const setupRef = useRef<(() => void) | null>(null);

  // Keep onChange fresh without resubscribing
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Throttled, single-flight change handler
  const handleChange = useCallback(() => {
    const now = Date.now();
    if (now - lastChangeTime.current < throttleMs) return;
    lastChangeTime.current = now;

    if (isRefreshing.current) return;
    if (!mountedRef.current) return;
    if (!isVisibleRef.current) return;

    isRefreshing.current = true;
    setLastSynced(new Date());
    setError(null);
    try {
      onChangeRef.current?.();
    } finally {
      isRefreshing.current = false;
    }
  }, [throttleMs]);

  const refresh = useCallback(() => {
    handleChange();
  }, [handleChange]);

  const maxBackoffMs = 30_000;
  const backoffDelay = useCallback(() => {
    const attempt = reconnectAttempts.current;
    const base = Math.min(1_000 * Math.pow(2, attempt), maxBackoffMs);
    const jitter = Math.floor(Math.random() * 1_000);
    return base + jitter;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!pollEnabled || pollIntervalMs <= 0) return;
    if (pollTimer.current) return;
    if (!isVisibleRef.current) return;
    pollTimer.current = setInterval(() => {
      if (!isVisibleRef.current) return;
      handleChange();
    }, pollIntervalMs);
  }, [pollEnabled, pollIntervalMs, handleChange]);

  const scheduleReconnect = useCallback(
    (delay: number) => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => {
        if (!mountedRef.current || !enabled) return;
        reconnectAttempts.current += 1;
        const setup = setupRef.current;
        if (setup) setup();
      }, delay);
    },
    [enabled]
  );

  const setupSubscription = useCallback(() => {
    if (!enabled || !mountedRef.current) return;

    // Cleanup previous channel/supabase instance
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
      } catch {}
      channelRef.current = null;
    }
    supabaseRef.current = null;

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setError("Supabase client unavailable");
      scheduleReconnect(backoffDelay());
      return;
    }
    supabaseRef.current = supabase;

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    (tables || []).forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        handleChange
      );
    });

    broadcastEvents.forEach(({ event, handler }) => {
      channel.on("broadcast", { event }, handler);
    });

    channel.subscribe((status: string) => {
      if (!mountedRef.current) return;
      const connected = status === "SUBSCRIBED";
      isConnectedRef.current = connected;
      setIsConnected(connected);

      if (connected) {
        setError(null);
        reconnectAttempts.current = 0;
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
        stopPolling();
        // Single-flight refresh on recovery after channel settles
        setTimeout(handleChange, 200);
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        setError(`Realtime ${status}`);
        reconnectAttempts.current = 0;
        startPolling();
      }
    });

    if (!isConnectedRef.current) {
      startPolling();
    }
  }, [
    channelName,
    tables,
    broadcastEvents,
    enabled,
    pollEnabled,
    pollIntervalMs,
    handleChange,
    backoffDelay,
    scheduleReconnect,
    startPolling,
    stopPolling,
  ]);

  setupRef.current = setupSubscription;

  // Visibility / focus handlers (stable refs, attached once)
  useEffect(() => {
    if (!focusRefresh || !enabled) return;
    const handleVisibility = () => {
      isVisibleRef.current =
        typeof document !== "undefined"
          ? document.visibilityState === "visible"
          : true;
      if (!isVisibleRef.current) return;
      const now = Date.now();
      if (now - lastFocusTime.current > 10_000) {
        lastFocusTime.current = now;
        if (!isConnectedRef.current) handleChange();
        startPolling();
      }
    };
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusTime.current > 10_000) {
        lastFocusTime.current = now;
        if (!isConnectedRef.current) handleChange();
        startPolling();
      }
    };
    visibilityHandlerRef.current = handleVisibility;
    focusHandlerRef.current = handleFocus;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("focus", handleFocus);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      window.removeEventListener("focus", handleFocus);
    };
  }, [focusRefresh, enabled, handleChange, startPolling]);

  useEffect(() => {
    mountedRef.current = true;
    const setup = setupRef.current;
    if (enabled && setup) setup();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      stopPolling();
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch {}
        channelRef.current = null;
      }
      supabaseRef.current = null;
    };
  }, [enabled, stopPolling]);

  return { isConnected, lastSynced, error, refresh };
}
