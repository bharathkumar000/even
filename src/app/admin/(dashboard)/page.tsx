import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  Users,
  Gavel,
  Shield,
  Crown,
  Layers,
  Clock,
  ShieldCheck,
  ArrowRight,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import StatCard from "@/components/admin/StatCard";
import AdminAnnouncementModal from "@/components/admin/AdminAnnouncementModal";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { getActiveAnnouncements } from "@/app/actions/announcements";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  // 1. User Role Counts
  let participantCount = 0;
  let leaderCount = 0;
  let judgeCount = 0;
  let staffCount = 0;

  // 2. Event Metrics Counts
  let totalTeams = 0;
  let activeRounds = 0;
  let pendingEvaluations = 0;
  let isResultsPublished = false;
  let announcements: any[] = [];

  try {
    const [
      profilesRes,
      teamMembersRes,
      teamsRes,
      roundsRes,
      evalsRes,
      resultsRes,
      annRes,
    ] = await Promise.allSettled([
      supabaseAdmin.from("profiles").select("role"),
      supabaseAdmin.from("team_members").select("id", { count: "exact", head: true }).eq("role", "leader"),
      supabaseAdmin.from("teams").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("evaluation_rounds").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabaseAdmin.from("evaluations").select("id", { count: "exact", head: true }).eq("status", "draft"),
      supabaseAdmin.from("event_results").select("is_published").eq("is_published", true).limit(1),
      getActiveAnnouncements("all"),
    ]);

    if (profilesRes.status === "fulfilled" && Array.isArray(profilesRes.value.data)) {
      const profiles = profilesRes.value.data;
      participantCount = profiles.filter((p) => p.role === "participant").length;
      judgeCount = profiles.filter((p) => p.role === "judge").length;
      staffCount = profiles.filter((p) => p.role === "staff" || p.role === "organizer").length;
      const profileLeaders = profiles.filter((p) => p.role === "leader").length;
      const tmLeaders = teamMembersRes.status === "fulfilled" && typeof teamMembersRes.value.count === "number" ? teamMembersRes.value.count : 0;
      leaderCount = Math.max(profileLeaders, tmLeaders);
    }
    if (teamsRes.status === "fulfilled" && teamsRes.value && typeof teamsRes.value.count === "number") {
      totalTeams = teamsRes.value.count;
    }
    if (roundsRes.status === "fulfilled" && roundsRes.value && typeof roundsRes.value.count === "number") {
      activeRounds = roundsRes.value.count;
    }
    if (evalsRes.status === "fulfilled" && evalsRes.value && typeof evalsRes.value.count === "number") {
      pendingEvaluations = evalsRes.value.count;
    }
    if (
      resultsRes.status === "fulfilled" &&
      resultsRes.value &&
      "data" in resultsRes.value &&
      Array.isArray(resultsRes.value.data) &&
      resultsRes.value.data.length > 0
    ) {
      isResultsPublished = true;
    }
    if (annRes.status === "fulfilled" && Array.isArray(annRes.value)) {
      announcements = annRes.value;
    }
  } catch (err) {
    console.error("Failed to load live admin metrics:", err);
  }

  const eventMetricCards = [
    {
      label: "Registered Teams",
      value: totalTeams,
      icon: Users,
      color: "text-accent-secondary",
      borderColor: "border-accent-secondary/30",
      link: "/admin/users?role=participant",
    },
    {
      label: "Active Rounds",
      value: activeRounds,
      icon: Layers,
      color: "text-accent-primary",
      borderColor: "border-accent-primary/30",
      link: "/admin/rounds",
    },
    {
      label: "Pending Evaluations",
      value: pendingEvaluations,
      icon: Clock,
      color: "text-status-warning",
      borderColor: "border-status-warning/30",
      link: "/admin/evaluations",
    },
    {
      label: "Results Engine",
      value: isResultsPublished ? "Published" : "Draft / Unreleased",
      icon: ShieldCheck,
      color: isResultsPublished ? "text-status-success" : "text-text-secondary",
      borderColor: isResultsPublished ? "border-status-success/30" : "border-border-color",
      link: "/admin/results",
    },
  ];

  return (
    <div className="space-y-12 animate-fade-in font-tech max-w-7xl mx-auto pb-12">
      {/* Live Announcement Banner (Only shows when an actual announcement exists) */}
      <AnnouncementBanner announcements={announcements} portalName="Global Broadcast" />

      {/* Header Banner: Actions at the top row */}
      <div className="space-y-4 border-b border-border-color pb-8">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold m-0">
            Eventra 1.0 // Command Center
          </p>

          <div className="flex items-center gap-3">
            <AdminAnnouncementModal />
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface-color border border-border-color hover:border-accent-secondary text-text-primary transition-all font-tech text-xs uppercase font-bold tracking-wider"
            >
              <UserCog size={15} />
              <span>Manage Users</span>
            </Link>
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-status-success/10 border border-status-success/40 text-status-success text-xs font-tech font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-status-success animate-ping" />
              System Live
            </span>
          </div>
        </div>

        {/* Main Title & Subtitle */}
        <div className="pt-2">
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
            Admin Overview
          </h1>
          <p className="font-tech text-xs text-text-secondary m-0 pt-1.5">
            Real-time event administration, evaluation pipelines & attendee demographic telemetry.
          </p>
        </div>
      </div>

      {/* SECTION 1: User Roles Overview (Interactive Stat Cards) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-color/40 pb-3">
          <div className="space-y-1">
            <h2 className="font-heading text-xl text-text-primary uppercase tracking-wider m-0 flex items-center gap-2.5">
              <UserCog className="text-accent-secondary" size={20} />
              <span>Role Demographics & Portal Roster</span>
            </h2>
            <p className="font-tech text-xs text-text-secondary m-0">
              Click any category card to inspect, promote or manage accounts by role.
            </p>
          </div>
          <Link
            href="/admin/users"
            className="font-tech text-xs text-accent-primary hover:underline uppercase tracking-wider font-bold inline-flex items-center gap-1"
          >
            <span>View All Accounts</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Participants"
            count={participantCount}
            role="participant"
            icon={Users}
            colorScheme="pink"
            description="Active hackers and ideathon builders"
          />
          <StatCard
            label="Team Leaders"
            count={leaderCount}
            role="leader"
            icon={Crown}
            colorScheme="yellow"
            description="Captains leading ideathon squads"
          />
          <StatCard
            label="Judges"
            count={judgeCount}
            role="judge"
            icon={Gavel}
            colorScheme="cyan"
            description="Evaluators scoring project criteria"
          />
          <StatCard
            label="Staff & Club"
            count={staffCount}
            role="staff"
            icon={Shield}
            colorScheme="green"
            description="Volunteers, scan desk & event organizers"
          />
        </div>
      </section>

      {/* SECTION 2: Event Core Metrics */}
      <section className="space-y-6">
        <div className="border-b border-border-color/40 pb-3">
          <h2 className="font-heading text-xl text-text-primary uppercase tracking-wider m-0 flex items-center gap-2.5">
            <Layers className="text-accent-primary" size={20} />
            <span>Event Operations Metrics</span>
          </h2>
          <p className="font-tech text-xs text-text-secondary m-0 mt-1">
            Core progress telemetry across evaluation stages, rosters, and scoring engines.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {eventMetricCards.map((card, idx) => {
            const IconComponent = card.icon;
            return (
              <div
                key={idx}
                className={`glass-panel p-6 border ${card.borderColor} flex flex-col justify-between transition-all duration-300 hover:-translate-y-1`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-tech text-xs uppercase tracking-wider text-text-secondary font-bold">
                      {card.label}
                    </span>
                    <div className="p-2 bg-surface-color border border-border-color rounded">
                      <IconComponent className={`${card.color} w-5 h-5`} />
                    </div>
                  </div>
                  <p className={`font-heading text-3xl md:text-4xl ${card.color} m-0 font-bold`}>
                    {card.value}
                  </p>
                </div>

                <div className="pt-4 mt-6 border-t border-border-color/60 flex justify-end">
                  <Link
                    href={card.link}
                    className="inline-flex items-center gap-1.5 font-tech text-xs uppercase font-bold text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <span>Inspect</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: Quick Navigation */}
      <section className="space-y-6">
        <div className="border-b border-border-color/40 pb-3">
          <h2 className="font-heading text-xl text-text-primary uppercase tracking-wider m-0 flex items-center gap-2.5">
            <ShieldCheck className="text-accent-tertiary" size={20} />
            <span>Mission Control Modules</span>
          </h2>
          <p className="font-tech text-xs text-text-secondary m-0 mt-1">
            Direct shortcuts to system management tooling and audit registries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link
            href="/admin/users"
            className="group glass-panel p-5 border border-border-color hover:border-accent-secondary transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <Users size={20} className="text-accent-secondary" />
                <ArrowRight size={14} className="text-text-secondary group-hover:text-accent-secondary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-heading text-sm text-text-primary mb-1 uppercase group-hover:text-accent-secondary transition-colors">
                User Management
              </h3>
              <p className="font-tech text-xs text-text-secondary m-0 line-clamp-2">
                Role promotion, user provisioning, and attendee roster directory.
              </p>
            </div>
          </Link>

          <Link
            href="/admin/rounds"
            className="group glass-panel p-5 border border-border-color hover:border-accent-primary transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <Layers size={20} className="text-accent-primary" />
                <ArrowRight size={14} className="text-text-secondary group-hover:text-accent-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-heading text-sm text-text-primary mb-1 uppercase group-hover:text-accent-primary transition-colors">
                Rounds & Criteria
              </h3>
              <p className="font-tech text-xs text-text-secondary m-0 line-clamp-2">
                Configure evaluation rubrics, sequence ordering, and round locks.
              </p>
            </div>
          </Link>

          <Link
            href="/admin/evaluations"
            className="group glass-panel p-5 border border-border-color hover:border-accent-tertiary transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <Clock size={20} className="text-accent-tertiary" />
                <ArrowRight size={14} className="text-text-secondary group-hover:text-accent-tertiary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-heading text-sm text-text-primary mb-1 uppercase group-hover:text-accent-tertiary transition-colors">
                Evaluation Overrides
              </h3>
              <p className="font-tech text-xs text-text-secondary m-0 line-clamp-2">
                Inspect judge scorecards, reopen submissions, and audit overrides.
              </p>
            </div>
          </Link>

          <Link
            href="/admin/results"
            className="group glass-panel p-5 border border-border-color hover:border-status-success transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <ShieldCheck size={20} className="text-status-success" />
                <ArrowRight size={14} className="text-text-secondary group-hover:text-status-success group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-heading text-sm text-text-primary mb-1 uppercase group-hover:text-status-success transition-colors">
                Results Engine
              </h3>
              <p className="font-tech text-xs text-text-secondary m-0 line-clamp-2">
                Recalculate leaderboard scores, freeze standing tables, and publish finals.
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
