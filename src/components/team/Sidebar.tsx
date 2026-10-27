"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileUp,
  QrCode,
  Trophy,
  Users,
  Bell,
  Activity,
  ArrowLeft,
  Shield,
  Layers,
  Home,
  Gavel,
  ScrollText,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

interface TeamSidebarProps {
  teamName?: string;
  leaderName?: string;
  track?: string;
  isLeader?: boolean;
}

export default function TeamSidebar({
  teamName = "Team Roster",
  leaderName = "Team Member",
  track = "Innovation",
  isLeader = true,
}: TeamSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/team",
      icon: LayoutDashboard,
      label: "Dashboard",
      badge: "Console",
      exact: true,
    },
    {
      href: "/team/submission",
      icon: FileUp,
      label: "Project Deliverables",
      badge: isLeader ? "Required" : "View",
    },
    {
      href: "/team/qr",
      icon: QrCode,
      label: "Event QR Pass",
      badge: "Check-in",
    },
    {
      href: "/team/problem-statements",
      icon: ScrollText,
      label: "Problem Statements",
    },
      {
      href: "/team/results",
      icon: Trophy,
      label: "Results & Standings",
      badge: "Live",
    },
  ];

  return (
    <aside className="w-full md:w-[280px] md:shrink-0 bg-[#0c0c14] md:border-r border-b md:border-b-0 border-border-color flex flex-col justify-between py-6 md:h-screen z-20 font-tech md:overflow-y-auto overscroll-contain custom-scrollbar">
      {/* Brand Header */}
      <div className="shrink-0">
        <div className="px-6 pb-6 border-b border-border-color flex flex-col items-center text-center">
          {/* Top Center Logo */}
          <div className="mb-3.5 relative flex items-center justify-center">
            <Image
              src="/ivc-logo-transparent.png"
              alt="Innovators & Visionaries Club Logo"
              width={72}
              height={72}
              priority
              className="w-[72px] h-[72px] object-contain drop-shadow-[0_0_15px_rgba(255,0,127,0.35)] hover:scale-105 transition-transform"
            />
          </div>

          {/* Respective Portal Heading Below Logo */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-accent-secondary/15 border border-accent-secondary/40 rounded">
                <Users className="text-accent-secondary w-4 h-4" />
              </span>
              <h2 className="font-heading text-lg tracking-[2px] m-0 text-text-primary uppercase leading-tight">
                Team Portal
              </h2>
            </div>
            <p className="font-tech text-[11px] text-accent-secondary m-0 font-bold tracking-[1.5px] uppercase mt-1">
              {isLeader ? "Team Lead Console" : "Team Member Console"}
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
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || (pathname?.startsWith(item.href) && item.href !== "/team");

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
                </Link>
            );
          })}
        </div>
      </div>

      {/* Footer Team Context & Sign Out */}
      <div className="px-4 py-4 border-t border-border-color mt-auto space-y-3 shrink-0">
        <div className="p-3 bg-surface-color/50 border border-border-color rounded">
          <p className="text-[10px] uppercase text-text-secondary tracking-wider font-bold mb-0.5">
            Active Team
          </p>
          <p className="font-heading text-xs text-text-primary uppercase truncate m-0">
            {teamName}
          </p>
          <div className="flex items-center justify-between text-[10px] text-text-secondary mt-1 font-mono">
            <span>Track: {track}</span>
            <span className="text-accent-tertiary">{isLeader ? "LEADER" : "MEMBER"}</span>
          </div>
        </div>

        <SignOutButton variant="menu-item" label="Sign Out" />

        <div className="pt-2 text-[10px] text-text-secondary/70 font-mono tracking-wider flex items-center justify-between">
          <span>BUILD: ViceVerse v2.0</span>
          <span>IVC 2026</span>
        </div>
      </div>
    </aside>
  );
}
