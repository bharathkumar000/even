"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  ShieldAlert,
  Clock,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Gift,
  Utensils,
  Coffee,
  Award,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  Copy,
  X,
  Radio,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getActivityPage,
  type ActivityPageResult,
  type ActivityLogRow,
  type ActivityFilters,
} from "@/app/actions/live-activity";
import type { AuditLogItem } from "@/app/actions/admin-audit-logs";

interface AuditLogsClientProps {
  initialActivity: ActivityPageResult;
  initialAdminLogs: AuditLogItem[];
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  registration: { label: "Check-In", icon: <UserCheck size={13} className="text-accent-tertiary" />, color: "accent-tertiary" },
  goodies: { label: "Goodies", icon: <Gift size={13} className="text-accent-primary" />, color: "accent-primary" },
  lunch: { label: "Lunch", icon: <Utensils size={13} className="text-accent-secondary" />, color: "accent-secondary" },
  snacks: { label: "Snacks", icon: <Coffee size={13} className="text-yellow-400" />, color: "yellow-400" },
  certificates: { label: "Certificate", icon: <Award size={13} className="text-purple-400" />, color: "purple-400" },
  scan_attempt: { label: "Scan Attempt", icon: <Activity size={13} className="text-text-secondary" />, color: "text-secondary" },
  verification_success: { label: "Verified", icon: <ShieldCheck size={13} className="text-status-success" />, color: "status-success" },
  verification_failed: { label: "Failed", icon: <ShieldAlert size={13} className="text-status-error" />, color: "status-error" },
  correction: { label: "Correction", icon: <UserCheck size={13} className="text-accent-tertiary" />, color: "accent-tertiary" },
  reversal: { label: "Reversal", icon: <AlertCircle size={13} className="text-status-error" />, color: "status-error" },
};

const RESULT_BADGES: Record<string, { label: string; className: string }> = {
  success: { label: "Success", className: "bg-status-success/20 text-status-success border-status-success/40" },
  failure: { label: "Failure", className: "bg-status-error/20 text-status-error border-status-error/40" },
  rejected: { label: "Rejected", className: "bg-status-error/20 text-status-error border-status-error/40" },
  already_completed: { label: "Claimed", className: "bg-surface-color text-text-secondary border-border-color" },
};

function formatLocalTime(iso?: string | null, opts?: { utc?: boolean }) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (opts?.utc) {
      return d.toISOString().replace("T", " ").replace("Z", " UTC");
    }
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso?: string | null) {
  if (!iso) return "";
  try {
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 45) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch {
    return "";
  }
}

export default function AuditLogsClientView({
  initialActivity,
  initialAdminLogs,
}: AuditLogsClientProps) {
  const [activeTab, setActiveTab] = useState<"operations" | "system">("operations");

  // Operations activity state
  const [activityData, setActivityData] = useState<ActivityPageResult>(initialActivity);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [showUtc, setShowUtc] = useState(false);
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);

  // System audit logs state
  const [adminLogs] = useState<AuditLogItem[]>(initialAdminLogs);
  const [adminSearch, setAdminSearch] = useState("");

  const mountedRef = useRef(false);

  // Fetch operations logs with active filters
  const fetchOperationsLogs = useCallback(
    async (isRefresh = false, pageNum = 1) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const filters: ActivityFilters = {
          search: searchQuery.trim() || null,
          actionType: (actionFilter as any) || "all",
          method: (methodFilter as any) || "all",
          result: (resultFilter as any) || "all",
        };
        const res = await getActivityPage({ filters, page: pageNum, pageSize });
        if (!mountedRef.current) return;
        setActivityData(res);
      } catch (err) {
        console.warn("Failed to load operations audit activity:", err);
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery, actionFilter, methodFilter, resultFilter, pageSize]
  );

  // Real-time listener for event_activity_logs (same table as staff/spoc)
  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();

    const channel = supabase
      .channel("admin_realtime_activity_logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_activity_logs" },
        () => {
          void fetchOperationsLogs(true, page);
        }
      )
      .on("broadcast", { event: "scan_action_recorded" }, () => {
        void fetchOperationsLogs(true, page);
      })
      .subscribe();

    // Gentle polling interval every 8 seconds
    const interval = setInterval(() => {
      void fetchOperationsLogs(true, page);
    }, 8000);

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchOperationsLogs, page]);

  // Refetch when filters change
  useEffect(() => {
    if (!mountedRef.current) return;
    setPage(1);
    void fetchOperationsLogs(false, 1);
  }, [searchQuery, actionFilter, methodFilter, resultFilter, fetchOperationsLogs]);

  const summary = activityData.summary || {
    total: 0,
    success: 0,
    failed: 0,
    checkIns: 0,
    distributions: 0,
  };

  const logs = activityData.logs || [];
  const selectedLog = logs.find((l) => l.id === openDrawerId) || null;

  // Filtered system audit logs
  const filteredAdminLogs = adminLogs.filter((log) => {
    if (!adminSearch) return true;
    const q = adminSearch.toLowerCase();
    const action = log.action?.toLowerCase() || "";
    const admin = log.admin_id?.toLowerCase() || "";
    const entity = log.entity_id?.toLowerCase() || "";
    const reason = typeof log.details === "object" ? JSON.stringify(log.details).toLowerCase() : "";
    return action.includes(q) || admin.includes(q) || entity.includes(q) || reason.includes(q);
  });

  return (
    <div className="space-y-6 font-tech">
      {/* Top Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-color pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("operations")}
            className={`px-4 py-2 text-xs font-bold uppercase transition-all rounded flex items-center gap-2 border ${
              activeTab === "operations"
                ? "bg-accent-secondary text-white border-accent-secondary shadow-lg shadow-accent-secondary/20"
                : "bg-surface-color text-text-secondary border-border-color hover:text-text-primary hover:border-accent-secondary/50"
            }`}
          >
            <Activity size={14} className={activeTab === "operations" ? "animate-pulse" : ""} />
            <span>Operations & Scanner Activity</span>
            <span className="px-1.5 py-0.2 rounded bg-black/40 text-[10px] font-mono">
              {summary.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("system")}
            className={`px-4 py-2 text-xs font-bold uppercase transition-all rounded flex items-center gap-2 border ${
              activeTab === "system"
                ? "bg-accent-secondary text-white border-accent-secondary shadow-lg shadow-accent-secondary/20"
                : "bg-surface-color text-text-secondary border-border-color hover:text-text-primary hover:border-accent-secondary/50"
            }`}
          >
            <FileText size={14} />
            <span>System & Security Audits</span>
            <span className="px-1.5 py-0.2 rounded bg-black/40 text-[10px] font-mono">
              {adminLogs.length}
            </span>
          </button>
        </div>

        {activeTab === "operations" && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-color border border-border-color text-text-secondary text-[11px] font-mono rounded">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
              Live Sync Active
            </span>

            <button
              type="button"
              onClick={() => void fetchOperationsLogs(true, page)}
              disabled={refreshing}
              className="px-3 py-1.5 bg-surface-color border border-border-color hover:bg-surface-color-light text-text-primary text-xs font-bold uppercase flex items-center gap-1.5 transition-colors disabled:opacity-50 rounded"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-accent-secondary" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: OPERATIONS & SCANNER ACTIVITY (REALTIME) */}
      {activeTab === "operations" && (
        <div className="space-y-6">
          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="glass-panel p-3.5 border border-border-color bg-surface-color/40 rounded flex flex-col justify-between">
              <div className="flex items-center justify-between text-text-secondary text-[11px] uppercase font-bold">
                <span>Total Actions</span>
                <Activity size={16} className="text-accent-tertiary" />
              </div>
              <div className="text-2xl font-heading text-text-primary mt-1 font-bold">
                {summary.total}
              </div>
            </div>

            <div className="glass-panel p-3.5 border border-status-success/30 bg-status-success/5 rounded flex flex-col justify-between">
              <div className="flex items-center justify-between text-status-success text-[11px] uppercase font-bold">
                <span>Successful</span>
                <CheckCircle2 size={16} className="text-status-success" />
              </div>
              <div className="text-2xl font-heading text-status-success mt-1 font-bold">
                {summary.success}
              </div>
            </div>

            <div className="glass-panel p-3.5 border border-status-error/30 bg-status-error/5 rounded flex flex-col justify-between">
              <div className="flex items-center justify-between text-status-error text-[11px] uppercase font-bold">
                <span>Failed / Rejected</span>
                <AlertCircle size={16} className="text-status-error" />
              </div>
              <div className="text-2xl font-heading text-status-error mt-1 font-bold">
                {summary.failed}
              </div>
            </div>

            <div className="glass-panel p-3.5 border border-accent-secondary/30 bg-accent-secondary/5 rounded flex flex-col justify-between">
              <div className="flex items-center justify-between text-accent-secondary text-[11px] uppercase font-bold">
                <span>Check-Ins</span>
                <UserCheck size={16} className="text-accent-secondary" />
              </div>
              <div className="text-2xl font-heading text-text-primary mt-1 font-bold">
                {summary.checkIns}
              </div>
            </div>

            <div className="glass-panel p-3.5 border border-accent-primary/30 bg-accent-primary/5 rounded flex flex-col justify-between">
              <div className="flex items-center justify-between text-accent-primary text-[11px] uppercase font-bold">
                <span>Distributions</span>
                <Gift size={16} className="text-accent-primary" />
              </div>
              <div className="text-2xl font-heading text-text-primary mt-1 font-bold">
                {summary.distributions}
              </div>
            </div>
          </div>

          {/* Filters & Search Header */}
          <div className="glass-panel p-4 border border-border-color bg-surface-color/50 rounded space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-2.5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search team name, code, participant, operator, item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-color border border-border-color text-text-primary text-xs pl-9 pr-3 py-2 focus:border-accent-secondary outline-none rounded font-sans"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="bg-surface-color border border-border-color text-text-primary text-xs px-2.5 py-2 focus:border-accent-secondary outline-none rounded uppercase"
                >
                  <option value="all">All Actions</option>
                  <option value="registration">Registration / Check-In</option>
                  <option value="lunch">Lunch</option>
                  <option value="snacks">Snacks</option>
                  <option value="goodies">Goodies</option>
                  <option value="certificates">Certificates</option>
                  <option value="verification_success">Verification Success</option>
                  <option value="verification_failed">Verification Failed</option>
                  <option value="correction">Correction</option>
                  <option value="reversal">Reversal</option>
                </select>

                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="bg-surface-color border border-border-color text-text-primary text-xs px-2.5 py-2 focus:border-accent-secondary outline-none rounded uppercase"
                >
                  <option value="all">All Methods</option>
                  <option value="qr">QR Code</option>
                  <option value="manual">Manual Entry</option>
                </select>

                <select
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                  className="bg-surface-color border border-border-color text-text-primary text-xs px-2.5 py-2 focus:border-accent-secondary outline-none rounded uppercase"
                >
                  <option value="all">All Results</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="rejected">Rejected</option>
                  <option value="already_completed">Already Completed</option>
                </select>

                <label className="text-text-secondary text-xs flex items-center gap-1.5 cursor-pointer ml-1">
                  <input
                    type="checkbox"
                    checked={showUtc}
                    onChange={(e) => setShowUtc(e.target.checked)}
                    className="accent-accent-secondary"
                  />
                  <span>UTC</span>
                </label>
              </div>
            </div>
          </div>

          {/* Activity Table */}
          <div className="glass-panel overflow-x-auto border border-border-color rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="border-b border-border-color bg-surface-color-light/40 text-text-secondary uppercase tracking-wider">
                <tr>
                  <th className="p-3 w-40">Timestamp</th>
                  <th className="p-3">Operator</th>
                  <th className="p-3">Team</th>
                  <th className="p-3">Participant</th>
                  <th className="p-3 text-center w-24">Method</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Item / Target</th>
                  <th className="p-3 text-center w-24">Result</th>
                  <th className="p-3 text-center w-16">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-text-secondary italic">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw size={20} className="animate-spin text-accent-secondary" />
                          <p className="m-0 text-xs">Loading live scanner audit events...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Activity size={32} className="text-text-secondary/40" />
                          <p className="m-0">No scanner or distribution events match current filters.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const actionMeta = ACTION_LABELS[log.action_type] || {
                      label: log.action_type,
                      icon: <Activity size={13} />,
                      color: "text-text-secondary",
                    };
                    const resultBadge = RESULT_BADGES[log.result || ""] || {
                      label: log.result || "-",
                      className: "bg-surface-color text-text-secondary border-border-color",
                    };

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setOpenDrawerId(log.id === openDrawerId ? null : log.id)}
                        className="hover:bg-surface-color-light/30 transition-colors cursor-pointer group"
                      >
                        <td className="p-3 whitespace-nowrap font-mono text-text-secondary">
                          <div className="text-text-primary">
                            {formatLocalTime(log.created_at, { utc: showUtc })}
                          </div>
                          <div className="text-[10px] text-text-secondary/60">
                            {formatRelative(log.created_at)}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-accent-secondary/15 border border-accent-secondary/30 flex items-center justify-center text-[10px] font-bold text-accent-secondary">
                              {log.operator_name?.charAt(0)?.toUpperCase() || "O"}
                            </span>
                            <div>
                              <p className="font-heading text-xs text-text-primary uppercase m-0 leading-tight">
                                {log.operator_name || "Operations"}
                              </p>
                              <span className="text-[10px] font-mono text-text-secondary uppercase">
                                {log.operator_role || "staff"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <p className="font-heading text-xs text-text-primary uppercase m-0 leading-tight">
                            {log.team_name || "Unknown Team"}
                          </p>
                          {log.team_code && (
                            <span className="text-[10px] font-mono text-accent-secondary">
                              {log.team_code}
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          <p className="text-xs text-text-primary m-0">
                            {log.participant_name || "Participant"}
                          </p>
                          {log.participant_role && (
                            <span className="text-[10px] text-text-secondary uppercase">
                              {log.participant_role}
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                              log.method === "manual"
                                ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/40"
                                : "bg-accent-tertiary/15 text-accent-tertiary border-accent-tertiary/40"
                            }`}
                          >
                            {(log.method || "QR").toUpperCase()}
                          </span>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {actionMeta.icon}
                            <span className="font-bold uppercase text-xs">
                              {actionMeta.label}
                            </span>
                          </div>
                        </td>

                        <td className="p-3 text-text-secondary max-w-xs truncate">
                          {log.item_name || log.reason || "-"}
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${resultBadge.className}`}
                          >
                            {resultBadge.label}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <button
                            type="button"
                            className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-color transition-colors"
                            title="View log details"
                          >
                            <ChevronRight
                              size={14}
                              className={`transition-transform ${openDrawerId === log.id ? "rotate-90 text-accent-secondary" : ""}`}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination / Load More */}
          {activityData.hasMore && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  void fetchOperationsLogs(false, nextPage);
                }}
                className="px-4 py-2 bg-surface-color border border-border-color hover:border-accent-secondary text-text-primary text-xs font-bold uppercase transition-colors rounded"
              >
                Load More Events
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SYSTEM & ADMINISTRATIVE AUDITS */}
      {activeTab === "system" && (
        <div className="space-y-4">
          <div className="glass-panel p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-border-color rounded">
            <div className="flex items-center gap-2 text-text-secondary text-xs">
              <ShieldAlert size={16} className="text-accent-secondary" />
              <span className="uppercase font-bold">Total System Actions: {adminLogs.length}</span>
            </div>

            <div className="relative w-full md:w-80">
              <Search size={15} className="absolute left-3 top-2.5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search action, admin, or target ID..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                className="w-full bg-surface-color border border-border-color text-text-primary text-xs font-sans pl-9 pr-3 py-1.5 focus:border-accent-secondary outline-none rounded"
              />
            </div>
          </div>

          <div className="glass-panel overflow-x-auto border border-border-color rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="border-b border-border-color bg-surface-color-light/40 text-text-secondary uppercase tracking-wider">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Admin ID</th>
                  <th className="p-3">Entity / Target</th>
                  <th className="p-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {filteredAdminLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-text-secondary italic">
                      No administrative system log entries recorded matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAdminLogs.map((log) => {
                    const details =
                      typeof log.details === "object" && log.details !== null
                        ? (log.details as Record<string, unknown>)
                        : null;
                    const reason =
                      typeof details?.reason === "string"
                        ? details.reason
                        : typeof details?.action === "string"
                        ? details.action
                        : "-";

                    return (
                      <tr key={log.id} className="hover:bg-surface-color-light/20 transition-colors">
                        <td className="p-3 text-text-secondary whitespace-nowrap flex items-center gap-1.5 font-mono">
                          <Clock size={13} className="text-accent-secondary" />
                          {log.created_at ? new Date(log.created_at).toLocaleString() : "Unknown"}
                        </td>
                        <td className="p-3 font-bold text-accent-tertiary uppercase">
                          {log.action}
                        </td>
                        <td className="p-3 font-mono text-text-primary">
                          {log.admin_id ? log.admin_id.slice(0, 8) + "..." : "System"}
                        </td>
                        <td className="p-3 font-mono text-text-secondary">
                          {log.entity_id ? log.entity_id.slice(0, 8) + "..." : log.entity_type || "-"}
                        </td>
                        <td className="p-3 text-text-secondary max-w-xs truncate" title={JSON.stringify(details || {})}>
                          {reason}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Inspection Drawer */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex justify-end"
          onClick={() => setOpenDrawerId(null)}
        >
          <div
            className="w-full max-w-lg bg-[#0a0a14] border-l border-border-color h-full p-6 overflow-y-auto space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-color pb-4">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-accent-secondary" />
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                  Audit Event Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenDrawerId(null)}
                className="text-text-secondary hover:text-text-primary p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="glass-panel p-3 border border-border-color rounded space-y-2">
                <span className="text-[10px] text-text-secondary uppercase block">
                  Event Identity
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-text-primary">{selectedLog.id}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(selectedLog.id)}
                    className="text-accent-secondary hover:underline text-[10px] uppercase flex items-center gap-1"
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="glass-panel p-3 border border-border-color rounded">
                  <span className="text-[10px] text-text-secondary uppercase block mb-1">
                    Action Type
                  </span>
                  <span className="text-accent-tertiary font-bold uppercase">
                    {selectedLog.action_type}
                  </span>
                </div>

                <div className="glass-panel p-3 border border-border-color rounded">
                  <span className="text-[10px] text-text-secondary uppercase block mb-1">
                    Result Status
                  </span>
                  <span
                    className={`font-bold uppercase ${
                      selectedLog.result === "success"
                        ? "text-status-success"
                        : "text-status-error"
                    }`}
                  >
                    {selectedLog.result}
                  </span>
                </div>
              </div>

              <div className="glass-panel p-3 border border-border-color rounded space-y-2">
                <span className="text-[10px] text-text-secondary uppercase block">
                  Operator Credentials
                </span>
                <p className="text-text-primary m-0 font-bold uppercase">
                  {selectedLog.operator_name || "Operations Desk"}
                </p>
                <p className="text-text-secondary m-0 text-[11px]">
                  Role: <span className="text-accent-secondary uppercase">{selectedLog.operator_role || "staff"}</span>
                </p>
                {selectedLog.operator_id && (
                  <p className="text-text-secondary/60 text-[10px] m-0">
                    ID: {selectedLog.operator_id}
                  </p>
                )}
              </div>

              <div className="glass-panel p-3 border border-border-color rounded space-y-2">
                <span className="text-[10px] text-text-secondary uppercase block">
                  Target Team & Participant
                </span>
                <p className="text-text-primary m-0 font-bold uppercase text-sm">
                  {selectedLog.team_name}
                </p>
                {selectedLog.team_code && (
                  <p className="text-accent-secondary m-0">
                    Code: {selectedLog.team_code}
                  </p>
                )}
                <p className="text-text-secondary m-0">
                  Participant: {selectedLog.participant_name} ({selectedLog.participant_role})
                </p>
              </div>

              <div className="glass-panel p-3 border border-border-color rounded space-y-1.5">
                <span className="text-[10px] text-text-secondary uppercase block">
                  Status Transition
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-surface-color border border-border-color text-text-secondary">
                    {selectedLog.previous_status || "None"}
                  </span>
                  <span className="text-text-secondary">&rarr;</span>
                  <span className="px-2 py-0.5 rounded bg-status-success/20 border border-status-success/40 text-status-success font-bold">
                    {selectedLog.new_status || "Claimed"}
                  </span>
                </div>
                {selectedLog.reason && (
                  <p className="text-status-error m-0 text-[11px] mt-1">
                    Reason: {selectedLog.reason}
                  </p>
                )}
              </div>

              <div className="glass-panel p-3 border border-border-color rounded space-y-1">
                <span className="text-[10px] text-text-secondary uppercase block">
                  Timestamps
                </span>
                <p className="text-text-primary m-0 text-[11px]">
                  Local: {formatLocalTime(selectedLog.created_at, { utc: false })}
                </p>
                <p className="text-text-secondary m-0 text-[11px]">
                  UTC: {formatLocalTime(selectedLog.created_at, { utc: true })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
