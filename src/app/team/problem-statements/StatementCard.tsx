'use client';

import { useState, useSyncExternalStore } from "react";
import { Clock, Users, AlertCircle, ChevronDown, ChevronUp, BookOpen, Cpu } from "lucide-react";
import SelectStatementButton from "./select-statement-button";

interface Statement {
  id: string;
  reference_number?: string | null;
  title: string;
  domain?: string | null;
  summary?: string | null;
  description?: string | null;
  team_limit?: number | null;
  enable_selection: boolean;
  manual_lock: boolean;
  selection_opening?: string | null;
  selection_closing?: string | null;
  selection_activated_at?: string | null;
  // SIH 2025 fields
  sih_ps_number?: string | null;
  organization?: string | null;
  theme?: string | null;
  category?: "Software" | "Hardware" | null;
  department?: string | null;
  internal_reference?: string | null;
  sih_year?: number | null;
}

interface Props {
  stmt: Statement;
  assignedCount: number;
  teamSelection: string | null;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hh = h > 0 ? `${h}h ` : "";
  const mm = `${m}m `;
  const ss = `${s}s`;
  return `${hh}${mm}${ss}`;
}

const subscribeTime = (callback: () => void) => {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
};
const getClientTime = () => Date.now();
const getServerTime = () => 0;

export default function StatementCard({ stmt, assignedCount, teamSelection }: Props) {
  const now = useSyncExternalStore(subscribeTime, getClientTime, getServerTime);
  const [expanded, setExpanded] = useState(false);

  const opening = stmt.selection_opening ? new Date(stmt.selection_opening).getTime() : null;
  const closing = stmt.selection_closing ? new Date(stmt.selection_closing).getTime() : null;
  const activated = stmt.selection_activated_at ? new Date(stmt.selection_activated_at).getTime() : null;

  const isOpen =
    now !== null &&
    stmt.enable_selection &&
    !stmt.manual_lock &&
    activated !== null &&
    now >= activated &&
    (closing === null || now <= closing);

  const isClosed = now !== null && closing !== null && now > closing;
  const remainingMs = now !== null && activated && now < activated ? activated - now : 0;
  const full = stmt.team_limit != null && assignedCount >= stmt.team_limit;

  // Check if this team has already selected this statement
  const isSelectedByTeam = teamSelection === stmt.id;
  // Check if this team has selected a different statement
  const hasOtherSelection = teamSelection !== null && teamSelection !== stmt.id;

  // Disable select if: not open, full, manual lock, already selected by this team, or team has another selection
  const disableSelect = !isOpen || full || stmt.manual_lock || isSelectedByTeam || hasOtherSelection;

  return (
    <article className="glass-panel p-4 sm:p-6 border border-border-color hover:border-accent-secondary/40 transition-all rounded-xl flex flex-col justify-between gap-4">
      <div>
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {stmt.reference_number && (
              <span className="px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary font-mono text-[11px] font-bold rounded">
                {stmt.reference_number}
              </span>
            )}
            {stmt.internal_reference && (
              <span className="px-2 py-0.5 bg-accent-tertiary/10 border border-accent-tertiary/30 text-accent-tertiary font-mono text-[10px] font-bold rounded">
                {stmt.internal_reference}
              </span>
            )}
            {stmt.sih_ps_number && (
              <span className="px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary font-mono text-[10px] font-bold rounded">
                {stmt.sih_ps_number}
              </span>
            )}
            {stmt.department && (
              <span className="px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary font-tech text-[10px] uppercase tracking-wider font-bold rounded">
                {stmt.department}
              </span>
            )}
            {stmt.category && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                stmt.category === "Software"
                  ? "bg-status-success/10 text-status-success border-status-success/30"
                  : "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
              }`}>
                {stmt.category}
              </span>
            )}
          </div>

          {/* Status Badge */}
          <div>
            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-status-success/15 border border-status-success/50 text-status-success text-[11px] font-tech font-bold uppercase rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                Selection Live
              </span>
            ) : isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-text-secondary/15 border border-text-secondary/40 text-text-secondary text-[11px] font-tech font-bold uppercase rounded-full">
                Selection Closed
              </span>
            ) : opening && now < opening ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-status-warning/15 border border-status-warning/50 text-status-warning text-[11px] font-tech font-bold uppercase rounded-full">
                <Clock size={11} />
                Opens in {formatMs(remainingMs)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-surface-color border border-border-color text-text-secondary text-[11px] font-tech uppercase rounded-full">
                Reading Phase
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="font-heading text-lg sm:text-xl text-text-primary uppercase tracking-wide m-0">
          {stmt.title}
        </h2>

        {/* Summary / Description */}
        <div className="mt-2 text-xs sm:text-sm text-text-secondary leading-relaxed">
          <p className="m-0">
            {expanded
              ? stmt.description || stmt.summary
              : stmt.summary ?? (stmt.description ? stmt.description.slice(0, 180) + "…" : "No description provided.")}
          </p>
          {(stmt.description && stmt.description.length > 180) && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1.5 text-accent-secondary hover:underline inline-flex items-center gap-1 font-tech font-bold text-xs cursor-pointer"
            >
              <span>{expanded ? "Show less" : "Read full description"}</span>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Footer Details & Action Button */}
      <div className="pt-3 border-t border-border-color/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          {isSelectedByTeam && (
            <span className="inline-flex items-center gap-1.5 font-tech text-status-success font-bold">
              <BookOpen size={13} className="text-status-success" />
              <span>SELECTED</span>
            </span>
          )}
          {hasOtherSelection && !isSelectedByTeam && (
            <span className="inline-flex items-center gap-1.5 font-tech text-status-warning font-bold">
              <AlertCircle size={13} className="text-status-warning" />
              <span>LOCKED — Your team selected another PS</span>
            </span>
          )}
          {!isSelectedByTeam && !hasOtherSelection && stmt.team_limit != null && (
            <span className={`inline-flex items-center gap-1.5 font-tech ${full ? "text-status-error font-bold" : ""}`}>
              <Users size={13} className={full ? "text-status-error" : "text-accent-secondary"} />
              <span>{assignedCount} / {stmt.team_limit} Teams Allotted</span>
              {full && <span className="text-[10px] uppercase font-mono px-1 bg-status-error/20 border border-status-error/40 rounded">Full</span>}
            </span>
          )}
          {stmt.manual_lock && (
            <span className="text-[11px] text-status-warning font-tech uppercase flex items-center gap-1">
              <AlertCircle size={12} /> Locked by Admin
            </span>
          )}
        </div>

        <div className="shrink-0">
          <SelectStatementButton
            statementId={stmt.id}
            statementTitle={stmt.title}
            disabled={disableSelect}
            isSelected={isSelectedByTeam}
          />
        </div>
      </div>
    </article>
  );
}
