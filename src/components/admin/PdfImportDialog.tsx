"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileText,
  Download,
  RefreshCw,
  X,
  Loader2,
  Eye,
  Edit3,
  FileUp,
} from "lucide-react";
import { importPdfExtract, importPdfContentWithoutStorage } from "@/app/actions/pdf-import";

interface PdfImportDialogProps {
  activityId: string;
  onImportComplete: (itemId: string) => void;
  onClose: () => void;
}

export function PdfImportDialog({
  activityId,
  onImportComplete,
  onClose,
}: PdfImportDialogProps) {
  const [stage, setStage] = useState<
    "upload" | "extracting" | "review" | "saving"
  >("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [filename, setFilename] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewDomain, setReviewDomain] = useState("");
  const [storageUploaded, setStorageUploaded] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Invalid file format. Only PDF files are accepted.");
      return;
    }
    if (selectedFile.size === 0) {
      setError("The PDF file is empty.");
      return;
    }
    const maxSize = 50 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError("File exceeds maximum allowed size of 50MB.");
      return;
    }
    setFile(selectedFile);
    fileRef.current = selectedFile;
    setFilename(selectedFile.name);
    setFileSize(selectedFile.size);
    setError(null);
    setStage("upload");
  };

  const handleExtract = async () => {
    if (!fileRef.current) return;
    setStage("extracting");
    setProgress(10);
    setError(null);

    try {
      const arrayBuffer = await fileRef.current.arrayBuffer();

      setProgress(40);
      const result = await importPdfExtract({
        fileBuffer: arrayBuffer,
        fileName: fileRef.current.name,
        fileSize: fileRef.current.size,
        mimeType: fileRef.current.type,
      });

      setProgress(80);
      setExtractedText(result.text);
      setPageCount(result.pageCount);
      setFilename(result.filename);
      setFileSize(result.size);

      // Auto-populate review fields from extracted text
      const lines = result.text.split("\n").filter((l) => l.trim());
      const firstLine = lines[0] || "";
      setReviewTitle(firstLine.length > 0 && firstLine.length < 100 ? firstLine : "");
      setReviewBody(result.text);
      setReviewSummary("");
      setReviewDomain("");

      setProgress(100);
      setStage("review");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to extract text from PDF."
      );
      setStage("upload");
    }
  };

  const handleRetry = () => {
    setError(null);
    setStage("upload");
  };

  const handleBackToUpload = () => {
    setStage("upload");
    setError(null);
  };

  const handleSave = async () => {
    if (!fileRef.current) return;
    setStage("saving");
    setError(null);

    try {
      const arrayBuffer = await fileRef.current.arrayBuffer();

      const result = await importPdfContentWithoutStorage({
        fileBuffer: arrayBuffer,
        fileName: fileRef.current.name,
        fileSize: fileRef.current.size,
        mimeType: fileRef.current.type,
        activityId,
        title: reviewTitle.trim() || undefined,
        summary: reviewSummary.trim() || undefined,
        body: reviewBody.trim(),
        domain: reviewDomain.trim() || undefined,
      });

      setItemId(result.itemId);
      setStorageUploaded(result.storageUploaded);
      setStage("saving");

      // Small delay to show saving state, then complete
      setTimeout(() => {
        onImportComplete(result.itemId);
        onClose();
      }, 500);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save imported content."
      );
      setStage("review");
    }
  };

  const handleClose = () => {
    setStage("upload");
    setFile(null);
    fileRef.current = null;
    setFilename("");
    setFileSize(0);
    setError(null);
    setExtractedText("");
    setPageCount(0);
    setProgress(0);
    setReviewTitle("");
    setReviewBody("");
    setReviewSummary("");
    setReviewDomain("");
    setDragActive(false);
    setStorageUploaded(false);
    setItemId(null);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const formatBytes = (size: number): string => {
    if (!size) return "0 B";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isReviewComplete =
    stage === "review" &&
    reviewBody.trim().length > 0;

  if (stage === "upload") {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
      >
        <div
          className="bg-[#0a0a0c] border border-border-color rounded-xl w-full max-w-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-text-primary"
        >
          <div className="flex items-start justify-between border-b border-border-color pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent-secondary/15 border border-accent-secondary/40 text-accent-secondary">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-heading text-lg uppercase tracking-wider text-text-primary m-0">
                  Import from PDF
                </h3>
                <p className="text-xs text-text-secondary m-0 mt-0.5">
                  Extract text from a PDF to create a problem statement.
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

          {error && (
            <div className="border border-status-error/40 bg-status-error/10 px-4 py-3 rounded mb-4 flex items-start gap-2">
              <X size={16} className="shrink-0 mt-0.5 text-status-error" />
              <span className="text-xs text-status-error">{error}</span>
            </div>
          )}

          <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragActive
              ? "border-accent-secondary bg-accent-secondary/10"
              : "border-border-color bg-surface-color/30 hover:border-accent-secondary/50"
          }`}>
            <div className="flex flex-col items-center gap-3">
              {file ? (
                <>
                  <div className="p-3 rounded-lg border border-border-color bg-[#0a0a0c]">
                    <FileUp size={24} className="text-accent-secondary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-text-primary font-medium truncate max-w-xs">
                      {filename}
                    </p>
                    <p className="text-[10px] text-text-secondary">
                      {formatBytes(fileSize)} · PDF
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      fileRef.current = null;
                      setFilename("");
                      setFileSize(0);
                    }}
                    className="text-xs text-status-error hover:text-status-error underline"
                  >
                    Remove file
                  </button>
                  <button
                    onClick={handleExtract}
                    disabled={!file}
                    className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 shadow-[0_0_18px_rgba(255,0,127,0.28)] disabled:opacity-50"
                  >
                    <Loader2 size={14} className={!file ? "hidden" : ""} />
                    <span>Extract Text</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-lg border border-border-color bg-[#0a0a0c]">
                    <FileUp size={32} className="text-accent-secondary" />
                  </div>
                  <p className="text-sm text-text-primary font-medium">
                    Drag and drop a PDF file here
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    or click to browse
                  </p>
                  <button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".pdf";
                      input.onchange = (e) => {
                        const f = (e.target as HTMLInputElement).files?.[0];
                        if (f) handleFileSelect(f);
                      };
                      input.click();
                    }}
                    className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 border border-accent-secondary/40 text-accent-secondary rounded text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/10 transition-colors"
                  >
                    <FileUp size={14} />
                    <span>Browse files</span>
                  </button>
                  <p className="text-[10px] text-text-secondary/60 mt-3">
                    PDF only · Max 50MB
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={handleClose}
              type="button"
              className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "extracting") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
        <div className="bg-[#0a0a0c] border border-border-color rounded-xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-text-primary">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 size={24} className="animate-spin text-accent-secondary" />
          </div>
          <h3 className="font-heading text-lg uppercase tracking-wider text-text-primary m-0 text-center mb-1">
            Extracting text
          </h3>
          <p className="text-xs text-text-secondary text-center mb-6">
            Processing PDF pages… {pageCount > 0 ? `${pageCount} page(s)` : ""}
          </p>
          <div className="w-full bg-surface-color-light rounded-full h-2 mb-6 overflow-hidden">
            <div
              className="bg-accent-secondary h-full w-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleClose}
              type="button"
              className="px-4 py-2 text-text-secondary text-xs uppercase font-bold hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "review") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-[#0a0a0c] border border-border-color rounded-xl w-full max-w-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-text-primary max-h-[90vh] flex flex-col">
          <div className="flex items-start justify-between border-b border-border-color pb-4 mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent-secondary/15 border border-accent-secondary/40 text-accent-secondary">
                <Eye size={20} />
              </div>
              <div>
                <h3 className="font-heading text-lg uppercase tracking-wider text-text-primary m-0">
                  Review &amp; Edit
                </h3>
                <p className="text-xs text-text-secondary m-0 mt-0.5">
                  Review extracted text before saving.
                </p>
              </div>
            </div>
            <button
              onClick={handleBackToUpload}
              type="button"
              className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 mb-4">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span className="px-2 py-1 rounded bg-surface-color-light border border-border-color text-text-secondary">
                {filename}
              </span>
              <span className="px-2 py-1 rounded bg-surface-color-light border border-border-color text-text-secondary">
                {formatBytes(fileSize)}
              </span>
              <span className="px-2 py-1 rounded bg-surface-color-light border border-border-color text-text-secondary">
                {pageCount} page{pageCount === 1 ? "" : "s"}
              </span>
              <span
                className={`px-2 py-1 rounded border ${
                  extractedText.trim().length > 0
                    ? "bg-status-success/10 text-status-success border-status-success/40"
                    : "bg-surface-color-light text-text-secondary border-border-color"
                }`}
              >
                Text extracted
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                Title
              </label>
              <input
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Problem statement title"
                className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                Domain / Track
              </label>
              <input
                value={reviewDomain}
                onChange={(e) => setReviewDomain(e.target.value)}
                placeholder="e.g. Artificial Intelligence"
                className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                Short Description
              </label>
              <textarea
                rows={2}
                value={reviewSummary}
                onChange={(e) => setReviewSummary(e.target.value)}
                placeholder="Short team-facing summary"
                className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                Full Problem Statement
              </label>
              <textarea
                rows={12}
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                placeholder="Extracted PDF content…"
                className="w-full px-3 py-3 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none font-mono leading-relaxed"
              />
            </div>

            <div className="border border-border-color/50 rounded-lg p-3 bg-surface-color/30">
              <p className="text-[10px] text-text-secondary m-0">
                Original PDF content has been preserved in the body field above.
                Edit as needed before saving.
              </p>
            </div>
          </div>

          <div className="border-t border-border-color pt-4 flex-shrink-0">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary"
                >
                  <RefreshCw size={14} />
                  <span>Reprocess PDF</span>
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
                  onClick={handleSave}
                  disabled={!isReviewComplete}
                  className="px-5 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90 disabled:opacity-50"
                >
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "saving") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
        <div className="bg-[#0a0a0c] border border-border-color rounded-xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-text-primary">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 size={24} className="animate-spin text-accent-secondary" />
          </div>
          <h3 className="font-heading text-lg uppercase tracking-wider text-text-primary m-0 text-center mb-1">
            Saving import
          </h3>
          <p className="text-xs text-text-secondary text-center">
            Creating problem statement draft…
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default PdfImportDialog;
