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
import { slugify } from "@/lib/utils";

import JudgeDashboardClient from "./JudgeDashboardClient";


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

    const [teamsRes, roundsRes, evalsRes, assignRes] = await Promise.all([
      supabaseAdmin.from("teams").select("id, name, leader_name, track, status"),
      supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, status, sequence_order")
        .order("sequence_order", { ascending: true }),
      supabaseAdmin.from("evaluations").select("round_id, team_id, status, total_score"),
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
    // announcements no longer fetched

    if (assignRes && assignRes.data && assignRes.data.length > 0) {
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
    <JudgeDashboardClient
      allTeams={allTeams}
      rounds={rounds}
      evaluations={evaluations}
      announcements={announcements}
      judgeAssignedTeamIds={judgeAssignedTeamIds}
      isJudgeSpecific={isJudgeSpecific}
    />
  );

}
