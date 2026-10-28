import type { Metadata } from "next";
import Link from "next/link";
import {
  HelpCircle,
  FileCheck,
  Award,
  Layers,
  ShieldCheck,
  Code,
  QrCode,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import CrossPortalNav from "@/components/navigation/CrossPortalNav";
import PartnerLogosBar from "@/components/PartnerLogosBar";
import { SITE_CONFIG, getCanonicalUrl } from "@/lib/seo-config";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQ) · Vice Verse 1.0 Ideathon",
  description:
    "Comprehensive FAQ and rules guide for Vice Verse 1.0 Ideathon at Vidyavardhaka College of Engineering (VVCE), Mysuru. Learn about tracks, submissions, rubrics, and QR check-ins.",
  alternates: {
    canonical: getCanonicalUrl("/faq"),
  },
  openGraph: {
    title: "Frequently Asked Questions (FAQ) · Vice Verse 1.0 Ideathon",
    description:
      "All guidelines, rules, evaluation rubrics, and logistics questions answered for Vice Verse 1.0 participants.",
    url: getCanonicalUrl("/faq"),
  },
};

const FAQ_ITEMS = [
  {
    question: "What is Vice Verse 1.0 and who is eligible to participate?",
    answer:
      "Vice Verse 1.0 is the annual flagship multi-track ideathon organized by the Innovators and Visionaries Club (IVC) at Vidyavardhaka College of Engineering (VVCE), Mysuru in partnership with InUnity. It brings together undergraduate and graduate engineering, computer science, and design students in cross-functional squads of 2 to 4 members to build transformative prototypes.",
    category: "General & Eligibility",
  },
  {
    question: "What are the core competition tracks?",
    answer:
      "Vice Verse 1.0 features 5 dedicated innovation tracks: (1) Artificial Intelligence & Intelligent Systems (GenAI, autonomous agents, computer vision), (2) Web3, Fintech & Security (decentralized applications, verifiable computing), (3) Smart Healthcare & MedTech (diagnostic assistants, telemedicine, assistive devices), (4) Agriculture & Rural Transformation (precision agritech, supply chain traceability), and (5) Open Innovation & Social Good (environmental monitoring, civic technology, public infrastructure).",
    category: "Tracks & Problem Statements",
  },
  {
    question: "How does the jury evaluation and rubric scoring work?",
    answer:
      "Evaluation is conducted via the platform's Judge Portal using a standardized 4-pillar rubric: Innovation & Uniqueness (30%), Technical Architecture & Execution (30%), Real-World Feasibility & Market Impact (25%), and Pitch Presentation & Team Dynamics (15%). Scores are tabulated in real-time across preliminary and grand finale rounds.",
    category: "Judging & Scoring",
  },
  {
    question: "What deliverables must teams submit on the platform?",
    answer:
      "Through the Team Leader Console (/team/submission), squads submit three required deliverables: (1) A public GitHub repository URL with an open-source license and comprehensive README, (2) An architecture pitch slide deck in PDF format, and (3) An optional working prototype URL or demo video.",
    category: "Submissions",
  },
  {
    question: "How do physical station check-ins and meal tokens work?",
    answer:
      "Each team generates a dynamic Digital Event QR Pass via /team/qr. When arriving at the venue or dining pavilion, the Operations Desk scans the pass using the hardware-accelerated scanner at /ops/scanner, instantly verifying attendance, dispensing welcome kits, and validating meal tokens with zero paper waste.",
    category: "Operations & Logistics",
  },
  {
    question: "Who retains intellectual property (IP) rights to projects built?",
    answer:
      "Participants retain 100% intellectual property ownership of all software, hardware designs, algorithms, and documentation developed during the hackathon. Neither IVC, VVCE, nor InUnity claim equity or IP ownership over student innovations.",
    category: "IP & Legal",
  },
  {
    question: "What hardware and equipment should participants bring to VVCE?",
    answer:
      "Participants must bring their personal laptops, chargers, extension cords, and any specialized hardware development kits or microcontrollers required for their prototype. High-density Wi-Fi networks and regulated power outlets are provisioned at each squad desk.",
    category: "Venue & Equipment",
  },
  {
    question: "How do squads get assistance from mentors and coordinators?",
    answer:
      "Each team is assigned a dedicated SPOC (Single Point of Contact) coordinator from the IVC organizing committee. Squad leaders can access their assigned SPOC's direct WhatsApp and phone contact credentials inside their Team Portal at /team.",
    category: "Mentorship & Support",
  },
];

export default function FAQPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const breadcrumbSchema = {
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
        name: "FAQ",
        item: getCanonicalUrl("/faq"),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#050508] text-text-primary flex flex-col font-tech selection:bg-accent-secondary selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <CrossPortalNav />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="text-xs text-text-secondary flex items-center gap-2">
          <Link href="/" className="hover:text-accent-primary transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-text-primary font-bold">FAQ</span>
        </nav>

        {/* Hero Header */}
        <header className="relative overflow-hidden glass-panel p-6 sm:p-10 border border-border-color shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-secondary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-color/90 border border-border-color rounded-full">
              <HelpCircle size={14} className="text-accent-secondary" />
              <span className="text-[11px] font-mono uppercase tracking-[2px] text-text-primary font-bold">
                Knowledge Base &amp; Guidelines
              </span>
            </div>
            <h1 className="font-heading text-3xl sm:text-5xl text-text-primary tracking-tight uppercase leading-none m-0">
              Frequently Asked <span className="text-accent-secondary">Questions</span>
            </h1>
            <p className="font-body text-base sm:text-lg text-text-secondary leading-relaxed m-0">
              Clear, transparent answers on rules, evaluation rubrics, submission standards,
              venue protocols, and digital QR passes.
            </p>
          </div>
        </header>

        {/* FAQ Grid */}
        <section className="space-y-6" aria-labelledby="faq-list-heading">
          <div className="border-b border-border-color pb-3">
            <h2 id="faq-list-heading" className="font-heading text-xl sm:text-2xl text-text-primary uppercase m-0">
              Everything You Need to Know
            </h2>
            <p className="text-xs text-text-secondary m-0 mt-1">
              Official operating policies validated by the organizing committee
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FAQ_ITEMS.map((item, idx) => (
              <article
                key={idx}
                className="glass-panel p-6 border border-border-color hover:border-accent-secondary transition-all duration-300 rounded space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-surface-color-light text-accent-secondary border border-accent-secondary/30 rounded inline-block">
                    {item.category}
                  </span>
                  <h3 className="font-heading text-base sm:text-lg text-text-primary uppercase tracking-wide m-0">
                    {item.question}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed m-0 pt-1">
                    {item.answer}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Quick Links CTA */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 glass-panel border border-border-color">
          <div>
            <h2 className="font-heading text-lg text-text-primary uppercase m-0">
              Need personalized guidance?
            </h2>
            <p className="text-xs text-text-secondary m-0 mt-1">
              Reach out to your assigned SPOC mentor or sign in to your team console.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="py-2.5 px-5 bg-accent-secondary hover:bg-accent-secondary/90 text-white font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2"
            >
              <span>Sign In to Portal</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/schedule"
              className="py-2.5 px-5 bg-surface-color border border-border-color hover:border-accent-primary text-text-primary font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2"
            >
              <span>View Schedule</span>
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
            <Link href="/schedule" className="hover:text-accent-primary transition-colors">
              Schedule
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
