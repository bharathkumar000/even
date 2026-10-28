"use client";

import Link from "next/link";
import { Gavel, ClipboardList, ArrowLeft } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default function JudgeHeader() {
  return (
    <header className="border-b border-border-color bg-surface-color/80 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent-primary/10 border border-accent-primary/40 rounded">
          <Gavel className="text-accent-primary w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg tracking-[2px] m-0 text-text-primary uppercase">
            Judges Evaluation Hub
          </h2>
          <p className="font-tech text-[11px] text-accent-secondary m-0 font-bold tracking-[1px] uppercase">
            Eventra 1.0 // Official Scoring Portal
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/judge"
          className="flex items-center gap-1.5 font-tech text-xs uppercase font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ClipboardList size={16} className="text-accent-tertiary" />
          <span>Assigned Teams</span>
        </Link>

        <SignOutButton variant="pill" label="Sign Out" />
      </div>
    </header>
  );
}
