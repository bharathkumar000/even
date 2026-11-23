import { supabaseAdmin } from "@/lib/supabase/admin";
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
import { getAuthenticatedUser } from "@/lib/auth/session";
import { validateUuid } from "@/lib/auth/uuid";

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
  let userId = "";

  // Fetch content for judge portal
  let contentItems: any[] = [];
  try {
    const contentData = await getContentForPortal("judge", undefined, undefined, "published", 20);
    contentItems = contentData.items || [];
  } catch (err) {
    console.error("Failed to load content for judge portal:", err);
  }

  try {
    const session = await getAuthenticatedUser();
    const user = session.user;
    userId = user?.id || "";

    if (!user) {
      return (
        <>
          <JudgeDashboardClient
            initialTeams={[]}
            initialRounds={[]}
            initialEvaluations={[]}
            initialAnnouncements={[]}
            initialJudgeAssignedTeamIds={[]}
            initialIsJudgeSpecific={false}
            userId={userId}
          />
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

    // 1. Get judge's assigned team IDs first (server-side filter, no full table scan)
    // Only fetch team_id column - minimal data transfer
    const [assignRes, roundsRes, evalsRes, announcementsData] = await Promise.all([
      supabaseAdmin
        .from("judge_assignments")
        .select("team_id, round_id")
        .eq("judge_id", user.id),
      supabaseAdmin
        .from("evaluation_rounds")
        .select("id, title, status, sequence_order")
        .order("sequence_order", { ascending: true }),
      supabaseAdmin
        .from("evaluations")
        .select("round_id, team_id, status, total_score")
        .eq("judge_id", user.id),
      getActiveAnnouncements("judges").catch(() => []),
    ]);

    if (roundsRes.data) rounds = roundsRes.data;
    if (evalsRes.data) evaluations = evalsRes.data;
    if (announcementsData) announcements = announcementsData;

    // Collect assigned team IDs
    if (assignRes.data && assignRes.data.length > 0) {
      judgeAssignedTeamIds = assignRes.data.map((a: any) => a.team_id);
      isJudgeSpecific = true;

      // 2. Fetch ONLY the teams this judge is assigned to (not all teams)
      // Use .in() filter for server-side filtering
      const teamsRes = await supabaseAdmin
        .from("teams")
        .select("id, name, leader_name, track, status")
        .in("id", judgeAssignedTeamIds);

      if (teamsRes.data) allTeams = teamsRes.data;
    } else {
      // Judge has no assignments - empty teams list
      allTeams = [];
    }

  } catch (err) {
    console.error("Failed to fetch judge dashboard data:", err);
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
        initialTeams={allTeams}
        initialRounds={rounds}
        initialEvaluations={evaluations}
        initialAnnouncements={announcements}
        initialJudgeAssignedTeamIds={judgeAssignedTeamIds}
        initialIsJudgeSpecific={isJudgeSpecific}
        userId={userId}
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
