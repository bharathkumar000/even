"use client";

import React from "react";
import { Camera, Search, RefreshCw, QrCode } from "lucide-react";

interface ScannerDeskProps {
  scanning: boolean;
  manualId: string;
  loading: boolean;
  onStartScanner: () => void;
  onStopScanner: () => void;
  onManualIdChange: (v: string) => void;
  onLookup: (id: string) => void;
}

export default function ScannerDesk({
  scanning,
  manualId,
  loading,
  onStartScanner,
  onStopScanner,
  onManualIdChange,
  onLookup,
}: ScannerDeskProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Camera Box */}
      <div className="glass-panel p-4 sm:p-6 border border-border-color space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg text-text-primary uppercase m-0 flex items-center gap-2">
            <Camera className="text-accent-tertiary" size={18} />
            Live Camera Scanner
          </h2>
          <button
            onClick={scanning ? onStopScanner : onStartScanner}
            className={`px-3 py-1.5 font-tech font-bold uppercase text-xs transition-colors ${
              scanning
                ? "bg-status-error hover:bg-status-error/80 text-white"
                : "bg-accent-tertiary hover:bg-accent-tertiary/80 text-black"
            }`}
          >
            {scanning ? "Stop Camera" : "Launch Camera"}
          </button>
        </div>

        <div className="relative w-full h-64 bg-surface-color border border-dashed border-border-color overflow-hidden rounded flex items-center justify-center">
          {/* html5-qrcode attaches and mutates DOM directly in this dedicated div. React must NOT have children here */}
          <div
            id="qr-reader-container"
            className="w-full h-full"
          />

          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center text-text-secondary font-tech p-4 bg-surface-color/90">
              <QrCode size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs m-0">Click &quot;Launch Camera&quot; to scan QR badges</p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Entry Box */}
      <div id="manual-lookup" className="glass-panel p-4 sm:p-6 border border-border-color space-y-4 flex flex-col justify-between scroll-mt-20">
        <div>
          <h2 className="font-heading text-lg text-text-primary uppercase m-0 flex items-center gap-2">
            <Search className="text-accent-secondary" size={18} />
            Manual ID Lookup
          </h2>
          <p className="font-tech text-xs text-text-secondary mt-1">
            If camera scanning is unavailable, enter the Team UUID directly.
          </p>

          <div className="pt-4 space-y-3 font-tech">
            <input
              type="text"
              placeholder="Paste Team ID UUID (e.g. 00000000-0000-...)"
              value={manualId}
              onChange={(e) => onManualIdChange(e.target.value)}
              className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-xs focus:border-accent-secondary outline-none font-sans tracking-normal"
            />
            <button
              type="button"
              onClick={() => onLookup(manualId)}
              disabled={loading || !manualId}
              className="w-full py-2.5 bg-surface-color-light border border-border-color hover:border-accent-secondary text-text-primary font-bold uppercase text-xs transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>{loading ? "Searching..." : "Lookup Team Roster"}</span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-surface-color-light/30 border border-border-color text-text-secondary font-tech text-[11px]">
          Action Desks: Registration, Kit/Goodies, Lunch Token, Snacks Token.
        </div>
      </div>
    </div>
  );
}
