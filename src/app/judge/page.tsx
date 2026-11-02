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
  Layers as LayersIcon,
  Sparkles,
} from "lucide-react";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import { getContentForPortal } from "@/app/actions/content-hub";
import JudgeDashboardClient from "./JudgeDashboardClient";
import { ContentActivityHub } from "@/components/content-hub";

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

  // Fetch content for judge portal
  let contentItems: any[] = [];
  try {
    const contentData = await getContentForPortal("judge", undefined, undefined, "published", 20);
    contentItems = contentData.items || [];
  } catch (err) {
    console.error("Failed to load content for judge portal:", err);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const [teamsRes, roundsRes, evalsRes, assignRes, announcementsData] = await Promise.all([
      supabaseAdmin.from("teams").select("id, name, leader_name, track, status"),
      supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, status, sequence_order")
        .order("sequence_order", { ascending: true }),
      user
        ? supabaseAdmin
            .from("evaluations")
            .select("round_id, team_id, status, total_score")
            .eq("judge_id", user.id)
        : Promise.resolve({ data: [] }),
      user
        ? supabaseAdmin
            .from("judge_assignments")
            .select("team_id")
            .eq("judge_id", user.id)
        : Promise.resolve({ data: [] }),
      getActiveAnnouncements("judges").catch(() => []),
    ]);

    if (teamsRes.data) allTeams = teamsRes.data;
    if (roundsRes.data) rounds = roundsRes.data;
    if (evalsRes.data) evaluations = evalsRes.data;
    if (announcementsData) announcements = announcementsData;

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
    <>
      <JudgeDashboardClient
        allTeams={allTeams}
        rounds={rounds}
        evaluations={evaluations}
        announcements={announcements}
        judgeAssignedTeamIds={judgeAssignedTeamIds}
        isJudgeSpecific={isJudgeSpecific}
      />

      {/* Content & Activity Hub for Judges */}
      <ContentActivityHub
        portalAudience="judge"
        showFilters={true}
        showSearch={true}
        showCreateButton={false}
        initialItems={[]}
        emptyMessage="No judge-specific content published yet."
        loadingMessage="Loading judge content..."
        errorMessage="Failed to load judge content."
      />
    </>
  );
}
