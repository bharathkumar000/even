"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Edit3,
  Copy,
  Save,
  Play,
  ArrowLeft,
  FileText,
  Timer,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LayoutList,
  Barcode,
} from "lucide-react";
import { createProjectSubmissionForm, updateProjectSubmissionForm } from "@/app/actions/project-submission-forms";
import { withCsrfToken } from "@/lib/csrf-client";

const QUESTION_TYPES = [
  { value: "short_answer", label: "Short Answer", icon: "text" },
  { value: "long_answer", label: "Long Answer", icon: "edit" },
  { value: "single_choice", label: "Single Choice", icon: "radio" },
  { value: "multiple_choice", label: "Multiple Choice", icon: "checkbox" },
  { value: "dropdown", label: "Dropdown", icon: "menu" },
  { value: "yes_no", label: "Yes / No", icon: "help-circle" },
  { value: "checkbox", label: "Checkbox", icon: "check" },
  { value: "number", label: "Number", icon: "#" },
  { value: "email", label: "Email", icon: "mail" },
  { value: "url", label: "URL", icon: "link" },
  { value: "date", label: "Date", icon: "calendar" },
  { value: "time", label: "Time", icon: "clock" },
  { value: "datetime", label: "Date & Time", icon: "clock" },
  { value: "file_upload", label: "File Upload", icon: "upload" },
  { value: "image_upload", label: "Image Upload", icon: "image" },
  { value: "video_link", label: "Video Link", icon: "video" },
  { value: "rating", label: "Rating", icon: "star" },
  { value: "linear_scale", label: "Linear Scale", icon: "sliders" },
  { value: "section_heading", label: "Section Heading", icon: "layout" },
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number]["value"];

interface FormQuestionOption {
  id: string;
  option_text: string;
  option_value: string;
  sort_order: number;
}

interface FormQuestion {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  placeholder: string | null;
  question_type: QuestionType;
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
  options: FormQuestionOption[];
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
  event_id: string | null;
  round_id: string | null;
  title: string;
  description: string | null;
  form_status: string;
  submission_state: string;
  timezone: string;
  allow_early_view: boolean;
  allow_draft_before_open: boolean;
  allow_edit_after_submit: boolean;
  allow_resubmission: boolean;
  resubmission_policy: string;
  auto_lock_at_deadline: boolean;
  allow_member_submit: boolean;
  max_marks: number | null;
  view_available_at: string | null;
  submission_open_at: string | null;
  submission_close_at: string | null;
}

type FormMode = "create" | "edit";

interface RoundOption {
  id: string;
  title: string;
  sequence_order: number;
  status: string;
}

export default function FormBuilderEditor() {
  const router = useRouter();
  const params = useParams();
  const formId = params.id as string | undefined;
  const mode: FormMode = formId ? "edit" : "create";

  const [form, setForm] = useState<SubmissionForm | null>(null);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<FormQuestion | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [rounds, setRounds] = useState<RoundOption[]>([]);

  const loadRounds = async () => {
    try {
      const res = await fetch(`/api/admin/rounds`);
      if (!res.ok) return;
      const data = await res.json();
      setRounds((data.rounds || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        sequence_order: r.sequence_order,
        status: r.status,
      })));
    } catch {
      // Silently ignore - rounds are optional for forms
    }
  };

  const loadForm = async () => {
    if (mode === "create") {
      setIsLoading(false);
      setSections([
        {
          id: "new-section-1",
          form_id: "",
          title: "Section 1",
          description: null,
          sort_order: 0,
          is_required: true,
          questions: [],
        },
      ]);
      setForm({
        id: "",
        event_id: null,
        round_id: null,
        title: "",
        description: null,
        form_status: "draft",
        submission_state: "not_open",
        timezone: "Asia/Kolkata",
        allow_early_view: false,
        allow_draft_before_open: true,
        allow_edit_after_submit: true,
        allow_resubmission: true,
        resubmission_policy: "none",
        auto_lock_at_deadline: false,
        allow_member_submit: true,
        max_marks: 50,
        view_available_at: null,
        submission_open_at: null,
        submission_close_at: null,
      });
      return;
    }

    try {
      const res = await fetch(`/api/admin/submission-forms/${formId}`);
      if (!res.ok) throw new Error("Failed to load form");
      const data = await res.json();
      setForm(data.form);
      setSections(
        data.sections.map((s: any) => ({
          ...s,
          questions: (data.questions || []).filter((q: any) => q.section_id === s.id),
        }))
      );
    } catch {
      setNotification({ type: "error", message: "Failed to load form" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadForm();
    loadRounds();
  }, [formId, mode]);

  const addSection = () => {
    const newSection: FormSection = {
      id: `new-section-${crypto.randomUUID()}`,
      form_id: form?.id || "",
      title: `Section ${sections.length + 1}`,
      description: null,
      sort_order: sections.length,
      is_required: true,
      questions: [],
    };
    setSections((prev) => [...prev, newSection]);
  };

  const addQuestion = (sectionId: string, questionType: QuestionType) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const newQuestion: FormQuestion = {
      id: `new-question-${crypto.randomUUID()}`,
      section_id: sectionId,
      title: `New ${QUESTION_TYPES.find((q) => q.value === questionType)?.label}`,
      description: null,
      placeholder: null,
      question_type: questionType,
      is_required: true,
      sort_order: section.questions.length,
      default_value: null,
      min_chars: null,
      max_chars: null,
      min_value: null,
      max_value: null,
      max_selections: null,
      max_file_size: null,
      max_attachments: 1,
      allowed_file_types: null,
      validation_rules: {},
      conditional_visibility: {},
      options:
        questionType === "single_choice" ||
        questionType === "multiple_choice" ||
        questionType === "dropdown" ||
        questionType === "checkbox"
          ? [
              {
                id: `opt-${crypto.randomUUID()}`,
                option_text: "Option 1",
                option_value: "option_1",
                sort_order: 0,
              },
              {
                id: `opt-${crypto.randomUUID()}`,
                option_text: "Option 2",
                option_value: "option_2",
                sort_order: 1,
              },
            ]
          : [],
    };

    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, questions: [...s.questions, newQuestion] }
          : s
      )
    );
    setSelectedQuestion(newQuestion);
  };

  const updateQuestion = (updated: FormQuestion) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        questions: s.questions.map((q) => (q.id === updated.id ? updated : q)),
      }))
    );
    setSelectedQuestion(updated);
  };

  const deleteQuestion = (sectionId: string, questionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              questions: s.questions.filter((q) => q.id !== questionId),
            }
          : s
      )
    );
    if (selectedQuestion?.id === questionId) {
      setSelectedQuestion(null);
    }
  };

  const duplicateQuestion = (sectionId: string, question: FormQuestion) => {
    const dup: FormQuestion = {
      ...question,
      id: `new-question-${crypto.randomUUID()}`,
      title: `${question.title} (Copy)`,
      sort_order: question.sort_order + 1,
    };
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              questions: [
                ...s.questions,
                ...(s.questions.filter((q) => q.id === question.id).length > 0
                  ? [dup]
                  : []),
              ],
            }
          : s
      )
    );
  };

  const deleteSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    setSelectedQuestion(null);
  };

  const saveForm = async () => {
    if (!form?.title?.trim()) {
      setNotification({ type: "error", message: "Form title is required" });
      return;
    }

    setIsSaving(true);
    try {
      const formConfig = {
        sections: sections.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          sort_order: s.sort_order,
          is_required: s.is_required,
          questions: s.questions.map((q) => ({
            id: q.id,
            title: q.title,
            description: q.description,
            placeholder: q.placeholder,
            question_type: q.question_type,
            is_required: q.is_required,
            sort_order: q.sort_order,
            default_value: q.default_value,
            min_chars: q.min_chars,
            max_chars: q.max_chars,
            min_value: q.min_value,
            max_value: q.max_value,
            max_selections: q.max_selections,
            max_file_size: q.max_file_size,
            max_attachments: q.max_attachments,
            allowed_file_types: q.allowed_file_types,
            validation_rules: q.validation_rules,
            conditional_visibility: q.conditional_visibility,
            options: q.options,
          })),
        })),
      };

      if (mode === "create") {
        await createProjectSubmissionForm({
          title: form.title,
          description: form.description || undefined,
          form_status: (form.form_status as any) || "draft",
          submission_state: (form.submission_state as any) || "not_open",
          round_id: form.round_id || null,
          timezone: form.timezone || "Asia/Kolkata",
          allow_early_view: form.allow_early_view || false,
          allow_draft_before_open: form.allow_draft_before_open ?? true,
          allow_edit_after_submit: form.allow_edit_after_submit ?? true,
          allow_resubmission: form.allow_resubmission ?? true,
          resubmission_policy: form.resubmission_policy || "none",
          auto_lock_at_deadline: form.auto_lock_at_deadline ?? false,
          allow_member_submit: form.allow_member_submit ?? true,
          max_marks: form.max_marks || 50,
          form_config: formConfig,
          ...withCsrfToken(),
        });
      } else if (form.id) {
        await updateProjectSubmissionForm({
          id: form.id,
          title: form.title,
          description: form.description || undefined,
          form_status: (form.form_status as any) || "draft",
          submission_state: (form.submission_state as any) || "not_open",
          round_id: form.round_id || null,
          timezone: form.timezone || "Asia/Kolkata",
          allow_early_view: form.allow_early_view || false,
          allow_draft_before_open: form.allow_draft_before_open ?? true,
          allow_edit_after_submit: form.allow_edit_after_submit ?? true,
          allow_resubmission: form.allow_resubmission ?? true,
          resubmission_policy: form.resubmission_policy || "none",
          auto_lock_at_deadline: form.auto_lock_at_deadline ?? false,
          allow_member_submit: form.allow_member_submit ?? true,
          max_marks: form.max_marks || 50,
          form_config: formConfig,
          ...withCsrfToken(),
        });
      }

      setNotification({ type: "success", message: "Form saved successfully" });
      setIsSaving(false);
      router.push(`/admin/submission-forms`);
    } catch (err) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Failed to save form" });
      setIsSaving(false);
    }
  };

  const updateFormField = (key: string, value: any) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : {
      id: "",
      event_id: null,
      round_id: null,
      title: key === "title" ? value : "",
      description: null,
      form_status: "draft",
      submission_state: "not_open",
      timezone: "Asia/Kolkata",
      allow_early_view: false,
      allow_draft_before_open: true,
      allow_edit_after_submit: true,
      allow_resubmission: true,
      resubmission_policy: "none",
      auto_lock_at_deadline: false,
      allow_member_submit: true,
      max_marks: 50,
      view_available_at: null,
      submission_open_at: null,
      submission_close_at: null,
      [key]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-secondary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-text-secondary uppercase tracking-wider">Loading form builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-tech">
      <div className="border-b border-border-color pb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[2px] text-accent-secondary font-bold mb-1">
            {mode === "create" ? "Create New Form" : "Edit Form"}
          </p>
          <h1 className="text-2xl font-heading text-text-primary uppercase m-0">
            {mode === "create" ? "New Submission Form" : form?.title || "Untitled Form"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveForm}
            disabled={isSaving}
            className={`px-5 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,0,127,0.3)] ${isSaving ? "opacity-70" : ""}`}
          >
            <Save size={14} />
            <span>{isSaving ? "Saving..." : "Save Form"}</span>
          </button>
          <button
            onClick={() => router.push("/admin/submission-forms")}
            className="px-4 py-2.5 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={13} />
            <span>Back</span>
          </button>
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
            <span>Dismiss</span>
          </button>
        </div>
      )}

      {/* Form Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="col-span-full md:col-span-2">
          <div className="border border-border-color rounded-lg p-4">
            <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Form Title</label>
            <input
              value={form?.title || ""}
              onChange={(e) => updateFormField("title", e.target.value)}
              placeholder="Enter form title"
              className="w-full px-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
            />
          </div>
        </div>
        <div className="col-span-full md:col-span-1">
          <div className="border border-border-color rounded-lg p-4">
            <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Status</label>
            <select
              value={form?.form_status || "draft"}
              onChange={(e) => updateFormField("form_status", e.target.value)}
              className="w-full px-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div className="col-span-full md:col-span-1">
          <div className="border border-border-color rounded-lg p-4">
            <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Associate Round</label>
            <select
              value={form?.round_id || ""}
              onChange={(e) => updateFormField("round_id", e.target.value || null)}
              className="w-full px-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
            >
              <option value="">No Round (General Form)</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  Round #{r.sequence_order} — {r.title} ({r.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sections & Questions Builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-accent-secondary" />
            <h3 className="font-heading text-lg text-text-primary uppercase m-0">Form Sections</h3>
          </div>
          <button
            onClick={addSection}
            className="px-3 py-1.5 border border-accent-secondary/40 text-accent-secondary rounded text-[10px] font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
          >
            <Plus size={13} />
            <span>Add Section</span>
          </button>
        </div>

        {sections.map((section) => (
          <div
            key={section.id}
            className="border border-border-color rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border-color bg-surface-color/30 p-3">
              <div className="flex items-center gap-2">
                <input
                  value={section.title}
                  onChange={(e) => {
                    setSections((prev) =>
                      prev.map((s) =>
                        s.id === section.id ? { ...s, title: e.target.value } : s
                      )
                    );
                  }}
                  className="font-bold text-text-primary bg-transparent border-none focus:ring-0 w-full text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => addQuestion(section.id, "short_answer")}
                  className="p-1.5 text-text-secondary hover:text-accent-secondary"
                  title="Add Question"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => deleteSection(section.id)}
                  className="p-1.5 text-text-secondary hover:text-status-error"
                  title="Delete Section"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <div className="p-3">
              {section.questions.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-[10px] text-text-secondary italic">
                    No questions yet. Click + to add one.
                  </p>
                </div>
              )}

              {section.questions.map((question) => (
                <div
                  key={question.id}
                  className="border border-border-color rounded p-3 mb-3 hover:border-accent-secondary/40 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        question.is_required ? "border-accent-secondary text-accent-secondary" : "border-border-color text-text-secondary"
                      }`}
                      >
                        {question.is_required ? "REQUIRED" : "OPTIONAL"}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          question.question_type.startsWith("file") || question.question_type.startsWith("image")
                            ? "border-accent-primary text-accent-primary"
                            : "border-border-color text-text-secondary"
                        }`}
                      >
                        {question.question_type.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedQuestion(question)}
                        className="p-1.5 text-text-secondary hover:text-accent-tertiary"
                        title="Edit"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => duplicateQuestion(section.id, question)}
                        className="p-1.5 text-text-secondary hover:text-accent-secondary"
                        title="Duplicate"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => deleteQuestion(section.id, question.id)}
                        className="p-1.5 text-text-secondary hover:text-status-error"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-text-primary">
                      {question.title}
                    </label>
                    {question.description && (
                      <p className="text-[10px] text-text-secondary mt-0.5">{question.description}</p>
                    )}
                    {question.placeholder && (
                      <p className="text-[10px] text-text-secondary/70 italic mt-0.5">Placeholder: {question.placeholder}</p>
                    )}
                    {question.options && question.options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] font-bold text-text-secondary">Options:</p>
                        {question.options.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2 text-[10px]">
                            <span className="w-4 h-4 border border-border-color rounded flex items-center justify-center">
                              {opt.sort_order + 1}
                            </span>
                            <span className="text-text-primary truncate">{opt.option_text}</span>
                            <span className="text-text-secondary/60 font-mono">{opt.option_value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {sections.length === 0 && (
          <div className="border border-dashed border-border-color bg-surface-color/30 rounded-lg p-12 text-center">
            <p className="text-xs text-text-secondary italic">
              No sections yet. Click "Add Section" to begin building your form.
            </p>
          </div>
        )}
      </div>

      {/* Question Editor Panel */}
      {selectedQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">Edit Question</h3>
                <p className="text-[10px] text-text-secondary m-0 mt-1">
                  {selectedQuestion.question_type.replace(/_/g, " ").toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setSelectedQuestion(null)}
                className="text-text-secondary hover:text-text-primary"
              >
                <span className="sr-only">Close</span>
                <span>✕</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Question Title</label>
                <input
                  value={selectedQuestion.title}
                  onChange={(e) => {
                    const updated = { ...selectedQuestion, title: e.target.value };
                    updateQuestion(updated);
                  }}
                  className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Description / Instructions</label>
                <textarea
                  value={selectedQuestion.description || ""}
                  onChange={(e) => {
                    const updated = { ...selectedQuestion, description: e.target.value || null };
                    updateQuestion(updated);
                  }}
                  rows={3}
                  className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Placeholder</label>
                <input
                  value={selectedQuestion.placeholder || ""}
                  onChange={(e) => {
                    const updated = { ...selectedQuestion, placeholder: e.target.value || null };
                    updateQuestion(updated);
                  }}
                  className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedQuestion.is_required}
                    onChange={(e) => {
                      const updated = { ...selectedQuestion, is_required: e.target.checked };
                      updateQuestion(updated);
                    }}
                    className="w-4 h-4 rounded border-border-color accent-accent-secondary"
                  />
                  <label className="text-xs font-bold text-text-secondary uppercase">Required</label>
                </div>
              </div>

              {/* Type-specific settings */}
              {selectedQuestion.question_type === "number" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Min Value</label>
                    <input
                      type="number"
                      value={selectedQuestion.min_value || ""}
                      onChange={(e) => {
                        const updated = { ...selectedQuestion, min_value: e.target.value ? Number(e.target.value) : null };
                        updateQuestion(updated);
                      }}
                      className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Max Value</label>
                    <input
                      type="number"
                      value={selectedQuestion.max_value || ""}
                      onChange={(e) => {
                        const updated = { ...selectedQuestion, max_value: e.target.value ? Number(e.target.value) : null };
                        updateQuestion(updated);
                      }}
                      className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                </div>
              )}

              {(selectedQuestion.question_type === "short_answer" || selectedQuestion.question_type === "long_answer") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Min Characters</label>
                    <input
                      type="number"
                      value={selectedQuestion.min_chars || ""}
                      onChange={(e) => {
                        const updated = { ...selectedQuestion, min_chars: e.target.value ? Number(e.target.value) : null };
                        updateQuestion(updated);
                      }}
                      className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Max Characters</label>
                    <input
                      type="number"
                      value={selectedQuestion.max_chars || ""}
                      onChange={(e) => {
                        const updated = { ...selectedQuestion, max_chars: e.target.value ? Number(e.target.value) : null };
                        updateQuestion(updated);
                      }}
                      className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                </div>
              )}

              {(selectedQuestion.question_type === "single_choice" ||
                selectedQuestion.question_type === "multiple_choice" ||
                selectedQuestion.question_type === "dropdown" ||
                selectedQuestion.question_type === "checkbox") && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Options</label>
                  <div className="space-y-2">
                    {selectedQuestion.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2 border border-border-color rounded p-2 bg-surface-color/30">
                        <input
                          value={opt.option_text}
                          onChange={(e) => {
                            const updated = {
                              ...selectedQuestion,
                              options: selectedQuestion.options.map((o) =>
                                o.id === opt.id ? { ...o, option_text: e.target.value } : o
                              ),
                            };
                            updateQuestion(updated);
                          }}
                          className="flex-1 px-2 py-1 bg-transparent border-none focus:ring-0 text-xs text-text-primary"
                        />
                        <input
                          value={opt.option_value}
                          onChange={(e) => {
                            const updated = {
                              ...selectedQuestion,
                              options: selectedQuestion.options.map((o) =>
                                o.id === opt.id ? { ...o, option_value: e.target.value } : o
                              ),
                            };
                            updateQuestion(updated);
                          }}
                          className="w-24 px-2 py-1 bg-transparent border-none focus:ring-0 text-xs font-mono text-text-secondary"
                        />
                        <button
                          onClick={() => {
                            const updated = {
                              ...selectedQuestion,
                              options: selectedQuestion.options.filter((o) => o.id !== opt.id),
                            };
                            updateQuestion(updated);
                          }}
                          className="p-1 text-status-error hover:bg-status-error/10 rounded"
                        >
                          <span className="sr-only">Remove</span>
                          <span>×</span>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const updated = {
                          ...selectedQuestion,
                          options: [
                            ...selectedQuestion.options,
                            {
                              id: `opt-${Date.now()}`,
                              option_text: `Option ${selectedQuestion.options.length + 1}`,
                              option_value: `option_${selectedQuestion.options.length + 1}`,
                              sort_order: selectedQuestion.options.length,
                            },
                          ],
                        };
                        updateQuestion(updated);
                      }}
                      className="w-full py-2 border border-dashed border-border-color rounded text-[10px] text-accent-secondary uppercase font-bold hover:bg-accent-secondary/5"
                    >
                      <Plus size={13} />
                      <span>Add Option</span>
                    </button>
                  </div>
                </div>
              )}

              {selectedQuestion.question_type.startsWith("file") || selectedQuestion.question_type.startsWith("image") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Max File Size (MB)</label>
                    <input
                      type="number"
                      value={selectedQuestion.max_file_size ? (selectedQuestion.max_file_size / (1024 * 1024)).toString() : ""}
                      onChange={(e) => {
                        const updated = {
                          ...selectedQuestion,
                          max_file_size: e.target.value ? Number(e.target.value) * 1024 * 1024 : null,
                        };
                        updateQuestion(updated);
                      }}
                      className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">Max Attachments</label>
                    <input
                      type="number"
                      value={selectedQuestion.max_attachments || 1}
                      onChange={(e) => {
                        const updated = { ...selectedQuestion, max_attachments: Number(e.target.value) || 1 };
                        updateQuestion(updated);
                      }}
                      className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border-color flex justify-end gap-2">
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="px-4 py-2 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="px-5 py-2 bg-accent-secondary text-black text-[10px] font-bold uppercase tracking-wider rounded hover:bg-accent-secondary/80"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
