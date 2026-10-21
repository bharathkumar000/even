"use client";

import React, { useState, useMemo } from "react";
import { Search, Gavel, Users, Shield, CheckCircle2, ChevronRight, Layers, Mail } from "lucide-react";
import { JudgeAssignmentsData, JudgeOption, TeamOption } from "@/app/actions/admin-assignments";
import CustomSelect from "@/components/ui/CustomSelect";

interface Props {
  initialData: JudgeAssignmentsData;
}

export default function ClubJudgesRosterClient({ initialData }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>(
    initialData.judges[0]?.id || ""
  );
  const [trackFilter, setTrackFilter] = useState("all");

  const { judges, teams } = initialData;

  // Map of teamId -> TeamOption
  const teamMap = useMemo(() => {
    const map = new Map<string, TeamOption>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  // Unique tracks
  const tracks = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.track) set.add(t.track);
    });
    return Array.from(set);
  }, [teams]);

  // Filtered judges
  const filteredJudges = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return judges.filter((j) => {
      if (!q) return true;
      const nameMatch = j.full_name?.toLowerCase().includes(q);
      const emailMatch = j.email?.toLowerCase().includes(q);
      const teamMatch = j.assigned_team_ids.some((tId) => {
        const team = teamMap.get(tId);
        return team?.name.toLowerCase().includes(q) || team?.code?.toLowerCase().includes(q);
      });
      return nameMatch || emailMatch || teamMatch;
    });
  }, [judges, searchTerm, teamMap]);

  const activeJudge = useMemo(
    () => judges.find((j) => j.id === selectedJudgeId) || filteredJudges[0] || null,
    [judges, selectedJudgeId, filteredJudges]
  );

  const activeAssignedTeams = useMemo(() => {
    if (!activeJudge) return [];
    return activeJudge.assigned_team_ids
      .map((tId) => teamMap.get(tId))
      .filter((t): t is TeamOption => Boolean(t))
      .filter((t) => (trackFilter === "all" ? true : t.track === trackFilter));
  }, [activeJudge, teamMap, trackFilter]);

  // Stats
  const totalJudges = judges.length;
  const allottedTeams = teams.filter((t) => t.assigned_judge_ids.length > 0).length;
  const unassignedTeams = teams.length - allottedTeams;

  return (
    <div className="space-y-6 font-tech">
      {/* Metric telemetry widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-surface-color/50 border border-border-color p-4 rounded flex items-center justify-between">
          <div>
            <p className="text-[10px] text-text-secondary uppercase tracking-[1px] m-0">Total Judges</p>
            <h3 className="text-2xl font-heading text-text-primary uppercase m-0 mt-0.5">{totalJudges}</h3>
          </div>
          <div className="w-9 h-9 rounded bg-accent-tertiary/15 border border-accent-tertiary/40 flex items-center justify-center text-accent-tertiary">
            <Gavel size={18} />
          </div>
        </div>

        <div className="bg-surface-color/50 border border-border-color p-4 rounded flex items-center justify-between">
          <div>
            <p className="text-[10px] text-text-secondary uppercase tracking-[1px] m-0">Allotted Teams</p>
            <h3 className="text-2xl font-heading text-status-success uppercase m-0 mt-0.5">{allottedTeams} / {teams.length}</h3>
          </div>
          <div className="w-9 h-9 rounded bg-status-success/15 border border-status-success/40 flex items-center justify-center text-status-success">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-surface-color/50 border border-border-color p-4 rounded flex items-center justify-between">
          <div>
            <p className="text-[10px] text-text-secondary uppercase tracking-[1px] m-0">Unassigned Teams</p>
            <h3 className="text-2xl font-heading text-status-warning uppercase m-0 mt-0.5">{unassignedTeams}</h3>
          </div>
          <div className="w-9 h-9 rounded bg-status-warning/15 border border-status-warning/40 flex items-center justify-center text-status-warning">
            <Users size={18} />
          </div>
        </div>
      </div>

      {/* Main 2-column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Judges Roster List (5 cols) */}
        <div className="lg:col-span-5 bg-surface-color/40 border border-border-color rounded p-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border-color/60">
            <span className="text-xs uppercase font-bold text-accent-tertiary tracking-wider flex items-center gap-2">
              <Shield size={14} />
              Jury Directory ({filteredJudges.length})
            </span>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search judge or allotted team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-tertiary outline-none font-mono"
            />
          </div>

          {/* Judges List */}
          <div className="space-y-2 overflow-y-auto max-h-[580px] pr-1">
            {filteredJudges.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-xs">
                No judges matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredJudges.map((j) => {
                const isSelected = activeJudge?.id === j.id;
                const count = j.assigned_team_ids.length;

                return (
                  <button
                    key={j.id}
                    onClick={() => setSelectedJudgeId(j.id)}
                    className={`w-full text-left p-3 rounded border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-accent-tertiary/15 border-accent-tertiary shadow-[0_0_15px_rgba(0,240,255,0.15)]"
                        : "bg-surface-color/50 border-border-color/70 hover:border-accent-tertiary/40 hover:bg-surface-color"
                    }`}
                  >
                    <div>
                      <p className="font-heading text-sm text-text-primary m-0 uppercase tracking-wide">
                        {j.full_name || "Judge"}
                      </p>
                      <p className="text-[11px] text-text-secondary font-mono m-0 truncate max-w-[200px]">
                        {j.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          count > 0
                            ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/40"
                            : "bg-surface-color-light text-text-secondary border border-border-color"
                        }`}
                      >
                        {count} {count === 1 ? "Team" : "Teams"}
                      </span>
                      <ChevronRight size={14} className="text-text-secondary" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Allotted Teams Showcase (7 cols) */}
        <div className="lg:col-span-7 bg-surface-color/40 border border-border-color rounded p-5 flex flex-col space-y-4">
          {activeJudge ? (
            <>
              {/* Judge Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-color/60">
                <div>
                  <span className="font-tech text-[10px] uppercase tracking-[2px] text-accent-tertiary font-bold block mb-1">
                    Inspecting Jury Member
                  </span>
                  <h2 className="font-heading text-xl text-text-primary uppercase m-0 flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-accent-tertiary" />
                    {activeJudge.full_name || "Judge"}
                  </h2>
                  <p className="text-xs font-mono text-text-secondary m-0 mt-0.5 flex items-center gap-1.5">
                    <Mail size={12} />
                    {activeJudge.email}
                  </p>
                </div>

                {/* Track Filter */}
                <CustomSelect
                  value={trackFilter}
                  onChange={(val) => setTrackFilter(val)}
                  options={[
                    { value: "all", label: "All Tracks" },
                    ...tracks.map((tr) => ({
                      value: tr,
                      label: tr,
                    })),
                  ]}
                  colorVariant="cyan"
                  size="sm"
                  containerClassName="w-full sm:w-44 shrink-0"
                />
              </div>

              {/* Allotted Teams Header */}
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span className="uppercase font-bold tracking-wider text-text-primary flex items-center gap-1.5">
                  <Layers size={14} className="text-accent-primary" />
                  Teams Allotted for Evaluation ({activeAssignedTeams.length}):
                </span>
                <span className="font-mono text-[11px]">
                  {activeJudge.assigned_team_ids.length} total allotted
                </span>
              </div>

              {/* Team Cards Grid */}
              <div className="space-y-2.5 overflow-y-auto max-h-[500px] pr-1">
                {activeAssignedTeams.length === 0 ? (
                  <div className="p-10 border border-dashed border-border-color rounded text-center text-text-secondary text-xs">
                    {activeJudge.assigned_team_ids.length === 0
                      ? "No teams currently allotted to this judge."
                      : "No allotted teams match the selected track filter."}
                  </div>
                ) : (
                  activeAssignedTeams.map((team, idx) => (
                    <div
                      key={team.id}
                      className="p-3.5 bg-surface-color/60 border border-border-color/80 rounded flex items-center justify-between hover:border-accent-primary/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-accent-tertiary font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-heading text-sm text-text-primary uppercase tracking-wide">
                            {team.name}
                          </span>
                          {team.code && (
                            <span className="font-mono text-[10px] text-accent-primary px-1.5 py-0.5 bg-accent-primary/10 border border-accent-primary/30 rounded">
                              {team.code}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] font-mono text-text-secondary">
                          {team.track && (
                            <span className="text-accent-secondary uppercase font-bold">
                              [{team.track}]
                            </span>
                          )}
                          <span>•</span>
                          <span className="text-status-success font-semibold">
                            Assigned to Evaluation Panel
                          </span>
                        </div>
                      </div>

                      <div className="px-2.5 py-1 rounded bg-surface-color-light border border-border-color text-xs font-mono text-text-secondary">
                        Table Evaluation
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-text-secondary text-xs">
              Select a judge from the directory on the left to inspect allotted teams.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
