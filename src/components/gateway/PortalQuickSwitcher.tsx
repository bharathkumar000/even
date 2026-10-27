"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Zap,
  Users,
  Gavel,
  ScanLine,
  ShieldAlert,
  ArrowRight,
  Check,
  Copy,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";

interface PortalQuickSwitcherProps {
  isOpen?: boolean;
  onClose?: () => void;
  variant?: "modal" | "inline";
}

interface DemoAccount {
  roleName: string;
  badge: string;
  portalUrl: string;
  email: string;
  fallbackEmail: string;
  password: string;
  fallbackPassword: string;
  description: string;
  themeColor: "cyan" | "yellow" | "pink" | "purple";
  icon: typeof ScanLine;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    roleName: "Club Member (Staff)",
    badge: "Operations Desk",
    portalUrl: "/ops/scanner",
    email: "staff.aman@ivc.pulse",
    fallbackEmail: "staff@ivc.com",
    password: "Password@123",
    fallbackPassword: "Password123!",
    description: "Scan QR codes, distribute kits/meals, monitor live check-ins.",
    themeColor: "cyan",
    icon: ScanLine,
  },
  {
    roleName: "Judge (AI Track)",
    badge: "Evaluation Jury",
    portalUrl: "/judge",
    email: "judge.arvind@ivc.pulse",
    fallbackEmail: "judge@ivc.com",
    password: "Password@123",
    fallbackPassword: "Password123!",
    description: "Dr. Arvind Raman — Score Teams 1–4 across 4 standardized rubrics.",
    themeColor: "yellow",
    icon: Gavel,
  },
  {
    roleName: "TEAM_LEADER",
    badge: "Team Hyperion",
    portalUrl: "/team",
    email: "lead.team1@ivc.pulse",
    fallbackEmail: "leader@ivc.com",
    password: "Password@123",
    fallbackPassword: "Password123!",
    description: "Aryan Sharma — Submit GitHub/pitch deck, view event QR pass.",
    themeColor: "pink",
    icon: Users,
  },
  {
    roleName: "Admin HQ",
    badge: "Mission Control",
    portalUrl: "/admin",
    email: "admin@ivc.pulse",
    fallbackEmail: "admin@ivc.com",
    password: "Password@123",
    fallbackPassword: "Password123!",
    description: "Complete oversight: User seeding, judge allocation, results.",
    themeColor: "purple",
    icon: ShieldAlert,
  },
];

export default function PortalQuickSwitcher({
  isOpen = true,
  onClose,
  variant = "inline",
}: PortalQuickSwitcherProps) {
  const router = useRouter();
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleQuickSwitch = async (account: DemoAccount) => {
    setActiveAccount(account.roleName);
    setStatusText(`Connecting to ${account.roleName}...`);
    setErrorMessage(null);

    const supabase = createClient();

    try {
      // Sign out current session first to ensure clean state
      await supabase.auth.signOut().catch(() => {});

      // Try primary email with password first
      const primaryEmail = account.email;
      const fallbackEmail = account.fallbackEmail;
      const primaryPassword = account.password;
      const fallbackPassword = account.fallbackPassword;

      // 1. Try primary email with primary password
      let authResult = await supabase.auth.signInWithPassword({
        email: primaryEmail,
        password: primaryPassword,
      });

      // 2. If primary fails, try fallback email with fallback password
      if (authResult.error) {
        authResult = await supabase.auth.signInWithPassword({
          email: fallbackEmail,
          password: fallbackPassword,
        });
      }

      // 3. If both fail, try primary email with fallback password
      if (authResult.error) {
        authResult = await supabase.auth.signInWithPassword({
          email: primaryEmail,
          password: fallbackPassword,
        });
      }

      // 4. If all fail, try fallback email with primary password
      if (authResult.error) {
        authResult = await supabase.auth.signInWithPassword({
          email: fallbackEmail,
          password: primaryPassword,
        });
      }

      // If all fail, show helpful error
      if (authResult.error) {
        throw new Error(
          `Demo account not configured. Please use the manual login page at /login with credentials from your administrator.`
        );
      }

      setStatusText(`Authorized! Redirecting to ${account.portalUrl}...`);
      router.push(account.portalUrl);
      router.refresh();

      setTimeout(() => {
        window.location.href = account.portalUrl;
      }, 700);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Quick switch failed");
      setActiveAccount(null);
      setStatusText(null);
    }
  };

  if (variant === "modal" && !isOpen) return null;

  const content = (
    <div className="space-y-4 font-tech">
      <div className="flex items-center justify-between border-b border-border-color pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-accent-primary/10 border border-accent-primary/40 rounded">
            <Zap className="w-4 h-4 text-accent-primary animate-pulse" />
          </div>
          <div>
            <h3 className="font-heading text-sm md:text-base text-text-primary uppercase m-0 leading-tight">
              One-Click Portal Switcher
            </h3>
            <p className="text-[11px] text-text-secondary m-0">
              Instant authentication using verified test credentials
            </p>
          </div>
        </div>

        {variant === "modal" && onClose && (
          <button
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text-primary border border-transparent hover:border-border-color rounded transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {statusText && (
        <div className="p-2.5 bg-accent-primary/15 border border-accent-primary text-text-primary text-xs flex items-center gap-2 animate-fade-in">
          <Loader2 size={14} className="animate-spin text-accent-primary" />
          <span className="font-bold tracking-wide">{statusText}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 bg-status-error/15 border border-status-error text-status-error text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {DEMO_ACCOUNTS.map((acc) => {
          const isCurrentLoading = activeAccount === acc.roleName;

          const colorStyles = {
            cyan: {
              border: "border-accent-tertiary/40 hover:border-accent-tertiary",
              bg: "hover:bg-accent-tertiary/5",
              glow: "group-hover:shadow-[0_0_15px_rgba(0,240,255,0.25)]",
              text: "text-accent-tertiary",
              btnBg: "bg-accent-tertiary hover:bg-accent-tertiary/90 text-black",
            },
            yellow: {
              border: "border-accent-primary/40 hover:border-accent-primary",
              bg: "hover:bg-accent-primary/5",
              glow: "group-hover:shadow-[0_0_15px_rgba(251,200,21,0.25)]",
              text: "text-accent-primary",
              btnBg: "bg-accent-primary hover:bg-accent-primary/90 text-black",
            },
            pink: {
              border: "border-accent-secondary/40 hover:border-accent-secondary",
              bg: "hover:bg-accent-secondary/5",
              glow: "group-hover:shadow-[0_0_15px_rgba(255,0,127,0.25)]",
              text: "text-accent-secondary",
              btnBg: "bg-accent-secondary hover:bg-accent-secondary/90 text-white",
            },
            purple: {
              border: "border-purple-500/40 hover:border-purple-500",
              bg: "hover:bg-purple-500/5",
              glow: "group-hover:shadow-[0_0_15px_rgba(168,85,247,0.25)]",
              text: "text-purple-400",
              btnBg: "bg-purple-500 hover:bg-purple-500/90 text-white",
            },
          }[acc.themeColor];

          return (
            <div
              key={acc.roleName}
              className={`group glass-panel p-3.5 border ${colorStyles.border} ${colorStyles.bg} ${colorStyles.glow} transition-all relative flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <acc.icon size={15} className={colorStyles.text} />
                    <span className="font-heading text-xs font-bold text-text-primary uppercase tracking-wider">
                      {acc.roleName}
                    </span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 bg-surface-color border border-border-color font-mono uppercase text-text-secondary font-bold">
                    {acc.badge}
                  </span>
                </div>

                <p className="text-[11px] text-text-secondary line-clamp-2 mb-3 leading-snug">
                  {acc.description}
                </p>

                <div className="p-2 bg-surface-color/80 border border-border-color/60 text-[10px] font-mono mb-3 space-y-0.5">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="truncate max-w-[140px] text-text-primary">{acc.email}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(acc.email).then(() => setCopiedEmail(acc.email))}
                      className="text-text-secondary hover:text-accent-primary p-0.5 transition-colors"
                      title="Copy email"
                    >
                      {copiedEmail === acc.email ? (
                        <Check size={11} className="text-status-success" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="truncate max-w-[140px] text-text-primary">{acc.password}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(acc.password).then(() => setCopiedEmail(acc.password))}
                      className="text-text-secondary hover:text-accent-primary p-0.5 transition-colors"
                      title="Copy password"
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={activeAccount !== null}
                onClick={() => handleQuickSwitch(acc)}
                className={`w-full py-2 px-3 ${colorStyles.btnBg} text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50`}
              >
                {isCurrentLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Test As {acc.roleName.split(" ")[0]}</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (variant === "modal") {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="glass-panel border border-border-color max-w-4xl w-full p-6 shadow-2xl relative animate-fade-in bg-[#0c0c14]">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 border border-border-color shadow-xl bg-surface-color/60">
      {content}
    </div>
  );
}
