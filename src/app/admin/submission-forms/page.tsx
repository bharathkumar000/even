import { getSubmissionForms } from "@/app/actions/submission-forms";
import { requireAdmin } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Edit3, Copy, Play, Pause, Timer, RefreshCw, FileText } from "lucide-react";

interface FormStatusBadgeProps {
  status: string;
}

function FormStatusBadge({ status }: FormStatusBadgeProps) {
  const variants: Record<string, string> = {
    draft: "bg-surface-color-light border-border-color text-text-secondary",
    scheduled: "bg-accent-secondary/15 border-accent-secondary/40 text-accent-secondary",
    published: "bg-status-success/15 border-status-success/40 text-status-success",
    unpublished: "bg-status-warning/15 border-status-warning/40 text-status-warning",
    archived: "bg-text-secondary/10 border-text-secondary/40 text-text-secondary",
  };

  return (
    <span
      className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border ${
        variants[status] || variants.draft
      }`}
    >
      {status.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

export default async function SubmissionFormsPage() {
  await requireAdmin();

  const { forms, error } = await getSubmissionForms();

  if (error) {
    redirect("/admin?error=" + encodeURIComponent(error));
  }

  return (
    <div className="space-y-8 font-tech">
      <div className="border-b border-border-color pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
              Admin HQ // Form Builder
            </p>
            <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
              Submission Forms
            </h1>
            <p className="font-tech text-text-secondary text-xs mt-2 max-w-2xl">
              Build dynamic submission forms for team deliverables. Configure sections, questions, validation, and publishing schedules.
            </p>
          </div>

          <Link
            href="/admin/submission-forms/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 shadow-[0_0_18px_rgba(255,0,127,0.28)]"
          >
            <Plus size={15} />
            <span>Create Form</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-status-error/15 border border-status-error text-status-error font-tech text-xs rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {forms.length === 0 ? (
            <div className="border border-dashed border-border-color bg-surface-color/30 rounded-lg p-16 text-center">
              <FileText className="w-12 h-12 text-accent-secondary mx-auto mb-4" />
              <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                No submission forms yet
              </h3>
              <p className="text-xs text-text-secondary mt-2">
                Create your first submission form to begin collecting team deliverables.
              </p>
              <Link
                href="/admin/submission-forms/new"
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 border border-accent-secondary/40 text-accent-secondary rounded text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
              >
                <Plus size={14} />
                Create Form
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="glass-panel p-5 border border-border-color rounded-lg hover:border-accent-secondary/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FormStatusBadge status={form.form_status} />
                        {form.submission_state !== "not_open" && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-surface-color border border-border-color text-text-secondary">
                            {form.submission_state.replace(/_/g, " ").toUpperCase()}
                          </span>
                        )}
                      </div>
                      <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                        {form.title}
                      </h3>
                      {form.description && (
                        <p className="text-[11px] text-text-secondary m-0 mt-1 line-clamp-2">
                          {form.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/submission-forms/${form.id}`}
                        className="px-3 py-1.5 border border-accent-secondary/40 text-accent-secondary rounded text-[10px] font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </Link>
                      <Link
                        href={`/admin/submission-forms/${form.id}/submissions`}
                        className="px-3 py-1.5 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
                      >
                        <FileText size={13} />
                        <span>Submissions</span>
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px]">
                    <div className="border border-border-color rounded p-2 text-center">
                      <span className="block text-text-secondary mb-0.5">Round</span>
                      <span className="block font-bold text-text-primary">{form.round_id || "Not set"}</span>
                    </div>
                    <div className="border border-border-color rounded p-2 text-center">
                      <span className="block text-text-secondary mb-0.5">Timezone</span>
                      <span className="block font-bold text-text-primary">{form.timezone}</span>
                    </div>
                    <div className="border border-border-color rounded p-2 text-center">
                      <span className="block text-text-secondary mb-0.5">Max Marks</span>
                      <span className="block font-bold text-text-primary">{form.max_marks ?? "—"}</span>
                    </div>
                  </div>

                  {form.submission_open_at || form.submission_close_at && (
                    <div className="mt-3 border border-border-color rounded bg-surface-color/30 p-3">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-text-secondary">Submission Window:</span>
                        <span className="text-text-primary font-mono">
                          {form.submission_open_at ? new Date(form.submission_open_at).toLocaleString() : "—"}
                          {" → "}
                          {form.submission_close_at ? new Date(form.submission_close_at).toLocaleString() : "—"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-2">
                    {form.form_status === "draft" && (
                      <Link
                        href={`/admin/submission-forms/${form.id}/publish`}
                        className="px-3 py-1.5 border border-status-success/40 text-status-success rounded text-[10px] font-bold uppercase tracking-wider hover:bg-status-success/10"
                      >
                        <Play size={13} />
                        <span>Publish</span>
                      </Link>
                    )}
                    {form.form_status === "published" && (
                      <>
                        <Link
                          href={`/admin/submission-forms/${form.id}/unpublish`}
                          className="px-3 py-1.5 border border-status-warning/40 text-status-warning rounded text-[10px] font-bold uppercase tracking-wider hover:bg-status-warning/10"
                        >
                          <Pause size={13} />
                          <span>Unpublish</span>
                        </Link>
                        <Link
                          href={`/admin/submission-forms/${form.id}/schedule`}
                          className="px-3 py-1.5 border border-accent-secondary/40 text-accent-secondary rounded text-[10px] font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
                        >
                          <Timer size={13} />
                          <span>Schedule</span>
                        </Link>
                      </>
                    )}
                    <Link
                      href={`/admin/submission-forms/${form.id}/duplicate`}
                      className="px-3 py-1.5 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
                    >
                      <Copy size={13} />
                      <span>Duplicate</span>
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm("Delete this form? This cannot be undone.")) {
                          // Delete action would go here
                        }
                      }}
                      className="px-3 py-1.5 border border-status-error/40 text-status-error rounded text-[10px] font-bold uppercase tracking-wider hover:bg-status-error/10"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="border border-border-color rounded-lg p-4 bg-surface-color/30">
            <h4 className="font-heading text-xs uppercase tracking-wider text-accent-secondary mb-3">
              Quick Actions
            </h4>
            <Link
              href="/admin/submission-forms/new"
              className="w-full flex items-center gap-2 px-3 py-2 border border-accent-secondary/40 rounded text-accent-secondary text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/10 transition-colors"
            >
              <Plus size={14} />
              <span>New Form</span>
            </Link>
          </div>

          <div className="border border-border-color rounded-lg p-4 bg-surface-color/30">
            <h4 className="font-heading text-xs uppercase tracking-wider text-accent-secondary mb-3">
              Question Types
            </h4>
            <ul className="space-y-1 text-[10px] text-text-secondary">
              <li className="flex items-center gap-1">• Short Answer</li>
              <li className="flex items-center gap-1">• Long Answer</li>
              <li className="flex items-center gap-1">• Single Choice</li>
              <li className="flex items-center gap-1">• Multiple Choice</li>
              <li className="flex items-center gap-1">• Dropdown</li>
              <li className="flex items-center gap-1">• Yes / No</li>
              <li className="flex items-center gap-1">• Checkbox</li>
              <li className="flex items-center gap-1">• Number</li>
              <li className="flex items-center gap-1">• Email / URL</li>
              <li className="flex items-center gap-1">• Date / Time</li>
              <li className="flex items-center gap-1">• File / Image Upload</li>
              <li className="flex items-center gap-1">• Rating / Scale</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
