'use client';

import { useEffect, useState } from "react";
import SelectStatementButton from "./select-statement-button";

interface Statement {
  id: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  team_limit?: number | null;
  enable_selection: boolean;
  manual_lock: boolean;
  selection_opening?: string | null;
  selection_closing?: string | null;
}

interface Props {
  stmt: Statement;
  assignedCount: number;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hh = h > 0 ? `${h}:` : "";
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${hh}${mm}:${String(s).padStart(2, "0")}`;
}

export default function StatementCard({ stmt, assignedCount }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const opening = stmt.selection_opening ? new Date(stmt.selection_opening).getTime() : null;
  const closing = stmt.selection_closing ? new Date(stmt.selection_closing).getTime() : null;

  const isOpen =
    stmt.enable_selection &&
    opening !== null &&
    now >= opening &&
    (closing === null || now <= closing);

  const isClosed = closing !== null && now > closing;

  const remainingMs = opening && now < opening ? opening - now : 0;

  const capacityInfo =
    stmt.team_limit != null ? `${assignedCount} / ${stmt.team_limit} TEAMS SELECTED` : null;
  const full = stmt.team_limit != null && assignedCount >= stmt.team_limit;

  let statusLabel = "READING PHASE";
  if (isOpen) statusLabel = "SELECTION IS LIVE";
  else if (isClosed) statusLabel = "SELECTION CLOSED";
  else if (opening && now < opening) statusLabel = `SELECTION OPENS IN ${formatMs(remainingMs)}`;

  const disableSelect = !isOpen || full || stmt.manual_lock;

  return (
    <div className="p-4 bg-surface-color/30 border border-border-color rounded">
      <h2 className="font-heading text-xl text-text-primary">{stmt.title}</h2>
      <p className="text-sm text-text-secondary">
        {stmt.summary ?? stmt.description?.slice(0, 200) + "..."}
      </p>
      {capacityInfo && (
        <p className="text-xs text-text-secondary mt-1">{capacityInfo}</p>
      )}
      {full && (
        <p className="text-xs text-status-error mt-1">SELECTION FULL</p>
      )}
      <p className="mt-1 text-xs text-text-secondary font-medium">{statusLabel}</p>
      <SelectStatementButton
        statementId={stmt.id}
        statementTitle={stmt.title}
        disabled={disableSelect}
      />
    </div>
  );
}
