"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRealtimeSync } from "@/lib/realtime/use-realtime-sync";
import {
  Users,
  Search,
  X,
  ExternalLink,
  Mail,
  Phone,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Building2,
  User,
  Loader2,
  RefreshCw,
  Eye,
  ArrowLeft,
  Shield,
  Target,
  RotateCcw,
  FileText,
  Trophy,
  Github,
} from "lucide-react";
import { getMyAssignedTeams, AssignedTeam, StaffAssignedTeamsData } from "@/app/actions/staff-assigned-teams";

type FilterStatus = "all" | "active" | "inactive" | "pending";
type FilterTrack = "all" | string;

interface AssignedTeamsClientProps {
  initialData: StaffAssignedTeamsData;
}

export default function AssignedTeamsClientView({
  initialData,
}: AssignedTeamsClientProps) {
  const [teams, setTeams] = useState<AssignedTeam[]>(initialData.teams || []);
  const [staff, setStaff] = useState<StaffAssignedTeamsData["staff"]>(initialData.staff);
  const [error, setError] = useState<string | null>(initialData.error || null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [trackFilter, setTrackFilter] = useState<FilterTrack>("all");

  // Team detail view state
  const [selectedTeam, setSelectedTeam] = useState<AssignedTeam | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Distinct tracks
  const tracks = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.track) set.add(t.track);
    });
    return Array.from(set).sort();
  }, [teams]);

  // Real-time sync for assigned teams
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyAssignedTeams();
      setTeams(data.teams || []);
      setStaff(data.staff);
      if (data.error) setError(data.error);
      setNotification({ type: "success", message: "Teams refreshed successfully" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh teams");
      setNotification({ type: "error", message: "Failed to refresh teams" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { isConnected, lastSynced } = useRealtimeSync({
    channelName: `ops-assigned-teams-${staff?.id || "unknown"}`,
    tables: [
      "team_spoc_assignments",
      "spocs",
      "teams",
      "team_members",
      "team_submissions",
      "event_results",
    ],
    onChange: handleRefresh,
    pollIntervalMs: 60000,
    enabled: !!staff,
    pollEnabled: true,
    focusRefresh: true,
  });

  useEffect(() => {
    if (lastSynced) {
      setNotification({
        type: "success",
        message: `Teams synchronized ${lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      });
      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSynced]);

  // Filtered teams
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      if (statusFilter !== "all" && team.status !== statusFilter) return false;
      if (trackFilter !== "all" && team.track !== trackFilter) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        team.name.toLowerCase().includes(q) ||
        team.code?.toLowerCase().includes(q) ||
        team.track?.toLowerCase().includes(q) ||
        team.id.toLowerCase().includes(q)
      );
    });
  }, [teams, searchQuery, statusFilter, trackFilter]);

  const handleOpenDetail = (team: AssignedTeam) => {
    setSelectedTeam(team);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setSelectedTeam(null);
    setIsDetailOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2 py-0.5 bg-status-success/15 border border-status-success text-status-success text-[10px] font-tech font-bold uppercase">
            ACTIVE
          </span>
        );
      case "inactive":
        return (
          <span className="px-2 py-0.5 bg-status-warning/15 border border-status-warning text-status-warning text-[10px] font-tech font-bold uppercase">
            INACTIVE
          </span>
        );
      case "pending":
        return (
          <span className="px-2 py-0.5 bg-accent-secondary/15 border border-accent-secondary text-accent-secondary text-[10px] font-tech font-bold uppercase">
            PENDING
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-accent-primary/15 border border-accent-primary text-accent-primary text-[10px] font-tech font-bold uppercase">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/ops/scanner"
            className="p-2 text-text-secondary hover:text-text-primary transition-colors"
            title="Back to Operations Portal"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
              <Shield className="w-7 h-7 md:w-9 md:h-9 text-accent-secondary" />
              My Assigned Teams
            </h1>
            <p className="font-tech text-text-secondary text-sm mt-1 max-w-2xl m-0">
              View and manage all teams assigned to you as an SPOC.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-color border border-border-color hover:border-accent-secondary text-text-primary font-tech font-bold uppercase tracking-wider text-xs transition-all hover:bg-surface-color-light cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            <span>{isLoading ? "Refreshing..." : "Refresh Teams"}</span>
          </button>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-surface-color border border-border-color/60 rounded text-[10px] font-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-status-success animate-pulse" : "bg-text-secondary"}`}
            />
            <span>{isConnected ? "Live Sync" : "Connecting…"}</span>
          </span>
        </div>
      </div>

      {/* Staff Info Card */}
      {staff && (
        <div className="bg-surface-color/50 border border-border-color rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent-secondary/15 border border-accent-secondary/40 flex items-center justify-center">
              <Shield className="w-6 h-6 text-accent-secondary" />
            </div>
            <div>
              <h2 className="font-heading text-lg text-text-primary m-0">{staff.name}</h2>
              <p className="text-xs text-text-secondary font-mono m-0">{staff.email || "No email"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
            {staff.phone && (
              <span className="flex items-center gap-1.5">
                <Phone size={12} />
                <span>{staff.phone}</span>
              </span>
            )}
            {staff.department && (
              <span className="flex items-center gap-1.5">
                <Building2 size={12} />
                <span>{staff.department}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-status-error/10 border border-status-error/40 px-4 py-3 rounded-lg flex items-center justify-between text-xs text-status-error flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-status-error hover:text-white uppercase text-[10px] tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-50 animate-slide-up p-4 border rounded-lg shadow-lg ${
          notification.type === "success"
            ? "bg-status-success/15 border-status-success text-status-success"
            : "bg-status-error/15 border-status-error text-status-error"
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="font-bold tracking-wide">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-surface-color/50 border border-border-color rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search by team name, code, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-secondary outline-none font-mono"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 outline-none focus:border-accent-secondary uppercase"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>

          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 outline-none focus:border-accent-secondary uppercase"
          >
            <option value="all">All Tracks</option>
            {tracks.map((track) => (
              <option key={track} value={track}>
                {track}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="space-y-4">
        {isLoading && teams.length === 0 ? (
          <div className="min-h-[300px] flex flex-col items-center justify-center border border-border-color bg-surface-color/50 rounded p-8">
            <Loader2 className="w-8 h-8 text-accent-secondary animate-spin mb-3" />
            <p className="font-tech text-text-secondary text-sm uppercase tracking-wider">
              Loading assigned teams…
            </p>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="border border-dashed border-border-color bg-surface-color/30 rounded-xl p-12 text-center">
            <Users className="w-12 h-12 text-accent-secondary mx-auto mb-3 opacity-50" />
            <h3 className="font-heading text-lg text-text-primary uppercase m-0">
              {teams.length === 0 ? "No teams assigned yet" : "No teams match your filters"}
            </h3>
            <p className="text-xs text-text-secondary mt-2">
              {teams.length === 0
                ? "No teams have been assigned to you yet. Contact your admin to get team assignments."
                : "Try adjusting your search or filters."}
            </p>
            {teams.length === 0 && !isLoading && (
              <button
                onClick={handleRefresh}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-accent-secondary/40 text-accent-secondary rounded text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
              >
                <RotateCcw size={14} />
                Refresh
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((team) => (
              <article
                key={team.id}
                onClick={() => handleOpenDetail(team)}
                className="cursor-pointer bg-surface-color/50 border border-border-color rounded-xl p-5 flex flex-col gap-4 hover:border-accent-secondary/50 hover:bg-surface-color transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-accent-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading text-base text-text-primary uppercase tracking-wide m-0 truncate">
                        {team.name}
                      </h3>
                      <p className="text-xs text-text-secondary font-mono m-0 mt-0.5">
                        {team.code ? `Code: ${team.code}` : "No code"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(team.status)}
                    <Eye className="w-4 h-4 text-text-secondary hover:text-accent-secondary transition-colors" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-secondary font-mono">
                  {team.track && (
                    <span className="px-2 py-0.5 bg-accent-tertiary/10 border border-accent-tertiary/30 rounded text-accent-tertiary uppercase">
                      {team.track}
                    </span>
                  )}
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users size={10} />
                    {team.member_count} member{team.member_count !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="pt-2 border-t border-border-color/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Shield size={12} className="text-accent-secondary" />
                      SPOC: {team.assignment.spoc_name}
                    </span>
                    <span>•</span>
                    <span className="font-mono">
                      Assigned: {team.assignment.allotted_at ? formatDateShort(team.assignment.allotted_at) : "—"}
                    </span>
                  </div>
                </div>

                {team.leader_name && team.leader_name !== "Not assigned" && (
                  <div className="pt-2 border-t border-border-color/40">
                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold mb-1.5">
                      Team Leader
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-primary">
                      <User size={12} />
                      <span className="font-medium">{team.leader_name}</span>
                      {team.leader_email && (
                        <>
                          <span className="text-text-secondary">•</span>
                          <a
                            href={`mailto:${team.leader_email}`}
                            className="text-accent-secondary hover:underline font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail size={10} />
                            {team.leader_email}
                          </a>
                        </>
                      )}
                      {team.leader_phone && (
                        <>
                          <span className="text-text-secondary">•</span>
                          <a
                            href={`tel:${team.leader_phone}`}
                            className="text-accent-secondary hover:underline font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone size={10} />
                            {team.leader_phone}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {/* Pagination placeholder for future use */}
        {filteredTeams.length > 0 && (
          <div className="flex justify-center pt-4">
            <p className="text-xs text-text-secondary font-mono">
              Showing {filteredTeams.length} of {teams.length} assigned team{teams.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Team Detail Modal */}
      {isDetailOpen && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center sm:items-start justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
          <div className="bg-surface-color border border-border-color rounded-xl w-full max-w-4xl my-auto sm:my-6 shadow-2xl max-h-[94vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-border-color p-5">
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-accent-tertiary font-bold m-0">
                  Team Details
                </p>
                <h3 className="font-heading text-xl text-text-primary uppercase m-0 mt-1">
                  {selectedTeam.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[10px] text-text-secondary font-mono">
                    {selectedTeam.code ? `Code: ${selectedTeam.code}` : "No code"}
                  </span>
                  {selectedTeam.track && (
                    <span className="px-2 py-0.5 bg-accent-tertiary/10 border border-accent-tertiary/30 rounded text-accent-tertiary text-[10px] uppercase font-bold">
                      {selectedTeam.track}
                    </span>
                  )}
                  {getStatusBadge(selectedTeam.status)}
                </div>
              </div>
              <button
                onClick={handleCloseDetail}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-6 max-h-[65vh] overflow-y-auto">
              {/* Team Identity */}
              <div className="border border-border-color rounded p-4 bg-surface-color/50">
                <h4 className="font-heading text-sm text-text-primary uppercase m-0 mb-3 flex items-center gap-2">
                  <Target size={16} className="text-accent-secondary" />
                  Team Identity
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Team Name</p>
                    <p className="font-medium text-text-primary m-0">{selectedTeam.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Team Code</p>
                    <p className="font-mono text-text-primary m-0">{selectedTeam.code || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Track / Domain</p>
                    <p className="font-medium text-text-primary m-0">{selectedTeam.track || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Status</p>
                    <p className="m-0">{getStatusBadge(selectedTeam.status)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Created</p>
                    <p className="font-mono text-text-secondary m-0">{formatDate(selectedTeam.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Last Updated</p>
                    <p className="font-mono text-text-secondary m-0">{formatDate(selectedTeam.updated_at)}</p>
                  </div>
                </div>
              </div>

              {/* Problem Statement */}
              {(selectedTeam.problem_statement || selectedTeam.problem_description) && (
                <div className="border border-border-color rounded p-4 bg-surface-color/50">
                  <h4 className="font-heading text-sm text-text-primary uppercase m-0 mb-3 flex items-center gap-2">
                    <FileText size={16} className="text-accent-primary" />
                    Problem Statement
                  </h4>
                  {selectedTeam.problem_statement && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Statement</p>
                      <p className="text-sm text-text-primary m-0 whitespace-pre-wrap">{selectedTeam.problem_statement}</p>
                    </div>
                  )}
                  {selectedTeam.problem_description && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Description</p>
                      <p className="text-sm text-text-secondary m-0 whitespace-pre-wrap">{selectedTeam.problem_description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Proposed Solution */}
              {(selectedTeam.proposed_solution || selectedTeam.solution_description) && (
                <div className="border border-border-color rounded p-4 bg-surface-color/50">
                  <h4 className="font-heading text-sm text-text-primary uppercase m-0 mb-3 flex items-center gap-2">
                    <Target size={16} className="text-accent-primary" />
                    Proposed Solution
                  </h4>
                  {selectedTeam.proposed_solution && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Solution</p>
                      <p className="text-sm text-text-primary m-0 whitespace-pre-wrap">{selectedTeam.proposed_solution}</p>
                    </div>
                  )}
                  {selectedTeam.solution_description && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Details</p>
                      <p className="text-sm text-text-secondary m-0 whitespace-pre-wrap">{selectedTeam.solution_description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Team Leader & Members */}
              <div className="border border-border-color rounded p-4 bg-surface-color/50">
                <h4 className="font-heading text-sm text-text-primary uppercase m-0 mb-3 flex items-center gap-2">
                  <Users size={16} className="text-accent-secondary" />
                  Team Leader & Members ({selectedTeam.member_count})
                </h4>

                {selectedTeam.leader_name && selectedTeam.leader_name !== "Not assigned" && (
                  <div className="mb-4 p-3 bg-accent-secondary/5 border border-accent-secondary/30 rounded">
                    <p className="text-[10px] uppercase tracking-wider text-accent-secondary font-bold m-0 mb-2">Team Leader</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-accent-secondary" />
                        <span className="font-medium text-text-primary">{selectedTeam.leader_name}</span>
                      </div>
                      {selectedTeam.leader_email && (
                        <a
                          href={`mailto:${selectedTeam.leader_email}`}
                          className="flex items-center gap-1.5 text-accent-secondary hover:underline font-mono text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail size={12} />
                          {selectedTeam.leader_email}
                        </a>
                      )}
                      {selectedTeam.leader_phone && (
                        <a
                          href={`tel:${selectedTeam.leader_phone}`}
                          className="flex items-center gap-1.5 text-accent-secondary hover:underline font-mono text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone size={12} />
                          {selectedTeam.leader_phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {selectedTeam.members.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold m-0 mb-2">
                      Team Members
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedTeam.members.map((member) => (
                        <div
                          key={member.id}
                          className="p-2 bg-surface-color border border-border-color rounded flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-accent-primary/10 border border-accent-primary/30 rounded text-[9px] font-bold uppercase text-accent-primary">
                              {member.role.toUpperCase()}
                            </span>
                            <span className="font-medium text-sm text-text-primary">{member.name}</span>
                          </div>
                          <span className="text-[10px] text-text-secondary font-mono">{member.email || "No email"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTeam.members.length === 0 && (
                  <p className="text-xs text-text-secondary italic">No member data available</p>
                )}
              </div>

              {/* Assignment Details */}
              <div className="border border-border-color rounded p-4 bg-surface-color/50">
                <h4 className="font-heading text-sm text-text-primary uppercase m-0 mb-3 flex items-center gap-2">
                  <Shield size={16} className="text-accent-secondary" />
                  Assignment Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Assigned SPOC</p>
                    <p className="font-medium text-text-primary m-0">{selectedTeam.assignment.spoc_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Assignment Date</p>
                    <p className="font-mono text-text-secondary m-0">{formatDate(selectedTeam.assignment.allotted_at)}</p>
                  </div>
                </div>
              </div>

              {/* Event Results */}
              {selectedTeam.event_results && (
                <div className="border border-status-success/30 rounded p-4 bg-status-success/5">
                  <h4 className="font-heading text-sm text-text-primary uppercase m-0 mb-3 flex items-center gap-2">
                    <Trophy size={16} className="text-status-success" />
                    Event Results
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Total Score</p>
                      <p className="font-heading text-xl text-status-success m-0">{selectedTeam.event_results.total_score || 0} PTS</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Average Score</p>
                      <p className="font-heading text-xl text-accent-primary m-0">{selectedTeam.event_results.average_score || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Evaluations</p>
                      <p className="font-heading text-xl text-accent-secondary m-0">{selectedTeam.event_results.evaluations_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Rank</p>
                      <p className="font-heading text-xl text-accent-tertiary m-0">
                        {selectedTeam.event_results.rank ? `#${selectedTeam.event_results.rank}` : "—"}
                      </p>
                    </div>
                    <div className="md:col-span-4 flex flex-wrap gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${selectedTeam.event_results.is_published ? "bg-status-success/15 text-status-success border-status-success" : "bg-surface-color-light text-text-secondary border-border-color"}`}>
                        {selectedTeam.event_results.is_published ? "Published" : "Draft"}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${selectedTeam.event_results.is_locked ? "bg-status-error/15 text-status-error border-status-error" : "bg-surface-color-light text-text-secondary border-border-color"}`}>
                        {selectedTeam.event_results.is_locked ? "Locked" : "Open"}
                      </span>
                      {selectedTeam.event_results.published_at && (
                        <span className="text-[10px] text-text-secondary font-mono">
                          Published: {formatDate(selectedTeam.event_results.published_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submissions */}
              {selectedTeam.submissions.length > 0 && (
                <div className="border border-border-color rounded p-4 bg-surface-color/50">
                  <h4 className="font-heading text-sm text-text-primary uppercase m-0 mb-3 flex items-center gap-2">
                    <FileText size={16} className="text-accent-primary" />
                    Submissions ({selectedTeam.submissions.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedTeam.submissions.map((submission) => (
                      <div key={submission.id} className="p-3 bg-surface-color border border-border-color rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <p className="font-mono text-xs text-accent-primary m-0">
                            Round: {submission.round_id.slice(0, 8)}...
                          </p>
                          <p className="text-[10px] text-text-secondary m-0">Submitted: {formatDate(submission.created_at)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {submission.ppt_url && (
                            <a href={submission.ppt_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-[10px] uppercase font-bold rounded hover:bg-accent-primary/20 transition-colors">
                              <FileText size={12} /> PPT
                            </a>
                          )}
                          {submission.github_url && (
                            <a href={submission.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-color/50 border border-border-color text-text-secondary text-[10px] uppercase font-bold rounded hover:bg-surface-color hover:text-accent-secondary transition-colors">
                              <Github size={12} /> GitHub
                            </a>
                          )}
                          {submission.pitch_deck_url && (
                            <a href={submission.pitch_deck_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary text-[10px] uppercase font-bold rounded hover:bg-accent-secondary/20 transition-colors">
                              <FileText size={12} /> Pitch Deck
                            </a>
                          )}
                          {submission.prototype_url && (
                            <a href={submission.prototype_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent-tertiary/10 border border-accent-tertiary/30 text-accent-tertiary text-[10px] uppercase font-bold rounded hover:bg-accent-tertiary/20 transition-colors">
                              <ExternalLink size={12} /> Prototype
                            </a>
                          )}
                          {submission.demo_url && (
                            <a href={submission.demo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-status-success/10 border border-status-success/30 text-status-success text-[10px] uppercase font-bold rounded hover:bg-status-success/20 transition-colors">
                              <ExternalLink size={12} /> Live Demo
                            </a>
                          )}
                          {submission.additional_material_url && (
                            <a href={submission.additional_material_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary text-[10px] uppercase font-bold rounded hover:bg-accent-secondary/20 transition-colors">
                              <FileText size={12} /> Additional
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignment Actions */}
              <div className="border-t border-border-color pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  onClick={handleCloseDetail}
                  className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary w-full sm:w-auto"
                >
                  Close
                </button>
                <Link
                  href={`/ops/scanner`}
                  className="px-4 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90 w-full sm:w-auto text-center"
                >
                  <QrCode size={14} className="inline mr-1" />
                  <span>Open QR Scanner</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}