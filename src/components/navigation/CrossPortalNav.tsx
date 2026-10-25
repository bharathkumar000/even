"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ScanLine,
  Gavel,
  Users,
  ShieldAlert,
  Home,
  Calendar,
  Info,
  LogOut,
  UserCheck,
  ChevronRight,
  ExternalLink,
  Zap,
  HelpCircle,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

interface CrossPortalNavProps {
  user?: {
    id?: string;
    email?: string;
    role?: string;
    fullName?: string;
  } | null;
  onOpenQuickSwitcher?: () => void;
}

export default function CrossPortalNav({
  user = null,
  onOpenQuickSwitcher,
}: CrossPortalNavProps) {
  const pathname = usePathname();

  const portals = [
    {
      name: "Gateway",
      href: "/",
      icon: Home,
      accent: "text-accent-primary",
      activeBg: "bg-accent-primary/10 border-accent-primary text-accent-primary",
      activeGlow: "0 0 10px rgba(251, 200, 21, 0.5)",
      exact: true,
    },
    {
      name: "Schedule",
      href: "/schedule",
      icon: Calendar,
      accent: "text-accent-tertiary",
      activeBg: "bg-accent-tertiary/10 border-accent-tertiary text-accent-tertiary",
      activeGlow: "0 0 10px rgba(0, 240, 255, 0.5)",
      exact: true,
    },
    {
      name: "About",
      href: "/about",
      icon: Info,
      accent: "text-accent-secondary",
      activeBg: "bg-accent-secondary/10 border-accent-secondary text-accent-secondary",
      activeGlow: "0 0 10px rgba(255, 0, 127, 0.5)",
      exact: true,
    },
    {
      name: "FAQ",
      href: "/faq",
      icon: HelpCircle,
      accent: "text-accent-primary",
      activeBg: "bg-accent-primary/10 border-accent-primary text-accent-primary",
      activeGlow: "0 0 10px rgba(251, 200, 21, 0.5)",
      exact: true,
    },
    {
      name: "Club Member",
      href: "/ops/scanner",
      icon: ScanLine,
      role: "Staff / Ops",
      accent: "text-accent-tertiary",
      activeBg: "bg-accent-tertiary/10 border-accent-tertiary text-accent-tertiary",
      activeGlow: "0 0 10px rgba(0, 240, 255, 0.5)",
      prefix: "/ops",
    },
    {
      name: "Judge",
      href: "/judge",
      icon: Gavel,
      role: "Jury",
      accent: "text-accent-primary",
      activeBg: "bg-accent-primary/10 border-accent-primary text-accent-primary",
      activeGlow: "0 0 10px rgba(251, 200, 21, 0.5)",
      prefix: "/judge",
    },
    {
      name: "TEAM_LEADER",
      href: "/team",
      icon: Users,
      role: "Leader & Squad",
      accent: "text-accent-secondary",
      activeBg: "bg-accent-secondary/10 border-accent-secondary text-accent-secondary",
      activeGlow: "0 0 10px rgba(255, 0, 127, 0.5)",
      prefix: "/team",
    },
    {
      name: "Admin HQ",
      href: "/admin",
      icon: ShieldAlert,
      role: "Mission Control",
      accent: "text-pink-400",
      activeBg: "bg-pink-500/10 border-pink-500 text-pink-400",
      activeGlow: "0 0 10px rgba(255, 0, 127, 0.4)",
      prefix: "/admin",
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#07070c]/90 backdrop-blur-md border-b border-border-color font-tech">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Logo & Title */}
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0 group focus:outline-none"
          >
            <div className="relative flex items-center justify-center">
              <Image
                src="/ivc-gear-logo.png"
                alt="IVC Logo"
                width={36}
                height={36}
                className="w-9 h-9 object-contain drop-shadow-[0_0_8px_rgba(255,0,127,0.4)] group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-black text-sm tracking-[2px] text-text-primary uppercase group-hover:text-accent-primary transition-colors">
                  Vice Verse
                </span>
                <span className="text-[10px] bg-accent-secondary/20 text-accent-secondary px-1.5 py-0.2 border border-accent-secondary/40 font-mono font-bold">
                  v2.0
                </span>
              </div>
              <span className="text-[10px] text-text-secondary tracking-[1.5px] uppercase font-bold">
                Pulse Portal Gateway
              </span>
            </div>
          </Link>

          {/* Central Portal Switcher Navigation */}
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto custom-scrollbar py-1">
            {portals.map((p) => {
              const isActive = p.exact
                ? pathname === p.href
                : pathname === p.href || (p.prefix ? pathname?.startsWith(p.prefix) : false);

              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs uppercase tracking-wider font-bold transition-all border shrink-0 ${
                    isActive
                      ? `${p.activeBg} shadow-sm`
                      : "border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-color-light/60 hover:border-border-color"
                  }`}
                  style={{
                    textShadow: isActive ? p.activeGlow : "none",
                  }}
                >
                  <p.icon size={14} className={isActive ? "" : p.accent} />
                  <span>{p.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions: Session Status / Fast Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            {onOpenQuickSwitcher && (
              <>
                <button
                  type="button"
                  onClick={onOpenQuickSwitcher}
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-tech font-bold uppercase tracking-wider bg-surface-color border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/10 transition-all shadow-[0_0_10px_rgba(251,200,21,0.15)]"
                  title="Quickly switch between test roles"
                >
                  <Zap size={13} className="animate-pulse" />
                  <span>Role Switcher</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenQuickSwitcher}
                  className="flex md:hidden items-center justify-center p-2 text-accent-primary bg-surface-color border border-accent-primary/40 hover:bg-accent-primary/10 transition-all shadow-sm"
                  title="Quickly switch between test roles"
                >
                  <Zap size={14} className="animate-pulse" />
                </button>
              </>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden lg:flex flex-col items-end text-right">
                  <span className="text-xs text-text-primary font-bold truncate max-w-[140px]">
                    {user.fullName || user.email?.split("@")[0]}
                  </span>
                  <span className="text-[10px] text-accent-secondary uppercase font-mono tracking-wider">
                    {user.role?.toUpperCase() || "AUTHENTICATED"}
                  </span>
                </div>
                <SignOutButton
                  variant="button"
                  label="Exit"
                  className="px-2.5 py-1 text-xs border border-border-color text-text-secondary hover:text-status-error hover:border-status-error/40 transition-colors"
                />
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-tech font-bold uppercase tracking-wider bg-gradient-to-r from-accent-secondary to-accent-primary text-black hover:opacity-90 transition-opacity"
              >
                <span>Sign In</span>
                <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
