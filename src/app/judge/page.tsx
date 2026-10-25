import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
import { getActiveAnnouncements } from "@/app/actions/announcements";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import RealtimeRoundsListener from "@/components/RealtimeRoundsListener";

export const dynamic = "force-dynamic";

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

export default async function JudgeDashboardPage() {
  let allTeams: AssignedTeam[] = [];
  let rounds: JudgeRound[] = [];
  let evaluations: JudgeEvaluation[] = [];
  let announcements: any[] = [];
  let judgeAssignedTeamIds: string[] = [];
  let isJudgeSpecific = false;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const [teamsRes, roundsRes, evalsRes, annRes, assignRes] = await Promise.all([
      supabaseAdmin.from("teams").select("id, name, leader_name, track, status"),
      supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, status, sequence_order")
        .order("sequence_order", { ascending: true }),
      supabaseAdmin.from("evaluations").select("round_id, team_id, status, total_score"),
      getActiveAnnouncements("judges"),
      user
        ? supabaseAdmin
            .from("judge_assignments")
            .select("team_id")
            .eq("judge_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

    if (teamsRes.data) allTeams = teamsRes.data;
    if (roundsRes.data) rounds = roundsRes.data;
    if (evalsRes.data) evaluations = evalsRes.data;
    announcements = annRes || [];

    if (assignRes.data && assignRes.data.length > 0) {
      judgeAssignedTeamIds = assignRes.data.map((a: any) => a.team_id);
      isJudgeSpecific = true;
    }
  } catch (err) {
    console.error("Failed to fetch assigned teams:", err);
  }

  const assignedTeams = isJudgeSpecific
    ? allTeams.filter((t) => judgeAssignedTeamIds.includes(t.id))
    : allTeams;

  // Helper to determine team evaluation status for active round
  const activeRound = rounds.find((r) => r.status === "open" || r.status === "reopened") || rounds[0];

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

  // Compute stats for overview cards
  const allottedCount = assignedTeams.length;
  let evaluatedCount = 0;
  let draftedCount = 0;
  let pendingCount = 0;

  assignedTeams.forEach((team) => {
    const status = getEvaluationStatus(team.id, activeRound?.id);
    if (status.label === "Submitted" || status.label === "Locked") {
      evaluatedCount++;
    } else if (status.label === "Draft") {
      draftedCount++;
    } else {
      pendingCount++;
    }
  });

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      <RealtimeRoundsListener channelName="judge-dashboard-rounds" />
      <AnnouncementBanner announcements={announcements} portalName="Judge Portal" />

      {/* Title */}
      <div className="border-b border-border-color pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-primary font-bold m-0">
              Official Judge Console // Team Roster
            </p>
            {isJudgeSpecific ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-accent-primary/20 text-accent-primary border border-accent-primary/40 uppercase">
                <ShieldCheck size={12} />
                {assignedTeams.length} Allotted Teams
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-surface-color-light text-text-secondary border border-border-color uppercase">
                All Teams (Jury View)
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
            Assigned Teams
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
            Select an assigned team below to inspect their project submission, pitch decks, and record criterion marks.
          </p>
        </div>

        {activeRound && (
          <div className="glass-panel px-4 py-2.5 border border-accent-primary/40 flex items-center gap-3">
            <Layers className="text-accent-primary w-5 h-5" />
            <div>
              <p className="font-tech text-[10px] text-text-secondary uppercase font-bold m-0">
                Active Round
              </p>
              <p className="font-heading text-sm text-text-primary uppercase m-0">
                {activeRound.title}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Allotted */}
        <div className="glass-panel p-4 border border-border-color bg-surface-color/60 flex flex-col justify-between rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="font-tech text-[10px] uppercase tracking-wider text-text-secondary font-bold">
              Total Allotted
            </span>
            <div className="p-2 rounded bg-accent-primary/10 border border-accent-primary/30 text-accent-primary">
              <Users size={16} />
            </div>
          </div>
          <div>
            <p className="font-heading text-3xl text-text-primary uppercase m-0 font-bold">
              {allottedCount}
            </p>
            <p className="font-tech text-xs text-text-secondary mt-1 m-0">
              Assigned Teams
            </p>
          </div>
        </div>

        {/* Evaluated / Completed */}
        <div className="glass-panel p-4 border border-status-success/40 bg-status-success/[0.04] flex flex-col justify-between rounded shadow-[0_0_15px_rgba(34,197,94,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-tech text-[10px] uppercase tracking-wider text-status-success font-bold">
              Evaluated
            </span>
            <div className="p-2 rounded bg-status-success/15 border border-status-success/40 text-status-success">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <p className="font-heading text-3xl text-status-success uppercase m-0 font-bold">
              {evaluatedCount}
            </p>
            <p className="font-tech text-xs text-text-secondary mt-1 m-0">
              Submitted &amp; Recorded
            </p>
          </div>
        </div>

        {/* Drafted / In Progress */}
        <div className="glass-panel p-4 border border-accent-secondary/40 bg-accent-secondary/[0.04] flex flex-col justify-between rounded shadow-[0_0_15px_rgba(255,0,127,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-tech text-[10px] uppercase tracking-wider text-accent-secondary font-bold">
              Drafted
            </span>
            <div className="p-2 rounded bg-accent-secondary/15 border border-accent-secondary/40 text-accent-secondary">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <p className="font-heading text-3xl text-accent-secondary uppercase m-0 font-bold">
              {draftedCount}
            </p>
            <p className="font-tech text-xs text-text-secondary mt-1 m-0">
              Saved Drafts
            </p>
          </div>
        </div>

        {/* Pending */}
        <div className="glass-panel p-4 border border-accent-tertiary/40 bg-accent-tertiary/[0.04] flex flex-col justify-between rounded shadow-[0_0_15px_rgba(255,200,0,0.05)]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-tech text-[10px] uppercase tracking-wider text-accent-tertiary font-bold">
              Pending
            </span>
            <div className="p-2 rounded bg-accent-tertiary/15 border border-accent-tertiary/40 text-accent-tertiary">
              <AlertCircle size={16} />
            </div>
          </div>
          <div>
            <p className="font-heading text-3xl text-accent-tertiary uppercase m-0 font-bold">
              {pendingCount}
            </p>
            <p className="font-tech text-xs text-text-secondary mt-1 m-0">
              Awaiting Evaluation
            </p>
          </div>
        </div>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignedTeams.length === 0 ? (
          <div className="col-span-full glass-panel p-10 text-center text-text-secondary font-tech">
            No teams currently assigned for evaluation.
          </div>
        ) : (
          assignedTeams.map((team) => {
            const statusInfo = getEvaluationStatus(team.id, activeRound?.id);

            return (
              <div
                key={team.id}
                className="glass-panel border border-border-color hover:border-accent-primary/50 transition-all p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-tech text-[10px] text-accent-secondary font-bold uppercase tracking-wider">
                      {team.track || "GENERAL INNOVATION"}
                    </span>
                    <span
                      className={`font-tech text-[10px] font-bold px-2 py-0.5 border uppercase ${statusInfo.style}`}
                    >
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

                  <Link
                    href={`/judge/evaluate/${team.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-black font-tech font-bold uppercase text-xs transition-colors"
                  >
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
