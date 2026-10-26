import type { Metadata } from "next";
import Link from "next/link";
import {
  Clock,
  Calendar,
  CheckCircle2,
  MapPin,
  Gavel,
  QrCode,
  Users,
  FileCode,
  Zap,
  ArrowRight,
} from "lucide-react";
import CrossPortalNav from "@/components/navigation/CrossPortalNav";
import PartnerLogosBar from "@/components/PartnerLogosBar";
import { SITE_CONFIG, getCanonicalUrl } from "@/lib/seo-config";

export const metadata: Metadata = {
  title: "Event Schedule & Timeline · Vice Verse 1.0 Ideathon",
  description:
    "Official schedule, rounds, and timeline for Vice Verse 1.0 Ideathon at Vidyavardhaka College of Engineering (VVCE), Mysuru. Live tracks, submission deadlines, and jury evaluation.",
  alternates: {
    canonical: getCanonicalUrl("/schedule"),
  },
  openGraph: {
    title: "Event Schedule & Timeline · Vice Verse 1.0 Ideathon",
    description:
      "Check the complete schedule and round progression for Vice Verse 1.0. Track check-ins, pitches, and jury scoring.",
    url: getCanonicalUrl("/schedule"),
  },
};

const SCHEDULE_ITEMS = [
  {
    time: "08:30 AM",
    title: "Registration & Hardware Kit Dispatch",
    location: "Main Operations Desk · Sri H. Kempegowda Sports Complex",
    description:
      "On-site team arrival, digital QR badge verification via the Ops Scanner Desk, and distribution of participant welcome kits and meal credentials.",
    tag: "Operations",
    status: "upcoming",
  },
  {
    time: "09:30 AM",
    title: "Inaugural Ceremony & Track Briefing",
    location: "Main Auditorium Stage",
    description:
      "Welcome addresses by IVC leadership, VVCE faculty, and InUnity dignitaries. Unveiling of problem statements, rubric guidelines, and jury introductions.",
    tag: "Ceremony",
    status: "upcoming",
  },
  {
    time: "10:30 AM",
    title: "Ideathon Sprint Begins: Architecture & Prototyping",
    location: "Assigned Team Bays (Halls A, B & C)",
    description:
      "Teams initiate development sprints across their selected tracks (AI/ML, Web3, MedTech, AgriTech, Open Innovation). High-speed campus Wi-Fi activated.",
    tag: "Hacking",
    status: "upcoming",
  },
  {
    time: "01:00 PM",
    title: "Lunch & Networking Break",
    location: "Dining Pavilion",
    description:
      "Nutritious buffet lunch served to verified participants. QR tokens scanned at the catering desks for real-time tracking.",
    tag: "Logistics",
    status: "upcoming",
  },
  {
    time: "02:30 PM",
    title: "Sprint Mentorship & Architecture Review",
    location: "Team Workstations",
    description:
      "Designated SPOC coordinators and industry mentors conduct 1-on-1 walkthroughs with teams to review feasibility, market fit, and technical stack.",
    tag: "Mentorship",
    status: "upcoming",
  },
  {
    time: "05:30 PM",
    title: "Round 1 Submissions Deadline",
    location: "Team Leader Console (/team/submission)",
    description:
      "Squads lock and upload their GitHub repository URL, architecture pitch deck (PDF), and prototype demo links for jury evaluation.",
    tag: "Deadline",
    status: "upcoming",
  },
  {
    time: "06:30 PM",
    title: "Round 1 Jury Adjudication & Live Scoring",
    location: "Jury Evaluation Panel (/judge)",
    description:
      "Jury members assess submissions across Innovation (30%), Technical Execution (30%), Feasibility (25%), and Presentation (15%).",
    tag: "Evaluation",
    status: "upcoming",
  },
  {
    time: "09:00 PM",
    title: "Round 1 Standings & Midnight Hack Sprint",
    location: "Central Gateway & Leaderboards",
    description:
      "Publishing of qualified squads advancing to Day 2 Grand Finale. All-night prototyping and prototype hardening sprint commences.",
    tag: "Milestone",
    status: "upcoming",
  },
];

export default function SchedulePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_CONFIG.canonicalUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Schedule",
        item: getCanonicalUrl("/schedule"),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#050508] text-text-primary flex flex-col font-tech selection:bg-accent-secondary selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CrossPortalNav />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="text-xs text-text-secondary flex items-center gap-2">
          <Link href="/" className="hover:text-accent-primary transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-text-primary font-bold">Schedule</span>
        </nav>

        {/* Hero Header */}
        <header className="relative overflow-hidden glass-panel p-6 sm:p-10 border border-border-color shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-tertiary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-color/90 border border-border-color rounded-full">
              <Calendar size={14} className="text-accent-tertiary" />
              <span className="text-[11px] font-mono uppercase tracking-[2px] text-text-primary font-bold">
                Live Timeline &amp; Rounds
              </span>
            </div>
            <h1 className="font-heading text-3xl sm:text-5xl text-text-primary tracking-tight uppercase leading-none m-0">
              Ideathon <span className="text-accent-tertiary">Event Schedule</span>
            </h1>
            <p className="font-body text-base sm:text-lg text-text-secondary leading-relaxed m-0">
              Official timeline and milestone roadmap for Vice Verse 1.0. All evaluations, check-ins,
              and submission gates are synced to the platform timekeeper.
            </p>
          </div>
        </header>

        {/* Timeline Stream */}
        <section className="space-y-6" aria-labelledby="timeline-heading">
          <div className="border-b border-border-color pb-3 flex items-center justify-between">
            <div>
              <h2 id="timeline-heading" className="font-heading text-xl sm:text-2xl text-text-primary uppercase m-0">
                Official Itinerary
              </h2>
              <p className="text-xs text-text-secondary m-0 mt-1">
                Synchronized live progression across all 4 portals
              </p>
            </div>
            <span className="text-xs font-mono text-accent-primary px-3 py-1 bg-surface-color border border-border-color rounded">
              IST (UTC+05:30)
            </span>
          </div>

          <div className="relative border-l-2 border-border-color ml-4 sm:ml-8 pl-6 sm:pl-10 space-y-8">
            {SCHEDULE_ITEMS.map((item, idx) => (
              <article
                key={idx}
                className="relative glass-panel p-5 sm:p-6 border border-border-color hover:border-accent-primary transition-all duration-300 rounded group"
              >
                {/* Timeline node */}
                <span
                  aria-hidden="true"
                  className="absolute -left-[35px] sm:-left-[51px] top-6 w-5 h-5 rounded-full bg-surface-color border-2 border-accent-primary group-hover:bg-accent-primary group-hover:scale-110 transition-all shadow-[0_0_10px_rgba(251,200,21,0.5)]"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-color/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-accent-primary" />
                    <time className="font-mono text-sm sm:text-base font-bold text-accent-primary">
                      {item.time}
                    </time>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-surface-color-light text-text-secondary border border-border-color rounded">
                      {item.tag}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary font-mono">
                    <MapPin size={13} className="text-accent-secondary" />
                    <span>{item.location}</span>
                  </div>
                </div>

                <h3 className="font-heading text-lg sm:text-xl text-text-primary uppercase tracking-wide m-0 mb-2 group-hover:text-accent-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Quick Links CTA */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 glass-panel border border-border-color">
          <div>
            <h2 className="font-heading text-lg text-text-primary uppercase m-0">
              Have questions about the evaluation rubric?
            </h2>
            <p className="text-xs text-text-secondary m-0 mt-1">
              Read our frequently asked questions, deliverables criteria, and submission rules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/faq"
              className="py-2.5 px-5 bg-accent-primary hover:bg-accent-primary-hover text-black font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2"
            >
              <span>Read Rules &amp; FAQ</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/about"
              className="py-2.5 px-5 bg-surface-color border border-border-color hover:border-accent-tertiary text-text-primary font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2"
            >
              <span>About Organizers</span>
            </Link>
          </div>
        </section>

        <section className="pt-4 border-t border-border-color/60">
          <PartnerLogosBar />
        </section>
      </main>

      {/* Accessible Footer */}
      <footer className="w-full border-t border-border-color bg-[#07070c] py-8 text-xs text-text-secondary font-tech">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="m-0">
            &copy; 2026 Innovators and Visionaries Club (IVC) × InUnity · Vidyavardhaka College of Engineering.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-accent-primary transition-colors">
              Home
            </Link>
            <Link href="/about" className="hover:text-accent-primary transition-colors">
              About
            </Link>
            <Link href="/faq" className="hover:text-accent-primary transition-colors">
              FAQ
            </Link>
            <Link href="/login" className="hover:text-accent-primary transition-colors">
              Portal Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
