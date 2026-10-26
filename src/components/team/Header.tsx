"use client";

import Link from "next/link";
import { Users, FileUp, Trophy, QrCode, ArrowLeft } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default function TeamHeader() {
  return (
    <header className="border-b border-border-color bg-surface-color/80 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent-secondary/10 border border-accent-secondary/40 rounded">
          <Users className="text-accent-secondary w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg tracking-[2px] m-0 text-text-primary uppercase">
            Team Deliverables Hub
          </h2>
          <p className="font-tech text-[11px] text-accent-tertiary m-0 font-bold tracking-[1px] uppercase">
            Eventra 1.0 // Participant Console
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/team/submission"
          className="flex items-center gap-1.5 font-tech text-xs uppercase font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          <FileUp size={16} className="text-accent-secondary" />
          <span>Deliverables</span>
        </Link>

        <Link
          href="/team/results"
          className="flex items-center gap-1.5 font-tech text-xs uppercase font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          <Trophy size={16} className="text-accent-primary" />
          <span>My Results</span>
        </Link>

        <Link
          href="/team/qr"
          className="flex items-center gap-1.5 font-tech text-xs uppercase font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          <QrCode size={16} className="text-accent-tertiary" />
          <span>QR Pass</span>
        </Link>

        <SignOutButton variant="pill" label="Sign Out" />
      </div>
    </header>
  );
}
