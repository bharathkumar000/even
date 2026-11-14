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
  Users as UsersIcon,
  FileText,
  Bell,
  Archive,
  Globe,
  ScrollText,
} from "lucide-react";
import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import { getContentForPortal } from "@/app/actions/content-hub";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import PitchAlertListener from "@/components/team/PitchAlertListener";
import TeamActivitySyncListener from "@/components/team/TeamActivitySyncListener";
import { getTeamRegistrationByEmail } from "@/lib/googleSheet";
import { ContentActivityHub } from "@/components/content-hub";
import TeamPullToRefresh from "@/components/team/TeamPullToRefresh";

export const dynamic = "force-dynamic";

const SPOC_PHONE_MAP: Record<string, string> = {
  monish: "9591755995",
  ananya: "9742993151",
  anirudh: "7975211494",
  anish: "7975274945",
  psp: "8073565631",
  vaishnavi: "9845019351",
  bhavana: "9632327370",
  ramya: "9035677873",
  vidhith: "8147526812",
  charan: "8088436353",
  mamatha: "9743777121",
  rahul: "7348877344",
};

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
  let assignedPS: any = null;

  // Fetch content for team portal
  let contentItems: any[] = [];
  try {
    const contentData = await getContentForPortal("team_leader", undefined, undefined, "published", 20);
    contentItems = contentData.items || [];
  } catch (err) {
    console.error("Failed to load content for team portal:", err);
  }

  try {
    const [teamRes, membersRes, logsRes, subRes, roundRes, resultRes, annRes, spocAssignRes, psAssignRes] =
      await Promise.all([
        supabaseAdmin
          .from("teams")
          .select("id, name, track, leader_name, created_at")
          .eq("id", effectiveTeamId)
          .maybeSingle(),
        supabaseAdmin
          .from("team_members")
          .select("id, user_id, role, profiles (id, name, email, phone)")
          .eq("team_id", effectiveTeamId),
        supabaseAdmin
          .from("event_activity_logs")
          .select("id, participant_id, action_type, created_at")
          .eq("team_id", effectiveTeamId)
          .eq("result", "success"),
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
        supabaseAdmin
          .from("team_problem_statement_assignments")
          .select(`
            problem_statement_id,
            problem_statements (
              id,
              reference_number,
              title
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
    if (psAssignRes?.data && (psAssignRes.data as any).problem_statements) {
      assignedPS = (psAssignRes.data as any).problem_statements;
    }
  } catch (err) {
    console.error("Failed to load team dashboard data:", err);
  }

  const isLeader = role === "leader" || !teamId;
  const totalMembers = Math.max(members.length, 1);

  const psDisplayTitle =
    assignedPS?.reference_number || assignedPS?.title || "Track Deliverable";

  const assignedSpocPhone =
    assignedSpoc?.phone ||
    (assignedSpoc?.name
      ? SPOC_PHONE_MAP[assignedSpoc.name.trim().toLowerCase()]
      : null);

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
    <TeamPullToRefresh>
      <div className="space-y-8 animate-fade-in font-tech">
      {/* Real-time Jury Pitch Call Alert */}
      <PitchAlertListener teamId={effectiveTeamId} teamName={teamInfo?.name} />

      {/* Real-time Activity Sync Listener (auto-updates claims & distribution status on revert) */}
      <TeamActivitySyncListener teamId={effectiveTeamId} />

      {/* Live Announcement Banner */}


      {/* Top Header */}
      <div className="border-b border-border-color pb-4 sm:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <p className="font-tech text-[10px] sm:text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
              Event Console // Team Lead
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 flex flex-wrap items-center gap-2 sm:gap-3">
              <span>{teamInfo?.name || "Team Console"}</span>
              <span className="text-accent-secondary">Dashboard</span>
            </h1>
            <p className="font-tech text-text-secondary text-xs mt-1.5 sm:mt-2">
              ViceVerse Ideathon 2026 — team deliverables, roster distribution & evaluation status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 bg-surface-color border border-border-color text-text-secondary text-[11px] sm:text-xs uppercase font-mono">
              Track: <span className="text-accent-primary font-bold">{teamInfo?.track || "GENERAL"}</span>
            </span>
            <span className="px-2.5 py-1 bg-accent-secondary/15 border border-accent-secondary text-accent-secondary text-[11px] sm:text-xs uppercase font-mono font-bold">
              {isLeader ? "LEADER CONSOLE" : "MEMBER"}
            </span>
          </div>
        </div>
      </div>

      {/* Broadcast Announcements */}
      <AnnouncementBanner
        announcements={announcements}
        portalName="Team Portal"
        audience="teams"
      />

      {/* Primary KPI Row: Team Status & Submission State */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Approved Roster Card */}
        <div className="glass-panel p-4 sm:p-5 border border-border-color flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1 truncate">
                Roster Members
              </span>
              <p className="font-heading text-2xl sm:text-3xl text-text-primary uppercase m-0 font-bold truncate">
                {totalMembers}
              </p>
            </div>
            <div className="p-2 sm:p-2.5 bg-accent-tertiary/10 border border-accent-tertiary/30 text-accent-tertiary rounded shrink-0">
              <Users size={18} className="sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="pt-3 sm:pt-4 border-t border-border-color/50 mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-status-success flex items-center gap-1 font-bold shrink-0">
              <CheckCircle2 size={13} /> Active Roster
            </span>
            <span className="text-text-secondary font-mono text-[11px] sm:text-xs truncate text-right">
              {teamInfo?.leader_name || "Leader"}
            </span>
          </div>
        </div>

        {/* Problem Statements Card */}
        <div className="glass-panel p-4 sm:p-5 border border-border-color flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1 truncate">
                Problem Statement
              </span>
              <p
                className="font-heading text-lg sm:text-xl text-accent-tertiary uppercase m-0 font-bold truncate leading-snug"
                title={psDisplayTitle}
              >
                {psDisplayTitle}
              </p>
            </div>
            <div className="p-2 sm:p-2.5 bg-accent-tertiary/10 border border-accent-tertiary/30 text-accent-tertiary rounded shrink-0">
              <ScrollText size={18} className="sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="pt-3 sm:pt-4 border-t border-border-color/50 mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-text-secondary truncate">
              Domain: <span className="text-text-primary font-bold">{teamInfo?.track || "Innovation"}</span>
            </span>
            <Link
              href="/team/problem-statements"
              className="text-accent-tertiary hover:underline font-bold uppercase text-[11px] flex items-center gap-1 shrink-0"
            >
              <span>{assignedPS ? "Change PS" : "View Statements"}</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Deliverables Submission Card */}
        <div className="glass-panel p-4 sm:p-5 border border-border-color flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1 truncate">
                Deliverables Status
              </span>
              <p
                className={`font-heading text-lg sm:text-xl uppercase m-0 font-bold truncate leading-snug ${
                  hasSubmitted ? "text-status-success" : "text-status-warning"
                }`}
                title={hasSubmitted ? "Submitted" : "Pending Action"}
              >
                {hasSubmitted ? "Submitted" : "Pending Action"}
              </p>
            </div>
            <div
              className={`p-2 sm:p-2.5 rounded border shrink-0 ${
                hasSubmitted
                  ? "bg-status-success/10 border-status-success text-status-success"
                  : "bg-status-warning/10 border-status-warning text-status-warning"
              }`}
            >
              <FileUp size={18} className="sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="pt-3 sm:pt-4 border-t border-border-color/50 mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-text-secondary truncate">
              Round: <span className="text-text-primary font-bold">{activeRound?.title || "Round 1"}</span>
            </span>
            <Link
              href="/team/submission"
              className="text-accent-secondary hover:underline font-bold uppercase text-[11px] flex items-center gap-1 shrink-0"
            >
              <span>{hasSubmitted ? "Review" : "Upload Now"}</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Results / Standings Card */}
        <div className="glass-panel p-4 sm:p-5 border border-border-color flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1 truncate">
                Evaluation Standing
              </span>
              <p
                className="font-heading text-lg sm:text-xl text-accent-primary uppercase m-0 font-bold truncate leading-snug"
                title={publishedResult ? `Rank #${publishedResult.rank || 1}` : "Under Review"}
              >
                {publishedResult ? `Rank #${publishedResult.rank || 1}` : "Under Review"}
              </p>
            </div>
            <div className="p-2 sm:p-2.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary rounded shrink-0">
              <Trophy size={18} className="sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="pt-3 sm:pt-4 border-t border-border-color/50 mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-text-secondary truncate">
              {publishedResult ? `${publishedResult.total_score} Points` : "Judging in Progress"}
            </span>
            <Link
              href="/team/results"
              className="text-accent-primary hover:underline font-bold uppercase text-[11px] flex items-center gap-1 shrink-0"
            >
              <span>View Scorecard</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* Team Contact Roster */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[2px] text-text-secondary font-bold m-0 flex items-center gap-2">
          <Users size={15} className="text-accent-secondary" />
          Team Contact Roster
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.length === 0 ? (
            <p className="text-xs text-text-secondary italic col-span-full">
              No team members registered yet.
            </p>
          ) : (
            members.map((member) => {
              const profile = (member as any).profiles;
              const phone = profile?.phone || null;
              const name = profile?.full_name || member.name || "Member";
              const email = profile?.email || member.email || null;
              return (
                <div
                  key={member.id}
                  className="glass-panel p-3 border border-border-color rounded flex items-center gap-3 hover:border-accent-secondary/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded bg-surface-color border border-border-color flex items-center justify-center font-heading text-xs text-text-secondary shrink-0 uppercase">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs text-text-primary truncate m-0">
                      {name}
                    </p>
                    <p className="text-[10px] text-text-secondary truncate m-0">
                      {member.role === "leader" ? "Team Leader" : "Member"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {phone ? (
                      <>
                        <a
                          href={`tel:${phone}`}
                          className="p-1.5 bg-surface-color border border-border-color hover:border-accent-primary text-accent-primary rounded hover:bg-accent-primary/5 transition-colors"
                          title="Call"
                        >
                          <Phone size={13} />
                        </a>
                        <span className="text-[10px] font-mono text-text-primary truncate max-w-[120px]">
                          {phone}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] opacity-50 italic">No phone</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {members.length > 0 && members.every((m) => {
          const profile = (m as any).profiles;
          return !profile?.phone;
        }) && (
          <p className="text-[10px] text-text-secondary/70 italic mt-2">
            No phone numbers added yet. Ask an administrator to add them in User Management.
          </p>
        )}
      </div>

      {/* Assigned Team SPOC Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-accent-secondary shrink-0" />
            <h2 className="font-heading text-lg sm:text-xl text-text-primary uppercase m-0 font-bold tracking-wide">
              Your Assigned SPOC
            </h2>
          </div>
          <p className="text-[10px] sm:text-[11px] text-text-secondary/70 font-mono m-0">
            Single Point of Contact — Dedicated Club Coordinator
          </p>
        </div>

        {assignedSpoc ? (
          <div className="glass-panel p-5 sm:p-6 border border-border-color rounded-xl bg-[#0a0a0f]/60 max-w-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-color/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent-secondary/10 border-2 border-accent-secondary/40 flex items-center justify-center text-accent-secondary font-bold font-mono text-lg shrink-0">
                  {assignedSpoc.name ? assignedSpoc.name.charAt(0).toUpperCase() : "S"}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading text-lg sm:text-xl text-text-primary uppercase m-0 font-bold tracking-wide">
                      {assignedSpoc.name}
                    </h3>
                    <span className="text-[9px] sm:text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider font-bold font-mono">
                      ASSIGNED
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary font-mono m-0 mt-0.5">
                    {assignedSpoc.department ? `${assignedSpoc.department} • ` : ""}Official Squad Mentor / SPOC
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 my-4">
              {assignedSpocPhone ? (
                <div className="p-3 bg-black/40 border border-border-color/40 rounded-lg">
                  <p className="text-[9px] uppercase tracking-wider text-text-secondary/60 font-mono m-0 mb-1">
                    Contact Phone
                  </p>
                  <a
                    href={`tel:${assignedSpocPhone}`}
                    className="text-text-primary text-xs sm:text-sm font-mono font-bold hover:text-accent-primary hover:underline transition-colors block truncate"
                  >
                    +91 {assignedSpocPhone}
                  </a>
                </div>
              ) : null}

              {assignedSpoc.email ? (
                <div className="p-3 bg-black/40 border border-border-color/40 rounded-lg">
                  <p className="text-[9px] uppercase tracking-wider text-text-secondary/60 font-mono m-0 mb-1">
                    Official Email
                  </p>
                  <a
                    href={`mailto:${assignedSpoc.email}`}
                    className="text-text-primary text-xs sm:text-sm font-mono font-bold hover:text-accent-primary hover:underline transition-colors block truncate"
                    title={assignedSpoc.email}
                  >
                    {assignedSpoc.email}
                  </a>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-border-color/30">
              {assignedSpocPhone && (
                <a
                  href={`tel:${assignedSpocPhone}`}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-accent-secondary border border-accent-secondary/30 text-black text-xs uppercase font-bold tracking-wider rounded-lg transition-all hover:bg-accent-primary hover:border-accent-primary flex items-center justify-center gap-2 min-h-[42px]"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>Call SPOC</span>
                </a>
              )}
              {assignedSpocPhone && (
                <a
                  href={`https://wa.me/91${assignedSpocPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs uppercase font-bold tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 min-h-[42px]"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>WhatsApp</span>
                </a>
              )}
              {assignedSpoc.email && (
                <a
                  href={`mailto:${assignedSpoc.email}`}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-surface-color-light border border-border-color hover:border-accent-secondary text-text-primary text-xs uppercase font-bold tracking-wider rounded-lg transition-all hover:bg-surface-color flex items-center justify-center gap-2 min-h-[42px]"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>Email SPOC</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-panel p-5 sm:p-6 border border-border-color rounded-xl bg-[#0a0a0f]/40 max-w-2xl flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading text-base sm:text-lg text-text-primary uppercase m-0 font-bold tracking-wide">
                SPOC Assignment in Progress
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed m-0 font-sans">
                Your dedicated Single Point of Contact (SPOC) is being assigned by the admin team. Once allotted, their direct contact details will appear right here.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Distribution Progress Section (Identical to Ops Progress Cards) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <p className="text-xs uppercase tracking-[2px] text-text-secondary font-bold m-0 flex items-center gap-2">
            <Activity size={15} className="text-accent-secondary shrink-0" />
            Distribution & Check-in Progress
          </p>
          <span className="text-[10px] sm:text-[11px] text-text-secondary font-mono">
            {regCount}/{totalMembers} Members Checked In
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Registrations */}
          <div className="glass-panel p-3.5 sm:p-4 border border-border-color space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-status-success font-bold uppercase flex items-center gap-1 text-[11px] sm:text-xs truncate">
                <CheckCircle2 size={13} className="shrink-0" /> Registrations
              </span>
              <span className="text-text-secondary font-mono text-[10px] sm:text-[11px]">{regPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-xl sm:text-2xl text-text-primary m-0">
                {regCount} <span className="text-text-secondary text-xs sm:text-sm">/ {totalMembers}</span>
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
          <div className="glass-panel p-3.5 sm:p-4 border border-border-color space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-accent-primary font-bold uppercase flex items-center gap-1 text-[11px] sm:text-xs truncate">
                <Gift size={13} className="shrink-0" /> Goodies Kit
              </span>
              <span className="text-text-secondary font-mono text-[10px] sm:text-[11px]">{goodiesPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-xl sm:text-2xl text-text-primary m-0">
                {goodiesCount} <span className="text-text-secondary text-xs sm:text-sm">/ {totalMembers}</span>
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
          <div className="glass-panel p-3.5 sm:p-4 border border-border-color space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-accent-secondary font-bold uppercase flex items-center gap-1 text-[11px] sm:text-xs truncate">
                <Utensils size={13} className="shrink-0" /> Lunch Token
              </span>
              <span className="text-text-secondary font-mono text-[10px] sm:text-[11px]">{lunchPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-xl sm:text-2xl text-text-primary m-0">
                {lunchCount} <span className="text-text-secondary text-xs sm:text-sm">/ {totalMembers}</span>
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
          <div className="glass-panel p-3.5 sm:p-4 border border-border-color space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-accent-tertiary font-bold uppercase flex items-center gap-1 text-[11px] sm:text-xs truncate">
                <Coffee size={13} className="shrink-0" /> Refreshments
              </span>
              <span className="text-text-secondary font-mono text-[10px] sm:text-[11px]">{snacksPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-xl sm:text-2xl text-text-primary m-0">
                {snacksCount} <span className="text-text-secondary text-xs sm:text-sm">/ {totalMembers}</span>
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

      {/* Content & Activity Hub */}
      <ContentActivityHub
        portalAudience="team_leader"
        showFilters={true}
        showSearch={true}
        showCreateButton={false}
        initialItems={contentItems}
        emptyMessage="No content published for your team yet."
        loadingMessage="Loading team content..."
        errorMessage="Failed to load team content."
      />
    </div>
    </TeamPullToRefresh>
  );
}
