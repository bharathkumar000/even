'use client';
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Layers,
  FileCheck,
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { slugify } from "@/lib/utils";

interface AssignedTeam {
  id: string;
  name: string;
  leader_name?: string | null;
  track?: string | null;
  status?: string | null;
}

interface JudgeRound {
  id: string;
  title: string;
  status: string;
  sequence_order: number;
}

interface JudgeEvaluation {
  round_id: string;
  team_id: string;
  status: string;
  total_score?: number | null;
}

interface Props {
  allTeams: AssignedTeam[];
  rounds: JudgeRound[];
  evaluations: JudgeEvaluation[];
  announcements: any[];
  judgeAssignedTeamIds: string[];
  isJudgeSpecific: boolean;
}

export default function JudgeDashboardClient({
  allTeams,
  rounds,
  evaluations,
  announcements,
  judgeAssignedTeamIds,
  isJudgeSpecific,
}: Props) {
  const assignedTeams = isJudgeSpecific
    ? allTeams.filter((t) => judgeAssignedTeamIds.includes(t.id))
    : allTeams;

  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    rounds.find((r) => r.status === "open" || r.status === "reopened")?.id || rounds[0]?.id || ""
  );

  const selectedRound = useMemo(
    () => rounds.find((r) => r.id === selectedRoundId) || rounds[0],
    [selectedRoundId, rounds]
  );

  const getEvaluationStatus = (teamId: string, roundId?: string) => {
    if (!roundId) return { label: "Pending", style: "bg-surface-color-light text-text-secondary border-border-color" };
    const ev = evaluations.find((e) => e.team_id === teamId && e.round_id === roundId);
    if (!ev) {
      return { label: "Pending", style: "bg-accent-primary/10 text-accent-primary border-accent-primary/40" };
    }
    if (ev.status === "submitted") {
      return { label: "Submitted", style: "bg-status-success/10 text-status-success border-status-success/40" };
    }
    if (ev.status === "locked") {
      return { label: "Locked", style: "bg-status-error/10 text-status-error border-status-error/40" };
    }
    return { label: "Draft", style: "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/40" };
  };

  // Stats for selected round
  const stats = useMemo(() => {
    let evaluated = 0,
      drafted = 0,
      pending = 0;
    assignedTeams.forEach((team) => {
      const st = getEvaluationStatus(team.id, selectedRound?.id);
      if (st.label === "Submitted" || st.label === "Locked") evaluated++;
      else if (st.label === "Draft") drafted++;
      else pending++;
    });
    return { evaluated, drafted, pending };
  }, [assignedTeams, selectedRound?.id, evaluations]);

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      {/* Round selector */}
      <div className="flex items-center gap-2 mb-4">
        <label className="font-tech text-xs uppercase text-text-secondary">Round:</label>
        <select
          value={selectedRoundId}
          onChange={(e) => setSelectedRoundId(e.target.value)}
          className="px-2 py-1 border border-border-color rounded bg-surface-color-light text-text-primary"
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} ({r.status})
            </option>
          ))}
        </select>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Allotted */}
        <div className="glass-panel p-4 border border-border-color bg-surface-color/60 flex flex-col justify-between rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="font-tech text-[10px] uppercase tracking-wider text-text-secondary font-bold">Total Allotted</span>
            <div className="p-2 rounded bg-accent-primary/10 border border-accent-primary/30 text-accent-primary">
              <Users size={16} />
            </div>
          </div>
          <div>
            <p className="font-heading text-3xl text-text-primary uppercase m-0 font-bold">{assignedTeams.length}</p>
            <p className="font-tech text-xs text-text-secondary mt-1 m-0">Assigned Teams</p>
          </div>
        </div>

        {/* Evaluated */}
        <div className="glass-panel p-4 border border-status-success/40 bg-status-success/[0.04] flex flex-col justify-between rounded shadow-[0_0_15px_rgba(34,197,94,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-tech text-[10px] uppercase tracking-wider text-status-success font-bold">Evaluated</span>
            <div className="p-2 rounded bg-status-success/15 border border-status-success/40 text-status-success">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <p className="font-heading text-3xl text-status-success uppercase m-0 font-bold">{stats.evaluated}</p>
            <p className="font-tech text-xs text-text-secondary mt-1 m-0">Submitted &amp; Recorded</p>
          </div>
        </div>

        {/* Drafted */}
        <div className="glass-panel p-4 border border-accent-secondary/40 bg-accent-secondary/[0.04] flex flex-col justify-between rounded shadow-[0_0_15px_rgba(255,0,127,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-tech text-[10px] uppercase tracking-wider text-accent-secondary font-bold">Drafted</span>
            <div className="p-2 rounded bg-accent-secondary/15 border border-accent-secondary/40 text-accent-secondary">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <p className="font-heading text-3xl text-accent-secondary uppercase m-0 font-bold">{stats.drafted}</p>
            <p className="font-tech text-xs text-text-secondary mt-1 m-0">Saved Drafts</p>
          </div>
        </div>

        {/* Pending */}
        <div className="glass-panel p-4 border border-accent-tertiary/40 bg-accent-tertiary/[0.04] flex flex-col justify-between rounded shadow-[0_0_15px_rgba(255,200,0,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-tech text-[10px] uppercase tracking-wider text-accent-tertiary font-bold">Pending</span>
            <div className="p-2 rounded bg-accent-tertiary/15 border border-accent-tertiary/40 text-accent-tertiary">
              <AlertCircle size={16} />
            </div>
          </div>
          <div>
            <p className="font-heading text-3xl text-accent-tertiary uppercase m-0 font-bold">{stats.pending}</p>
            <p className="font-tech text-xs text-text-secondary mt-1 m-0">Awaiting Evaluation</p>
          </div>
        </div>
      </div>

      {/* Team Cards Grid – show pending teams first */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignedTeams.length === 0 ? (
          <div className="col-span-full glass-panel p-10 text-center text-text-secondary font-tech">No teams currently assigned for evaluation.</div>
        ) : (
          assignedTeams.map((team) => {
            const statusInfo = getEvaluationStatus(team.id, selectedRound?.id);
            return (
              <div key={team.id} className="glass-panel border border-border-color hover:border-accent-primary/50 transition-all p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-tech text-[10px] text-accent-secondary font-bold uppercase tracking-wider">
                      {team.track || "GENERAL INNOVATION"}
                    </span>
                    <span className={`font-tech text-[10px] font-bold px-2 py-0.5 border uppercase ${statusInfo.style}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <h3 className="font-heading text-xl text-text-primary uppercase m-0 mb-1">
                    {team.name || `Team ${team.id.slice(0, 6)}`}
                  </h3>
                  <p className="font-tech text-xs text-text-secondary m-0">
                    Leader: <span className="text-text-primary">{team.leader_name || "N/A"}</span>
                  </p>
                </div>
                <div className="pt-6 mt-6 border-t border-border-color flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-text-secondary text-xs font-tech">
                    <FileCheck size={15} />
                    <span>Evaluation</span>
                  </div>
                  <Link href={`/judge/evaluate/${team.name ? slugify(team.name) : team.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-black font-tech font-bold uppercase text-xs transition-colors">
                    <span>Evaluate</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
