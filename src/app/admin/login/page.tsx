"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  AlertTriangle,
  Lock,
  ArrowRight,
} from "lucide-react";
import {
  verifyAdminPasscode,
  getAdminTrialStatus,
} from "@/app/actions/admin-auth";


export default function AdminPasscodePage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(3);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);


useEffect(() => {
    // Initialize CSRF token first, then read trial status
    const initCsrf = async () => {
      try {
        await fetch("/api/csrf/init", { method: "GET", credentials: "include" });
      } catch (e) {
        console.warn("CSRF init failed:", e);
      }
    };

    initCsrf().then(() => {
      // Read current trial status after CSRF init
      getAdminTrialStatus().then((status) => {
        if (!status.authenticated) {
          router.push("/login");
          return;
        }
        if (!status.isAdmin) {
          router.push("/");
          return;
        }
        if (status.verified) {
          router.push("/admin");
        } else {
          setAttemptsRemaining(status.attemptsRemaining);
          setIsLocked(status.isLocked);
        }
      });
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || !passcode) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await verifyAdminPasscode(passcode);
      if (res.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setErrorMsg(res.error || "Authentication failed.");
        setAttemptsRemaining(res.attemptsRemaining);
        setIsLocked(res.isLocked);
        setPasscode("");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to verify passcode.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-text-primary flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-8 border border-accent-secondary/50 shadow-2xl relative space-y-6">
        {/* Cyberpunk Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-secondary via-accent-primary to-accent-tertiary" />

        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-accent-secondary/10 border border-accent-secondary/40 mb-1">
            <KeyRound className="w-8 h-8 text-accent-secondary animate-pulse" />
          </div>
          <h1 className="font-heading text-2xl text-text-primary uppercase m-0 tracking-wider">
            Admin Checkpoint
          </h1>
          <p className="font-tech text-xs text-text-secondary uppercase tracking-widest">
            Level 2 Authentication // Mission Control
          </p>
        </div>

        {/* Lockout Banner */}
        {isLocked ? (
          <div className="p-4 bg-status-error/15 border border-status-error text-status-error font-tech text-xs flex items-start gap-2.5">
            <Lock size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase m-0">Access Locked Out</p>
              <p className="m-0 text-[11px] opacity-90 mt-0.5">
                Maximum 3 attempts exceeded. Admin access is locked for security. Please try again later.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2.5 bg-surface-color-light/50 border border-border-color text-xs font-tech">
            <span className="text-text-secondary uppercase">Attempts Remaining:</span>
            <span
              className={`font-bold px-2 py-0.5 border ${
                attemptsRemaining === 1
                  ? "bg-status-error/15 text-status-error border-status-error"
                  : attemptsRemaining === 2
                  ? "bg-accent-primary/15 text-accent-primary border-accent-primary"
                  : "bg-status-success/15 text-status-success border-status-success"
              }`}
            >
              {attemptsRemaining} / 3
            </span>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && !isLocked && (
          <div className="p-3 bg-status-error/15 border border-status-error text-status-error font-tech text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Passcode Form */}
        <form onSubmit={handleSubmit} className="space-y-4 font-tech">
          <div className="space-y-1">
            <label className="block text-xs uppercase text-text-secondary font-bold">
              Admin Master Passcode
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-3 text-text-secondary" />
              <input
                type="password"
                required
                disabled={isLocked || loading}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter secret key..."
                className="w-full bg-surface-color border border-border-color p-2.5 pl-9 text-text-primary text-sm focus:border-accent-secondary outline-none font-sans tracking-normal disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLocked || loading || !passcode}
            className="w-full py-3 bg-gradient-to-r from-accent-secondary to-accent-primary hover:opacity-90 text-black font-tech font-bold uppercase tracking-wider text-xs transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <span>{loading ? "Verifying Gate..." : "Authorize Access"}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <div className="pt-2 text-center font-tech text-[11px] text-text-secondary">
          <p className="m-0">
            Protected by cryptographic checkpoint & rate-limited trial counters.
          </p>
        </div>
      </div>
    </div>
  );
}
