import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Calendar,
  Award,
  Users,
  Compass,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import CrossPortalNav from "@/components/navigation/CrossPortalNav";
import PartnerLogosBar from "@/components/PartnerLogosBar";
import { SITE_CONFIG, getCanonicalUrl } from "@/lib/seo-config";

export const metadata: Metadata = {
  title: "About EVENTRA · Vice Verse 1.0 & Organizers",
  description:
    "Learn about Vice Verse 1.0 Ideathon, organized by the Innovators and Visionaries Club (IVC) at Vidyavardhaka College of Engineering (VVCE), Mysuru in collaboration with InUnity.",
  alternates: {
    canonical: getCanonicalUrl("/about"),
  },
  openGraph: {
    title: "About EVENTRA · Vice Verse 1.0 & Organizers",
    description:
      "Vice Verse 1.0 Ideathon at Vidyavardhaka College of Engineering (VVCE), Mysuru. Powered by IVC and InUnity.",
    url: getCanonicalUrl("/about"),
  },
};

export default function AboutPage() {
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
        name: "About",
        item: getCanonicalUrl("/about"),
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
          <span className="text-text-primary font-bold">About</span>
        </nav>

        {/* Hero Header */}
        <header className="relative overflow-hidden glass-panel p-6 sm:p-10 border border-border-color shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-color/90 border border-border-color rounded-full">
              <Zap size={14} className="text-accent-primary" />
              <span className="text-[11px] font-mono uppercase tracking-[2px] text-text-primary font-bold">
                The Platform &amp; Mission
              </span>
            </div>
            <h1 className="font-heading text-3xl sm:text-5xl text-text-primary tracking-tight uppercase leading-none m-0">
              About <span className="text-accent-primary">EVENTRA</span> &amp;{" "}
              <span className="text-accent-secondary">Vice Verse 1.0</span>
            </h1>
            <p className="font-body text-base sm:text-lg text-text-secondary leading-relaxed m-0">
              EVENTRA (IVC-PULSE) is the unified hackathon management operating system built to power
              the flagship Vice Verse Ideathon. Engineered with role isolation across participants, judges,
              operations staff, and administrators, it delivers real-time grading, automated QR attendance,
              and live telemetry for competitive student innovators.
            </p>
          </div>
        </header>

        {/* The Organizers Grid */}
        <section className="space-y-6" aria-labelledby="organizers-heading">
          <div className="border-b border-border-color pb-3">
            <h2 id="organizers-heading" className="font-heading text-xl sm:text-2xl text-text-primary uppercase m-0">
              Institutional Partners &amp; Organizers
            </h2>
            <p className="text-xs text-text-secondary m-0 mt-1">
              Collaborative student leadership and industry innovation ecosystems
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* IVC Card */}
            <article className="glass-panel p-6 border border-accent-secondary/40 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded bg-accent-secondary/15 border border-accent-secondary/40 flex items-center justify-center">
                  <Compass className="w-6 h-6 text-accent-secondary" />
                </div>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                  Innovators &amp; Visionaries Club (IVC)
                </h3>
                <p className="text-xs text-accent-secondary font-mono font-bold uppercase">
                  Lead Student Organizing Body
                </p>
                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  IVC is the premier student innovation society at Vidyavardhaka College of Engineering.
                  Dedicated to turning student concepts into functional prototypes, IVC organizes high-stakes
                  hackathons, technical workshops, and mentorship initiatives that bridge academia and industry.
                </p>
              </div>
              <div className="pt-3 border-t border-border-color">
                <span className="text-[11px] text-text-secondary font-mono">
                  Role: Platform Architecture &amp; Event Execution
                </span>
              </div>
            </article>

            {/* VVCE Card */}
            <article className="glass-panel p-6 border border-accent-primary/40 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded bg-accent-primary/15 border border-accent-primary/40 flex items-center justify-center">
                  <Award className="w-6 h-6 text-accent-primary" />
                </div>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                  Vidyavardhaka College of Engineering
                </h3>
                <p className="text-xs text-accent-primary font-mono font-bold uppercase">
                  Host Institution · Mysuru, Karnataka
                </p>
                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  Established in 1997, VVCE is an autonomous engineering institution affiliated with Visvesvaraya
                  Technological University (VTU) and accredited with NAAC &apos;A&apos; Grade. Recognized as a regional
                  center for excellence in engineering and technological research in Karnataka.
                </p>
              </div>
              <div className="pt-3 border-t border-border-color flex items-center justify-between">
                <span className="text-[11px] text-text-secondary font-mono">Autonomous Campus</span>
                <a
                  href="https://vvce.ac.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>vvce.ac.in</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </article>

            {/* InUnity Card */}
            <article className="glass-panel p-6 border border-accent-tertiary/40 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded bg-accent-tertiary/15 border border-accent-tertiary/40 flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent-tertiary" />
                </div>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                  InUnity
                </h3>
                <p className="text-xs text-accent-tertiary font-mono font-bold uppercase">
                  Ecosystem &amp; Mentorship Partner
                </p>
                <p className="text-xs text-text-secondary leading-relaxed m-0">
                  InUnity empowers grassroots innovators to create viable ventures through structured design thinking,
                  product incubation, and industry connections. InUnity collaborates on jury evaluation,
                  problem statement curation, and track mentorship.
                </p>
              </div>
              <div className="pt-3 border-t border-border-color">
                <span className="text-[11px] text-text-secondary font-mono">
                  Role: Industry Judging &amp; Incubation
                </span>
              </div>
            </article>
          </div>
        </section>

        {/* Venue Information */}
        <section className="glass-panel p-6 sm:p-8 border border-border-color space-y-4" aria-labelledby="venue-heading">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded bg-accent-primary/10 border border-accent-primary/30 text-accent-primary">
              <MapPin size={24} />
            </div>
            <div>
              <h2 id="venue-heading" className="font-heading text-xl text-text-primary uppercase m-0">
                Official Event Venue
              </h2>
              <p className="text-xs text-text-secondary m-0 mt-0.5">
                On-campus facilities and physical operations hub
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2 text-xs leading-relaxed text-text-secondary">
              <p className="text-text-primary font-bold text-sm">
                Sri H. Kempegowda Indoor Sports Complex
              </p>
              <p>Vidyavardhaka College of Engineering (VVCE) Campus</p>
              <p>Gokulam 3rd Stage, Mysuru, Karnataka 570002, India</p>
              <p className="pt-2 text-text-secondary">
                Equipped with high-density Wi-Fi networks, dedicated power drops for each squad desk,
                air-conditioned presentation stages, and operations registration desks.
              </p>
            </div>

            <div className="space-y-3 p-4 bg-surface-color/60 border border-border-color rounded">
              <h3 className="font-heading text-xs text-accent-primary uppercase m-0">
                Participant Checklist
              </h3>
              <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                <li>Government or College Photo ID card for physical check-in</li>
                <li>Digital Event QR Pass generated via Team Portal</li>
                <li>Laptops, chargers, and hardware prototypes</li>
                <li>Signed Code of Conduct and Team Agreement</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Quick Links CTA */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 glass-panel border border-border-color">
          <div>
            <h2 className="font-heading text-lg text-text-primary uppercase m-0">
              Ready to explore the Ideathon flow?
            </h2>
            <p className="text-xs text-text-secondary m-0 mt-1">
              Check the official timeline, round schedules, or view frequently asked questions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/schedule"
              className="py-2.5 px-5 bg-accent-primary hover:bg-accent-primary-hover text-black font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2"
            >
              <span>View Schedule</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/faq"
              className="py-2.5 px-5 bg-surface-color border border-border-color hover:border-accent-secondary text-text-primary font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2"
            >
              <span>Read FAQ</span>
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
            <Link href="/schedule" className="hover:text-accent-primary transition-colors">
              Schedule
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
