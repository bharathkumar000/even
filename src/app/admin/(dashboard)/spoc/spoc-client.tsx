"use client";

import { useState, useTransition, useMemo } from "react";
import {
  UserCheck,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  Sparkles,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import Image from "next/image";
import {
  SpocItem,
  SpocTeamOption,
  updateSpocTeams,
  autoBalanceSpocAssignments,
  getSpocPortalData,
} from "@/app/actions/admin-spoc";

interface SpocClientProps {
  initialSpocs: SpocItem[];
  initialTeams: SpocTeamOption[];
}

export default function SpocClientView({
  initialSpocs,
  initialTeams,
}: SpocClientProps) {
  const [spocs, setSpocs] = useState<SpocItem[]>(initialSpocs);
  const [teams, setTeams] = useState<SpocTeamOption[]>(initialTeams);

  // Selected SPOC
  const [selectedSpocId, setSelectedSpocId] = useState<string>(
    initialSpocs[0]?.id || ""
  );

  // Search & Filter state
  const [spocSearch, setSpocSearch] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");
  const [teamSearch, setTeamSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  const [showOtherAssigned, setShowOtherAssigned] = useState(false);

  // Assign SPOC modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");

  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Pending stage state: map of spocId -> string[] of selected team IDs
  const [pendingAssignedMap, setPendingAssignedMap] = useState<
    Record<string, string[]>
  >(() =>
    Object.fromEntries(
      initialSpocs.map((spoc) => [spoc.id, [...spoc.assigned_team_ids]])
    )
  );

  // Active selected SPOC
  const activeSpoc = useMemo(
    () => spocs.find((s) => s.id === selectedSpocId) || null,
    [spocs, selectedSpocId]
  );

  // Set of staged team IDs assigned to this SPOC
  const stagedTeamIds = useMemo(() => {
    if (!selectedSpocId) return new Set<string>();
    return new Set(pendingAssignedMap[selectedSpocId] || activeSpoc?.assigned_team_ids || []);
  }, [selectedSpocId, pendingAssignedMap, activeSpoc]);

  // Check if active SPOC has unsaved pending changes
  const hasUnsavedChanges = useMemo(() => {
    if (!activeSpoc) return false;
    const original = new Set(activeSpoc.assigned_team_ids || []);
    if (original.size !== stagedTeamIds.size) return true;
    for (const id of stagedTeamIds) {
      if (!original.has(id)) return true;
    }
    return false;
  }, [activeSpoc, stagedTeamIds]);

  // Distinct tracks
  const tracks = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.track) set.add(t.track);
    });
    return Array.from(set);
  }, [teams]);

  // Staff SPOC metrics
  const assignedSpocCount = useMemo(
    () => spocs.filter((s) => s.assigned_team_ids.length > 0).length,
    [spocs]
  );
  const unassignedSpocCount = spocs.length - assignedSpocCount;
  const totalTeamsAllocated = useMemo(
    () => spocs.reduce((sum, s) => sum + s.assigned_team_ids.length, 0),
    [spocs]
  );

  // Filtered SPOCs
  const filteredSpocs = useMemo(() => {
    return spocs.filter((s) => {
      if (assignedFilter === "assigned" && s.assigned_team_ids.length === 0) {
        return false;
      }
      if (assignedFilter === "unassigned" && s.assigned_team_ids.length > 0) {
        return false;
      }

      const q = spocSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [spocs, spocSearch, assignedFilter]);

  // Staff list shown inside the Assign SPOC modal
  const modalFilteredSpocs = useMemo(() => {
    const q = assignSearch.toLowerCase().trim();
    if (!q) return spocs;
    return spocs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false)
    );
  }, [spocs, assignSearch]);

  // Filtered teams for allotment (Exclusive rule applied)
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (trackFilter !== "all" && t.track !== trackFilter) return false;

      // Exclusion rule: If team is allotted to ANOTHER SPOC, hide unless showOtherAssigned is true
      const isAssignedToOther = t.assigned_spoc_id && t.assigned_spoc_id !== selectedSpocId;
      const isStagedInThis = stagedTeamIds.has(t.id);

      if (!showOtherAssigned && isAssignedToOther && !isStagedInThis) {
        return false;
      }

      const q = teamSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q)
      );
    });
  }, [teams, teamSearch, trackFilter, selectedSpocId, showOtherAssigned, stagedTeamIds]);

  // Helper to format WhatsApp URL
  const getWhatsAppLink = (phone?: string | null, name?: string) => {
    if (!phone) return null;
    const cleanNumber = phone.replace(/[^0-9]/g, "");
    if (!cleanNumber) return null;
    const text = encodeURIComponent(
      `Hello ${name || "SPOC"}, reaching out regarding ViceVerse Ideathon coordination.`
    );
    return `https://wa.me/${cleanNumber}?text=${text}`;
  };

  // Open the staff picker used to assign an SPOC
  const handleOpenAssignModal = () => {
    setAssignSearch("");
    setIsModalOpen(true);
  };

  const handleSelectStaffForAssignment = (spoc: SpocItem) => {
    setSelectedSpocId(spoc.id);
    setIsModalOpen(false);
    setAssignSearch("");
  };

  // Toggle Team Allotment for active SPOC (Staging in pendingAssignedMap only)
  const handleToggleTeam = (team: SpocTeamOption) => {
    if (!activeSpoc) return;
    const teamId = team.id;

    setPendingAssignedMap((prev) => {
      const currentList = prev[activeSpoc.id] || [...activeSpoc.assigned_team_ids];
      const set = new Set(currentList);
      if (set.has(teamId)) {
        set.delete(teamId);
      } else {
        set.add(teamId);
      }
      return {
        ...prev,
        [activeSpoc.id]: Array.from(set),
      };
    });
  };

  // Bulk select filtered teams for active SPOC (Staging only)
  const handleSelectAllFiltered = () => {
    if (!activeSpoc) return;
    setPendingAssignedMap((prev) => {
      const currentList = prev[activeSpoc.id] || [...activeSpoc.assigned_team_ids];
      const set = new Set(currentList);
      filteredTeams.forEach((t) => set.add(t.id));
      return {
        ...prev,
        [activeSpoc.id]: Array.from(set),
      };
    });
  };

  // Bulk clear selected teams for active SPOC (Staging only)
  const handleClearAll = () => {
    if (!activeSpoc) return;
    setPendingAssignedMap((prev) => ({
      ...prev,
      [activeSpoc.id]: [],
    }));
  };

  // Discard pending changes and reset to current saved DB state for active SPOC
  const handleResetStaged = () => {
    if (!activeSpoc) return;
    setPendingAssignedMap((prev) => ({
      ...prev,
      [activeSpoc.id]: [...activeSpoc.assigned_team_ids],
    }));
  };

  // Explicit Confirm Allotment handler -> writes to database
  const handleConfirmSpocAllotment = () => {
    if (!activeSpoc) return;
    const nextArray = Array.from(stagedTeamIds);
    setNotification(null);

    // Optimistically update SPOCs and Teams
    setSpocs((prev) =>
      prev.map((s) => {
        if (s.id === activeSpoc.id) {
          return { ...s, assigned_team_ids: nextArray };
        }
        return {
          ...s,
          assigned_team_ids: s.assigned_team_ids.filter((id) => !nextArray.includes(id)),
        };
      })
    );

    setTeams((prev) =>
      prev.map((t) => {
        if (nextArray.includes(t.id)) {
          return {
            ...t,
            assigned_spoc_id: activeSpoc.id,
            assigned_spoc_name: activeSpoc.name,
          };
        } else if (t.assigned_spoc_id === activeSpoc.id) {
          return {
            ...t,
            assigned_spoc_id: null,
            assigned_spoc_name: null,
          };
        }
        return t;
      })
    );

    setPendingAssignedMap((prev) => {
      const next: Record<string, string[]> = {};
      for (const [id, teamIds] of Object.entries(prev)) {
        next[id] =
          id === activeSpoc.id
            ? nextArray
            : teamIds.filter((teamId) => !nextArray.includes(teamId));
      }
      return next;
    });

    // Save to database
    startTransition(async () => {
      try {
        await updateSpocTeams({
          spocId: activeSpoc.id,
          teamIds: nextArray,
        });
        setNotification({
          type: "success",
          message: `Allotment confirmed! Successfully saved ${nextArray.length} teams to ${activeSpoc.name}.`,
        });
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to confirm SPOC allotments.",
        });
      }
    });
  };

  const handleAutoBalance = () => {
    if (spocs.length === 0) {
      setNotification({
        type: "error",
        message:
          "No eligible Staff / Club Members found. Add staff accounts under User Management first.",
      });
      return;
    }

    if (
      !confirm(
        "Auto-balance unassigned teams evenly across all eligible Staff / Club Member SPOCs?"
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await autoBalanceSpocAssignments();
        const fresh = await getSpocPortalData();
        setSpocs(fresh.spocs);
        setTeams(fresh.teams);
        setPendingAssignedMap(
          Object.fromEntries(
            fresh.spocs.map((spoc) => [
              spoc.id,
              [...spoc.assigned_team_ids],
            ])
          )
        );
        setNotification({
          type: "success",
          message:
            res.message ||
            `Auto-balance complete! Distributed ${res.allocatedTeamsCount} team(s) across ${res.spocsCount || spocs.length} Staff SPOCs.`,
        });
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message:
            err instanceof Error ? err.message : "Failed to auto-balance SPOCs.",
        });
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 border flex items-center justify-between text-xs transition-all ${
            notification.type === "success"
              ? "bg-status-success/15 border-status-success text-status-success"
              : "bg-status-error/15 border-status-error text-status-error"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="font-bold tracking-wide">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-text-secondary hover:text-text-primary uppercase text-[10px] tracking-wider cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Staff SPOC Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: "Total Staff",
            value: spocs.length,
            color: "text-accent-secondary",
          },
          {
            label: "Eligible SPOCs",
            value: spocs.length,
            color: "text-accent-primary",
          },
          {
            label: "Assigned SPOCs",
            value: assignedSpocCount,
            color: "text-status-success",
          },
          {
            label: "Unassigned SPOCs",
            value: unassignedSpocCount,
            color: "text-status-warning",
          },
          {
            label: "Teams Allocated",
            value: totalTeamsAllocated,
            color: "text-accent-tertiary",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="border border-border-color bg-surface-color/50 rounded-lg p-3"
          >
            <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
              {metric.label}
            </p>
            <p
              className={`font-heading text-2xl m-0 mt-1 ${metric.color}`}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main Dual-Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: SPOC Directory (4 cols) */}
        <div className="lg:col-span-4 border border-border-color bg-surface-color/50 rounded-lg p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-color/60">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-accent-secondary" />
              <div>
                <h2 className="font-heading text-lg text-text-primary uppercase m-0">
                  Staff SPOCs ({spocs.length})
                </h2>
                <p className="text-[10px] text-text-secondary font-mono m-0 mt-0.5">
                  {assignedSpocCount} assigned · {unassignedSpocCount} unassigned
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoBalance}
                disabled={isPending || spocs.length === 0}
                title="Automatically distribute teams across eligible Staff SPOCs evenly"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-color-light border border-accent-tertiary/50 hover:border-accent-tertiary text-accent-tertiary font-tech font-bold uppercase tracking-wider text-[11px] rounded transition-all hover:bg-accent-tertiary/10 cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={12} />
                <span>Auto-Balance</span>
              </button>
              <button
                onClick={handleOpenAssignModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 cursor-pointer shadow-[0_0_15px_rgba(255,0,127,0.3)]"
              >
                <Plus size={14} />
                <span>Assign SPOC</span>
              </button>
            </div>
          </div>

          {/* SPOC Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Search staff by name or email..."
                value={spocSearch}
                onChange={(e) => setSpocSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-secondary outline-none font-mono"
              />
            </div>
            <select
              value={assignedFilter}
              onChange={(e) =>
                setAssignedFilter(
                  e.target.value as "all" | "assigned" | "unassigned"
                )
              }
              className="w-full bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 font-mono outline-none focus:border-accent-secondary uppercase"
            >
              <option value="all">All Staff</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          {/* SPOC List */}
          <div className="space-y-2 overflow-y-auto max-h-[620px] pr-1">
            {filteredSpocs.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-xs">
                {spocs.length === 0
                  ? "No Staff / Club Members found. Add them under User Management first."
                  : "No staff members match your search or filter."}
              </div>
            ) : (
              filteredSpocs.map((s) => {
                const isSelected = s.id === selectedSpocId;
                const count = s.assigned_team_ids.length;
                const waLink = getWhatsAppLink(s.phone, s.name);

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSpocId(s.id)}
                    className={`w-full text-left p-3 rounded border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? "bg-accent-secondary/[0.06] border-accent-secondary/50 shadow-[0_0_15px_rgba(255,0,127,0.12)]"
                        : "bg-surface-color/40 border-border-color/70 hover:border-accent-secondary/40 hover:bg-surface-color"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar preview */}
                      <div className="relative shrink-0 w-10 h-10 rounded-full overflow-hidden border border-border-color bg-surface-color-light flex items-center justify-center">
                        {s.avatar_url ? (
                            <Image
                              src={s.avatar_url}
                              alt={s.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                        ) : (
                          <span className="font-heading text-sm text-accent-secondary uppercase font-bold">
                            {s.name.slice(0, 2)}
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <p className="font-heading text-sm text-text-primary m-0 uppercase tracking-wide">
                          {s.name}
                        </p>
                        {s.email && (
                          <p className="text-[10px] text-text-secondary font-mono m-0 truncate max-w-[150px]">
                            {s.email}
                          </p>
                        )}
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] text-[#25D366] hover:underline font-bold"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle size={11} className="stroke-[2.5]" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                        count > 0
                          ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/40"
                          : "bg-surface-color-light text-text-secondary border border-border-color"
                      }`}
                    >
                      {count > 0
                        ? `${count} ${count === 1 ? "Team" : "Teams"}`
                        : "Unassigned"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Teams Allotment Panel (8 cols) */}
        <div className="lg:col-span-8 border border-border-color bg-surface-color/50 rounded-lg p-5 flex flex-col space-y-4">
          {activeSpoc ? (
            <>
              {/* Active SPOC Status Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-color/60">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-accent-secondary/60 bg-surface-color-light flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,0,127,0.2)]">
                    {activeSpoc.avatar_url ? (
                        <Image
                          src={activeSpoc.avatar_url}
                          alt={activeSpoc.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                    ) : (
                      <span className="font-heading text-lg text-accent-secondary uppercase font-bold">
                        {activeSpoc.name.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-tech text-[10px] uppercase tracking-[2px] text-accent-secondary font-bold block mb-0.5">
                      Staff SPOC Allotment Console
                    </span>
                    <h2 className="font-heading text-xl text-text-primary uppercase m-0 flex items-center gap-2">
                      {activeSpoc.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
                      {activeSpoc.phone && (
                        <span className="text-text-secondary font-mono">
                          📞 {activeSpoc.phone}
                        </span>
                      )}
                      {activeSpoc.email && (
                        <span className="text-text-secondary font-mono">
                          ✉️ {activeSpoc.email}
                        </span>
                      )}
                      {getWhatsAppLink(activeSpoc.phone, activeSpoc.name) && (
                        <a
                          href={getWhatsAppLink(activeSpoc.phone, activeSpoc.name)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#25D366]/15 border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/25 font-bold text-[11px] transition-colors"
                        >
                          <MessageCircle size={13} className="stroke-[2.5]" />
                          <span>WhatsApp Chat</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bulk Actions & Confirm Allotment */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleSelectAllFiltered}
                    disabled={isPending || filteredTeams.length === 0}
                    className="px-3 py-1.5 bg-surface-color-light border border-border-color hover:border-accent-primary text-text-primary text-xs uppercase font-bold tracking-wider rounded transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Select Filtered ({filteredTeams.length})
                  </button>
                  <button
                    onClick={handleClearAll}
                    disabled={isPending || stagedTeamIds.size === 0}
                    className="px-3 py-1.5 bg-status-error/10 border border-status-error/40 hover:bg-status-error/20 text-status-error text-xs uppercase font-bold tracking-wider rounded transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Clear Selected
                  </button>
                  {hasUnsavedChanges && (
                    <button
                      onClick={handleResetStaged}
                      disabled={isPending}
                      className="px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary underline font-mono cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={handleConfirmSpocAllotment}
                    disabled={isPending || !hasUnsavedChanges}
                    className={`px-4 py-1.5 rounded font-tech text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      hasUnsavedChanges
                        ? "bg-accent-primary text-black hover:bg-accent-primary/90 shadow-[0_0_15px_rgba(0,240,255,0.4)] animate-pulse"
                        : "bg-surface-color-light text-text-secondary border border-border-color opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <Check size={14} className="stroke-[3]" />
                    <span>Confirm Allotment ({stagedTeamIds.size})</span>
                  </button>
                </div>
              </div>

              {/* Unsaved changes notice banner */}
              {hasUnsavedChanges && (
                <div className="bg-accent-primary/10 border border-accent-primary/40 px-3 py-2 rounded flex items-center justify-between text-xs text-accent-primary animate-fade-in">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
                    <strong>{stagedTeamIds.size} team(s) selected.</strong> Click &quot;Confirm Allotment&quot; to apply changes to this SPOC.
                  </span>
                  <button
                    onClick={handleConfirmSpocAllotment}
                    disabled={isPending}
                    className="underline font-bold uppercase tracking-wider hover:text-text-primary cursor-pointer"
                  >
                    Save Allotment Now
                  </button>
                </div>
              )}

              {/* Filters for Teams */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  <input
                    type="text"
                    placeholder="Search available teams by name or code..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-primary outline-none font-mono"
                  />
                </div>

                {/* Track Filter */}
                <select
                  value={trackFilter}
                  onChange={(e) => setTrackFilter(e.target.value)}
                  className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 font-mono outline-none focus:border-accent-primary uppercase"
                >
                  <option value="all">All Tracks</option>
                  {tracks.map((tr) => (
                    <option key={tr} value={tr}>
                      Track: {tr}
                    </option>
                  ))}
                </select>

                {/* Show All Toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-secondary hover:text-text-primary shrink-0 px-2 py-1 bg-surface-color/40 border border-border-color rounded">
                  <input
                    type="checkbox"
                    checked={showOtherAssigned}
                    onChange={(e) => setShowOtherAssigned(e.target.checked)}
                    className="accent-accent-secondary cursor-pointer"
                  />
                  <span>Show already allotted</span>
                </label>
              </div>

              {/* Teams Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto max-h-[580px] pr-1">
                {filteredTeams.length === 0 ? (
                  <div className="sm:col-span-2 p-10 text-center text-text-secondary text-xs">
                    No unassigned teams available for allotment. All teams are allotted or filtered.
                  </div>
                ) : (
                  filteredTeams.map((team) => {
                    const isAssignedToThis = stagedTeamIds.has(team.id);
                    const isAssignedToOther =
                      team.assigned_spoc_id && team.assigned_spoc_id !== activeSpoc.id;

                    return (
                      <div
                        key={team.id}
                        onClick={() => handleToggleTeam(team)}
                        className={`p-3.5 rounded border transition-all cursor-pointer flex items-center justify-between ${
                          isAssignedToThis
                            ? "bg-gradient-to-r from-accent-primary/15 to-transparent border-accent-primary shadow-[0_0_15px_rgba(0,240,255,0.15)]"
                            : isAssignedToOther
                            ? "bg-surface-color/20 border-status-warning/40 opacity-75 hover:opacity-100"
                            : "bg-surface-color/40 border-border-color/70 hover:border-accent-primary/40 hover:bg-surface-color"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-sm text-text-primary uppercase tracking-wide">
                              {team.name}
                            </span>
                            {team.code && (
                              <span className="font-mono text-[10px] text-accent-tertiary px-1.5 py-0.2 bg-accent-tertiary/10 border border-accent-tertiary/30 rounded">
                                {team.code}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] font-mono text-text-secondary">
                            {team.track && (
                              <span className="uppercase text-accent-secondary">
                                [{team.track}]
                              </span>
                            )}
                            {isAssignedToOther && (
                              <>
                                <span>•</span>
                                <span className="text-status-warning font-semibold">
                                  Allotted to: {team.assigned_spoc_name || "Other SPOC"}
                                </span>
                              </>
                            )}
                            {!isAssignedToOther && !isAssignedToThis && (
                              <>
                                <span>•</span>
                                <span className="text-status-success font-semibold">
                                  Available for Allotment
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Checkbox indicator */}
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                            isAssignedToThis
                              ? "bg-accent-primary border-accent-primary text-black"
                              : isAssignedToOther
                              ? "border-status-warning/60 bg-status-warning/10 text-status-warning text-xs font-bold"
                              : "border-border-color/80 bg-surface-color/60 text-transparent"
                          }`}
                        >
                          {isAssignedToThis ? (
                            <Check size={14} className="stroke-[3]" />
                          ) : isAssignedToOther ? (
                            "!"
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-text-secondary font-tech">
              Please select a Staff / Club Member on the left to configure team
              allotments.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Assign SPOC from the Staff directory */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-lg p-6 space-y-4 animate-fade-in shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                  Assign SPOC
                </h3>
                <p className="text-[11px] text-text-secondary font-mono m-0 mt-1">
                  Select a Staff / Club Member to manage their team allotment.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Search staff by name or email..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-secondary outline-none font-mono"
                autoFocus
              />
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1">
              {modalFilteredSpocs.length === 0 ? (
                <div className="p-6 text-center text-text-secondary text-xs">
                  {spocs.length === 0
                    ? "No Staff / Club Members found. Add them under User Management first."
                    : "No staff members match your search."}
                </div>
              ) : (
                modalFilteredSpocs.map((s) => {
                  const isSelected = s.id === selectedSpocId;

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStaffForAssignment(s)}
                      className={`w-full text-left p-3 rounded border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-accent-secondary/[0.06] border-accent-secondary/50"
                          : "bg-surface-color/40 border-border-color/70 hover:border-accent-secondary/40 hover:bg-surface-color"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-border-color bg-surface-color-light flex items-center justify-center shrink-0">
                          {s.avatar_url ? (
                            <Image
                              src={s.avatar_url}
                              alt={s.name}
                              width={36}
                              height={36}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-heading text-xs text-accent-secondary uppercase font-bold">
                              {s.name.slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-heading text-sm text-text-primary m-0 uppercase tracking-wide">
                            {s.name}
                          </p>
                          {s.email && (
                            <p className="text-[10px] text-text-secondary font-mono m-0">
                              {s.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                          s.assigned_team_ids.length > 0
                            ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/40"
                            : "bg-surface-color-light text-text-secondary border border-border-color"
                        }`}
                      >
                        {s.assigned_team_ids.length > 0
                          ? `${s.assigned_team_ids.length} Teams`
                          : "Assign"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex justify-end border-t border-border-color pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
