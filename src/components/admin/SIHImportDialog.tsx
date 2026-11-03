"use client";

import { useState, useCallback, useEffect } from "react";
import {
  FileText,
  Download,
  RefreshCw,
  X,
  Loader2,
  Eye,
  Edit3,
  FileUp,
  CheckCircle2,
  AlertCircle,
  BarChart2,
} from "lucide-react";
import { importSIHProblemStatements, getSIHProblemStatementsPreview } from "@/app/actions/import-sih-problem-statements";

interface SIHImportDialogProps {
  onImportComplete: () => void;
  onClose: () => void;
}

interface PreviewData {
  total: number;
  byDepartment: Record<string, number>;
  byCategory: Record<string, number>;
  statements: Array<{
    internalReference: string;
    sihPsNumber: string;
    title: string;
    department: string;
    category: string;
    organization: string;
  }>;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ internalReference: string; error: string }>;
  details: Array<{ internalReference: string; sihPsNumber: string; id: string; action: "inserted" | "skipped" }>;
}

export function SIHImportDialog({
  onImportComplete,
  onClose,
}: SIHImportDialogProps) {
  const [stage, setStage] = useState<"preview" | "importing" | "complete" | "error">("preview");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
  }, []);

  const loadPreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const data = await getSIHProblemStatementsPreview();
      setPreviewData(data);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    setStage("importing");
    setProgress(10);
    setError(null);

    try {
      const result = await importSIHProblemStatements({});
      setProgress(100);
      setImportResult(result);
      
      if (result.success) {
        setStage("complete");
      } else {
        setStage("error");
        setError(`Import completed with ${result.errors.length} error(s). ${result.imported} imported, ${result.skipped} skipped.`);
      }
    } catch (err: unknown) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  const handleClose = () => {
    setStage("preview");
    setProgress(0);
    setError(null);
    setImportResult(null);
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (stage === "preview") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-[#0a0a0c] border border-border-color rounded-xl w-full max-w-4xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-text-primary max-h-[90vh] flex flex-col">
          <div className="flex items-start justify-between border-b border-border-color pb-4 mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent-secondary/15 border border-accent-secondary/40 text-accent-secondary">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-heading text-lg uppercase tracking-wider text-text-primary m-0">
                  Import SIH 2025 Problem Statements
                </h3>
                <p className="text-xs text-text-secondary m-0 mt-0.5">
                  Import all 30 official SIH 2025 problem statements from the case study booklet.
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              type="button"
              className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {previewError && (
            <div className="border border-status-error/40 bg-status-error/10 px-4 py-3 rounded mb-4 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-status-error" />
              <span className="text-xs text-status-error">{previewError}</span>
            </div>
          )}

          {loadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-accent-secondary" />
              <span className="ml-2 text-xs text-text-secondary">Loading preview...</span>
            </div>
          ) : previewData ? (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="border border-border-color bg-surface-color/50 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">Total Statements</p>
                  <p className="font-heading text-2xl text-accent-tertiary m-0 mt-1">{previewData.total}</p>
                </div>
                <div className="border border-border-color bg-surface-color/50 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">Software</p>
                  <p className="font-heading text-2xl text-status-success m-0 mt-1">{previewData.byCategory["Software"] || 0}</p>
                </div>
                <div className="border border-border-color bg-surface-color/50 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">Hardware</p>
                  <p className="font-heading text-2xl text-accent-primary m-0 mt-1">{previewData.byCategory["Hardware"] || 0}</p>
                </div>
                <div className="border border-border-color bg-surface-color/50 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">Departments</p>
                  <p className="font-heading text-2xl text-accent-secondary m-0 mt-1">{Object.keys(previewData.byDepartment).length}</p>
                </div>
              </div>

              {/* Department Breakdown */}
              <div className="border border-border-color/50 rounded-lg p-4 bg-surface-color/30">
                <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-2">Department Distribution</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(previewData.byDepartment).map(([dept, count]) => (
                    <span key={dept} className="px-2 py-1 rounded bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary font-mono text-[10px] font-bold">
                      {dept}: {count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Statement List Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">Problem Statements Preview</p>
                  <p className="text-[10px] text-text-secondary/60">Showing all {previewData.total} statements</p>
                </div>
                <div className="max-h-64 overflow-y-auto border border-border-color rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border-color bg-surface-color/50">
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-text-secondary">Ref</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-text-secondary">SIH PS No.</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-text-secondary">Title</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-text-secondary">Dept</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-text-secondary">Category</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-text-secondary">Organization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.statements.map((stmt) => (
                        <tr key={stmt.sihPsNumber} className="border-b border-border-color/50 hover:bg-surface-color/30">
                          <td className="px-3 py-2 font-mono text-accent-secondary">{stmt.internalReference}</td>
                          <td className="px-3 py-2 font-mono text-text-primary">{stmt.sihPsNumber}</td>
                          <td className="px-3 py-2 text-text-primary truncate max-w-xs">{stmt.title}</td>
                          <td className="px-3 py-2 text-text-secondary">{stmt.department}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${stmt.category === "Software" ? "bg-status-success/10 text-status-success" : "bg-accent-primary/10 text-accent-primary"}`}>
                              {stmt.category}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-text-secondary/60 truncate max-w-xs">{stmt.organization}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Notes */}
              <div className="border border-status-warning/40 bg-status-warning/10 p-3 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-status-warning" />
                  <div className="text-xs text-status-warning space-y-1">
                    <p className="font-bold">Import Behavior:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>Each statement becomes an independent database record</li>
                      <li>SIH PS number used as unique identifier (prevents duplicates)</li>
                      <li>All records imported as DRAFT status</li>
                      <li>Re-importing will skip existing records</li>
                      <li>Admin-edited descriptions/status preserved on re-import</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-border-color pt-4 flex-shrink-0">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadPreview}
                      className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary"
                    >
                      <RefreshCw size={14} />
                      <span>Refresh Preview</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClose}
                      type="button"
                      className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      className="px-5 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90"
                    >
                      Import All 30 Statements
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-center">
              <p className="text-text-secondary">No preview data available</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (stage === "importing") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
        <div className="bg-[#0a0a0c] border border-border-color rounded-xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-text-primary">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 size={24} className="animate-spin text-accent-secondary" />
          </div>
          <h3 className="font-heading text-lg uppercase tracking-wider text-text-primary m-0 text-center mb-1">
            Importing SIH Problem Statements
          </h3>
          <p className="text-xs text-text-secondary text-center mb-6">
            Creating {SIH_PROBLEM_STATEMENTS.length} individual records...
          </p>
          <div className="w-full bg-surface-color-light rounded-full h-2 mb-6 overflow-hidden">
            <div
              className="bg-accent-secondary h-full w-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-text-secondary text-center">{progress}%</p>
        </div>
      </div>
    );
  }

  if (stage === "complete" || stage === "error") {
    const isError = stage === "error";
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
        <div className="bg-[#0a0a0c] border border-border-color rounded-xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-text-primary">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className={`p-3 rounded-full ${isError ? "bg-status-error/15 border border-status-error/40 text-status-error" : "bg-status-success/15 border border-status-success/40 text-status-success"}`}>
              {isError ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
            </div>
          </div>
          <h3 className="font-heading text-lg uppercase tracking-wider text-text-primary m-0 text-center mb-1">
            {isError ? "Import Completed with Errors" : "Import Successful"}
          </h3>
          <p className="text-xs text-text-secondary text-center mb-6">
            {error || `${importResult?.imported || 0} statements imported, ${importResult?.skipped || 0} skipped`}
          </p>

          {importResult && (
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-status-success/10 border border-status-success/30">
                  <p className="font-heading text-xl text-status-success m-0">{importResult.imported}</p>
                  <p className="text-[10px] text-text-secondary m-0">Imported</p>
                </div>
                <div className="p-2 rounded bg-status-warning/10 border border-status-warning/30">
                  <p className="font-heading text-xl text-status-warning m-0">{importResult.skipped}</p>
                  <p className="text-[10px] text-text-secondary m-0">Skipped</p>
                </div>
                <div className="p-2 rounded bg-status-error/10 border border-status-error/30">
                  <p className="font-heading text-xl text-status-error m-0">{importResult.errors.length}</p>
                  <p className="text-[10px] text-text-secondary m-0">Errors</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="border border-status-error/40 bg-status-error/10 rounded p-3">
                  <p className="text-[10px] font-bold text-status-error mb-2">Errors:</p>
                  <ul className="text-xs text-status-error space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx} className="font-mono">{err.internalReference}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={handleClose}
              type="button"
              className="px-4 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const SIH_PROBLEM_STATEMENTS = [
  { internalReference: "CS-01", sihPsNumber: "SIH25001" },
  { internalReference: "CS-02", sihPsNumber: "SIH25002" },
  { internalReference: "CS-03", sihPsNumber: "SIH25004" },
  { internalReference: "CS-04", sihPsNumber: "SIH25013" },
  { internalReference: "CS-05", sihPsNumber: "SIH25022" },
  { internalReference: "CS-06", sihPsNumber: "SIH25029" },
  { internalReference: "CS-07", sihPsNumber: "SIH25038" },
  { internalReference: "CS-08", sihPsNumber: "SIH25039" },
  { internalReference: "CS-09", sihPsNumber: "SIH25040" },
  { internalReference: "CS-10", sihPsNumber: "SIH25050" },
  { internalReference: "CS-11", sihPsNumber: "SIH25071" },
  { internalReference: "CS-12", sihPsNumber: "SIH25099" },
  { internalReference: "CS-13", sihPsNumber: "SIH25102" },
  { internalReference: "CS-14", sihPsNumber: "SIH25104" },
  { internalReference: "CS-15", sihPsNumber: "SIH25092" },
  { internalReference: "EC-01", sihPsNumber: "SIH25051" },
  { internalReference: "EC-02", sihPsNumber: "SIH25021" },
  { internalReference: "EC-03", sihPsNumber: "SIH25020" },
  { internalReference: "EC-04", sihPsNumber: "SIH25036" },
  { internalReference: "EC-05", sihPsNumber: "SIH25063" },
  { internalReference: "EC-06", sihPsNumber: "SIH25062" },
  { internalReference: "EC-07", sihPsNumber: "SIH25064" },
  { internalReference: "EC-08", sihPsNumber: "SIH25047" },
  { internalReference: "EC-09", sihPsNumber: "SIH25077" },
  { internalReference: "EC-10", sihPsNumber: "SIH25043" },
  { internalReference: "ME-01", sihPsNumber: "SIH25053" },
  { internalReference: "ME-02", sihPsNumber: "SIH25003" },
  { internalReference: "ME-03", sihPsNumber: "SIH25072" },
  { internalReference: "CE-01", sihPsNumber: "SIH25065" },
  { internalReference: "CE-02", sihPsNumber: "SIH25090" },
];

export default SIHImportDialog;