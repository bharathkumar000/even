"use client";

import React, { useCallback, useState, useEffect } from "react";
import {
  Search,
  X,
  ArrowLeft,
  Users,
  ShieldCheck,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import {
  searchTeams,
  getTeamLookupDetails,
  type TeamSearchResult,
  type TeamLookupResult,
  type TeamLookupMember,
  type TeamLookupActivity,
} from "@/app/actions/operations";

// UUID regex for validation
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  registration: { label: "Check-In", icon: <ShieldCheck size={12} className="text-accent-tertiary" />, color: "accent-tertiary" },
  goodies: { label: "Kit Distribution", icon: <ShieldCheck size={12} className="text-accent-primary" />, color: "accent-primary" },
  lunch: { label: "Lunch", icon: <ShieldCheck size={12} className="text-accent-secondary" />, color: "accent-secondary" },
  snacks: { label: "Snacks", icon: <ShieldCheck size={12} className="text-yellow-400" />, color: "yellow-400" },
  certificates: { label: "Certificate", icon: <ShieldCheck size={12} className="text-purple-400" />, color: "purple-400" },
};

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  success: { label: "Success", color: "status-success" },
  failure: { label: "Failure", color: "status-error" },
  rejected: { label: "Rejected", color: "status-error" },
  already_completed: { label: "Already Completed", color: "text-text-secondary" },
};

function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
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

interface TeamLookupClientViewProps {
  initialTeamId?: string;
}

export default function TeamLookupClientView({ initialTeamId }: TeamLookupClientViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TeamSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedTeam, setSelectedTeam] = useState<TeamLookupResult | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If initial team ID provided (e.g., from scanner), load it
  useEffect(() => {
    if (initialTeamId) {
      void handleSearch(initialTeamId);
    }
  }, [initialTeamId]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setSearchResults([]);
    setSearchError(null);
    setSelectedTeam(null);
    setTeamError(null);

    if (!query || query.trim().length === 0) {
      return;
    }

    setSearchLoading(true);
    try {
      const result = await searchTeams(query.trim(), 20);
      if (result.error) {
        setSearchError(result.error);
      } else {
        setSearchResults(result.teams || []);
        // If exactly one UUID match, auto-select it
        if (result.teams && result.teams.length === 1 && UUID_REGEX.test(query.trim())) {
          await selectTeam(result.teams[0].id);
        }
      }
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const selectTeam = useCallback(async (teamId: string) => {
    setTeamLoading(true);
    setTeamError(null);
    setSelectedTeam(null);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const result = await getTeamLookupDetails(teamId);
      if (result.error) {
        setTeamError(result.error);
      } else {
        setSelectedTeam(result);
      }
    } catch (err: unknown) {
      setTeamError(err instanceof Error ? err.message : "Failed to load team details");
    } finally {
      setTeamLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSelectedTeam(null);
    setTeamError(null);
    setSuccessMsg(null);
    setErrorMsg(null);
  }, []);

  const isActionClaimed = (participantId: string, actionType: string) => {
    if (!selectedTeam) return false;
    return selectedTeam.activity.some(
      (a) => a.action_type === actionType && a.result === "success"
    );
  };

  if (searchLoading || teamLoading) {
    return (
      <div className="glass-panel p-12 border border-border-color rounded-lg text-center">
        <Loader2 size={24} className="animate-spin text-accent-tertiary mx-auto mb-3" />
        <p className="text-xs text-text-secondary uppercase tracking-wider font-bold">
          {searchLoading ? "Searching teams…" : "Loading team details…"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 bg-status-success/15 border border-status-success text-status-success font-tech text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-status-error/15 border border-status-error text-status-error font-tech text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}
      {searchError && (
        <div className="p-4 bg-status-error/15 border border-status-error text-status-error font-tech text-xs rounded">
          {searchError}
        </div>
      )}
      {teamError && (
        <div className="p-4 bg-status-error/15 border border-status-error text-status-error font-tech text-xs rounded">
          {teamError}
        </div>
      )}

      {/* Search Section */}
      <div className="glass-panel p-6 border border-border-color rounded-lg">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Enter Team ID or team name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(searchQuery)}
              className="w-full pl-9 pr-4 py-3 bg-surface-color border border-border-color rounded text-text-primary outline-none focus:border-accent-tertiary text-sm font-sans"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSearch(searchQuery)}
              disabled={searchLoading || !searchQuery.trim()}
              className="px-5 py-3 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase text-xs rounded transition-all disabled:opacity-50 hover:opacity-90 shadow-[0_0_18px_rgba(255,0,127,0.28)] flex items-center gap-2"
            >
              <Search size={14} />
              <span>Search</span>
            </button>
            <button
              onClick={clearSearch}
              disabled={!searchQuery && !selectedTeam}
              className="px-4 py-3 bg-surface-color border border-border-color text-text-primary font-tech font-bold uppercase text-xs rounded transition-all hover:bg-surface-color-light"
            >
              <X size={14} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {searchQuery && !searchLoading && searchResults.length === 0 && !searchError && (
          <p className="mt-4 text-center text-xs text-text-secondary/60 italic">
            No teams found matching "{searchQuery}".
          </p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-6 border border-border-color rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-color-light/40 text-text-secondary uppercase tracking-wider">
                <tr>
                  <th className="p-3 w-48">Team Name</th>
                  <th className="p-3 w-24 text-center">Team ID</th>
                  <th className="p-3 w-20 text-center">Track</th>
                  <th className="p-3 w-20 text-center">Members</th>
                  <th className="p-3 w-24 text-center">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {searchResults.map((team) => (
                  <tr
                    key={team.id}
                    className="hover:bg-surface-color-light/20 transition-colors cursor-pointer"
                    onClick={() => selectTeam(team.id)}
                  >
                    <td className="p-3 text-text-primary truncate max-w-xs">
                      {team.name}
                      {team.leader_name && (
                        <span className="text-[10px] text-text-secondary/60 block mt-0.5">
                          Leader: {team.leader_name}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono text-text-secondary truncate max-w-xs">
                      {team.id.slice(0, 8)}&hellip;
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border accent-tertiary/20 text-accent-tertiary border-accent-tertiary/40">
                        {team.track || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-center text-text-secondary">{team.member_count}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        team.status === "active"
                          ? "bg-status-success/10 text-status-success border-status-success/40"
                          : "bg-surface-color text-text-secondary border-border-color"
                      }`}>
                        {team.status || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectTeam(team.id);
                        }}
                        className="px-3 py-1 border border-accent-tertiary rounded text-accent-tertiary text-[10px] font-bold uppercase hover:bg-accent-tertiary/10"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Team Details Section (Read-Only) */}
      {selectedTeam && selectedTeam.team && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={clearSearch}
              className="flex items-center gap-2 text-accent-tertiary text-xs font-bold uppercase hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to Search</span>
            </button>
          </div>

          {/* Team Header */}
          <div className="glass-panel p-6 border border-accent-tertiary/40 rounded-lg">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border accent-tertiary/20 text-accent-tertiary border-accent-tertiary/40">
                    {selectedTeam.team.track || "GENERAL"}
                  </span>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                    selectedTeam.team.status === "active"
                      ? "bg-status-success/10 text-status-success border-status-success/40"
                      : "bg-surface-color text-text-secondary border-border-color"
                  }`}>
                    {selectedTeam.team.status || "—"}
                  </span>
                  <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border text-text-secondary/20 text-text-secondary border-text-text-secondary/40">
                    READ-ONLY
                  </span>
                </div>
                <h2 className="font-heading text-2xl text-text-primary uppercase m-0 mt-2">
                  {selectedTeam.team.name}
                </h2>
                <p className="text-xs text-text-secondary m-0 mt-1 font-mono">
                  Team ID: {selectedTeam.team.id}
                </p>
                {selectedTeam.team.leader_name && (
                  <p className="text-xs text-text-primary m-0 mt-1">
                    Leader: <span className="font-bold">{selectedTeam.team.leader_name}</span>
                  </p>
                )}
                <p className="text-xs text-text-secondary m-0 mt-1">
                  Verification only — no status changes permitted.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-surface-color border border-border-color rounded text-center">
                  <span className="block text-[10px] text-text-secondary uppercase font-bold">
                    Members
                  </span>
                  <span className="block text-lg font-mono font-bold text-text-primary">
                    {selectedTeam.members.length}
                  </span>
                </div>
                <div className="p-3 bg-surface-color border border-border-color rounded text-center">
                  <span className="block text-[10px] text-text-secondary uppercase font-bold">
                    Last Scanned
                  </span>
                  <span className="block text-xs font-mono text-text-secondary">
                    {selectedTeam.team.last_scanned_at
                      ? formatTimestamp(selectedTeam.team.last_scanned_at)
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Member Roster (Read-Only) */}
          <div className="glass-panel p-6 border border-border-color rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-sm text-text-primary uppercase m-0">
                Team Members ({selectedTeam.members.length})
              </h3>
              <span className="text-[10px] text-text-secondary/60 font-mono uppercase">
                Read-only status
              </span>
            </div>
            {selectedTeam.members.length === 0 ? (
              <p className="text-center text-xs text-text-secondary/60 italic py-8">
                No team members found.
              </p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-surface-color-light/40 text-text-secondary uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Member</th>
                    <th className="p-3 w-20 text-center">Role</th>
                    <th className="p-3 w-24 text-center">Registration</th>
                    <th className="p-3 w-24 text-center">Kit / Goodies</th>
                    <th className="p-3 w-20 text-center">Lunch</th>
                    <th className="p-3 w-20 text-center">Snacks</th>
                    <th className="p-3 w-24 text-center">Certificates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/30">
                  {selectedTeam.members.map((member) => {
                    const regLog = selectedTeam.activity.find(
                      (a) => a.action_type === "registration" && a.result === "success"
                    );
                    const goodiesLog = selectedTeam.activity.find(
                      (a) => a.action_type === "goodies" && a.result === "success"
                    );
                    const lunchLogs = selectedTeam.activity.filter(
                      (a) => a.action_type === "lunch" && a.result === "success"
                    );
                    const snacksLogs = selectedTeam.activity.filter(
                      (a) => a.action_type === "snacks" && a.result === "success"
                    );
                    const certLog = selectedTeam.activity.find(
                      (a) => a.action_type === "certificates" && a.result === "success"
                    );

                    const statusBadge = (claimed: boolean, label: string) => (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        claimed
                          ? "bg-status-success/10 text-status-success border-status-success/40"
                          : "bg-surface-color text-text-secondary border-border-color"
                      }`}>
                        {claimed ? <CheckCircle2 size={11} className="text-status-success" /> : ""}
                        {label}
                      </span>
                    );

                    return (
                      <tr key={member.id} className="hover:bg-surface-color-light/20 transition-colors">
                        <td className="p-3">
                          <p className="font-heading text-sm text-text-primary uppercase m-0 leading-none">
                            {member.name || member.email?.split("@")[0] || "Member"}
                          </p>
                          <span className="text-[10px] font-mono text-text-secondary">
                            {member.email || member.user_id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                              member.role === "leader"
                                ? "bg-accent-secondary/15 text-accent-secondary border-accent-secondary"
                                : "bg-surface-color text-text-secondary border-border-color"
                            }`}
                          >
                            {member.role || "Member"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {statusBadge(Boolean(regLog), regLog ? "Checked-In" : "Pending")}
                          {regLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              {formatRelative(regLog.created_at)}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {statusBadge(Boolean(goodiesLog), goodiesLog ? "Distributed" : "Pending")}
                          {goodiesLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              {formatRelative(goodiesLog.created_at)}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {statusBadge(lunchLogs.length > 0, `${lunchLogs.length}/3`)}
                        </td>
                        <td className="p-3 text-center">
                          {statusBadge(snacksLogs.length > 0, `${snacksLogs.length}/3`)}
                        </td>
                        <td className="p-3 text-center">
                          {statusBadge(Boolean(certLog), certLog ? "Issued" : "Pending")}
                          {certLog && (
                            <p className="text-[9px] text-text-secondary font-mono m-0 mt-1">
                              {formatRelative(certLog.created_at)}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Activity Log (Read-Only) */}
          {selectedTeam.activity.length > 0 && (
            <div className="glass-panel p-6 border border-border-color rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-sm text-text-primary uppercase m-0">
                  Activity History
                </h3>
                <span className="text-[10px] font-mono text-text-secondary/60">
                  {selectedTeam.activity.length} record{selectedTeam.activity.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-surface-color-light/40 text-text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-32">Time</th>
                      <th className="p-3">Operator</th>
                      <th className="p-3 w-24 text-center">Action</th>
                      <th className="p-3 w-20 text-center">Method</th>
                      <th className="p-3 w-24 text-center">Result</th>
                      <th className="p-3">Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color/30">
                    {selectedTeam.activity.map((log) => {
                      const actionInfo = ACTION_LABELS[log.action_type] ?? {
                        label: log.action_type,
                        icon: <ShieldCheck size={12} className="text-text-secondary" />,
                        color: "text-secondary",
                      };
                      const resultInfo =
                        RESULT_LABELS[log.result || ""] ?? {
                          label: log.result || "—",
                          color: "text-text-secondary",
                        };

                      return (
                        <tr key={log.id} className="hover:bg-surface-color-light/20 transition-colors">
                          <td className="p-3 font-mono text-[10px] text-text-primary">
                            {formatTimestamp(log.created_at)}
                            <div className="text-[10px] text-text-secondary/60 mt-0.5">
                              {formatRelative(log.created_at)}
                            </div>
                          </td>
                          <td className="p-3">
                            <p className="font-heading text-xs text-text-primary uppercase m-0 leading-none">
                              {log.operator_name || "Operations"}
                            </p>
                            <span className="text-[10px] text-text-secondary/60">
                              {log.operator_role || "staff"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="flex items-center justify-center gap-1.5">
                              {actionInfo.icon}
                              <span className="text-[10px] text-text-primary uppercase">
                                {actionInfo.label}
                              </span>
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border accent-tertiary/20 text-accent-tertiary border-accent-tertiary/40">
                              {(log.method === "manual" ? "Manual" : "QR")}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              resultInfo.color === "status-success"
                                ? "bg-status-success/10 text-status-success border-status-success/40"
                                : resultInfo.color === "status-error"
                                ? "bg-status-error/10 text-status-error border-status-error/40"
                                : "bg-surface-color text-text-secondary border-border-color"
                            }`}>
                              {resultInfo.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <p className="text-xs text-text-primary m-0 truncate max-w-xs">
                              {log.item_name || "—"}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
