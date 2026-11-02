"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Activity,
  ArrowRight,
  Clock,
  Copy,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Gift,
  Utensils,
  Coffee,
  Award,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getActivityPage, type ActivityFilters } from "@/app/actions/live-activity";

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  registration: { label: "Check-In", icon: <UserCheck size={12} className="text-accent-tertiary" />, color: "accent-tertiary" },
  goodies: { label: "Goodies", icon: <Gift size={12} className="text-accent-primary" />, color: "accent-primary" },
  lunch: { label: "Lunch", icon: <Utensils size={12} className="text-accent-secondary" />, color: "accent-secondary" },
  snacks: { label: "Snacks", icon: <Coffee size={12} className="text-yellow-400" />, color: "yellow-400" },
  certificates: { label: "Certificate", icon: <Award size={12} className="text-purple-400" />, color: "purple-400" },
  scan_attempt: { label: "Scan Attempt", icon: <Activity size={12} className="text-text-secondary" />, color: "text-secondary" },
  verification_success: { label: "Verified", icon: <ShieldCheck size={12} className="text-status-success" />, color: "status-success" },
  verification_failed: { label: "Verification Failed", icon: <ShieldAlert size={12} className="text-status-error" />, color: "status-error" },
  correction: { label: "Correction", icon: <UserCheck size={12} className="text-accent-tertiary" />, color: "accent-tertiary" },
  reversal: { label: "Reversal", icon: <AlertCircle size={12} className="text-status-error" />, color: "status-error" },
};

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  success: { label: "Success", color: "status-success" },
  failure: { label: "Failure", color: "status-error" },
  rejected: { label: "Rejected", color: "status-error" },
  already_completed: { label: "Already Completed", color: "text-text-secondary" },
};

function formatLocal(iso: string | null | undefined, opts?: { utc?: boolean }) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (opts?.utc) {
      return d.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "UTC", timeZoneName: "short",
      }) + " UTC";
    }
    return d.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hr ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  } catch {
    return "";
  }
}

export default function LiveActivityPage() {
  const [filters, setFilters] = useState<ActivityFilters>({
    search: null,
    actionType: "all",
    method: "all",
    result: "all",
    from: null,
    to: null,
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(PAGE_SIZE);
  const [data, setData] = useState<{
    logs: any[];
    summary: any;
    total: number;
    hasMore: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showUtc, setShowUtc] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const mountedRef = useRef(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getActivityPage({ filters, page, pageSize });
      if (!mountedRef.current) return;
      setData(result);
      setUnauthorized(false);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Failed to load activity";
      const isAuth = /Unauthorized|Forbidden|authentication/i.test(msg);
      setUnauthorized(isAuth);
      setError(isAuth ? null : msg);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, page, pageSize]);

  const handleRefresh = useCallback(() => {
    setPage(1);
    void fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel("ops-live-activity-audit")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_activity_logs" },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!mountedRef.current) return;
    setPage(1);
    void fetchData();
  }, [filters, fetchData]);

  const summary = data?.summary ?? { total: 0, success: 0, failed: 0, checkIns: 0, distributions: 0 };
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;

  if (unauthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert size={48} className="text-status-error mb-4" />
        <h2 className="font-heading text-xl text-text-primary uppercase mb-2">Access Restricted</h2>
        <p className="text-text-secondary mb-6 max-w-md">
          Live Activity is restricted to operations staff and administrators. Sign in with an
          authorized operations account to view the audit log.
        </p>
        <Link
          href="/ops/scanner"
          className="px-4 py-2 bg-accent-tertiary hover:bg-accent-tertiary/80 text-black border border-accent-tertiary text-xs font-bold uppercase rounded transition-colors"
        >
          Back to Scanner Desk
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c14] text-text-primary font-tech">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-color pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-accent-tertiary" />
              <span className="text-[11px] font-bold uppercase tracking-[2px] text-accent-tertiary">
                Live Operations Audit
              </span>
            </div>
            <h1 className="font-heading text-2xl md:text-3xl text-text-primary uppercase m-0 mt-1">
              Live Activity Audit Window
            </h1>
            <p className="text-xs text-text-secondary m-0 mt-0.5">
              Persistent scan & distribution audit log. Opens independently of the scanner desk.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-2 bg-surface-color border border-border-color hover:bg-surface-color-light text-text-primary text-xs font-bold uppercase flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <Link
              href="/ops/scanner"
              className="px-3 py-2 bg-surface-color border border-border-color hover:bg-surface-color-light text-text-primary text-xs font-bold uppercase flex items-center gap-2 transition-colors"
            >
              <ArrowRight size={14} /> <span>Back to Scanner</span>
            </Link>
          </div>
        </div>

        {error && !data && (
          <div className="rounded-lg bg-status-error/10 border border-status-error/30 p-4 text-text-secondary text-xs">
            <AlertCircle size={16} className="mr-2 text-status-error" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Events"
            value={summary.total}
            icon={<Activity size={20} className="text-accent-tertiary" />}
            color="accent-tertiary"
          />
          <SummaryCard
            title="Successful"
            value={summary.success}
            icon={<CheckCircle2 size={20} className="text-status-success" />}
            color="status-success"
          />
          <SummaryCard
            title="Failed / Rejected"
            value={summary.failed}
            icon={<AlertCircle size={20} className="text-status-error" />}
            color="status-error"
          />
          <SummaryCard
            title="Distributions"
            value={summary.distributions}
            icon={<Gift size={20} className="text-accent-primary" />}
            color="accent-primary"
          />
        </div>

        <ActivityFilters
          filters={filters}
          onChange={setFilters}
          summaryCounts={{
            all: summary.total,
            registration: logs.filter((l: any) => l.action_type === "registration").length,
            goodies: logs.filter((l: any) => l.action_type === "goodies").length,
            lunch: logs.filter((l: any) => l.action_type === "lunch").length,
            snacks: logs.filter((l: any) => l.action_type === "snacks").length,
            certificates: logs.filter((l: any) => l.action_type === "certificates").length,
          }}
        />

        <div className="border border-border-color rounded-lg bg-surface-color/30 overflow-hidden">
          <div className="border-b border-border-color bg-surface-color/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold uppercase">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-accent-tertiary" />
              <span>Activity Feed &mdash; Newest First</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-text-secondary ml-2">
                <input
                  type="checkbox"
                  checked={showUtc}
                  onChange={() => setShowUtc((v) => !v)}
                  className="accent-accent-tertiary"
                />
                UTC timestamps
              </label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-color-light/30 text-text-secondary">
                <tr>
                  <th className="p-3 w-48">Timestamp</th>
                  <th className="p-3">Operator</th>
                  <th className="p-3 w-32">Role</th>
                  <th className="p-3 w-48">Team</th>
                  <th className="p-3 w-24">Method</th>
                  <th className="p-3 w-40">Action</th>
                  <th className="p-3 w-32">Item</th>
                  <th className="p-3 w-32 text-center">Result</th>
                  <th className="p-3 w-24 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/40">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-text-secondary">
                      {loading || refreshing ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw size={20} className="animate-spin text-accent-tertiary" />
                          <p className="m-0 text-xs">Loading audit events&hellip;</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <Activity size={40} className="text-text-secondary/40" />
                          <p className="m-0 text-sm">No activity events match the current filters.</p>
                          <p className="m-0 text-[10px] text-text-secondary/60">
                            Scan a badge or run a distribution from the scanner desk to see events appear here.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-surface-color-light/40 transition-colors group cursor-pointer"
                      onClick={() => setOpenDrawer(log.id === openDrawer ? null : log.id)}
                    >
                      <td className="p-3 font-mono text-text-primary">
                        <div>{formatLocal(log.created_at, { utc: showUtc })}</div>
                        <div className="text-[10px] text-text-secondary/60 mt-0.5">
                          {formatRelative(log.created_at)}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-accent-tertiary/10 border border-accent-tertiary/30 flex items-center justify-center text-[10px] font-bold text-accent-tertiary">
                            {log.operator_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="font-heading text-xs text-text-primary uppercase m-0 leading-none">
                              {log.operator_name || "Operations"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border uppercase">
                          {log.operator_role || "staff"}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-heading text-sm text-text-primary uppercase m-0">
                          {log.team_name}
                        </p>
                        {log.team_code && (
                          <p className="text-[10px] font-mono text-accent-secondary m-0 mt-0.5">
                            {log.team_code}
                          </p>
                        )}
                        {log.team_track && (
                          <p className="text-[10px] text-text-secondary/60 m-0 mt-0.5">
                            {log.team_track}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                          log.method === "manual"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                            : "bg-accent-tertiary/20 text-accent-tertiary border-accent-tertiary/50"
                        }`}>
                          {(log.method === "manual" ? "Manual" : "QR").toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {ACTION_LABELS[log.action_type]?.icon || <Activity size={12} />}
                          <span className="text-xs text-text-primary uppercase">{ACTION_LABELS[log.action_type]?.label || log.action_type}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="text-xs text-text-primary m-0">{log.item_name || "&mdash;"}</p>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${
                          RESULT_LABELS[log.result || ""]?.color
                            ? `bg-${RESULT_LABELS[log.result || ""].color === "status-success" ? "status-success" : RESULT_LABELS[log.result || ""].color === "status-error" ? "status-error" : "text-text-secondary"}/20 text-${
                                RESULT_LABELS[log.result || ""].color
                              } border-${RESULT_LABELS[log.result || ""].color === "status-success" ? "status-success" : RESULT_LABELS[log.result || ""].color === "status-error" ? "status-error" : "text-text-secondary"}/50`
                            : "bg-surface-color text-text-secondary border-border-color"
                        }`}>
                          {RESULT_LABELS[log.result || ""]?.label || log.result}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDrawer(log.id === openDrawer ? null : log.id);
                          }}
                          className="w-6 h-6 rounded border border-border-color hover:bg-surface-color-light text-text-secondary flex items-center justify-center text-[10px] transition-colors"
                          title={openDrawer === log.id ? "Close details" : "View details"}
                        >
                          <ChevronRight size={12} className={openDrawer === log.id ? "rotate-90" : ""} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="px-4 py-3 border-t border-border-color text-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 bg-surface-color border border-border-color hover:bg-surface-color-light text-accent-tertiary text-xs font-bold uppercase transition-colors"
              >
                Load More Events
              </button>
            </div>
          )}
        </div>

        {openDrawer && (
          <ActivityDetailDrawer
            log={logs.find((l) => l.id === openDrawer) ?? null}
            onClose={() => setOpenDrawer(null)}
            showUtc={showUtc}
          />
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    accent_tertiary: "border-accent-tertiary text-accent-tertiary bg-accent-tertiary/10",
    accent_primary: "border-accent-primary text-accent-primary bg-accent-primary/10",
    accent_secondary: "border-accent-secondary text-accent-secondary bg-accent-secondary/10",
    status_success: "border-status-success text-status-success bg-status-success/10",
    status_error: "border-status-error text-status-error bg-status-error/10",
  };
  return (
    <div className="rounded-lg border p-4 bg-surface-color/50">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded ${colorMap[color] || colorMap.accent_tertiary} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="font-heading text-2xl font-bold text-text-primary m-0">{value}</p>
      <p className="font-tech text-[10px] text-text-secondary uppercase tracking-wider m-0 mt-1">{title}</p>
    </div>
  );
}

function ActivityFilters({
  filters,
  onChange,
  summaryCounts,
}: {
  filters: ActivityFilters;
  onChange: (v: ActivityFilters) => void;
  summaryCounts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);

  const actionTabs = [
    { id: "all", label: "All Actions", count: summaryCounts.all },
    { id: "registration", label: "Check-In", count: summaryCounts.registration },
    { id: "goodies", label: "Goodies", count: summaryCounts.goodies },
    { id: "lunch", label: "Lunch", count: summaryCounts.lunch },
    { id: "snacks", label: "Snacks", count: summaryCounts.snacks },
    { id: "certificates", label: "Certificates", count: summaryCounts.certificates },
  ];

  return (
    <div className="border border-border-color rounded-lg bg-surface-color/40 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-text-primary">
          <Search size={14} /> Filters
        </h3>
        <span className="text-[10px]">{open ? "Collapse" : "Expand"}</span>
      </div>
      {!open ? null : (
        <div className="space-y-4 border-t border-border-color pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FilterSelect
              label="Action"
              value={filters.actionType ?? "all"}
              onChange={(v) =>
                onChange({ ...filters, actionType: (v === "all" ? "all" : v) as ActivityFilters["actionType"] })
              }
              options={actionTabs.map((t) => ({ value: t.id, label: `${t.label} (${t.count})` }))}
            />
            <FilterSelect
              label="Method"
              value={filters.method ?? "all"}
              onChange={(v) =>
                onChange({ ...filters, method: (v === "all" ? "all" : v) as ActivityFilters["method"] })
              }
              options={[
                { value: "all", label: "All Methods" },
                { value: "qr", label: "QR Scan" },
                { value: "manual", label: "Manual Lookup" },
              ]}
            />
            <FilterSelect
              label="Result"
              value={filters.result ?? "all"}
              onChange={(v) =>
                onChange({ ...filters, result: (v === "all" ? "all" : v) as ActivityFilters["result"] })
              }
              options={[
                { value: "all", label: "All Results" },
                { value: "success", label: "Success" },
                { value: "failure", label: "Failed" },
                { value: "rejected", label: "Rejected" },
                { value: "already_completed", label: "Already Completed" },
              ]}
            />
            <button
              onClick={() => {
                onChange({ ...filters, from: null, to: null });
              }}
              className="px-3 py-2 bg-surface-color border border-border-color hover:bg-surface-color-light text-text-secondary text-xs font-bold uppercase transition-colors"
            >
              Clear Dates
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-text-secondary uppercase font-bold">From</label>
              <input
                type="datetime-local"
                value={filters.from ? new Date(filters.from).toISOString().slice(0, 16) : ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...filters, from: e.target.value || null })
                }
                className="w-full bg-surface-color border border-border-color p-2 text-xs text-text-primary outline-none focus:border-accent-tertiary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-text-secondary uppercase font-bold">To</label>
              <input
                type="datetime-local"
                value={filters.to ? new Date(filters.to).toISOString().slice(0, 16) : ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...filters, to: e.target.value || null })
                }
                className="w-full bg-surface-color border border-border-color p-2 text-xs text-text-primary outline-none focus:border-accent-tertiary"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[10px] text-text-secondary uppercase font-bold shrink-0">Search</label>
            <input
              type="text"
              placeholder="Team, operator, participant&hellip;"
              value={filters.search ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...filters, search: e.target.value || null })
              }
              className="flex-1 bg-surface-color border border-border-color pl-8 pr-3 py-2 text-xs text-text-primary outline-none focus:border-accent-tertiary font-sans"
            />
            <Search size={14} className="text-text-secondary" />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() =>
                onChange({
                  search: null,
                  actionType: "all",
                  method: "all",
                  result: "all",
                  from: null,
                  to: null,
                })
              }
              className="flex-1 py-2 bg-surface-color border border-border-color hover:bg-surface-color-light text-text-secondary text-xs font-bold uppercase transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-text-secondary uppercase font-bold">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-color border border-border-color p-2 text-xs text-text-primary outline-none focus:border-accent-tertiary rounded"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ActivityDetailDrawer({
  log,
  onClose,
  showUtc,
}: {
  log: any | null;
  onClose: () => void;
  showUtc: boolean;
}) {
  if (!log) return null;

  const fields = [
    { label: "Activity ID", value: log.id, copy: true },
    { label: "Timestamp (local)", value: formatLocal(log.created_at), copy: false },
    { label: "Timestamp (UTC)", value: formatLocal(log.created_at, { utc: true }), copy: true },
    { label: "Event ID", value: log.event_id || "&mdash;", copy: true },
    { label: "Operator", value: log.operator_name || "&mdash;", copy: false },
    { label: "Operator Role", value: log.operator_role || "&mdash;", copy: false },
    { label: "Operator ID", value: log.operator_id || "&mdash;", copy: true },
    { label: "Method", value: (log.method === "manual" ? "Manual Team ID Lookup" : "QR Scan"), copy: false },
    { label: "Team ID", value: log.team_id || "&mdash;", copy: true },
    { label: "Team Name", value: log.team_name, copy: false },
    { label: "Team Code", value: log.team_code || "&mdash;", copy: true },
    { label: "Track", value: log.team_track || "&mdash;", copy: false },
    { label: "Participant ID", value: log.participant_id || "&mdash;", copy: true },
    { label: "Participant", value: log.participant_name, copy: false },
    { label: "Participant Role", value: log.participant_role || "&mdash;", copy: false },
    { label: "Action", value: log.action_type, copy: false },
    { label: "Item Distributed", value: log.item_name || "&mdash;", copy: false },
    { label: "Result", value: log.result || "&mdash;", copy: false },
    { label: "Previous Status", value: log.previous_status || "&mdash;", copy: false },
    { label: "New Status", value: log.new_status || "&mdash;", copy: false },
    { label: "Reason", value: log.reason || "&mdash;", copy: true },
    { label: "Reference ID", value: log.reference_id || "&mdash;", copy: true },
    { label: "Correlation ID", value: log.correlation_id || "&mdash;", copy: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 md:left-auto md:w-[700px] md:bottom-auto md:right-0 md:top-1/4 md:rounded-t-2xl md:border-t-0 border-t border-border-color animate-slide-up">
        <div className="bg-[#0c0c14] border border-border-color rounded-t-2xl p-6 md:p-8 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-xl text-text-primary uppercase">Event Details</h2>
            <button onClick={onClose} className="w-8 h-8 rounded border border-border-color hover:bg-surface-color-light flex items-center justify-center text-text-secondary transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.label} className="flex gap-4 border-b border-border-color/40 pb-2 last:border-0 last:pb-0">
                <span className="w-48 shrink-0 text-[11px] font-bold uppercase text-text-secondary">{f.label}</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs font-mono text-text-primary break-all">
                    {typeof f.value === "string" ? f.value : String(f.value)}
                  </span>
                  {f.copy && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(typeof f.value === "string" ? f.value : String(f.value));
                      }}
                      className="w-5 h-5 rounded border border-border-color hover:bg-surface-color-light text-[10px] text-text-secondary flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-4 border-t border-border-color flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-color border border-border-color hover:bg-surface-color-light text-text-primary text-xs font-bold uppercase transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// useRef is used for mountedRef above.
