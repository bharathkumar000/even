"use client";

import { useState, useEffect, useCallback, useSyncExternalStore, useRef } from "react";

const subscribeTime = (callback: () => void) => {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
};
const getClientTime = () => Date.now();
const getServerTime = () => 0;
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  Timer,
  Upload,
  Download,
  FileText,
  Image as ImageIcon,
  Send,
  ArrowLeft,
  Clock,
  ShieldCheck,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";

interface FormQuestion {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  placeholder: string | null;
  question_type: string;
  is_required: boolean;
  sort_order: number;
  default_value: string | null;
  min_chars: number | null;
  max_chars: number | null;
  min_value: number | null;
  max_value: number | null;
  max_selections: number | null;
  max_file_size: number | null;
  max_attachments: number;
  allowed_file_types: string[] | null;
  validation_rules: Record<string, unknown>;
  conditional_visibility: Record<string, unknown>;
  options: Array<{ id: string; option_text: string; option_value: string; sort_order: number }>;
}

interface FormSection {
  id: string;
  form_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  questions: FormQuestion[];
}

interface SubmissionForm {
  id: string;
  form_status: string;
  submission_state: string;
  submission_open_at: string | null;
  submission_close_at: string | null;
  timezone: string;
  allow_member_submit: boolean;
  auto_lock_at_deadline: boolean;
  max_marks: number | null;
}

interface CurrentSubmission {
  id: string;
  version: number;
  status: string;
  answers: Record<string, unknown>;
  file_references: Array<any>;
  submitted_by: string | null;
  submitted_at: string;
  reference_number: string;
}

interface TeamDynamicSubmissionClientViewProps {
  teamId: string;
  userId: string;
  role: string;
  activeRound: any;
  formId: string | null;
  formStatus: string;
  submissionState: string;
  submissionOpenAt: string | null;
  submissionCloseAt: string | null;
  allowMemberSubmit: boolean;
  autoLockAtDeadline: boolean;
  maxMarks: number | null;
  isOpen: boolean;
  isLocked: boolean;
  isNotOpen: boolean;
  isLeader: boolean;
  currentSubmission: CurrentSubmission | null;
}

export default function TeamDynamicSubmissionClientView({
  teamId,
  userId,
  role,
  activeRound,
  formId,
  formStatus,
  submissionState,
  submissionOpenAt,
  submissionCloseAt,
  allowMemberSubmit,
  autoLockAtDeadline,
  maxMarks,
  isOpen,
  isLocked,
  isNotOpen,
  isLeader,
  currentSubmission,
}: TeamDynamicSubmissionClientViewProps) {
  const now = useSyncExternalStore(subscribeTime, getClientTime, getServerTime);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [form, setForm] = useState<SubmissionForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submissionReceipt, setSubmissionReceipt] = useState<{ referenceNumber: string; submittedAt: string } | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [fileRefs, setFileRefs] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const hasLoadedDraftRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const fileRefsRef = useRef(fileRefs);
  fileRefsRef.current = fileRefs;

  const loadForm = async () => {
    if (!formId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/team/submission-form/${formId}`);
      if (!res.ok) throw new Error("Failed to load form");
      const data = await res.json();
      setSections(data.sections || []);
      setForm(data.form || null);

      // Load existing draft
      const draftRes = await fetch(`/api/team/submission-draft?formId=${formId}&teamId=${teamId}`);
      if (draftRes.ok) {
        const draftData = await draftRes.json();
        if (draftData.draft) {
          setAnswers(draftData.draft.answers || {});
          setFileRefs(draftData.draft.file_references || []);
          if (draftData.draft.updated_at || draftData.draft.created_at) {
            const dt = new Date(draftData.draft.updated_at || draftData.draft.created_at);
            setLastSavedAt(
              dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            );
          }
        }
      }

      // Load existing final submission
      if (currentSubmission) {
        setAnswers(currentSubmission.answers || {});
        setFileRefs(currentSubmission.file_references || []);
      }
    } catch {
      setNotification({ type: "error", message: "Failed to load submission form" });
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        hasLoadedDraftRef.current = true;
      }, 500);
    }
  };

  useEffect(() => {
    loadForm();
    setMounted(true);
  }, [formId]);

  const handleAnswerChange = (questionId: string, value: unknown) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      validateQuestion(questionId, value as string);
      return next;
    });
  };

  const validateQuestion = useCallback((questionId: string, value: string) => {
    const question = sections.flatMap((s) => s.questions).find((q) => q.id === questionId);
    if (!question) return;

    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[questionId];

      if (question.is_required && (!value || value.toString().trim() === "")) {
        next[questionId] = "This field is required";
      } else if (value && question.question_type === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          next[questionId] = "Invalid email address";
        }
      } else if (value && question.question_type === "url") {
        try {
          new URL(value);
        } catch {
          next[questionId] = "Invalid URL";
        }
      } else if (value && question.question_type === "number") {
        const num = Number(value);
        if (isNaN(num)) {
          next[questionId] = "Must be a valid number";
        } else {
          if (question.min_value !== null && num < question.min_value) {
            next[questionId] = `Minimum value is ${question.min_value}`;
          }
          if (question.max_value !== null && num > question.max_value) {
            next[questionId] = `Maximum value is ${question.max_value}`;
          }
        }
      } else if (value && question.min_chars !== null && value.toString().length < question.min_chars) {
        next[questionId] = `Minimum ${question.min_chars} characters required`;
      } else if (value && question.max_chars !== null && value.toString().length > question.max_chars) {
        next[questionId] = `Maximum ${question.max_chars} characters allowed`;
      }

      return next;
    });
  }, [sections]);

  const validateAll = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    sections.forEach((section) => {
      section.questions.forEach((q) => {
        const value = answers[q.id];
        const strValue = value ? value.toString() : "";

        if (q.is_required && (!strValue || strValue.trim() === "")) {
          errors[q.id] = "This field is required";
        }
      });
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [answers, sections]);

  const handleFileUpload = async (questionId: string, files: FileList) => {
    if (!files.length) return;

    for (const file of Array.from(files)) {
      setFileUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

      try {
        // Prepare upload
        const prepRes = await fetch("/api/team/submission-file/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: null,
            submissionId: null,
            questionId,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
          }),
        });

        if (!prepRes.ok) throw new Error("Failed to prepare upload");
        const prepData = await prepRes.json();

        // Upload to signed URL
        const uploadRes = await fetch(prepData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Upload failed");

        // Register attachment
        const regRes = await fetch("/api/team/submission-file/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: null,
            submissionId: null,
            questionId,
            fileName: file.name,
            filePath: prepData.path,
            mimeType: file.type,
            size: file.size,
          }),
        });

        if (!regRes.ok) throw new Error("Failed to register attachment");
        const regData = await regRes.json();

        setFileRefs((prev) => [...prev, regData.attachment]);
        setFileUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      } catch (err) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "File upload failed",
        });
        setFileUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }
    }
  };

  const handleRemoveFile = (attachmentId: string) => {
    setFileRefs((prev) => prev.filter((f) => f.id !== attachmentId));
  };

  const saveDraft = async (isAuto = false) => {
    if (!formId || !teamId || isLocked || (!isLeader && !allowMemberSubmit)) return;

    if (isAuto) {
      setIsAutoSaving(true);
    } else {
      setIsSaving(true);
    }

    try {
      const res = await fetch("/api/team/submission-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: formId,
          team_id: teamId,
          answers: answersRef.current,
          file_references: fileRefsRef.current,
        }),
      });

      if (!res.ok) throw new Error("Failed to save draft");

      const nowTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLastSavedAt(nowTime);

      if (!isAuto) {
        setNotification({ type: "success", message: `Draft saved successfully at ${nowTime}` });
      }
    } catch (err) {
      if (!isAuto) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to save draft",
        });
      }
    } finally {
      if (isAuto) {
        setIsAutoSaving(false);
      } else {
        setIsSaving(false);
      }
    }
  };

  // Debounced auto-save when answers or files change
  useEffect(() => {
    if (!hasLoadedDraftRef.current) return;
    if (isLocked || (!isLeader && !allowMemberSubmit) || currentSubmission) return;

    const timer = setTimeout(() => {
      saveDraft(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [answers, fileRefs, isLocked, isLeader, allowMemberSubmit, currentSubmission]);

  const submitFinal = async () => {
    if (!formId || !teamId) return;

    const isValid = validateAll();
    if (!isValid) {
      setNotification({ type: "error", message: "Please fill in all required fields" });
      return;
    }

    setShowConfirm(false);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/team/submission-final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: formId,
          team_id: teamId,
          answers,
          file_references: fileRefs,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Submission failed");
      }

      const data = await res.json();
      setSubmissionReceipt({
        referenceNumber: data.submission.reference_number,
        submittedAt: data.submission.submitted_at,
      });
      setNotification({ type: "success", message: "Submission successful!" });
    } catch (err) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Submission failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCountdown = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return "00:00:00";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };


  const getDeadlineSeconds = (): number => {
    if (!submissionCloseAt || !now) return 0;
    const closeTime = new Date(submissionCloseAt).getTime();
    return Math.max(0, Math.floor((closeTime - now) / 1000));
  };

  const renderQuestionInput = (question: FormQuestion) => {
    const value = answers[question.id];
    const error = validationErrors[question.id];
    const isRequired = question.is_required;
    const disabled = isLocked || (!isLeader && !allowMemberSubmit);

    const commonClasses = "w-full px-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none disabled:opacity-60";

    switch (question.question_type) {
      case "short_answer":
      case "email":
      case "url":
      case "number":
        return (
          <input
            type={question.question_type === "email" ? "email" : question.question_type === "url" ? "url" : question.question_type === "number" ? "number" : "text"}
            value={typeof value === "string" ? value : value ? String(value) : ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder ?? undefined}
            required={question.is_required}
            disabled={disabled}
            className={`${commonClasses} ${error ? "border-status-error" : ""}`}
          />
        );
      case "long_answer":
        return (
          <textarea
            value={typeof value === "string" ? value : value ? String(value) : ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder ?? undefined}
            required={question.is_required}
            disabled={disabled}
            rows={4}
            className={`${commonClasses} ${error ? "border-status-error" : ""} resize-y`}
          />
        );
      case "single_choice":
      case "dropdown":
        return (
          <select
            value={typeof value === "string" ? value : value ? String(value) : ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            disabled={disabled}
            className={`${commonClasses} ${error ? "border-status-error" : ""}`}
          >
            <option value="">Select an option</option>
            {question.options.map((opt) => (
              <option key={opt.id} value={opt.option_value}>
                {opt.option_text}
              </option>
            ))}
          </select>
        );
      case "multiple_choice":
      case "checkbox":
        return (
          <div className="space-y-2">
            {question.options.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 cursor-pointer disabled:opacity-60">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) ? value.includes(opt.option_value) : false}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? [...value] : [];
                    if (e.target.checked) {
                      current.push(opt.option_value);
                    } else {
                      const idx = current.indexOf(opt.option_value);
                      if (idx >= 0) current.splice(idx, 1);
                    }
                    handleAnswerChange(question.id, current);
                  }}
                  disabled={disabled}
                  className="w-4 h-4 rounded border-border-color accent-accent-secondary"
                />
                <span className="text-xs text-text-primary">{opt.option_text}</span>
              </label>
            ))}
          </div>
        );
      case "yes_no":
        return (
          <div className="flex gap-4">
            {["yes", "no"].map((val) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer disabled:opacity-60">
                <input
                  type="radio"
                  value={val}
                  checked={value === val}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  disabled={disabled}
                  className="w-4 h-4 rounded border-border-color accent-accent-secondary"
                />
                <span className="text-xs text-text-primary capitalize">{val}</span>
              </label>
            ))}
          </div>
        );
      case "rating":
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleAnswerChange(question.id, star)}
                disabled={disabled}
                className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                  typeof value === "number" && star <= value
                    ? "text-yellow-400 bg-yellow-400/10"
                    : "text-text-secondary hover:text-accent-secondary"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        );
      case "linear_scale":
        return (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-secondary">{question.min_value ?? 1}</span>
            <input
              type="range"
              min={question.min_value ?? 1}
              max={question.max_value ?? 10}
              value={typeof value === "number" ? value : value ? Number(value) : question.min_value ?? 1}
              onChange={(e) => handleAnswerChange(question.id, Number(e.target.value))}
              disabled={disabled}
              className="flex-1 h-1 bg-surface-color rounded-lg appearance-none cursor-pointer accent-accent-secondary"
            />
            <span className="text-[10px] text-text-secondary">{question.max_value ?? 10}</span>
          </div>
        );
      case "date":
      case "time":
      case "datetime":
        return (
          <input
            type={question.question_type === "datetime" ? "datetime-local" : question.question_type}
            value={typeof value === "string" ? value : value ? String(value) : ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            disabled={disabled}
            className={`${commonClasses} ${error ? "border-status-error" : ""}`}
          />
        );
      case "file_upload":
      case "image_upload":
        return (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer disabled:opacity-60">
              <Upload size={14} className="text-accent-secondary" />
              <span className="text-xs font-bold text-text-secondary uppercase">Choose Files</span>
              <input
                type="file"
                multiple
                accept={question.allowed_file_types?.map((t) => `.${t}`).join(",")}
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(question.id, e.target.files);
                }}
                disabled={disabled}
                className="sr-only"
              />
            </label>
            {fileRefs
              .filter((f) => f.question_id === question.id)
              .map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 border border-border-color rounded px-2.5 py-2 bg-surface-color/30">
                  <span className="text-[10px] text-text-primary truncate">{f.file_name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRemoveFile(f.id)}
                      className="p-1 text-status-error hover:bg-status-error/10 rounded"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        );
      case "section_heading":
        return (
          <div className="p-3 bg-surface-color/30 border border-border-color rounded">
            <h4 className="font-heading text-base text-text-primary uppercase m-0">{question.title}</h4>
            {question.description && (
              <p className="text-[10px] text-text-secondary mt-1">{question.description}</p>
            )}
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={typeof value === "string" ? value : value ? String(value) : ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            disabled={disabled}
            className={commonClasses}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-accent-secondary" />
          <p className="text-xs text-text-secondary uppercase tracking-wider">Loading form...</p>
        </div>
      </div>
    );
  }

  if (isNotOpen && !currentSubmission) {
    const openTime = submissionOpenAt ? new Date(submissionOpenAt) : null;
    return (
      <div className="space-y-8">
        <div className="border-b border-border-color pb-6">
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
            Team Portal // Deliverables Submission
          </p>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
            Project Deliverables
          </h1>
        </div>

        <div className="glass-panel p-8 border border-status-warning text-status-warning rounded-lg text-center">
          <Timer size={32} className="mx-auto mb-4 text-status-warning" />
          <h2 className="font-heading text-xl text-status-warning uppercase mb-2">Submissions Not Open Yet</h2>
          <p className="text-xs text-text-secondary mb-4">
            The submission form is published but not yet open for submissions.
          </p>
          {openTime && (
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs font-mono text-text-secondary">Opens at:</span>
              <span className="font-heading text-lg text-text-primary font-bold">
                {openTime.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {activeRound && (
          <div className="glass-panel p-6 border border-border-color rounded-lg">
            <h3 className="font-heading text-sm text-accent-secondary uppercase mb-3">Active Round</h3>
            <p className="font-heading text-lg text-text-primary">{activeRound.title}</p>
          </div>
        )}
      </div>
    );
  }

  if (isLocked && !currentSubmission) {
    return (
      <div className="space-y-8">
        <div className="border-b border-border-color pb-6">
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
            Team Portal // Deliverables Submission
          </p>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
            Project Deliverables
          </h1>
        </div>

        <div className="glass-panel p-8 border border-status-error text-status-error rounded-lg text-center">
          <Lock size={32} className="mx-auto mb-4 text-status-error" />
          <h2 className="font-heading text-xl text-status-error uppercase mb-2">Submissions Locked</h2>
          <p className="text-xs text-text-secondary mb-4">
            The submission deadline has passed. No further submissions are accepted.
          </p>
        </div>
      </div>
    );
  }

  // Read-only mode (published for viewing but not open for submissions)
  if (formStatus === "published" && submissionState !== "open" && !currentSubmission) {
    return (
      <div className="space-y-8">
        <div className="border-b border-border-color pb-6">
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
            Team Portal // Deliverables Submission
          </p>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
            Project Deliverables
          </h1>
        </div>

        <div className="glass-panel p-8 border border-border-color rounded-lg text-center">
          <ShieldCheck size={32} className="mx-auto mb-4 text-text-secondary" />
          <h2 className="font-heading text-xl text-text-secondary uppercase mb-2">View Only Mode</h2>
          <p className="text-xs text-text-secondary mb-4">
            The submission form is published for viewing but submissions are not yet open.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border-color pb-6 flex items-center justify-between">
        <div>
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
            Team Portal // Deliverables Submission
          </p>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
            Project Deliverables
          </h1>
            <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
              {activeRound ? `Round: ${activeRound.title}` : ""} Submit your project deliverables through the administrator-configured form.
            </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Draft Auto-Saved Indicator */}
          {isAutoSaving ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-tertiary/10 border border-accent-tertiary/30 text-accent-tertiary text-xs font-mono animate-pulse">
              <Loader2 size={12} className="animate-spin text-accent-tertiary shrink-0" />
              <span>Auto-saving draft...</span>
            </div>
          ) : lastSavedAt ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-status-success/10 border border-status-success/30 text-status-success text-xs font-mono"
              title={`Your draft changes are automatically synced. Last saved at ${lastSavedAt}`}
            >
              <CheckCircle2 size={13} className="text-status-success shrink-0" />
              <span className="hidden sm:inline text-text-secondary text-[11px]">Draft auto-saved at</span>
              <span className="font-bold text-status-success text-[11px]">{lastSavedAt}</span>
            </div>
          ) : null}

          {submissionCloseAt && (
            <div className="px-3 py-1.5 rounded bg-surface-color border border-border-color text-xs flex items-center">
              <Timer size={12} className="mr-1.5 text-accent-secondary animate-pulse" />
              <span className="font-mono font-bold text-text-primary">
                {mounted ? formatCountdown(getDeadlineSeconds()) : "--:--:--"}
              </span>
              <span className="text-text-secondary ml-1">Remaining</span>
            </div>
          )}
          <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
            isOpen ? "bg-status-success/15 border-status-success text-status-success" : "bg-status-warning/15 border-status-warning text-status-warning"
          }`}
          >
            {isOpen ? "OPEN FOR SUBMISSION" : "SUBMISSIONS CLOSED"}
          </span>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3 border rounded flex items-center justify-between text-xs ${
            notification.type === "success"
              ? "bg-status-success/15 border-status-success text-status-success"
              : "bg-status-error/15 border-status-error text-status-error"
          }`}
        >
          <span className="flex items-center gap-2">
            {notification.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </span>
          <button
            onClick={() => setNotification(null)}
            className="text-text-secondary hover:text-text-primary"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isLeader && !allowMemberSubmit && (
        <div className="p-3 bg-status-warning/15 border border-status-warning text-status-warning rounded text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>You are viewing in read-only mode. Only the Team Leader can submit deliverables.</span>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {sections.map((section) => (
          <div key={section.id} className="border border-border-color rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border-color bg-surface-color/30 p-3">
              <div>
                <h3 className="font-heading text-sm text-text-primary uppercase m-0">{section.title}</h3>
                {section.description && (
                  <p className="text-[10px] text-text-secondary mt-0.5">{section.description}</p>
                )}
              </div>
              {section.is_required && (
                <span className="px-2 py-0.5 rounded border border-accent-secondary text-accent-secondary text-[9px] font-bold uppercase">
                  Required Section
                </span>
              )}
            </div>

            <div className="p-4 space-y-4">
              {section.questions.map((question) => (
                <div
                  key={question.id}
                  className="space-y-2"
                >
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-text-primary flex items-center justify-between gap-2">
                    <span>{question.title}</span>
                    {question.is_required ? (
                      <span className="text-[10px] text-accent-secondary uppercase font-bold">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-secondary/60 uppercase font-bold">
                        Optional
                      </span>
                    )}
                  </label>
                  {validationErrors[question.id] && (
                      <span className="text-[9px] text-status-error font-mono">{validationErrors[question.id]}</span>
                    )}
                  </div>
                  {question.description && (
                    <p className="text-[10px] text-text-secondary mt-0.5">{question.description}</p>
                  )}
                  {renderQuestionInput(question)}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-6 border-t border-border-color flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => saveDraft(false)}
              disabled={isSaving || isAutoSaving || isLocked || (!isLeader && !allowMemberSubmit)}
              className="px-5 py-2.5 border border-accent-tertiary/40 text-accent-tertiary rounded text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 hover:bg-accent-tertiary/10 flex items-center gap-2"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              <span>{isSaving ? "Saving..." : "Save Draft"}</span>
            </button>
            {lastSavedAt && (
              <span className="text-[11px] font-mono text-status-success flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-status-success shrink-0" />
                <span>Auto-saved at {lastSavedAt}</span>
              </span>
            )}
            {currentSubmission && (
              <button
                onClick={() => setShowReview(true)}
                disabled={isLocked || (!isLeader && !allowMemberSubmit)}
                className="px-5 py-2.5 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
              >
                Review Submission
              </button>
            )}
          </div>
          <button
            onClick={() => {
              if (currentSubmission) {
                setShowReview(true);
              } else {
                setShowConfirm(true);
              }
            }}
            disabled={isSubmitting || isLocked || (!isLeader && !allowMemberSubmit)}
            className="px-6 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all disabled:opacity-50 shadow-[0_0_18px_rgba(255,0,127,0.28)]"
          >
            <Loader2 size={14} className={isSubmitting ? "animate-spin" : ""} mr-2 />
            {isSubmitting ? "Submitting..." : currentSubmission ? "Resubmit" : "Submit Final"}
          </button>
        </div>
      </form>

      {/* Submission Receipt */}
      {submissionReceipt && (
        <div className="glass-panel p-6 border border-status-success rounded-lg shadow-[0_0_30px_rgba(0,255,136,0.2)]">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 size={24} className="text-status-success" />
            <h2 className="font-heading text-lg text-status-success uppercase m-0">Submission Received</h2>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">Reference Number:</span>
              <span className="font-mono font-bold text-text-primary">{submissionReceipt.referenceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Submitted At:</span>
              <span className="text-text-primary">{new Date(submissionReceipt.submittedAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Team:</span>
              <span className="text-text-primary">{teamId}</span>
            </div>
          </div>
          <button
            onClick={() => setSubmissionReceipt(null)}
            className="mt-4 px-4 py-2 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-heading text-lg text-text-primary uppercase mb-2">Confirm Final Submission</h3>
            <p className="text-xs text-text-secondary mb-6">
              Once submitted, your answers are final. {currentSubmission ? "This will create a new version." : ""}
              {currentSubmission && !allowMemberSubmit ? " Resubmission may be restricted by administrator settings." : ""}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={submitFinal}
                disabled={isSubmitting}
                className="px-5 py-2 bg-status-error text-white text-[10px] font-bold uppercase tracking-wider rounded hover:bg-status-error/80 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Final"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
