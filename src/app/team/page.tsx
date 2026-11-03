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

export const dynamic = "force-dynamic";

const SPOC_CONTACTS = [
  { name: "Monish", phone: "9591755995", email: "vvce25ec0308@vvce.ac.in" },
  { name: "Ananya", phone: "9742993151", email: "vvce25cse0005@vvce.ac.in" },
  { name: "Anirudh", phone: "7975211494", email: "vvce25cse0129@vvce.ac.in" },
  { name: "Anish", phone: "7975274945", email: "vvce25cse0342@vvce.ac.in" },
  { name: "PSP", phone: "8073565631", email: "vvce25cse0402@vvce.ac.in" },
  { name: "Vaishnavi", phone: "9845019351", email: "vvce25cseaiml0180@vvce.ac.in" },
  { name: "Bhavana", phone: "9632327370", email: "vvce25ec0220@vvce.ac.in" },
  { name: "Ramya", phone: "9035677873", email: "vvce25cse0158@vvce.ac.in" },
  { name: "Vidhith", phone: "8147526812", email: "vvce25cse0089@vvce.ac.in" },
  { name: "Charan", phone: "8088436353", email: "vvce25ec0244@vvce.ac.in" },
  { name: "Mamatha", phone: "9743777121", email: "vvce25ec0183@vvce.ac.in" },
  { name: "Rahul", phone: "7348877344", email: "vvce25cse0647@vvce.ac.in" },
];

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

  // Fetch content for team portal
  let contentItems: any[] = [];
  try {
    const contentData = await getContentForPortal("team_leader", undefined, undefined, "published", 20);
    contentItems = contentData.items || [];
  } catch (err) {
    console.error("Failed to load content for team portal:", err);
  }

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

      {/* Real-time Activity Sync Listener (auto-updates claims & distribution status on revert) */}
      <TeamActivitySyncListener teamId={effectiveTeamId} />

      {/* Live Announcement Banner */}


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

      {/* Broadcast Announcements */}
      <AnnouncementBanner
        announcements={announcements}
        portalName="Team Portal"
        audience="teams"
      />

      {/* Primary KPI Row: Team Status & Submission State */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Approved Roster Card */}
        <div className="glass-panel p-5 border border-border-color rounded-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-border-color/80 group">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1 truncate">
                Roster Members
              </span>
              <p className="font-heading text-2xl sm:text-3xl text-text-primary uppercase m-0 font-bold tracking-tight truncate">
                {totalMembers}
              </p>
            </div>
            <div className="p-2.5 bg-accent-tertiary/10 border border-accent-tertiary/30 text-accent-tertiary rounded-lg shrink-0 flex items-center justify-center transition-transform group-hover:scale-105">
              <Users size={20} />
            </div>
          </div>
          <div className="pt-3 border-t border-border-color/50 mt-3 flex items-center justify-between text-xs gap-2">
            <span className="text-status-success flex items-center gap-1 font-bold shrink-0">
              <CheckCircle2 size={13} /> Active Roster
            </span>
            <span className="text-text-secondary font-mono truncate">{teamInfo?.leader_name || "Leader"}</span>
          </div>
        </div>

        {/* Problem Statements Card */}
        <div className="glass-panel p-5 border border-border-color rounded-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-border-color/80 group">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1 truncate">
                Problem Statement
              </span>
              <p
                className="font-heading text-xl sm:text-2xl text-accent-tertiary uppercase m-0 font-bold tracking-tight truncate"
                title="Track Deliverable"
              >
                Track Deliverable
              </p>
            </div>
            <div className="p-2.5 bg-accent-tertiary/10 border border-accent-tertiary/30 text-accent-tertiary rounded-lg shrink-0 flex items-center justify-center transition-transform group-hover:scale-105">
              <ScrollText size={20} />
            </div>
          </div>
          <div className="pt-3 border-t border-border-color/50 mt-3 flex items-center justify-between text-xs gap-2">
            <span className="text-text-secondary truncate">
              Domain: <span className="text-text-primary font-bold">{teamInfo?.track || "Innovation"}</span>
            </span>
            <Link
              href="/team/problem-statements"
              className="text-accent-tertiary hover:underline font-bold uppercase text-[11px] flex items-center gap-1 shrink-0"
            >
              <span>View Statements</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Deliverables Submission Card */}
        <div className="glass-panel p-5 border border-border-color rounded-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-border-color/80 group">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1 truncate">
                Deliverables Status
              </span>
              <p
                className={`font-heading text-xl sm:text-2xl uppercase m-0 font-bold tracking-tight truncate ${
                  hasSubmitted ? "text-status-success" : "text-status-warning"
                }`}
                title={hasSubmitted ? "Submitted" : "Pending Action"}
              >
                {hasSubmitted ? "Submitted" : "Pending Action"}
              </p>
            </div>
            <div
              className={`p-2.5 rounded-lg border shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 ${
                hasSubmitted
                  ? "bg-status-success/10 border-status-success text-status-success"
                  : "bg-status-warning/10 border-status-warning text-status-warning"
              }`}
            >
              <FileUp size={20} />
            </div>
          </div>
          <div className="pt-3 border-t border-border-color/50 mt-3 flex items-center justify-between text-xs gap-2">
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
        <div className="glass-panel p-5 border border-border-color rounded-xl flex flex-col justify-between relative overflow-hidden transition-all hover:border-border-color/80 group">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-1 truncate">
                Evaluation Standing
              </span>
              <p className="font-heading text-xl sm:text-2xl text-accent-primary uppercase m-0 font-bold tracking-tight truncate">
                {publishedResult ? `Rank #${publishedResult.rank || 1}` : "Under Review"}
              </p>
            </div>
            <div className="p-2.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary rounded-lg shrink-0 flex items-center justify-center transition-transform group-hover:scale-105">
              <Trophy size={20} />
            </div>
          </div>
          <div className="pt-3 border-t border-border-color/50 mt-3 flex items-center justify-between text-xs gap-2">
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

      {/* SPOC Contact Directory */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-secondary shrink-0" />
            <h2 className="font-heading text-xl text-text-primary uppercase m-0 font-bold tracking-wide">
              SPOC Contact Directory
            </h2>
          </div>
          <p className="text-[11px] text-text-secondary/70 font-mono">
            Single Point of Contact — Event Coordination
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SPOC_CONTACTS.map((spoc) => (
            <div
              key={spoc.name}
              className="glass-panel p-6 sm:p-8 border border-border-color rounded-xl bg-[#0a0a0f]/50 flex flex-col h-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg sm:text-xl text-text-primary uppercase m-0 font-bold tracking-wide leading-tight">
                  {spoc.name}
                </h3>
                <div className="flex items-center gap-1 text-accent-secondary">
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] text-text-secondary/60 uppercase tracking-wider font-bold font-mono">
                    SPOC
                  </span>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-accent-secondary shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-text-secondary/60 font-mono m-0">
                      Contact Number
                    </p>
                    <a
                      href={`tel:${spoc.phone}`}
                      className="text-text-primary text-base font-mono font-bold hover:text-accent-primary hover:underline transition-colors"
                    >
                      {spoc.phone}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-border-color/40">
                  <Mail className="w-5 h-5 text-accent-secondary shrink-0" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-text-secondary/60 font-mono m-0">
                      Email Address
                    </p>
                    <a
                      href={`mailto:${spoc.email}`}
                      className="text-text-primary text-base font-mono font-bold hover:text-accent-primary hover:underline transition-colors"
                    >
                      {spoc.email}
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-border-color/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <a
                  href={`tel:${spoc.phone}`}
                  className="flex-1 sm:w-1/2 px-4 py-3 bg-accent-secondary border border-accent-secondary/30 text-black text-xs sm:text-base uppercase font-bold tracking-wider rounded-lg transition-all hover:bg-accent-primary hover:border-accent-primary flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>Call</span>
                </a>
                <a
                  href={`mailto:${spoc.email}`}
                  className="flex-1 sm:w-1/2 px-4 py-3 bg-transparent border border-border-color hover:border-accent-secondary text-text-primary text-xs sm:text-base uppercase font-bold tracking-wider rounded-lg transition-all hover:bg-surface-color-light hover:text-text-primary flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>Email</span>
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-secondary/50 italic mt-3">
          Tap Call to dial directly or Email to open your default mail client.
        </p>
      </div>

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
  );
}
