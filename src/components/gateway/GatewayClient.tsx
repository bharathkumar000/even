"use client";

// useState import removed
import Link from "next/link";
import Image from "next/image";
import {
  ScanLine,
  Gavel,
  Users,
  ShieldAlert,
  ArrowRight,
  QrCode,
  Layers,
  Award,
  FileUp,
  Calendar,
  Settings,
  UserCheck,
  CheckCircle2,
  Radio,
  Zap,
  Cpu,
  Coins,
  HeartPulse,
  Sprout,
  Globe,
  HelpCircle,
  Compass,
} from "lucide-react";
import CrossPortalNav from "@/components/navigation/CrossPortalNav";

import AnnouncementBanner from "@/components/AnnouncementBanner";
import PartnerLogosBar from "@/components/PartnerLogosBar";
import type { AnnouncementItem } from "@/app/actions/announcements";

interface GatewayClientProps {
  user: {
    id: string;
    email?: string;
    role?: string;
    fullName?: string;
  } | null;
  announcements: AnnouncementItem[];
  stats: {
    teamsCount: number;
    judgesCount: number;
    activeRoundTitle: string;
  };
}

export default function GatewayClient({
  user,
  announcements,
  stats,
}: GatewayClientProps) {
  

  // Determine user's matching portal based on role
  const getUserTargetPortal = (role?: string) => {
    switch (role) {
      case "admin":
        return { name: "Admin HQ", url: "/admin", accent: "text-pink-400" };
      case "judge":
        return { name: "Judge Portal", url: "/judge", accent: "text-accent-primary" };
        case "staff":
        case "organizer":
        case "spoc":
        return { name: "Club Member Ops", url: "/ops/scanner", accent: "text-accent-tertiary" };
      case "leader":
      case "participant":
      default:
        return { name: "Team Leader Console", url: "/team", accent: "text-accent-secondary" };
    }
  };

  const userTarget = getUserTargetPortal(user?.role);

  return (
    <div className="min-h-screen bg-[#050508] text-text-primary flex flex-col font-tech selection:bg-accent-secondary selection:text-white">
      {/* Top Universal Cross-Portal Navigation */}
        <CrossPortalNav user={user} />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Real-time Announcements Banner */}
        {announcements.length > 0 && (
          <div className="w-full animate-fade-in">
            <AnnouncementBanner
              announcements={announcements}
              portalName="Grand Central Gateway"
            />
          </div>
        )}

        {/* Hero Section */}
        <section className="relative overflow-hidden glass-panel p-6 sm:p-10 border border-border-color shadow-2xl">
          {/* Neon backdrop ambiance */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-secondary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-tertiary/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(251,200,21,0.04),transparent_70%)] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl text-center md:text-left">
              {/* Event Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-color/90 border border-border-color rounded-full">
                <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                <span className="text-[11px] font-mono uppercase tracking-[2px] text-text-primary font-bold">
                  Ideathon 2026 Live · Eventra 1.0
                </span>
                <span className="text-[10px] text-accent-primary font-bold">
                  IVC × InUnity
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="font-heading text-3xl sm:text-5xl lg:text-6xl text-text-primary tracking-tight uppercase leading-none m-0">
                Central <span className="text-accent-secondary animate-flicker">Gateway</span> &amp;{" "}
                <span className="text-accent-primary">Portals</span>
              </h1>

              {/* Tagline */}
              <p className="font-body text-base sm:text-lg text-text-secondary m-0 max-w-xl">
                The unified mission bridge linking all event stakeholders. Seamlessly navigate
                between the <strong className="text-accent-tertiary">Club Member Operations</strong> desk, the{" "}
                <strong className="text-accent-primary">Judge Evaluation</strong> panel, and the{" "}
                <strong className="text-accent-secondary">TEAM_LEADER Console</strong> with zero URL friction.
              </p>

              {/* Live Telemetry Chips */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                <div className="px-3 py-1.5 bg-surface-color-light/70 border border-border-color rounded flex items-center gap-2">
                  <Radio size={14} className="text-accent-primary animate-pulse" />
                  <span className="text-xs text-text-secondary uppercase">Active Round:</span>
                  <span className="text-xs font-bold text-text-primary font-mono">
                    {stats.activeRoundTitle}
                  </span>
                </div>

                <div className="px-3 py-1.5 bg-surface-color-light/70 border border-border-color rounded flex items-center gap-2">
                  <Users size={14} className="text-accent-secondary" />
                  <span className="text-xs text-text-secondary uppercase">Teams:</span>
                  <span className="text-xs font-bold text-text-primary font-mono">
                    {stats.teamsCount > 0 ? `${stats.teamsCount} Squads` : "20 Squads"}
                  </span>
                </div>

                <div className="px-3 py-1.5 bg-surface-color-light/70 border border-border-color rounded flex items-center gap-2">
                  <Gavel size={14} className="text-accent-tertiary" />
                  <span className="text-xs text-text-secondary uppercase">Jury:</span>
                  <span className="text-xs font-bold text-text-primary font-mono">
                    {stats.judgesCount > 0 ? `${stats.judgesCount} Evaluators` : "5 Tracks"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Emblem & Quick Action */}
            <div className="shrink-0 flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-accent-secondary via-accent-primary to-accent-tertiary rounded-full blur-xl opacity-40 group-hover:opacity-75 transition-opacity" />
                <Image
                  src="/Vice_verse_logo.png"
                  alt="Eventra Logo"
                  width={210}
                  height={130}
                  priority
                  className="relative object-contain drop-shadow-[0_0_20px_rgba(255,0,127,0.5)] transform group-hover:scale-105 transition-transform"
                />
              </div>

              {user ? (
                <Link
                  href={userTarget.url}
                  className="w-full py-2.5 px-5 bg-gradient-to-r from-accent-secondary to-accent-primary hover:opacity-90 text-black font-tech font-bold uppercase tracking-wider text-xs transition-all shadow-[0_0_15px_rgba(255,0,127,0.4)] flex items-center justify-center gap-2 text-center"
                >
                  <Zap size={14} />
                  <span>Resume In {userTarget.name}</span>
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <> </>
              )}
            </div>
          </div>
        </section>

        {/* Authenticated Active User Banner */}
        {user && (
          <div className="p-4 bg-surface-color/90 border border-accent-secondary/40 shadow-lg rounded flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-accent-secondary/15 border border-accent-secondary/50 text-accent-secondary">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold text-text-primary tracking-wider">
                    Active Session:
                  </span>
                  <span className="text-xs text-accent-secondary font-mono font-bold">
                    {user.fullName || user.email}
                  </span>
                  <span className="text-[10px] bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/50 px-2 py-0.5 font-mono uppercase font-bold">
                    ROLE: {user.role?.toUpperCase() || "MEMBER"}
                  </span>
                </div>
                <p className="text-xs text-text-secondary m-0 mt-0.5">
                  You are verified to access event systems. Click below to launch your authorized portal or select any portal for review.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={userTarget.url}
                className="py-2 px-4 bg-accent-secondary hover:bg-accent-secondary/90 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
              >
                <span>Enter {userTarget.name}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* THE THREE CORE PORTALS SECTION                                            */}
        {/* ========================================================================= */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border-color pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-primary animate-ping" />
                <h2 className="font-heading text-xl sm:text-2xl text-text-primary uppercase m-0 tracking-wide">
                  Core Event Portals
                </h2>
              </div>
              <p className="text-xs text-text-secondary m-0 mt-1">
                Direct, seamless entry points into the three mission-critical portals
              </p>
            </div>

{/* Test role switcher removed */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. CLUB MEMBER PORTAL */}
            <div className="glass-panel p-6 border border-accent-tertiary/40 hover:border-accent-tertiary transition-all duration-300 relative group flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(0,240,255,0.2)]">
              {/* Neon top accent strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-accent-tertiary" />

              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="p-3 bg-accent-tertiary/10 border border-accent-tertiary/40 rounded">
                    <ScanLine className="w-7 h-7 text-accent-tertiary" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 bg-accent-tertiary/20 text-accent-tertiary border border-accent-tertiary/40 uppercase font-mono font-bold tracking-wider">
                      Operations Desk
                    </span>
                    <p className="text-[10px] text-text-secondary m-0 mt-1 uppercase font-bold">
                      Route: /ops/scanner
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-heading text-lg sm:text-xl text-text-primary uppercase tracking-wider m-0 group-hover:text-accent-tertiary transition-colors">
                    Club Member
                  </h3>
                  <p className="text-xs text-accent-tertiary/90 font-mono font-bold uppercase tracking-wide mt-0.5">
                    Logistics &amp; Verification Desk
                  </p>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  On-ground nerve center for event organizers, club members, and volunteers.
                  Features high-speed live camera QR scanner, attendee check-in audits,
                  breakfast/lunch/kit token distribution, and live round monitors.
                </p>

                {/* Core Capabilities */}
                <div className="space-y-2 pt-2 border-t border-border-color/60">
                  <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider block">
                    Key Features &amp; Direct Links:
                  </span>
                  <div className="flex flex-col gap-1.5 text-xs font-mono">
                    <Link
                      href="/ops/scanner"
                      className="flex items-center justify-between p-2 bg-surface-color border border-border-color hover:border-accent-tertiary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <QrCode size={13} className="text-accent-tertiary" />
                        <span>Live QR Scanner Desk</span>
                      </div>
                      <ArrowRight size={12} />
                    </Link>

                    <Link
                      href="/ops/rounds"
                      className="flex items-center justify-between p-2 bg-surface-color border border-border-color hover:border-accent-tertiary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Layers size={13} className="text-accent-tertiary" />
                        <span>Rounds &amp; Criteria</span>
                      </div>
                      <ArrowRight size={12} />
                    </Link>

                    <Link
                      href="/ops/judges-roster"
                      className="flex items-center justify-between p-2 bg-surface-color border border-border-color hover:border-accent-tertiary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Gavel size={13} className="text-accent-tertiary" />
                        <span>Judges &amp; Track Roster</span>
                      </div>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-4">
                <Link
                  href="/ops/scanner"
                  className="w-full py-3 px-4 bg-accent-tertiary hover:bg-accent-tertiary/90 text-black font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.3)] group-hover:shadow-[0_0_20px_rgba(0,240,255,0.5)]"
                >
                  <span>Launch Operations Portal</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* 2. JUDGE PORTAL */}
            <div className="glass-panel p-6 border border-accent-primary/40 hover:border-accent-primary transition-all duration-300 relative group flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(251,200,21,0.2)]">
              {/* Neon top accent strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-accent-primary" />

              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="p-3 bg-accent-primary/10 border border-accent-primary/40 rounded">
                    <Gavel className="w-7 h-7 text-accent-primary" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 bg-accent-primary/20 text-accent-primary border border-accent-primary/40 uppercase font-mono font-bold tracking-wider">
                      Jury Panel
                    </span>
                    <p className="text-[10px] text-text-secondary m-0 mt-1 uppercase font-bold">
                      Route: /judge
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-heading text-lg sm:text-xl text-text-primary uppercase tracking-wider m-0 group-hover:text-accent-primary transition-colors">
                    Judge Portal
                  </h3>
                  <p className="text-xs text-accent-primary/90 font-mono font-bold uppercase tracking-wide mt-0.5">
                    Live Rubric Scoring &amp; Jury Standings
                  </p>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  Tailored specifically for track evaluation committees. Allows judges to review
                  their assigned squad repositories and slide decks, input live scores across
                  Innovation, Technical Execution, Impact, and Presentation, and review verified leaderboards.
                </p>

                {/* Core Capabilities */}
                <div className="space-y-2 pt-2 border-t border-border-color/60">
                  <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider block">
                    Key Features &amp; Direct Links:
                  </span>
                  <div className="flex flex-col gap-1.5 text-xs font-mono">
                    <Link
                      href="/judge"
                      className="flex items-center justify-between p-2 bg-surface-color border border-border-color hover:border-accent-primary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Users size={13} className="text-accent-primary" />
                        <span>Assigned Track Teams</span>
                      </div>
                      <ArrowRight size={12} />
                    </Link>

                    <Link
                      href="/judge/rubrics"
                      className="flex items-center justify-between p-2 bg-surface-color border border-border-color hover:border-accent-primary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Layers size={13} className="text-accent-primary" />
                        <span>Scoring Rubrics &amp; Criteria</span>
                      </div>
                      <ArrowRight size={12} />
                    </Link>

                    <Link
                      href="/judge/results"
                      className="flex items-center justify-between p-2 bg-surface-color border border-border-color hover:border-accent-primary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Award size={13} className="text-accent-primary" />
                        <span>Live Standings &amp; Leaderboard</span>
                      </div>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-4">
                <Link
                  href="/judge"
                  className="w-full py-3 px-4 bg-accent-primary hover:bg-accent-primary/90 text-black font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(251,200,21,0.3)] group-hover:shadow-[0_0_20px_rgba(251,200,21,0.5)]"
                >
                  <span>Launch Judge Portal</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* 3. TEAM_LEADER PORTAL */}
            <div className="glass-panel p-6 border border-accent-secondary/40 hover:border-accent-secondary transition-all duration-300 relative group flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(255,0,127,0.2)]">
              {/* Neon top accent strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-accent-secondary" />

              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="p-3 bg-accent-secondary/10 border border-accent-secondary/40 rounded">
                    <Users className="w-7 h-7 text-accent-secondary" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/40 uppercase font-mono font-bold tracking-wider">
                      Participants
                    </span>
                    <p className="text-[10px] text-text-secondary m-0 mt-1 uppercase font-bold">
                      Route: /team
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-heading text-lg sm:text-xl text-text-primary uppercase tracking-wider m-0 group-hover:text-accent-secondary transition-colors">
                    TEAM_LEADER
                  </h3>
                  <p className="text-xs text-accent-secondary/90 font-mono font-bold uppercase tracking-wide mt-0.5">
                    Team Lead &amp; Participant Console
                  </p>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  The mission cockpit for participating squads. Submit GitHub repositories,
                  pitch decks, and video demonstrations, generate digital Event QR Passes for
                  station check-ins, connect with your assigned SPOC coordinator, and monitor round advancement.
                </p>

                {/* Core Capabilities */}
                <div className="space-y-2 pt-2 border-t border-border-color/60">
                  <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider block">
                    Key Features &amp; Direct Links:
                  </span>
                  <div className="flex flex-col gap-1.5 text-xs font-mono">
                    <Link
                      href="/team"
                      className="flex items-center justify-between p-2 bg-surface-color border border-border-color hover:border-accent-secondary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Users size={13} className="text-accent-secondary" />
                        <span>Team Console &amp; SPOC</span>
                      </div>
                      <ArrowRight size={12} />
                    </Link>

                    <Link
                      href="/team/submission"
                      className="flex items-center justify-between p-2 bg-surface-color border border-border-color hover:border-accent-secondary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileUp size={13} className="text-accent-secondary" />
                        <span>Project Deliverables Submissions</span>
                      </div>
                      <ArrowRight size={12} />
                    </Link>

                    <Link
                      href="/team/qr"
                      className="flex items-center justify-between p-2 bg-surface-color border border-border-color hover:border-accent-secondary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <QrCode size={13} className="text-accent-secondary" />
                        <span>Digital Event QR Pass</span>
                      </div>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-4">
                <Link
                  href="/team"
                  className="w-full py-3 px-4 bg-accent-secondary hover:bg-accent-secondary/90 text-white font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,0,127,0.3)] group-hover:shadow-[0_0_20px_rgba(255,0,127,0.5)]"
                >
                  <span>Launch Team Portal</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* ADMIN HQ MISSION CONTROL BANNER                                           */}
        {/* ========================================================================= */}
        <section className="glass-panel p-5 border border-pink-500/30 hover:border-pink-500/60 transition-all rounded bg-gradient-to-r from-surface-color via-surface-color-light to-surface-color">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-pink-500/10 border border-pink-500/40 rounded shrink-0">
                <ShieldAlert className="w-6 h-6 text-pink-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                    Admin Mission Control
                  </h3>
                  <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/40 px-2 py-0.5 font-mono uppercase font-bold">
                    ROUTE: /admin
                  </span>
                </div>
                <p className="text-xs text-text-secondary m-0 mt-1 max-w-2xl">
                  Central administrator oversight: User account provisioning, automated 1-click test seeding,
                  rubric weightage configuration, live score override engine, SPOC team matching, and security audit logs.
                </p>
                <p className="text-[11px] text-pink-400 font-mono font-bold m-0 mt-1">
                  Access Level: <span className="text-text-primary">Executive Committee · MFA Enforced</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto">
              <Link
                href="/admin"
                className="w-full sm:w-auto py-2.5 px-5 bg-gradient-to-r from-pink-600 to-accent-secondary hover:opacity-90 text-white font-tech font-bold uppercase tracking-wider text-xs transition-all shadow-md flex items-center justify-center gap-2 text-center"
              >
                <span>Enter Admin HQ</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* EMBEDDED QUICK ROLE SWITCHER FOR INSTANT TESTING                          */}
        {/* ========================================================================= */}
{/* Quick role switcher inline removed */}

        {/* ========================================================================= */}
        {/* PUBLIC EVENT RESOURCES QUICK ACCESS                                       */}
        {/* ========================================================================= */}
        <section className="space-y-4">
          <div className="border-b border-border-color pb-2">
            <h3 className="font-heading text-base text-text-primary uppercase m-0">
              Event Resources &amp; Schedules
            </h3>
            <p className="text-xs text-text-secondary m-0 mt-0.5">
              Live schedule, venue guidelines, and public event directories
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/schedule"
              className="p-3.5 glass-panel border border-border-color hover:border-accent-primary text-text-secondary hover:text-text-primary transition-all flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-2">
                <Calendar size={18} className="text-accent-primary group-hover:scale-110 transition-transform" />
                <ArrowRight size={13} className="text-text-secondary group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <p className="font-heading text-xs text-text-primary uppercase m-0">
                  Event Schedule
                </p>
                <p className="text-[10px] text-text-secondary m-0 mt-0.5">
                  Timeline &amp; Rounds
                </p>
              </div>
            </Link>

            <Link
              href="/about"
              className="p-3.5 glass-panel border border-border-color hover:border-accent-secondary text-text-secondary hover:text-text-primary transition-all flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-2">
                <Compass size={18} className="text-accent-secondary group-hover:scale-110 transition-transform" />
                <ArrowRight size={13} className="text-text-secondary group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <p className="font-heading text-xs text-text-primary uppercase m-0">
                  About Eventra
                </p>
                <p className="text-[10px] text-text-secondary m-0 mt-0.5">
                  VVCE, IVC &amp; InUnity
                </p>
              </div>
            </Link>

            <Link
              href="/faq"
              className="p-3.5 glass-panel border border-border-color hover:border-accent-tertiary text-text-secondary hover:text-text-primary transition-all flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-2">
                <HelpCircle size={18} className="text-accent-tertiary group-hover:scale-110 transition-transform" />
                <ArrowRight size={13} className="text-text-secondary group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <p className="font-heading text-xs text-text-primary uppercase m-0">
                  Rules &amp; FAQ
                </p>
                <p className="text-[10px] text-text-secondary m-0 mt-0.5">
                  Rubrics &amp; Guidelines
                </p>
              </div>
            </Link>

            <Link
              href="/login"
              className="p-3.5 glass-panel border border-border-color hover:border-status-success text-text-secondary hover:text-text-primary transition-all flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-2">
                <UserCheck size={18} className="text-status-success group-hover:scale-110 transition-transform" />
                <ArrowRight size={13} className="text-text-secondary group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <p className="font-heading text-xs text-text-primary uppercase m-0">
                  Portal Sign In
                </p>
                <p className="text-[10px] text-text-secondary m-0 mt-0.5">
                  Admin, Jury &amp; Squads
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* COMPETITION TRACKS SECTION                                                */}
        {/* ========================================================================= */}
        <section id="tracks" className="space-y-4" aria-labelledby="tracks-heading">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border-color pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-accent-primary animate-pulse" />
                <h2 id="tracks-heading" className="font-heading text-xl sm:text-2xl text-text-primary uppercase m-0 tracking-wide">
                  Vice Verse 1.0 Innovation Tracks
                </h2>
              </div>
              <p className="text-xs text-text-secondary m-0 mt-1">
                Five high-impact domains challenging participating student engineering squads
              </p>
            </div>
            <span className="text-[11px] font-mono text-accent-secondary border border-accent-secondary/40 px-2.5 py-1 bg-surface-color rounded">
              5 Technical Tracks
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Track 1 */}
            <article className="glass-panel p-5 border border-border-color hover:border-accent-primary transition-all duration-300 rounded flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center text-accent-primary">
                  <Cpu size={20} />
                </div>
                <h3 className="font-heading text-base text-text-primary uppercase m-0">
                  AI &amp; Intelligent Systems
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  Generative AI, agentic systems, autonomous models, computer vision, and real-time inference solving enterprise and consumer bottlenecks.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border-color/60 text-[10px] font-mono text-accent-primary">
                Keywords: LLMs · Multi-Agent · Vision · RAG
              </div>
            </article>

            {/* Track 2 */}
            <article className="glass-panel p-5 border border-border-color hover:border-accent-secondary transition-all duration-300 rounded flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded bg-accent-secondary/10 border border-accent-secondary/30 flex items-center justify-center text-accent-secondary">
                  <Coins size={20} />
                </div>
                <h3 className="font-heading text-base text-text-primary uppercase m-0">
                  Web3 &amp; Fintech Security
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  Decentralized applications, cryptographic identity verification, smart contract security, cross-border settlement, and fraud detection.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border-color/60 text-[10px] font-mono text-accent-secondary">
                Keywords: Smart Contracts · Zero-Knowledge · DeFi
              </div>
            </article>

            {/* Track 3 */}
            <article className="glass-panel p-5 border border-border-color hover:border-accent-tertiary transition-all duration-300 rounded flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded bg-accent-tertiary/10 border border-accent-tertiary/30 flex items-center justify-center text-accent-tertiary">
                  <HeartPulse size={20} />
                </div>
                <h3 className="font-heading text-base text-text-primary uppercase m-0">
                  Smart Healthcare &amp; MedTech
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  Diagnostic triage tools, remote patient monitoring, assistive robotic devices, hospital resource scheduling, and bio-telemetry processing.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border-color/60 text-[10px] font-mono text-accent-tertiary">
                Keywords: Telehealth · Medical AI · Wearables
              </div>
            </article>

            {/* Track 4 */}
            <article className="glass-panel p-5 border border-border-color hover:border-status-success transition-all duration-300 rounded flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded bg-status-success/10 border border-status-success/30 flex items-center justify-center text-status-success">
                  <Sprout size={20} />
                </div>
                <h3 className="font-heading text-base text-text-primary uppercase m-0">
                  Agriculture &amp; Rural Impact
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  Precision soil analysis, crop disease detection, IoT irrigation controllers, rural credit linkages, and agri-supply chain transparency.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border-color/60 text-[10px] font-mono text-status-success">
                Keywords: Agritech · IoT Sensing · Soil Analytics
              </div>
            </article>

            {/* Track 5 */}
            <article className="glass-panel p-5 border border-border-color hover:border-pink-400 transition-all duration-300 rounded flex flex-col justify-between lg:col-span-2">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
                  <Globe size={20} />
                </div>
                <h3 className="font-heading text-base text-text-primary uppercase m-0">
                  Open Innovation &amp; Social Transformation
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  Cross-disciplinary solutions targeting civic infrastructure, renewable energy distribution, disaster early warning, educational equity, and sustainability metrics.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border-color/60 text-[10px] font-mono text-pink-400">
                Keywords: CleanTech · Civic Tech · Accessibility · Public Infrastructure
              </div>
            </article>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* EVALUATION CRITERIA & RUBRIC PILLARS                                      */}
        {/* ========================================================================= */}
        <section className="glass-panel p-6 sm:p-8 border border-border-color space-y-5" aria-labelledby="rubric-heading">
          <div className="border-b border-border-color pb-3">
            <h2 id="rubric-heading" className="font-heading text-lg sm:text-xl text-text-primary uppercase m-0">
              Jury Evaluation Rubric &amp; Weightage
            </h2>
            <p className="text-xs text-text-secondary m-0 mt-1">
              Standardized scoring matrix enforced across all track judges via the live Judge Portal
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-surface-color/60 border border-border-color rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-accent-primary uppercase">Pillar 1</span>
                <span className="text-sm font-heading font-black text-accent-primary">30%</span>
              </div>
              <h3 className="font-heading text-sm text-text-primary uppercase m-0">Innovation &amp; Originality</h3>
              <p className="text-xs text-text-secondary m-0">
                Novelty of the concept, technical ingenuity, and differentiation from existing commercial alternatives.
              </p>
            </div>

            <div className="p-4 bg-surface-color/60 border border-border-color rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-accent-secondary uppercase">Pillar 2</span>
                <span className="text-sm font-heading font-black text-accent-secondary">30%</span>
              </div>
              <h3 className="font-heading text-sm text-text-primary uppercase m-0">Technical Execution</h3>
              <p className="text-xs text-text-secondary m-0">
                Architecture robustness, clean repository commits, operational API integrations, and prototype fidelity.
              </p>
            </div>

            <div className="p-4 bg-surface-color/60 border border-border-color rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-accent-tertiary uppercase">Pillar 3</span>
                <span className="text-sm font-heading font-black text-accent-tertiary">25%</span>
              </div>
              <h3 className="font-heading text-sm text-text-primary uppercase m-0">Impact &amp; Feasibility</h3>
              <p className="text-xs text-text-secondary m-0">
                Target market viability, user persona validation, scalability potential, and clear deployment roadmap.
              </p>
            </div>

            <div className="p-4 bg-surface-color/60 border border-border-color rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-pink-400 uppercase">Pillar 4</span>
                <span className="text-sm font-heading font-black text-pink-400">15%</span>
              </div>
              <h3 className="font-heading text-sm text-text-primary uppercase m-0">Presentation &amp; Pitch</h3>
              <p className="text-xs text-text-secondary m-0">
                Clarity of articulation, prototype live demonstration, defense during jury Q&amp;A, and team cohesion.
              </p>
            </div>
          </div>
        </section>

        {/* Partner Logos Bar */}
        <section className="pt-4 border-t border-border-color/60">
          <PartnerLogosBar />
        </section>
      </main>

      {/* Accessible Footer with Semantic Crawlable Links */}
      <footer className="w-full border-t border-border-color bg-[#07070c] py-10 text-xs text-text-secondary font-tech">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Image
                  src="/ivc-gear-logo.png"
                  alt="IVC Gear Emblem"
                  width={24}
                  height={24}
                  className="object-contain"
                />
                <span className="font-heading text-sm font-bold text-text-primary uppercase tracking-wider">
                  EVENTRA
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed m-0">
                Multi-Portal Hackathon Operating System powering Vice Verse 1.0 Ideathon. Built by Innovators &amp; Visionaries Club (IVC) at Vidyavardhaka College of Engineering.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-heading text-xs uppercase text-text-primary font-bold tracking-wider m-0">
                Public Discovery
              </h4>
              <ul className="space-y-1.5 list-none p-0 m-0">
                <li>
                  <Link href="/" className="hover:text-accent-primary transition-colors">
                    Home &amp; Gateway
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-accent-primary transition-colors">
                    About Organizers &amp; Venue
                  </Link>
                </li>
                <li>
                  <Link href="/schedule" className="hover:text-accent-primary transition-colors">
                    Event Schedule &amp; Flow
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-accent-primary transition-colors">
                    Rules &amp; Frequently Asked Questions
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-heading text-xs uppercase text-text-primary font-bold tracking-wider m-0">
                Stakeholder Portals
              </h4>
              <ul className="space-y-1.5 list-none p-0 m-0">
                <li>
                  <Link href="/login" className="hover:text-accent-secondary transition-colors">
                    Portal Access Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-accent-secondary transition-colors">
                    Squad Registration
                  </Link>
                </li>
                <li>
                  <Link href="/judge" className="hover:text-accent-secondary transition-colors">
                    Jury Evaluation Panel
                  </Link>
                </li>
                <li>
                  <Link href="/ops/scanner" className="hover:text-accent-secondary transition-colors">
                    Operations &amp; QR Desk
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-heading text-xs uppercase text-text-primary font-bold tracking-wider m-0">
                Venue &amp; Host
              </h4>
              <address className="not-italic text-xs text-text-secondary leading-relaxed">
                <p className="m-0 font-bold text-text-primary">Vidyavardhaka College of Engineering</p>
                <p className="m-0">Sri H. Kempegowda Indoor Sports Complex</p>
                <p className="m-0">Gokulam 3rd Stage, Mysuru, Karnataka 570002</p>
                <p className="m-0 pt-1 text-accent-primary">Autonomous Institution · NAAC &apos;A&apos; Grade</p>
              </address>
            </div>
          </div>

          <div className="pt-6 border-t border-border-color/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-text-secondary">
            <p className="m-0">
              &copy; 2026 Innovators &amp; Visionaries Club (IVC) × InUnity. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span>Next.js 16 App Router</span>
              <span>•</span>
              <span>Accessible Semantic HTML5</span>
              <span>•</span>
              <span>Robots &amp; Sitemap Validated</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
