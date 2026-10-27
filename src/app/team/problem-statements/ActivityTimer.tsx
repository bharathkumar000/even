"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

interface ActivityTimerProps {
  activityId: string;
}

export default function ActivityTimer({ activityId }: ActivityTimerProps) {
  const [timerEnd, setTimerEnd] = useState<string | null>(null);
  const [timerAutoPublish, setTimerAutoPublish] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadTimer = async () => {
      try {
        const res = await fetch(`/api/activity-timer/${activityId}`);
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          if (data.endTime) {
            const end = new Date(data.endTime).getTime();
            const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
            if (diff > 0) {
              setTimerEnd(data.endTime);
              setTimeRemaining(diff);
              setTimerAutoPublish(data.autoPublish);
            }
          }
        }
      } catch {
        // Ignore errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTimer();

    const interval = setInterval(() => {
      if (timerEnd) {
        const end = new Date(timerEnd).getTime();
        const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
        setTimeRemaining(diff);
        if (diff <= 0) {
          setTimerEnd(null);
          setTimeRemaining(0);
        }
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-3 bg-surface-color/30 border border-border-color rounded">
        <div className="w-4 h-4 border-2 border-accent-secondary/30 border-t-accent-secondary rounded-full animate-spin" />
        <span className="text-xs text-text-secondary">Loading timer...</span>
      </div>
    );
  }

  if (!timerEnd || timeRemaining <= 0) {
    return (
      <div className="flex items-center justify-center gap-2 p-3 bg-surface-color/30 border border-border-color rounded">
        <Timer className="w-4 h-4 text-text-secondary" />
        <span className="text-xs font-mono text-text-secondary uppercase tracking-wider">TIME EXPIRED</span>
      </div>
    );
  }

  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;

  const timeString = hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const progress = timerEnd ? (1 - timeRemaining / (new Date(timerEnd).getTime() - (Date.now() - timeRemaining * 1000))) : 0;

  return (
    <div className="flex items-center gap-3 p-3 bg-surface-color/30 border border-accent-secondary/40 rounded relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-accent-secondary/10 to-transparent" />
      <div className="relative flex items-center gap-3">
        <div className="flex items-center gap-2 p-2 bg-accent-secondary/15 border border-accent-secondary/40 rounded">
          <Timer className="w-5 h-5 text-accent-secondary animate-pulse" />
        </div>
        <div>
          <p className="text-[9px] font-mono text-accent-secondary uppercase tracking-[2px] font-bold mb-0.5">
            TIME REMAINING
          </p>
          <p className="font-mono text-xl text-white tabular-nums font-bold tracking-tight m-0">
            {timeString}
          </p>
        </div>
        {timerAutoPublish && (
          <span className="ml-2 px-2 py-0.5 text-[8px] font-mono font-bold uppercase bg-status-success/20 text-status-success border border-status-success/30 rounded">
            AUTO-PUBLISH
          </span>
        )}
      </div>
      <div className="absolute bottom-0 left-0 h-1 bg-accent-secondary/20 w-full">
        <div
          className="h-full bg-accent-secondary"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}