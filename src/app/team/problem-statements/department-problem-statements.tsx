"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getPublishedProblemStatements, getAssignmentCounts } from "@/app/actions/admin-problem-statements";
import StatementCard from "./StatementCard";

type Department = "cse-aiml" | "ece-eee" | "me-cv";

const DEPARTMENTS: Array<{
  id: Department;
  label: string;
  subtitle: string;
}> = [
  { id: "cse-aiml", label: "CSE / AIML", subtitle: "Computer Science & AI/ML" },
  { id: "ece-eee", label: "ECE / EEE", subtitle: "Electronics & Electrical" },
  { id: "me-cv", label: "ME / CV", subtitle: "Mechanical & Civil" },
];

interface DepartmentData {
  statements: any[];
  counts: Record<string, number>;
  loading: boolean;
  error: string | null;
}

interface DepartmentProblemStatementsProps {
  initialStatements: any[];
  initialCounts: Record<string, number>;
  defaultDepartment: Department | null;
}

// Map department filter to database department values
function getDepartmentFilter(department: Department): string {
  switch (department) {
    case "cse-aiml":
      return "CSE / AIML";
    case "ece-eee":
      return "Electronics and Communication";
    case "me-cv":
      return "Mechanical,Civil";
    default:
      return "";
  }
}

// Filter statements by department field (not domain)
function filterByDepartment(statements: any[], department: Department): any[] {
  const deptValue = getDepartmentFilter(department);
  const values = deptValue.split(",").map(v => v.trim().toLowerCase());
  
  return statements.filter((s: any) => {
    const dept = (s.department || "").toLowerCase().trim();
    return values.some(v => dept.includes(v));
  });
}

// Compute overall phase from statements
function computePhase(statements: any[]): { phase: "not_started" | "reading" | "selection" | "closed"; label: string; color: string } {
  const now = Date.now();
  const anyReadingStarted = statements.some((s: any) => s.reading_started_at);
  const anySelectionActivated = statements.some((s: any) => s.selection_activated_at);
  const anySelectionEnabled = statements.some((s: any) => s.enable_selection === true);

  if (anySelectionActivated && anySelectionEnabled) {
    return { phase: "selection", label: "SELECTION PHASE", color: "bg-status-success/15 border-status-success/50 text-status-success" };
  }
  if (anySelectionActivated && !anySelectionEnabled) {
    return { phase: "closed", label: "SELECTION CLOSED", color: "bg-surface-color border border-border-color text-text-secondary" };
  }
  if (anyReadingStarted) {
    return { phase: "reading", label: "READING PHASE", color: "bg-surface-color border border-border-color text-text-secondary" };
  }
  return { phase: "not_started", label: "NOT STARTED", color: "bg-surface-color border border-border-color text-text-secondary" };
}

export default function DepartmentProblemStatements({
  initialStatements,
  initialCounts,
  defaultDepartment,
}: DepartmentProblemStatementsProps) {
  // Default to CSE/AIML if no department specified
  const [activeDepartment, setActiveDepartment] = useState<Department>(defaultDepartment || "cse-aiml");
  const [departmentData, setDepartmentData] = useState<Record<Department, DepartmentData>>({
    "cse-aiml": { statements: [], counts: {}, loading: false, error: null },
    "ece-eee": { statements: [], counts: {}, loading: false, error: null },
    "me-cv": { statements: [], counts: {}, loading: false, error: null },
  });

  // Initialize with server-fetched data for the default department
  useEffect(() => {
    if (defaultDepartment) {
      const filtered = filterByDepartment(initialStatements, defaultDepartment);
      setDepartmentData((prev) => ({
        ...prev,
        [defaultDepartment]: {
          statements: filtered,
          counts: initialCounts,
          loading: false,
          error: null,
        },
      }));
    } else {
      // Default to CSE/AIML if no defaultDepartment provided
      const filtered = filterByDepartment(initialStatements, "cse-aiml");
      setDepartmentData((prev) => ({
        ...prev,
        "cse-aiml": {
          statements: filtered,
          counts: initialCounts,
          loading: false,
          error: null,
        },
      }));
    }
  }, [initialStatements, initialCounts, defaultDepartment]);

  const fetchDepartment = useCallback(async (dept: Department) => {
    setDepartmentData((prev) => ({
      ...prev,
      [dept]: { ...prev[dept], loading: true, error: null },
    }));
    try {
      const statements = await getPublishedProblemStatements(dept);
      const statementIds = statements.map((s) => s.id);
      const counts = await getAssignmentCounts(statementIds);
      setDepartmentData((prev) => ({
        ...prev,
        [dept]: { statements, counts, loading: false, error: null },
      }));
    } catch (err: unknown) {
      setDepartmentData((prev) => ({
        ...prev,
        [dept]: {
          ...prev[dept],
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load statements.",
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (activeDepartment) {
      const existing = departmentData[activeDepartment];
      if (!existing.loading && existing.statements.length === 0) {
        fetchDepartment(activeDepartment);
      }
    }
  }, [activeDepartment, departmentData, fetchDepartment]);

  const current = activeDepartment ? departmentData[activeDepartment] : null;
  const deptInfo = DEPARTMENTS.find((d) => d.id === activeDepartment);

  const statements = current?.statements || [];
  const counts = current?.counts || {};
  const loading = current?.loading || false;

  // Compute phase from all statements (not just filtered department)
  const allStatements = initialStatements;
  const phaseInfo = useMemo(() => computePhase(allStatements), [allStatements]);

  return (
    <div className="space-y-6">
      {/* Phase Banner */}
      <div className={`px-4 py-3 rounded-lg border font-tech text-xs uppercase tracking-wider font-bold flex items-center justify-between ${phaseInfo.color}`}>
        <span>{phaseInfo.label}</span>
        {phaseInfo.phase === "selection" && (
          <span className="text-[10px] font-mono opacity-80">Team selection is open</span>
        )}
        {phaseInfo.phase === "reading" && (
          <span className="text-[10px] font-mono opacity-80">Reading only — selection disabled</span>
        )}
        {phaseInfo.phase === "closed" && (
          <span className="text-[10px] font-mono opacity-80">Selection closed — no further changes</span>
        )}
      </div>

      {/* Domain Filters - Three equally sized horizontal options */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {DEPARTMENTS.map((d) => {
          const isActive = activeDepartment === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setActiveDepartment(d.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 px-5 py-3.5 text-sm font-tech font-bold uppercase tracking-wider rounded-xl transition-all border-2 ${
                isActive
                  ? "bg-accent-secondary/15 text-accent-secondary border-accent-secondary shadow-[0_0_20px_rgba(255,0,127,0.25)]"
                  : "text-text-secondary border-transparent hover:border-accent-secondary/40 hover:bg-surface-color/30"
              }`}
            >
              <span className="font-heading text-base">{d.label}</span>
              <span className="text-[10px] font-mono opacity-60">{d.subtitle}</span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent-secondary/30 border-t-accent-secondary rounded-full animate-spin mb-3" />
          <p className="text-text-secondary text-xs font-mono uppercase">
            Loading {deptInfo?.label} problem statements…
          </p>
        </div>
      )}

      {/* Error state */}
      {current?.error && (
        <div className="p-4 bg-status-error/15 border border-status-error text-status-error text-xs font-mono rounded-lg text-center">
          {current.error}
        </div>
      )}

      {/* Empty state */}
      {!loading && statements.length === 0 && !current?.error && (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-full bg-surface-color/30 border border-border-color flex items-center justify-center mx-auto mb-4">
            <span className="text-text-secondary/50">📋</span>
          </div>
          <p className="text-text-secondary font-tech text-sm uppercase">
            No published problem statements available in this domain yet.
          </p>
        </div>
      )}

      {/* Statements Grid */}
      {!loading && statements.length > 0 && (
        <div className="grid gap-4">
          {statements.map((stmt: any) => (
            <StatementCard key={stmt.id} stmt={stmt} assignedCount={counts[stmt.id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}
