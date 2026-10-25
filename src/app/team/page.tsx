import Link from "next/link";
import {
  Users,
  CheckCircle2,
  QrCode,
  FileUp,
  Trophy,
  Activity,
  Layers,
  ArrowRight,
  Shield,
  Coffee,
  Utensils,
  Gift,
  UserCheck,
  Clock,
  Sparkles,
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import PitchAlertListener from "@/components/team/PitchAlertListener";
import { getTeamRegistrationByEmail } from "@/lib/googleSheet";

import Image from "next/image";

export const dynamic = "force-dynamic";


export default async function TeamDashboardPage() {
  const { teamId, user, role } = await requireAuthenticatedTeamUser();
  const effectiveTeamId = teamId;

  let teamInfo: any = null;
  let members: any[] = [];
  let activityLogs: any[] = [];
  let currentSubmission: any = null;
  let activeRound: any = null;
  let publishedResult: any = null;
  let announcements: any[] = [];
  let assignedSpoc: any = null;

  try {
    const [teamRes, membersRes, logsRes, subRes, roundRes, resultRes, annRes, spocAssignRes] =
      await Promise.all([
        supabaseAdmin
          .from("teams")
          .select("id, name, track, leader_name, created_at")
          .eq("id", effectiveTeamId)
          .maybeSingle(),
        supabaseAdmin
          .from("team_members")
          .select("id, user_id, role, profiles (id, name, email)")
          .eq("team_id", effectiveTeamId),
        supabaseAdmin
          .from("event_activity_logs")
          .select("id, participant_id, action_type, created_at")
          .eq("team_id", effectiveTeamId),
        supabaseAdmin
          .from("team_submissions")
          .select("*")
          .eq("team_id", effectiveTeamId)
          .maybeSingle(),
        supabaseAdmin
          .from("evaluation_rounds")
          .select("*")
          .order("sequence_order", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("event_results")
          .select("*")
          .eq("team_id", effectiveTeamId)
          .eq("is_published", true)
          .maybeSingle(),
        getActiveAnnouncements("teams"),
        supabaseAdmin
          .from("team_spoc_assignments")
          .select(`
            spoc_id,
            spocs (
              id,
              name,
              email,
              phone,
              department,
              notes,
              avatar_url
            )
          `)
          .eq("team_id", effectiveTeamId)
          .maybeSingle(),
      ]);

    if (teamRes.data) teamInfo = teamRes.data;
    // Fallback to Google Sheet registration data when Supabase returns no team.
    if (!teamInfo && user?.email) {
      const reg = await getTeamRegistrationByEmail(user.email);
      if (reg) {
        teamInfo = {
          name: reg["Team Name"] ?? "",
          track: reg["SELECTED DOMAIN"] ?? "",
          leader_name: reg["Team Leader"] ?? user.email?.split("@")[0],
        };
        // Build a simple members array for roster counts based on registration fields
        const memberNames = [
          reg["Team Leader"],
          reg["Member 1 Name"],
          reg["Member 2 Name"],
          reg["Member 3 Name"]
        ].filter(Boolean);
        members = memberNames.map((name) => ({ name }));
      }
    }
    if (membersRes.data) members = membersRes.data;
    if (logsRes.data) activityLogs = logsRes.data;
    if (subRes.data) currentSubmission = subRes.data;
    if (roundRes.data) activeRound = roundRes.data;
    if (resultRes.data) publishedResult = resultRes.data;
    announcements = annRes || [];
    if (spocAssignRes.data && (spocAssignRes.data as any).spocs) {
      assignedSpoc = (spocAssignRes.data as any).spocs;
    }
  } catch (err) {
    console.error("Failed to load team dashboard data:", err);
  }

  const isLeader = role === "leader" || !teamId;
  const totalMembers = Math.max(members.length, 1);

  // Distribution counters
  const regCount = activityLogs.filter((l) => l.action_type === "registration").length;
  const goodiesCount = activityLogs.filter((l) => l.action_type === "goodies").length;
  const lunchCount = activityLogs.filter((l) => l.action_type === "lunch").length;
  const snacksCount = activityLogs.filter((l) => l.action_type === "snacks").length;

  const regPct = Math.min(100, Math.round((regCount / totalMembers) * 100));
  const goodiesPct = Math.min(100, Math.round((goodiesCount / totalMembers) * 100));
  const lunchPct = Math.min(100, Math.round((lunchCount / totalMembers) * 100));
  const snacksPct = Math.min(100, Math.round((snacksCount / totalMembers) * 100));

  const hasSubmitted = !!currentSubmission?.ppt_url;

  return (
    <div className="space-y-8 animate-fade-in font-tech">
      {/* Real-time Jury Pitch Call Alert */}
      <PitchAlertListener teamId={effectiveTeamId} teamName={teamInfo?.name} />

      {/* Live Announcement Banner */}
      <AnnouncementBanner announcements={announcements} portalName="Team Portal" />

      {/* Top Header */}
      <div className="border-b border-border-color pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
              Event Console // Team Lead
            </p>
            <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
              <span>{teamInfo?.name || "Team Console"}</span>
              <span className="text-accent-secondary">Dashboard</span>
            </h1>
            <p className="font-tech text-text-secondary text-xs mt-2">
              ViceVerse Ideathon 2026 — team deliverables, roster distribution & evaluation status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-surface-color border border-border-color text-text-secondary text-xs uppercase font-mono">
              Track: <span className="text-accent-primary font-bold">{teamInfo?.track || "GENERAL"}</span>
            </span>
            <span className="px-3 py-1 bg-accent-secondary/15 border border-accent-secondary text-accent-secondary text-xs uppercase font-mono font-bold">
              {isLeader ? "LEADER CONSOLE" : "MEMBER"}
            </span>
          </div>
        </div>
      </div>

      {/* Primary KPI Row: Team Status & Submission State */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Approved Roster Card */}
        <div className="glass-panel p-5 border border-border-color flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1">
                Roster Members
              </span>
              <p className="font-heading text-3xl text-text-primary uppercase m-0 font-bold">
                {totalMembers}
              </p>
            </div>
            <div className="p-2.5 bg-accent-tertiary/10 border border-accent-tertiary/30 text-accent-tertiary rounded">
              <Users size={20} />
            </div>
          </div>
          <div className="pt-4 border-t border-border-color/50 mt-3 flex items-center justify-between text-xs">
            <span className="text-status-success flex items-center gap-1 font-bold">
              <CheckCircle2 size={13} /> Active Roster
            </span>
            <span className="text-text-secondary font-mono">{teamInfo?.leader_name || "Leader"}</span>
          </div>
        </div>

        {/* Deliverables Submission Card */}
        <div className="glass-panel p-5 border border-border-color flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1">
                Deliverables Status
              </span>
              <p
                className={`font-heading text-2xl uppercase m-0 font-bold ${
                  hasSubmitted ? "text-status-success" : "text-status-warning"
                }`}
              >
                {hasSubmitted ? "Submitted" : "Pending Action"}
              </p>
            </div>
            <div
              className={`p-2.5 rounded border ${
                hasSubmitted
                  ? "bg-status-success/10 border-status-success text-status-success"
                  : "bg-status-warning/10 border-status-warning text-status-warning"
              }`}
            >
              <FileUp size={20} />
            </div>
          </div>
          <div className="pt-4 border-t border-border-color/50 mt-3 flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              Round: <span className="text-text-primary font-bold">{activeRound?.title || "Round 1"}</span>
            </span>
            <Link
              href="/team/submission"
              className="text-accent-secondary hover:underline font-bold uppercase text-[11px] flex items-center gap-1"
            >
              <span>{hasSubmitted ? "Review" : "Upload Now"}</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Results / Standings Card */}
        <div className="glass-panel p-5 border border-border-color flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1">
                Evaluation Standing
              </span>
              <p className="font-heading text-2xl text-accent-primary uppercase m-0 font-bold">
                {publishedResult ? `Rank #${publishedResult.rank || 1}` : "Under Review"}
              </p>
            </div>
            <div className="p-2.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary rounded">
              <Trophy size={20} />
            </div>
          </div>
          <div className="pt-4 border-t border-border-color/50 mt-3 flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              {publishedResult ? `${publishedResult.total_score} Points` : "Judging in Progress"}
            </span>
            <Link
              href="/team/results"
              className="text-accent-primary hover:underline font-bold uppercase text-[11px] flex items-center gap-1"
            >
              <span>View Scorecard</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* Dedicated SPOC Coordinator Card */}
      {assignedSpoc && (
        <div className="glass-panel p-4 sm:p-5 border border-accent-secondary/40 bg-gradient-to-r from-accent-secondary/[0.07] via-surface-color/60 to-surface-color flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5 rounded-lg shadow-[0_0_20px_rgba(255,0,127,0.1)]">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-accent-secondary bg-surface-color-light flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,0,127,0.25)]">
              {assignedSpoc.avatar_url ? (
                <Image
                  src={assignedSpoc.avatar_url}
                  alt={assignedSpoc.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-heading text-xl text-accent-secondary uppercase font-bold">
                  {assignedSpoc.name.slice(0, 2)}
                </span>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-success animate-pulse shrink-0" />
                <span className="text-[10px] uppercase tracking-[2px] text-accent-secondary font-bold">
                  Your Dedicated Event SPOC
                </span>
              </div>
              <h3 className="font-heading text-lg sm:text-xl text-text-primary uppercase m-0 flex flex-wrap items-center gap-1.5 sm:gap-2 leading-tight">
                <span>{assignedSpoc.name}</span>
                {assignedSpoc.department && (
                  <span className="text-xs font-mono text-accent-primary normal-case">
                    [{assignedSpoc.department}]
                  </span>
                )}
              </h3>
              <p className="text-[11px] sm:text-xs text-text-secondary m-0 font-mono">
                Assigned coordinator for team queries, schedule assistance & live logistics.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-border-color/40 w-full md:w-auto">
            {assignedSpoc.phone && (
              <a
                href={`tel:${assignedSpoc.phone}`}
                className="flex-1 sm:flex-none px-3 py-2 bg-surface-color border border-border-color hover:border-accent-primary text-text-primary text-xs uppercase font-bold tracking-wider rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <Phone size={14} className="text-accent-primary shrink-0" />
                <span>Call</span>
              </a>
            )}

            {assignedSpoc.phone && (
              <a
                href={`https://wa.me/${assignedSpoc.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `Hello ${assignedSpoc.name}, reaching out from Team "${teamInfo?.name || "Participant"}" regarding ViceVerse Ideathon.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none px-3.5 py-2 bg-[#25D366] text-black text-xs uppercase font-bold tracking-wider rounded hover:bg-[#20ba59] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(37,211,102,0.3)] cursor-pointer"
              >
                <MessageCircle size={15} className="stroke-[2.5] shrink-0" />
                <span>WhatsApp</span>
                <ExternalLink size={12} className="shrink-0" />
              </a>
            )}

            {assignedSpoc.email && (
              <a
                href={`mailto:${assignedSpoc.email}`}
                className="p-2 bg-surface-color border border-border-color hover:border-accent-secondary text-text-secondary hover:text-text-primary rounded transition-colors"
                title={assignedSpoc.email}
              >
                <Mail size={15} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Distribution Progress Section (Identical to Ops Progress Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[2px] text-text-secondary font-bold m-0 flex items-center gap-2">
            <Activity size={15} className="text-accent-secondary" />
            Distribution & Check-in Progress
          </p>
          <span className="text-[11px] text-text-secondary font-mono">
            {regCount}/{totalMembers} Members Checked In
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Registrations */}
          <div className="glass-panel p-4 border border-border-color space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-status-success font-bold uppercase flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Registrations
              </span>
              <span className="text-text-secondary font-mono text-[11px]">{regPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-2xl text-text-primary m-0">
                {regCount} <span className="text-text-secondary text-sm">/ {totalMembers}</span>
              </p>
            </div>
            <div className="w-full bg-surface-color h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-status-success h-full transition-all duration-500"
                style={{ width: `${regPct}%` }}
              />
            </div>
          </div>

          {/* Goodies */}
          <div className="glass-panel p-4 border border-border-color space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-accent-primary font-bold uppercase flex items-center gap-1.5">
                <Gift size={14} /> Goodies / Kits
              </span>
              <span className="text-text-secondary font-mono text-[11px]">{goodiesPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-2xl text-text-primary m-0">
                {goodiesCount} <span className="text-text-secondary text-sm">/ {totalMembers}</span>
              </p>
            </div>
            <div className="w-full bg-surface-color h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-accent-primary h-full transition-all duration-500"
                style={{ width: `${goodiesPct}%` }}
              />
            </div>
          </div>

          {/* Lunch */}
          <div className="glass-panel p-4 border border-border-color space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-accent-secondary font-bold uppercase flex items-center gap-1.5">
                <Utensils size={14} /> Lunch Token
              </span>
              <span className="text-text-secondary font-mono text-[11px]">{lunchPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-2xl text-text-primary m-0">
                {lunchCount} <span className="text-text-secondary text-sm">/ {totalMembers}</span>
              </p>
            </div>
            <div className="w-full bg-surface-color h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-accent-secondary h-full transition-all duration-500"
                style={{ width: `${lunchPct}%` }}
              />
            </div>
          </div>

          {/* Snacks */}
          <div className="glass-panel p-4 border border-border-color space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-accent-tertiary font-bold uppercase flex items-center gap-1.5">
                <Coffee size={14} /> Refreshments
              </span>
              <span className="text-text-secondary font-mono text-[11px]">{snacksPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-2xl text-text-primary m-0">
                {snacksCount} <span className="text-text-secondary text-sm">/ {totalMembers}</span>
              </p>
            </div>
            <div className="w-full bg-surface-color h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-accent-tertiary h-full transition-all duration-500"
                style={{ width: `${snacksPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions (Matching Operations Action Cards) */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[2px] text-text-secondary font-bold m-0">
          Quick Actions
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Action 1: Upload Deliverables */}
          <Link
            href="/team/submission"
            className="group glass-panel p-3.5 sm:p-4 border border-border-color hover:border-accent-secondary transition-all flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 sm:p-3 bg-accent-secondary/10 border border-accent-secondary/40 text-accent-secondary rounded group-hover:scale-105 transition-transform shrink-0">
                <FileUp size={20} className="sm:w-[22px] sm:h-[22px]" />
              </div>
              <div className="min-w-0">
                <p className="font-heading text-sm sm:text-base text-text-primary uppercase m-0 group-hover:text-accent-secondary transition-colors truncate">
                  Submit Deliverables
                </p>
                <p className="text-[11px] sm:text-xs text-text-secondary m-0 mt-0.5 truncate">
                  Upload Problem/Solution Statement & Presentation File
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="text-[9px] sm:text-[10px] px-2 py-0.5 bg-accent-secondary/15 border border-accent-secondary/40 text-accent-secondary font-bold uppercase">
                {hasSubmitted ? "Updated" : "Primary"}
              </span>
              <ArrowRight size={15} className="text-text-secondary group-hover:text-accent-secondary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          {/* Action 2: Show QR Code */}
          <Link
            href="/team/qr"
            className="group glass-panel p-3.5 sm:p-4 border border-border-color hover:border-accent-tertiary transition-all flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 sm:p-3 bg-accent-tertiary/10 border border-accent-tertiary/40 text-accent-tertiary rounded group-hover:scale-105 transition-transform shrink-0">
                <QrCode size={20} className="sm:w-[22px] sm:h-[22px]" />
              </div>
              <div className="min-w-0">
                <p className="font-heading text-sm sm:text-base text-text-primary uppercase m-0 group-hover:text-accent-tertiary transition-colors truncate">
                  Show Team QR Pass
                </p>
                <p className="text-[11px] sm:text-xs text-text-secondary m-0 mt-0.5 truncate">
                  Present QR badge to Operations Desk for check-in & tokens
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="text-[9px] sm:text-[10px] px-2 py-0.5 bg-surface-color border border-border-color text-text-secondary font-bold uppercase">
                Pass
              </span>
              <ArrowRight size={15} className="text-text-secondary group-hover:text-accent-tertiary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          {/* Action 3: Team Standings */}
          <Link
            href="/team/results"
            className="group glass-panel p-3.5 sm:p-4 border border-border-color hover:border-accent-primary transition-all flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 sm:p-3 bg-accent-primary/10 border border-accent-primary/40 text-accent-primary rounded group-hover:scale-105 transition-transform shrink-0">
                <Trophy size={20} className="sm:w-[22px] sm:h-[22px]" />
              </div>
              <div className="min-w-0">
                <p className="font-heading text-sm sm:text-base text-text-primary uppercase m-0 group-hover:text-accent-primary transition-colors truncate">
                  Scorecard & Results
                </p>
                <p className="text-[11px] sm:text-xs text-text-secondary m-0 mt-0.5 truncate">
                  Check certified judging scores and event standings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="text-[9px] sm:text-[10px] px-2 py-0.5 bg-surface-color border border-border-color text-text-secondary font-bold uppercase">
                Certified
              </span>
              <ArrowRight size={15} className="text-text-secondary group-hover:text-accent-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          {/* Action 4: Round Details */}
          <div className="glass-panel p-4 border border-border-color flex items-center justify-between opacity-80">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-surface-color-light border border-border-color text-text-secondary rounded">
                <Clock size={22} />
              </div>
              <div>
                <p className="font-heading text-base text-text-primary uppercase m-0">
                  Current Stage: {activeRound?.title || "Innovation & Pitch"}
                </p>
                <p className="text-xs text-text-secondary m-0 mt-0.5 font-mono">
                  Status: {activeRound?.status?.toUpperCase() || "ACTIVE"}
                </p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-status-success/15 border border-status-success text-status-success font-bold uppercase">
              Live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
