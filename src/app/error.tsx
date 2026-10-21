"use client";

import { useEffect } from "react";
import { AlertOctagon, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client-side boundary errors
    console.error("Unhandled client error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg-color flex items-center justify-center p-6 text-text-primary">
      <div className="glass-panel max-w-lg w-full p-8 text-center space-y-6 border border-status-error/40 shadow-[0_0_50px_rgba(255,0,127,0.2)] relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-status-error/10 border border-status-error/40 flex items-center justify-center mx-auto text-status-error">
          <AlertOctagon size={32} />
        </div>

        <div>
          <h1 className="font-heading text-3xl font-black uppercase tracking-wider text-status-error animate-flicker">
            System Failure
          </h1>
          <h2 className="font-tech text-sm font-bold uppercase tracking-widest text-text-primary mt-1">
            Execution Interrupted
          </h2>
          <p className="font-tech text-xs text-text-secondary mt-2 max-w-sm mx-auto">
            A critical anomaly occurred during execution. Safe-mode protocols have contained the error.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            id="reinitialize-btn"
            type="button"
            onClick={() => {
              try {
                reset();
              } catch (err) {
                console.warn("reset() threw an exception:", err);
              }
              // Force clean browser reload to break out of frozen error boundaries
              window.location.reload();
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-accent-secondary text-white font-tech font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-accent-secondary/80 transition-colors shadow-[0_0_15px_rgba(255,0,127,0.4)] cursor-pointer"
          >
            <RotateCcw size={14} />
            Re-Initialize System
          </button>
          <button
            id="return-home-btn"
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-surface-color border border-border-color text-text-secondary font-tech font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 hover:text-text-primary hover:border-text-secondary transition-colors cursor-pointer"
          >
            <Home size={14} />
            Return Home
          </button>
          <button
            id="reauth-btn"
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-accent-primary/10 border border-accent-primary/40 text-accent-primary font-tech font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-accent-primary/20 transition-colors cursor-pointer"
          >
            Sign In Portal
          </button>
        </div>
      </div>
    </div>
  );
}

