"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function DepartmentProblemStatements({
  initialStatements,
  initialCounts,
  defaultDepartment,
}: DepartmentProblemStatementsProps) {
  const [activeDepartment, setActiveDepartment] = useState<Department | null>(defaultDepartment || null);
  const [departmentData, setDepartmentData] = useState<Record<Department, DepartmentData>>({
    "cse-aiml": { statements: [], counts: {}, loading: false, error: null },
    "ece-eee": { statements: [], counts: {}, loading: false, error: null },
    "me-cv": { statements: [], counts: {}, loading: false, error: null },
  });

  // Initialize with server-fetched data for the default department
  useEffect(() => {
    if (defaultDepartment) {
      const filtered = initialStatements.filter((s: any) => {
        const d = (s.domain || "").toLowerCase();
        if (defaultDepartment === "cse-aiml") return d.includes("cse") || d.includes("aiml");
        if (defaultDepartment === "ece-eee") return d.includes("ece") || d.includes("eee") || d.includes("electronics") || d.includes("electrical");
        if (defaultDepartment === "me-cv") return d.includes("me") || d.includes("cv") || d.includes("mechanical") || d.includes("civil");
        return false;
      });
      setDepartmentData((prev) => ({
        ...prev,
        [defaultDepartment]: {
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

  if (!activeDepartment) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 border border-border-color rounded-lg text-xs text-text-secondary font-mono uppercase mb-6">
          <span>Select a Department</span>
        </div>
        <div className="flex justify-center gap-3">
          {DEPARTMENTS.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDepartment(d.id)}
              className="px-6 py-3 border border-border-color rounded-lg bg-surface-color/50 text-text-primary font-tech font-bold text-sm uppercase tracking-wider hover:bg-accent-secondary/10 hover:border-accent-secondary transition-all"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const statements = current?.statements || [];
  const counts = current?.counts || {};
  const loading = current?.loading || false;

  return (
    <div className="space-y-6">
      {/* Department Tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-4 border-b border-border-color pb-4">
        {DEPARTMENTS.map((d) => {
          const isActive = activeDepartment === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setActiveDepartment(d.id)}
              className={`px-5 py-2.5 text-sm font-tech font-bold uppercase tracking-wider rounded-lg transition-all ${
                isActive
                  ? "bg-accent-secondary text-black border-accent-secondary shadow-[0_0_15px_rgba(255,0,127,0.3)]"
                  : "text-text-secondary border-transparent hover:border-accent-secondary/40 hover:bg-surface-color/40"
              }`}
            >
              {d.label}
              <span className="ml-1 text-[10px] opacity-60">{d.subtitle}</span>
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
            No published problem statements for {deptInfo?.label}
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
