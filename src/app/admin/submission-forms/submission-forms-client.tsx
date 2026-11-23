"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Edit3,
  Play,
  Pause,
  Archive,
  FileText,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import type { ProjectSubmissionForm } from "@/app/actions/project-submission-forms";
import {
  publishProjectSubmissionForm,
  unpublishProjectSubmissionForm,
  archiveProjectSubmissionForm,
  deleteProjectSubmissionForm,
} from "@/app/actions/project-submission-forms";

interface Props {
  initialForms: ProjectSubmissionForm[];
  initialError?: string;
}

export default function SubmissionFormsClient({
  initialForms,
  initialError,
}: Props) {
  const router = useRouter();
  const [forms, setForms] = useState<ProjectSubmissionForm[]>(initialForms || []);
  const [error, setError] = useState<string | null>(initialError || null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const handlePublish = async (formId: string) => {
    setActionLoadingId(formId);
    try {
      const updated = await publishProjectSubmissionForm(formId);
      setForms((prev) => prev.map((f) => (f.id === formId ? updated : f)));
      showNotification("success", "Submission form published live.");
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Failed to publish form."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnpublish = async (formId: string) => {
    setActionLoadingId(formId);
    try {
      const updated = await unpublishProjectSubmissionForm(formId);
      setForms((prev) => prev.map((f) => (f.id === formId ? updated : f)));
      showNotification("success", "Form reverted to draft (unpublished).");
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Failed to unpublish form."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleArchive = async (formId: string) => {
    setActionLoadingId(formId);
    try {
      const updated = await archiveProjectSubmissionForm(formId);
      setForms((prev) => prev.map((f) => (f.id === formId ? updated : f)));
      showNotification("success", "Form archived.");
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Failed to archive form."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (formId: string) => {
    setActionLoadingId(formId);
    try {
      await deleteProjectSubmissionForm(formId);
      setForms((prev) => prev.filter((f) => f.id !== formId));
      setConfirmDeleteId(null);
      showNotification("success", "Submission form permanently deleted.");
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Failed to delete form."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8 font-tech max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Top Header */}
      <div className="border-b border-border-color pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
              Admin HQ // Form Builder
            </p>
            <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
              Project Submissions
            </h1>
            <p className="font-tech text-text-secondary text-xs mt-2 max-w-2xl">
              Build dynamic submission forms for team deliverables. Configure sections, questions, file upload constraints, and release schedules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/submission-forms/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 shadow-[0_0_18px_rgba(255,0,127,0.28)]"
            >
              <Plus size={15} />
              <span>Create Form</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs font-tech flex items-center justify-between gap-3 ${
            notification.type === "success"
              ? "bg-status-success/10 border-status-success/40 text-status-success"
              : "bg-status-error/10 border-status-error/40 text-status-error"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs uppercase font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-status-error/15 border border-status-error text-status-error font-tech text-xs rounded-xl flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {forms.length === 0 ? (
            <div className="border border-dashed border-border-color bg-surface-color/30 rounded-xl p-16 text-center">
              <FileText className="w-12 h-12 text-accent-secondary mx-auto mb-4 opacity-70" />
              <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                No submission forms yet
              </h3>
              <p className="text-xs text-text-secondary mt-2">
                Create your first submission form to begin collecting team deliverables.
              </p>
              <Link
                href="/admin/submission-forms/new"
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 border border-accent-secondary/40 text-accent-secondary rounded text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/10 transition-colors"
              >
                <Plus size={14} />
                <span>Create Form Now</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {forms.map((form) => {
                const configSections = (form.form_config as any)?.sections || [];
                const totalQuestions = configSections.reduce(
                  (acc: number, s: any) => acc + (s.questions?.length || 0),
                  0
                );
                const isLoading = actionLoadingId === form.id;
                const isConfirmingDelete = confirmDeleteId === form.id;

                return (
                  <div
                    key={form.id}
                    className="glass-panel p-5 sm:p-6 border border-border-color rounded-xl hover:border-accent-secondary/50 transition-colors bg-surface-color/40 relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                              form.form_status === "published"
                                ? "bg-status-success/15 border-status-success/40 text-status-success"
                                : form.form_status === "archived"
                                ? "bg-text-secondary/15 border-border-color text-text-secondary"
                                : "bg-amber-500/15 border-amber-500/40 text-amber-400"
                            }`}
                          >
                            {form.form_status.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-surface-color border border-border-color text-text-secondary font-mono">
                            v{form.version || 1}
                          </span>
                        </div>
                        <h3 className="font-heading text-lg sm:text-xl text-text-primary uppercase m-0 font-bold">
                          {form.title}
                        </h3>
                        {form.description && (
                          <p className="text-xs text-text-secondary m-0 mt-1.5 line-clamp-2 font-sans">
                            {form.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/admin/submission-forms/${form.id}/edit`}
                          className="px-3 py-1.5 border border-accent-secondary/40 text-accent-secondary rounded text-[11px] font-bold uppercase tracking-wider hover:bg-accent-secondary/10 flex items-center gap-1.5 transition-colors"
                        >
                          <Edit3 size={13} />
                          <span>Builder</span>
                        </Link>
                        <Link
                          href={`/admin/submission-forms/${form.id}/submissions`}
                          className="px-3 py-1.5 border border-border-color rounded text-[11px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:border-border-color-light flex items-center gap-1.5 transition-colors"
                        >
                          <FileText size={13} />
                          <span>Submissions</span>
                        </Link>
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px] font-mono">
                      <div className="border border-border-color/60 rounded-lg p-2.5 bg-surface-color/30 text-center">
                        <span className="block text-text-secondary/70 text-[9px] uppercase font-tech font-bold mb-0.5">
                          Sections
                        </span>
                        <span className="font-bold text-text-primary">
                          {configSections.length}
                        </span>
                      </div>
                      <div className="border border-border-color/60 rounded-lg p-2.5 bg-surface-color/30 text-center">
                        <span className="block text-text-secondary/70 text-[9px] uppercase font-tech font-bold mb-0.5">
                          Questions
                        </span>
                        <span className="font-bold text-text-primary">
                          {totalQuestions}
                        </span>
                      </div>
                      <div className="border border-border-color/60 rounded-lg p-2.5 bg-surface-color/30 text-center">
                        <span className="block text-text-secondary/70 text-[9px] uppercase font-tech font-bold mb-0.5">
                          Draft Mode
                        </span>
                        <span className="font-bold text-accent-secondary">
                          {form.allow_draft_before_open ? "Allowed" : "Instant"}
                        </span>
                      </div>
                      <div className="border border-border-color/60 rounded-lg p-2.5 bg-surface-color/30 text-center">
                        <span className="block text-text-secondary/70 text-[9px] uppercase font-tech font-bold mb-0.5">
                          Edit After Submit
                        </span>
                        <span className="font-bold text-text-primary">
                          {form.allow_edit_after_submit ? "Yes" : "Locked"}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 pt-3.5 border-t border-border-color/40 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {form.form_status === "draft" && (
                          <button
                            onClick={() => handlePublish(form.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-status-success/15 border border-status-success/40 text-status-success rounded text-[10px] font-bold uppercase tracking-wider hover:bg-status-success/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Play size={12} />
                            <span>{isLoading ? "Publishing..." : "Publish Live"}</span>
                          </button>
                        )}

                        {form.form_status === "published" && (
                          <button
                            onClick={() => handleUnpublish(form.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Pause size={12} />
                            <span>{isLoading ? "Updating..." : "Unpublish (Draft)"}</span>
                          </button>
                        )}

                        {form.form_status !== "archived" && (
                          <button
                            onClick={() => handleArchive(form.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 border border-border-color text-text-secondary rounded text-[10px] font-bold uppercase tracking-wider hover:text-text-primary hover:bg-surface-color transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Archive size={12} />
                            <span>Archive</span>
                          </button>
                        )}
                      </div>

                      {/* Delete confirmation */}
                      <div>
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-2 animate-fade-in">
                            <span className="text-[10px] text-status-error font-bold uppercase">
                              Confirm delete?
                            </span>
                            <button
                              onClick={() => handleDelete(form.id)}
                              disabled={isLoading}
                              className="px-2.5 py-1 bg-status-error text-white rounded text-[10px] font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
                            >
                              Yes, Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 border border-border-color text-text-secondary rounded text-[10px] font-bold uppercase tracking-wider hover:text-text-primary"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(form.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 border border-status-error/30 text-status-error/80 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-status-error/15 hover:text-status-error transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Info Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel border border-border-color rounded-xl p-5 bg-surface-color/30 space-y-3">
            <h4 className="font-heading text-xs uppercase tracking-wider text-accent-secondary m-0 flex items-center gap-2">
              <Layers size={14} />
              <span>Project Deliverables Workflow</span>
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed font-sans m-0">
              When published, this dynamic form becomes visible to team captains and squad members under their Deliverables submission portal.
            </p>
            <div className="pt-2 border-t border-border-color/40">
              <Link
                href="/team/submission"
                target="_blank"
                className="text-xs text-accent-primary hover:underline font-bold uppercase tracking-wider flex items-center gap-1"
              >
                <span>Preview Team View</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>

          <div className="glass-panel border border-border-color rounded-xl p-5 bg-surface-color/30 space-y-3">
            <h4 className="font-heading text-xs uppercase tracking-wider text-accent-secondary m-0 flex items-center gap-2">
              <HelpCircle size={14} />
              <span>Supported Question Formats</span>
            </h4>
            <ul className="space-y-1.5 text-xs text-text-secondary font-sans m-0 p-0 list-none">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary shrink-0" />
                <span>Problem Statement Reference Selection</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary shrink-0" />
                <span>Text / Problem & Proposed Solution</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary shrink-0" />
                <span>Direct PPTX / PDF File Uploads</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary shrink-0" />
                <span>Live Repository & Demo URLs</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
