import { getAllSubmissions } from "@/app/actions/team-submissions";
import { getAttachmentDownloadUrl } from "@/app/actions/team-submissions";
import { getProjectSubmissionFormById } from "@/app/actions/project-submission-forms";
import { requireAdmin } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, FileText, X, Eye, Copy, ExternalLink } from "lucide-react";

interface SubmissionRow {
  id: string;
  form_id: string;
  team_id: string;
  version: number;
  status: string;
  answers: Record<string, unknown>;
  file_references: Array<{
    question_id: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    size: number;
  }>;
  submitted_by: string | null;
  submitted_at: string;
  reference_number: string;
  teams?: {
    id: string;
    name: string;
    track: string | null;
    leader_name: string | null;
  };
  profiles?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  await requireAdmin();

  const { id, submissionId } = await params;

  const { submissions } = await getAllSubmissions(id);
  const submission: SubmissionRow | undefined = (submissions || []).find((s: any) => s.id === submissionId) as any;

  if (!submission) {
    redirect(`/admin/submission-forms/${id}/submissions?error=not_found`);
  }

  // Load the form config to resolve question titles and types for the detail view.
  const questionMap: Record<string, { title: string; question_type: string | null }> = {};
  try {
    const { form } = await getProjectSubmissionFormById(id);
    const sections = (form?.form_config as any)?.sections || [];
    for (const section of sections) {
      const questions = Array.isArray(section.questions) ? section.questions : [];
      for (const q of questions) {
        questionMap[q.id] = {
          title: q.title ?? q.label ?? `Question ${String(q.id).slice(-4).toUpperCase()}`,
          question_type: q.question_type ?? q.type ?? null,
        };
      }
    }
  } catch {
    // Form config unavailable — fall back to question IDs.
  }

  function getSafeUrl(value: string): string | null {
    try {
      const url = new URL(value.trim());
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.toString();
      }
      return null;
    } catch {
      return null;
    }
  }

  return (
    <div className="space-y-8 font-tech">
      {/* Header */}
      <div className="border-b border-border-color pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/admin/submission-forms"
              className="text-[10px] text-accent-secondary hover:text-accent-primary transition-colors font-tech uppercase font-bold tracking-wider"
            >
              ← Back to All Submissions
            </Link>
            <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 mt-2">
              Submission Details
            </h1>
            <p className="font-tech text-text-secondary text-xs mt-2 max-w-2xl">
              Reference: <span className="font-mono font-bold text-text-primary">{submission.reference_number}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/submission-forms"
              className="px-4 py-2 border border-border-color rounded text-accent-secondary text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
            >
              All Forms
            </Link>
          </div>
        </div>
      </div>

      {/* Submission Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
            Team Name
          </p>
          <p className="font-heading text-lg text-text-primary uppercase m-0 truncate">
            {submission.teams?.name || "Unknown Team"}
          </p>
          {submission.teams?.track && (
            <p className="text-xs text-text-secondary m-0 mt-1">{submission.teams.track}</p>
          )}
        </div>
        <div className="glass-panel p-5 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
            Team Leader
          </p>
          <p className="font-heading text-lg text-text-primary uppercase m-0 truncate">
            {submission.teams?.leader_name || "Unknown"}
          </p>
        </div>
        <div className="glass-panel p-5 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
            Version
          </p>
          <p className="font-heading text-lg text-text-primary uppercase m-0">
            v{submission.version}
          </p>
        </div>
        <div className="glass-panel p-5 border border-border-color rounded-lg">
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
            Status
          </p>
          <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase border ${
            submission.status === "submitted"
              ? "bg-status-success/10 text-status-success border-status-success/40"
              : submission.status === "rejected"
              ? "bg-status-error/10 text-status-error border-status-error/40"
              : submission.status === "approved"
              ? "bg-status-success/10 text-status-success border-status-success/40"
              : "bg-surface-color-light text-text-secondary border-border-color"
                        }`}
          >
            {submission.status}
          </span>
        </div>
      </div>

      {/* Submitted At */}
      <div className="glass-panel p-5 border border-border-color rounded-lg">
        <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0 mb-2">
          Submitted At
        </p>
        <p className="font-mono text-text-primary">
          {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "—"}
        </p>
      </div>

      {/* Answers Section */}
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[2px] text-accent-secondary font-bold">
          Submitted Answers
        </p>
        <div className="space-y-3">
          {Object.entries(submission.answers || {}).map(([questionId, answer]) => {
            const q = questionMap[questionId];
            const title = q?.title || `Question ${questionId.slice(-4).toUpperCase()}`;
            const qType = q?.question_type;
            const isUrlAnswer = qType === "url" && typeof answer === "string" && answer.trim() !== "";
            const safeUrl = isUrlAnswer ? getSafeUrl(answer) : null;

            return (
              <div key={questionId} className="glass-panel p-5 border border-border-color rounded-lg">
                <p className="text-xs uppercase tracking-[1.5px] text-accent-secondary font-bold m-0 mb-1">
                  {title}
                </p>
                {safeUrl ? (
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent-secondary underline break-all hover:text-accent-primary flex items-center gap-1.5"
                  >
                    {String(answer)}
                    <ExternalLink size={12} className="text-text-secondary/60" />
                  </a>
                ) : (
                  <p className="text-sm text-text-primary leading-relaxed m-0 break-words whitespace-pre-wrap">
                    {answer !== null && answer !== undefined ? String(answer) : "—"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Attachments Section */}
      {submission.file_references && submission.file_references.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[2px] text-accent-secondary font-bold">
            Uploaded Files
          </p>
          <div className="space-y-3">
            {submission.file_references.map((file: any) => (
              <div key={file.file_name} className="glass-panel p-4 border border-border-color rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded border border-border-color bg-surface-color/40 flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-heading text-sm text-text-primary uppercase m-0 truncate max-w-xs">
                      {file.file_name}
                    </p>
                    <p className="text-[10px] text-text-secondary m-0 mt-0.5 font-mono">
                      {file.mime_type || "Unknown format"} • {file.size} bytes
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (file.file_path) {
                      window.open(
                        `/api/team/submission-file/download?path=${encodeURIComponent(file.file_path)}`,
                        "_blank"
                      );
                    }
                  }}
                  className="p-1.5 border border-border-color rounded text-text-secondary hover:text-accent-secondary hover:border-accent-secondary/50 transition-colors"
                  title="Download"
                >
                  <Download size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}