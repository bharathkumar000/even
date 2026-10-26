"use client";

import Link from "next/link";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-color flex items-center justify-center p-6 text-text-primary">
      <div className="glass-panel max-w-lg w-full p-8 text-center space-y-6 border border-border-color shadow-[0_0_50px_rgba(255,0,127,0.15)] relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-36 h-36 bg-accent-secondary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-36 h-36 bg-accent-tertiary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 rounded-full bg-accent-secondary/10 border border-accent-secondary/40 flex items-center justify-center mx-auto text-accent-secondary">
          <AlertTriangle size={32} />
        </div>

        <div>
          <h1 className="font-heading text-4xl font-black uppercase tracking-wider text-accent-primary animate-flicker">
            404
          </h1>
          <h2 className="font-tech text-lg font-bold uppercase tracking-widest text-text-primary mt-1">
            Sector Not Found
          </h2>
          <p className="font-tech text-xs text-text-secondary mt-2 max-w-sm mx-auto">
            The coordinates you requested do not exist in the Eventra network grid.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-accent-primary text-black font-tech font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-accent-primary-hover transition-colors cursor-pointer"
          >
            <Home size={14} />
            Command Center
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto px-6 py-2.5 bg-surface-color border border-border-color text-text-secondary font-tech font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 hover:text-text-primary hover:border-text-secondary transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            Previous Sector
          </button>
        </div>
      </div>
    </div>
  );
}
