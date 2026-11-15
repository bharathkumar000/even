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
  onManualLookup: (id: string) => void;
  recentScans?: string[];
  continuousScanCount?: number;
  onClearBadgeLock?: () => void;
}

export default React.memo(function ScannerDesk({
  scanning,
  manualId,
  loading,
  onStartScanner,
  onStopScanner,
  onManualIdChange,
  onLookup,
  onManualLookup,
  recentScans,
  continuousScanCount = 0,
  onClearBadgeLock,
}: ScannerDeskProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Camera Box */}
      <div className="glass-panel p-3.5 sm:p-6 border border-border-color space-y-4 min-w-0 rounded-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading text-base sm:text-lg text-text-primary uppercase m-0 flex items-center gap-2 shrink-0">
              <Camera className="text-accent-tertiary" size={18} />
              Live Camera Scanner
            </h2>
            {scanning && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-status-success/15 text-status-success border border-status-success/40">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-ping" />
                Live Mode
              </span>
            )}
            {continuousScanCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-accent-primary/15 text-accent-primary border border-accent-primary/40">
                {continuousScanCount} Scanned
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {scanning && onClearBadgeLock && (
              <button
                type="button"
                onClick={onClearBadgeLock}
                title="Reset badge deduplication lock to scan same QR code immediately"
                className="flex-1 sm:flex-initial px-3 py-2 font-tech uppercase text-[11px] font-bold text-text-secondary hover:text-white bg-surface-color border border-border-color hover:border-accent-primary rounded-lg transition-colors text-center"
              >
                Reset Lock
              </button>
            )}
            <button
              type="button"
              onClick={scanning ? onStopScanner : onStartScanner}
              className={`flex-1 sm:flex-initial px-4 py-2 font-tech font-bold uppercase text-xs transition-colors shrink-0 rounded-lg text-center ${
                scanning
                  ? "bg-status-error hover:bg-status-error/80 text-white"
                  : "bg-accent-tertiary hover:bg-accent-tertiary/80 text-black"
              }`}
            >
              {scanning ? "Stop Camera" : "Launch Camera"}
            </button>
          </div>
        </div>

        <div className="relative w-full min-h-[260px] sm:min-h-[380px] lg:min-h-[480px] max-h-[550px] bg-surface-color border border-dashed border-border-color overflow-hidden rounded-xl flex items-center justify-center">
          {/* html5-qrcode attaches and mutates DOM directly in this dedicated div. React must NOT have children here */}
          <div id="qr-reader-container" className="w-full h-full [&_video]:max-w-full [&_video]:h-full [&_video]:object-cover [&_canvas]:max-w-full [&_select]:text-black [&_select]:bg-white" />

          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center text-text-secondary font-tech p-4 bg-surface-color/90">
              <QrCode size={40} className="mx-auto mb-2 opacity-50 text-accent-tertiary" />
              <p className="text-xs m-0 font-bold text-text-primary">Tap &quot;Launch Camera&quot; to scan QR badges</p>
              <p className="text-[10px] text-text-secondary/70 mt-1">Multi-scan enabled: scan one badge after another seamlessly</p>
            </div>
          )}

          {scanning && loading && (
            <div className="absolute top-3 right-3 px-3 py-1 rounded bg-black/80 border border-accent-primary text-accent-primary font-tech text-xs flex items-center gap-2 pointer-events-none shadow-lg animate-pulse z-20">
              <span className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
              <span>Recording scan...</span>
            </div>
          )}
        </div>
      </div>

      {/* Manual Entry Box */}
      <div id="manual-lookup" className="glass-panel p-4 sm:p-6 border border-border-color space-y-4 flex flex-col justify-between scroll-mt-20 min-w-0 rounded-xl">
        <div>
          <h2 className="font-heading text-base sm:text-lg text-text-primary uppercase m-0 flex items-center gap-2">
            <Search className="text-accent-secondary" size={18} />
            Manual ID Lookup
          </h2>
          <p className="font-tech text-xs text-text-secondary mt-1">
            Fallback for QR scanning: enter the Team UUID directly to verify team and record distributions.
          </p>
          <div className="pt-4 space-y-3 font-tech">
            <div className="space-y-2.5">
              <input
                type="text"
                id="manual-team-id"
                placeholder="Paste Team ID UUID (e.g. 00000000-0000-...)"
                value={manualId}
                onChange={e => onManualIdChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && manualId && onManualLookup(manualId)}
                className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-xs focus:border-accent-secondary outline-none font-sans tracking-normal font-mono rounded-lg"
                autoComplete="off"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => !loading && manualId && onManualLookup(manualId)}
                  disabled={loading || !manualId}
                  className="flex-1 min-h-[42px] py-2.5 px-3 bg-accent-secondary hover:bg-accent-secondary/80 text-black font-bold uppercase text-xs transition-colors flex items-center justify-center gap-2 rounded-lg disabled:opacity-50"
                >
                  <Search size={14} className={loading ? "animate-spin" : ""} />
                  <span>{loading ? "Verifying..." : "Verify Team"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { onManualIdChange(""); }}
                  disabled={loading || !manualId}
                  className="min-h-[42px] px-4 py-2.5 bg-surface-color border border-border-color hover:border-accent-secondary text-text-primary font-bold uppercase text-xs transition-colors flex items-center justify-center gap-2 rounded-lg disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 bg-surface-color-light/30 border border-border-color text-text-secondary font-tech text-[11px] rounded-lg">
          Action Desks: Registration, Kit/Goodies, Lunch Token, Snacks Token, Certificates.
        </div>
      </div>

      {/* Recent Scans */}
      {recentScans && recentScans.length > 0 && (
        <div className="glass-panel p-4 border border-border-color">
          <h3 className="font-tech text-sm font-bold uppercase mb-2">Recent Teams</h3>
          <ul className="flex flex-col gap-1">
            {recentScans.map((id, idx) => (
              <li key={id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onLookup(id)}
                  className="text-accent-primary underline"
                >
                  {id}
                </button>
                {idx === 0 && <span className="text-xs text-status-success">(Current)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
