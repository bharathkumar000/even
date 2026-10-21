"use client";

import React, { useState, useEffect } from "react";
import {
  Gift,
  UserCheck,
  Utensils,
  Coffee,
  Search,
  RefreshCw,
  Radio,
  CheckCircle2,
  Clock,
  ShieldCheck,
  User,
} from "lucide-react";
import type { LiveActivityFeedItem } from "@/app/actions/operations";
import type { ActionType } from "@/lib/validations/operations";

interface LiveActivityStreamProps {
  logs: LiveActivityFeedItem[];
  loading: boolean;
  onRefresh: () => void;
  lastSyncTime?: Date;
}

export default function LiveActivityStream({
  logs,
  loading,
  onRefresh,
  lastSyncTime,
}: LiveActivityStreamProps) {
  const [filterAction, setFilterAction] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const getActionBadge = (action: ActionType) => {
    switch (action) {
      case "goodies":
        return {
          icon: <Gift size={13} className="text-accent-primary" />,
          label: "Goodies Distributed",
          cls: "bg-accent-primary/15 text-accent-primary border-accent-primary",
        };
      case "registration":
        return {
          icon: <UserCheck size={13} className="text-accent-tertiary" />,
          label: "Registration Check-In",
          cls: "bg-accent-tertiary/15 text-accent-tertiary border-accent-tertiary",
        };
      case "lunch":
        return {
          icon: <Utensils size={13} className="text-accent-secondary" />,
          label: "Lunch Token",
          cls: "bg-accent-secondary/15 text-accent-secondary border-accent-secondary",
        };
      case "snacks":
        return {
          icon: <Coffee size={13} className="text-yellow-400" />,
          label: "Snacks Token",
          cls: "bg-yellow-400/15 text-yellow-400 border-yellow-400/60",
        };
      default:
        return {
          icon: <CheckCircle2 size={13} className="text-text-secondary" />,
          label: action,
          cls: "bg-surface-color text-text-secondary border-border-color",
        };
    }
  };

  const formatTimestamp = (iso: string) => {
    if (!mounted) return { timeStr: "", dateStr: "", relativeStr: "" };
    try {
      const date = new Date(iso);
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

       // No relative time calculation to avoid hydration mismatch; leave empty
       const relativeStr = "";


      return { timeStr, dateStr, relativeStr };
    } catch {
      return { timeStr: iso, dateStr: "", relativeStr: "" };
    }
  };

  // Filter logs by tab & search query
  const filteredLogs = logs.filter((item) => {
    if (filterAction !== "all" && item.action_type !== filterAction) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTeam = item.team_name.toLowerCase().includes(q);
      const matchesScanner = item.scanner_name.toLowerCase().includes(q) || item.scanner_email.toLowerCase().includes(q);
      const matchesParticipant = item.participant_name.toLowerCase().includes(q);
      return matchesTeam || matchesScanner || matchesParticipant;
    }
    return true;
  });

  const countByAction = (act: string) =>
    act === "all" ? logs.length : logs.filter((l) => l.action_type === act).length;

  return (
    <div id="live-activity" className="glass-panel p-6 border border-border-color space-y-5 font-tech scroll-mt-20">
      {/* Top Header with Live Pulse */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-color pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-success"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[2px] text-status-success">
              Live Real-Time Telemetry Stream
            </span>
          </div>
          <h2 className="font-heading text-xl text-text-primary uppercase m-0 mt-1">
            Verification & Distribution Audit Feed
          </h2>
          <p className="text-xs text-text-secondary m-0 mt-0.5">
            Instant multi-station telemetry: Shows which club member scanned which team in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mounted && lastSyncTime && (
            <span className="text-[10px] text-text-secondary flex items-center gap-1 font-mono">
              <Clock size={12} />
               Sync: {lastSyncTime.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 bg-surface-color hover:bg-surface-color-light border border-border-color text-text-primary text-xs font-bold uppercase flex items-center gap-1.5 transition-colors"
            title="Refresh stream"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-accent-tertiary" : ""} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold uppercase">
          {[
            { id: "all", label: "All Scans" },
            { id: "goodies", label: "Goodies" },
            { id: "registration", label: "Check-In" },
            { id: "lunch", label: "Lunch" },
            { id: "snacks", label: "Snacks" },
          ].map((tab) => {
            const count = countByAction(tab.id);
            const active = filterAction === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterAction(tab.id)}
                className={`px-2.5 py-1 text-[11px] transition-all border flex items-center gap-1 ${
                  active
                    ? "bg-accent-tertiary/20 text-accent-tertiary border-accent-tertiary"
                    : "bg-surface-color text-text-secondary border-border-color hover:text-text-primary hover:border-text-secondary"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[9px] px-1 rounded ${
                    active ? "bg-accent-tertiary text-black" : "bg-surface-color-light text-text-secondary"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Filter by Team, Member, or Scanner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-color border border-border-color pl-8 pr-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent-tertiary font-sans"
          />
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="overflow-x-auto border border-border-color rounded bg-surface-color/40">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border-color bg-surface-color-light/60 text-text-secondary uppercase tracking-wider text-[11px]">
              <th className="p-3">Time & Desk</th>
              <th className="p-3">Club Member (Scanner)</th>
              <th className="p-3">Team & Participant</th>
              <th className="p-3">Perk / Action</th>
              <th className="p-3 text-right">Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color/30">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-text-secondary italic">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-accent-tertiary" />
                      <span>Loading real-time audit feed...</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Radio size={28} className="mx-auto text-text-secondary/40" />
                      <p className="m-0">No scan telemetry recorded for this filter.</p>
                      <p className="text-[10px] text-text-secondary/70 m-0">
                        When any club member scans a badge, the activity will immediately appear here.
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredLogs.map((item) => {
                const actionBadge = getActionBadge(item.action_type);
                const { timeStr, dateStr, relativeStr } = formatTimestamp(item.created_at);

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-color-light/30 transition-colors animate-fade-in"
                  >
                    {/* Timestamp */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-primary">
                        <Clock size={12} className="text-accent-tertiary" />
                        <span>{timeStr}</span>
                      </div>
          <div className="text-[10px] text-text-secondary mt-0.5 flex items-center gap-1 font-mono">
            <span>{dateStr}</span>
            {relativeStr && <span className="text-accent-tertiary font-bold">({relativeStr})</span>}
          </div>
                    </td>

                    {/* Club Member / Scanner */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-accent-tertiary/10 border border-accent-tertiary/40 flex items-center justify-center text-accent-tertiary font-bold text-[10px]">
                          {item.scanner_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-heading text-xs text-text-primary uppercase m-0 leading-none">
                            {item.scanner_name}
                          </p>
                          <p className="font-mono text-[10px] text-text-secondary m-0 mt-0.5">
                            {item.scanner_email || "Club Member Desk"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Team & Participant */}
                    <td className="p-3">
                      <div>
                        <span className="font-heading text-sm text-text-primary uppercase">
                          {item.team_name}
                        </span>
                        {item.team_track && (
                          <span className="ml-1.5 text-[9px] uppercase px-1.5 py-0.5 bg-surface-color border border-border-color text-accent-secondary">
                            {item.team_track}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-text-secondary mt-0.5 flex items-center gap-1">
                        <User size={11} className="text-text-secondary" />
                        <span>{item.participant_name}</span>
                        <span className="text-text-secondary/60">({item.participant_role})</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-[10px] uppercase font-bold ${actionBadge.cls}`}
                      >
                        {actionBadge.icon}
                        <span>{actionBadge.label}</span>
                      </span>
                    </td>

                    {/* Verification Status */}
                    <td className="p-3 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] text-status-success font-bold uppercase">
                        <ShieldCheck size={13} />
                        <span>Claim Verified</span>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
