"use client";

import Link from "next/link";
import { QrCode, ArrowLeft } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default function OpsHeader() {
  return (
    <header className="border-b border-border-color bg-surface-color/85 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent-tertiary/10 border border-accent-tertiary/40 rounded">
          <QrCode className="text-accent-tertiary w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg tracking-[2px] m-0 text-text-primary uppercase">
            Event Operations Hub
          </h2>
          <p className="font-tech text-[11px] text-accent-primary m-0 font-bold tracking-[1px] uppercase">
            On-Site Desks // QR Verification & Logistics
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/ops/scanner"
          className="flex items-center gap-1.5 font-tech text-xs uppercase font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          <QrCode size={16} className="text-accent-tertiary" />
          <span>QR Scanner</span>
        </Link>

        <SignOutButton variant="pill" label="Sign Out" />
      </div>
    </header>
  );
}
