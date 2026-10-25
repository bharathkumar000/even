"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Gavel,
  Users,
  Layers,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default function JudgeSidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/judge",
      icon: Users,
      label: "Assigned Teams",
      badge: "Evaluate",
    },
    {
      href: "/judge/rubrics",
      icon: Layers,
      label: "Judging Rubrics",
      badge: "Criteria",
    },
  ];

  const isItemActive = (item: (typeof navItems)[0]) => {
    if (item.href === "/judge") {
      return pathname === "/judge" || pathname?.startsWith("/judge/evaluate");
    }
    return pathname === item.href || (pathname?.startsWith(item.href) && item.href !== "/judge");
  };

  return (
    <>
      {/* ================================================================= */}
      {/* MOBILE TOP BAR (Visible only on < md screens)                      */}
      {/* ================================================================= */}
      <header className="md:hidden sticky top-0 z-40 bg-[#0c0c14]/95 backdrop-blur-md border-b border-border-color px-4 py-2.5 flex items-center justify-between font-tech shrink-0">
        <Link href="/judge" className="flex items-center gap-2.5 text-left">
          <Image
            src="/ivc-gear-logo.png"
            alt="IVC Logo"
            width={32}
            height={32}
            priority
            className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]"
          />
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="p-0.5 bg-accent-primary/15 border border-accent-primary/40 rounded">
                <Gavel className="text-accent-primary w-3 h-3" />
              </span>
              <span className="font-heading text-sm tracking-[1.5px] text-text-primary uppercase font-bold">
                Judge Portal
              </span>
            </div>
            <p className="text-[9px] text-accent-primary m-0 font-bold tracking-[1px] uppercase mt-0.5">
              Evaluation Committee
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-status-success/15 border border-status-success/40 rounded text-[9px] font-bold text-status-success uppercase font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            <span>LIVE</span>
          </div>
          <SignOutButton
            variant="pill"
            label="Sign Out"
            className="text-[10px] py-1 px-2.5 rounded-lg"
          />
        </div>
      </header>

      {/* ================================================================= */}
      {/* DESKTOP SIDEBAR (Visible only on >= md screens)                   */}
      {/* ================================================================= */}
      <aside className="hidden md:flex w-[280px] shrink-0 bg-[#0c0c14] border-r border-border-color flex-col justify-between py-6 h-screen z-20 font-tech overflow-y-auto overscroll-contain custom-scrollbar">
        {/* Brand Header */}
        <div className="shrink-0">
          <div className="px-6 pb-6 border-b border-border-color flex flex-col items-center text-center">
            {/* Top Center Logo */}
            <div className="mb-3.5 relative flex items-center justify-center">
              <Image
                src="/ivc-gear-logo.png"
                alt="Innovators & Visionaries Club Logo"
                width={72}
                height={72}
                priority
                className="w-[72px] h-[72px] object-contain drop-shadow-[0_0_15px_rgba(0,240,255,0.35)] hover:scale-105 transition-transform"
              />
            </div>

            {/* Respective Portal Heading Below Logo */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-accent-primary/15 border border-accent-primary/40 rounded">
                  <Gavel className="text-accent-primary w-4 h-4" />
                </span>
                <h2 className="font-heading text-lg tracking-[2px] m-0 text-text-primary uppercase leading-tight">
                  Judge Portal
                </h2>
              </div>
              <p className="font-tech text-[11px] text-accent-primary m-0 font-bold tracking-[1.5px] uppercase mt-1">
                Evaluation Committee
              </p>
            </div>

            {/* Event Status Capsule */}
            <div className="mt-4 w-full px-3 py-1.5 bg-status-success/10 border border-status-success/30 rounded flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
                <span className="text-[11px] text-status-success font-bold uppercase tracking-wider">
                  Ideathon — Live
                </span>
              </div>
              <span className="text-[10px] text-text-secondary uppercase">2026</span>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="py-6 px-4 flex flex-col gap-1.5">
            <p className="font-tech text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 pl-3 font-bold">
              Navigation
            </p>

            {navItems.map((item) => {
              const isActive = isItemActive(item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center justify-between py-3 px-4 rounded-2xl transition-all duration-300 ease-out active:scale-[0.98] ${
                    isActive
                      ? "bg-[linear-gradient(90deg,#E0026E_0%,#B8005A_26%,#5B0832_60%,#240A1B_85%,#140E17_100%)] text-white shadow-[0_4px_22px_rgba(224,2,110,0.38),inset_0_1px_1px_rgba(255,255,255,0.22)] border border-pink-500/25 animate-active-pill"
                      : "text-[#94A3B8] border border-transparent hover:text-white hover:bg-white/[0.04] hover:translate-x-1"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <item.icon
                      size={18}
                      className={`transition-colors duration-200 shrink-0 ${
                        isActive ? "text-white" : "text-[#94A3B8] group-hover:text-white"
                      }`}
                    />
                    <span
                      className={`text-[13px] font-medium tracking-normal transition-colors duration-200 ${
                        isActive ? "text-white font-semibold" : "text-[#94A3B8] group-hover:text-white"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold tracking-wider ${
                        isActive
                          ? "bg-white/20 text-white border border-white/30"
                          : "bg-surface-color text-text-secondary border border-border-color/60"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer Judge Context & Sign Out */}
        <div className="px-4 py-4 border-t border-border-color mt-auto space-y-3 shrink-0">
          <div className="p-3 bg-surface-color/50 border border-border-color rounded">
            <p className="text-[10px] uppercase text-text-secondary tracking-wider font-bold mb-0.5">
              Judge Portal
            </p>
            <p className="font-heading text-xs text-text-primary uppercase truncate m-0">
              Jury Evaluation Panel
            </p>
            <div className="flex items-center justify-between text-[10px] text-text-secondary mt-1 font-mono">
              <span>Scorecard Auth</span>
              <span className="text-status-success">VERIFIED</span>
            </div>
          </div>

          <SignOutButton variant="menu-item" label="Sign Out (Judge)" />

          <div className="pt-2 text-[10px] text-text-secondary/70 font-mono tracking-wider flex items-center justify-between">
            <span>BUILD: ViceVerse v2.0</span>
            <span>IVC 2026</span>
          </div>
        </div>
      </aside>

      {/* ================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Visible only on < md screens)       */}
      {/* ================================================================= */}
      <nav
        aria-label="Mobile Judge Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c14]/95 backdrop-blur-xl border-t border-border-color/80 px-2 pt-2 font-tech shadow-[0_-10px_35px_rgba(0,0,0,0.85)] pb-[max(0.6rem,env(safe-area-inset-bottom))]"
      >
        <div className="grid grid-cols-3 gap-1.5 max-w-md mx-auto items-stretch">
          {navItems.map((item) => {
            const isActive = isItemActive(item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 active:scale-95 text-center ${
                  isActive
                    ? "bg-gradient-to-t from-accent-secondary/25 via-accent-secondary/10 to-transparent border border-accent-secondary/50 text-white shadow-[0_0_18px_rgba(255,0,127,0.3)]"
                    : "text-text-secondary/80 border border-transparent hover:text-text-primary hover:bg-white/[0.03]"
                }`}
              >
                {/* Active Top Glowing Accent Indicator */}
                {isActive && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full bg-accent-secondary shadow-[0_0_10px_var(--accent-secondary)]" />
                )}

                <item.icon
                  size={19}
                  className={`transition-colors shrink-0 mb-1 ${
                    isActive ? "text-accent-secondary" : "text-text-secondary/80"
                  }`}
                />

                <span
                  className={`text-[10px] font-heading tracking-wide uppercase leading-tight line-clamp-1 ${
                    isActive ? "text-white font-bold" : "text-text-secondary"
                  }`}
                >
                  {item.label}
                </span>

                {item.badge && (
                  <span
                    className={`mt-1 text-[8px] font-mono uppercase px-1.5 py-0.2 rounded-full border leading-tight ${
                      isActive
                        ? "bg-accent-secondary/20 text-accent-secondary border-accent-secondary/40 font-bold"
                        : "bg-surface-color-light/70 text-text-secondary/70 border-border-color/60"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
