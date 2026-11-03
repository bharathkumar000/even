"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Gift,
  Utensils,
  Coffee,
  Award,
  UserCheck,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getRecentlyScannedTeams, type RecentlyScannedTeam } from "@/app/actions/operations";

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  registration: { label: "Check-In", icon: <UserCheck size={12} className="text-accent-tertiary" /> },
  goodies: { label: "Kit Distribution", icon: <Gift size={12} className="text-accent-primary" /> },
  lunch: { label: "Lunch", icon: <Utensils size={12} className="text-accent-secondary" /> },
  snacks: { label: "Snacks", icon: <Coffee size={12} className="text-yellow-400" /> },
  certificates: { label: "Certificate", icon: <Award size={12} className="text-purple-400" /> },
};

function formatTimestamp(iso: string) {
  try {
    const d = new Date(iso);
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const dateStr = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return { timeStr, dateStr };
  } catch {
    return { timeStr: iso, dateStr: "" };
  }
}

interface RecentlyScannedTeamsProps {
  limit?: number;
}

export default function RecentlyScannedTeams({ limit = 3 }: RecentlyScannedTeamsProps) {
  const [scans, setScans] = useState<RecentlyScannedTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRecentlyScannedTeams(limit);
      if (result.error) {
        setError(result.error);
        setScans([]);
      } else {
        setScans(result.scans || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load recent scans");
      setScans([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void fetchScans();

    const supabase = createClient();
    const channel = supabase
      .channel("ops-recently-scanned-teams")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_activity_logs",
        },
        () => {
          void fetchScans();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchScans]);

  if (loading) {
    return (
      <div className="glass-panel p-6 border border-border-color rounded-lg text-center">
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <Loader2 size={20} className="animate-spin text-accent-tertiary" />
          <p className="text-xs text-text-secondary uppercase tracking-wider font-bold">
            Loading recent scans&hellip;
          </p>
        </div>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="glass-panel p-8 border border-border-color rounded-lg text-center">
        <ShieldCheck size={32} className="mx-auto mb-3 text-text-secondary/40" />
        <h3 className="font-heading text-sm text-text-primary uppercase m-0 mb-1">
          No Recent Scans
        </h3>
        <p className="text-[10px] text-text-secondary/60 m-0">
          Successfully scanned teams will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 border border-border-color rounded-lg space-y-4 font-tech">
      <div className="flex items-center justify-between border-b border-border-color pb-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-accent-tertiary" />
          <h3 className="font-heading text-sm uppercase tracking-wider text-text-primary m-0">
            Recently Scanned Teams
          </h3>
        </div>
        <span className="text-[10px] font-mono text-text-secondary/60 uppercase">
          Last {scans.length} scan{scans.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {scans.map((scan) => {
          const action = ACTION_LABELS[scan.action_type] ?? {
            label: scan.action_type,
            icon: <ShieldCheck size={12} className="text-text-secondary" />,
          };
          const { timeStr, dateStr } = formatTimestamp(scan.created_at);

          return (
            <div
              key={scan.id}
              className="flex items-center justify-between gap-4 p-3 bg-surface-color/30 rounded border border-border-color/50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm text-text-primary uppercase m-0 leading-none truncate">
                  {scan.team_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] font-mono text-text-primary truncate">
                    {scan.team_id.slice(0, 8)}&hellip;
                  </span>
                  {scan.team_code && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border accent-tertiary/20 text-accent-tertiary border-accent-tertiary/40">
                      {scan.team_code}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-text-secondary m-0 mt-1">
                  {scan.team_track ? `${scan.team_track} • ` : ""}{scan.operator_name}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase border accent-tertiary/20 text-accent-tertiary border-accent-tertiary/40`}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border status-success/20 text-status-success border-status-success/40"
                >
                  <CheckCircle2 size={12} className="text-status-success" />
                  <span>Verified</span>
                </span>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-mono text-text-primary">{timeStr}</span>
                  <span className="text-[10px] text-text-secondary/60">{dateStr}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
