"use client";

// useState import removed
import Link from "next/link";
import {
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Home,
  Zap,
  Users,
  Gavel,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
// PortalQuickSwitcher import removed

interface PortalAccessDeniedProps {
  portalTitle: string;
  requiredRoleLabel: string;
  accentColor?: "yellow" | "cyan" | "pink" | "purple";
  currentUser: {
    id: string;
    email?: string;
    role?: string;
    fullName?: string;
  };
}

export default function PortalAccessDenied({
  portalTitle,
  requiredRoleLabel,
  accentColor = "yellow",
  currentUser,
}: PortalAccessDeniedProps) {
  // isSwitcherOpen state removed

  // Map user's actual role to their authorized portal
  const getUserAuthorizedPortal = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return {
          name: "Admin Mission Control",
          url: "/admin",
          icon: ShieldAlert,
          accent: "text-pink-400",
          border: "border-pink-500/50",
          bg: "bg-pink-500/10",
        };
      case "judge":
        return {
          name: "Judge Evaluation Panel",
          url: "/judge",
          icon: Gavel,
          accent: "text-accent-primary",
          border: "border-accent-primary/50",
          bg: "bg-accent-primary/10",
        };
        case "staff":
        case "organizer":
        case "spoc":
        return {
          name: "Club Member Operations Desk",
          url: "/ops/scanner",
          icon: ScanLine,
          accent: "text-accent-tertiary",
          border: "border-accent-tertiary/50",
          bg: "bg-accent-tertiary/10",
        };
      case "leader":
      case "participant":
      default:
        return {
          name: "TEAM_LEADER Console",
          url: "/team",
          icon: Users,
          accent: "text-accent-secondary",
          border: "border-accent-secondary/50",
          bg: "bg-accent-secondary/10",
        };
    }
  };

  const userAuthorizedPortal = getUserAuthorizedPortal(currentUser.role);

  const accentStyles = {
    yellow: {
      border: "border-accent-primary/40",
      glow: "shadow-[0_0_40px_rgba(251,200,21,0.15)]",
      badge: "bg-accent-primary/20 text-accent-primary border-accent-primary/40",
      iconBg: "bg-accent-primary/10 text-accent-primary border-accent-primary/40",
    },
    cyan: {
      border: "border-accent-tertiary/40",
      glow: "shadow-[0_0_40px_rgba(0,240,255,0.15)]",
      badge: "bg-accent-tertiary/20 text-accent-tertiary border-accent-tertiary/40",
      iconBg: "bg-accent-tertiary/10 text-accent-tertiary border-accent-tertiary/40",
    },
    pink: {
      border: "border-accent-secondary/40",
      glow: "shadow-[0_0_40px_rgba(255,0,127,0.15)]",
      badge: "bg-accent-secondary/20 text-accent-secondary border-accent-secondary/40",
      iconBg: "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/40",
    },
    purple: {
      border: "border-pink-500/40",
      glow: "shadow-[0_0_40px_rgba(255,0,127,0.15)]",
      badge: "bg-pink-500/20 text-pink-300 border-pink-500/40",
      iconBg: "bg-pink-500/10 text-pink-400 border-pink-500/40",
    },
  }[accentColor];

  return (
    <div className="min-h-screen bg-[#050508] text-text-primary flex items-center justify-center p-4 sm:p-6 font-tech">
      <div
        className={`glass-panel max-w-xl w-full p-6 sm:p-8 border ${accentStyles.border} ${accentStyles.glow} relative overflow-hidden space-y-6`}
      >
        {/* Neon corner flare */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-accent-secondary/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        {/* Top Header Badge */}
        <div className="flex items-center justify-between border-b border-border-color pb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-warning animate-ping" />
            <span className="text-[11px] font-mono uppercase tracking-[2px] text-text-secondary font-bold">
              Access Restriction Checkpoint
            </span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 font-mono uppercase font-bold border ${accentStyles.badge}`}>
            403 · Sector Restricted
          </span>
        </div>

        {/* Center Alert Icon & Portal Warning */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded border shrink-0 ${accentStyles.iconBg}`}>
            <ShieldAlert size={28} />
          </div>
          <div className="space-y-1">
            <h1 className="font-heading text-xl sm:text-2xl text-text-primary uppercase m-0 leading-tight">
              {portalTitle}
            </h1>
            <p className="text-xs text-text-secondary m-0">
              This portal requires <strong className="text-text-primary">{requiredRoleLabel}</strong> clearance.
            </p>
          </div>
        </div>

        {/* Active Session Details Box */}
        <div className="p-4 bg-surface-color/90 border border-border-color rounded space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary uppercase">Active Session:</span>
            <span className="text-text-primary font-mono font-bold">
              {currentUser.fullName || currentUser.email}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary uppercase">Verified Role:</span>
            <span className="px-2 py-0.5 bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/40 font-mono uppercase text-[11px] font-bold">
              {currentUser.role?.toUpperCase() || "UNKNOWN"}
            </span>
          </div>
          <p className="text-[11px] text-text-secondary/80 m-0 pt-1 border-t border-border-color/60">
            You are authenticated, but your account permissions do not grant access to this sector. Choose an action below to continue seamlessly.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* 1. Go to Authorized Portal */}
          <Link
            href={userAuthorizedPortal.url}
            className="w-full py-3 px-4 bg-gradient-to-r from-accent-secondary to-accent-primary hover:opacity-90 text-black font-tech font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-md text-center"
          >
            <userAuthorizedPortal.icon size={15} />
            <span>Launch My Authorized Portal ({userAuthorizedPortal.name})</span>
            <ArrowRight size={14} />
          </Link>

          {/* 2. Switch Test Role (1-Click) */}


          {/* 3. Return to Gateway & Sign Out Row */}
          <div className="flex items-center gap-3 pt-1">
            <Link
              href="/"
              className="flex-1 py-2 px-3 bg-surface-color-light border border-border-color hover:border-text-secondary text-text-secondary hover:text-text-primary text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 text-center"
            >
              <Home size={14} />
              <span>Return to Central Gateway</span>
            </Link>

            <SignOutButton
              variant="button"
              label="Sign Out"
              className="py-2 px-4 border border-border-color text-text-secondary hover:text-status-error hover:border-status-error/40 text-xs font-bold uppercase tracking-wider transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Role Switcher Modal */}

    </div>
  );
}
