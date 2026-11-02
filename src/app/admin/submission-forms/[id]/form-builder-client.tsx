"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Edit3,
  Copy,
  Save,
  Play,
  ArrowLeft,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LayoutList,
  Eye,
  Send,
} from "lucide-react";
import {
  updateProjectSubmissionForm,
  publishProjectSubmissionForm,
  unpublishProjectSubmissionForm,
  archiveProjectSubmissionForm,
  type ProjectSubmissionForm,
} from "@/app/actions/project-submission-forms";

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
  id?: string;
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
  max_attachments: number | null;
  allowed_file_types: string[] | null;
  validation_rules: Record<string, unknown>;
  conditional_visibility: Record<string, unknown>;
  options: FormQuestionOption[];
}

interface FormSection {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  questions: FormQuestion[];
}

interface FormBuilderEditorProps {
  initialForm: ProjectSubmissionForm;
}

export default function FormBuilderEditor({
  initialForm,
}: FormBuilderEditorProps) {
  const router = useRouter();

  // Parse form_config from the initial form
  const formConfig = (initialForm.form_config || {}) as {
    sections?: Array<{
      id: string;
      title: string;
      description: string | null;
      sort_order: number;
      is_required: boolean;
      questions?: Array<{
        id: string;
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
        max_attachments: number | null;
        allowed_file_types: string[] | null;
        validation_rules: Record<string, unknown>;
        conditional_visibility: Record<string, unknown>;
        options?: Array<{
          id?: string;
          option_text: string;
          option_value: string;
          sort_order: number;
        }>;
      }>;
    }>;
  };

  const initialSections: FormSection[] = (formConfig.sections || []).map(
    (s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      sort_order: s.sort_order,
      is_required: s.is_required,
      questions: (s.questions || []).map((q) => ({
        id: q.id,
        section_id: s.id,
        title: q.title,
        description: q.description,
        placeholder: q.placeholder,
        question_type: q.question_type as QuestionType,
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
        options: q.options || [],
      })),
    })
  );

  const [form, setForm] = useState({
    id: initialForm.id,
    title: initialForm.title,
    description: initialForm.description || "",
    form_status: initialForm.form_status as
      | "draft"
      | "scheduled"
      | "published"
      | "unpublished"
      | "archived",
    submission_state: initialForm.submission_state as
      | "not_open"
      | "open"
      | "closed"
      | "locked",
    round_id: initialForm.round_id || null,
    timezone: initialForm.timezone,
    allow_early_view: initialForm.allow_early_view,
    allow_draft_before_open: initialForm.allow_draft_before_open,
    allow_edit_after_submit: initialForm.allow_edit_after_submit,
    allow_resubmission: initialForm.allow_resubmission,
    resubmission_policy: initialForm.resubmission_policy,
    auto_lock_at_deadline: initialForm.auto_lock_at_deadline,
    allow_member_submit: initialForm.allow_member_submit,
    max_marks: initialForm.max_marks || null,
  });
  const [sections, setSections] = useState<FormSection[]>(initialSections);
  const [selectedQuestion, setSelectedQuestion] = useState<FormQuestion | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [rounds, setRounds] = useState<Array<{
    id: string;
    title: string;
    sequence_order: number;
    status: string;
  }>>([]);

  useEffect(() => {
    loadRounds();
  }, []);

  const loadRounds = async () => {
    try {
      const res = await fetch("/api/admin/rounds");
      if (!res.ok) return;
      const data = await res.json();
      setRounds(
        (data.rounds || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          sequence_order: r.sequence_order,
          status: r.status,
        }))
      );
    } catch {
      // Silently ignore - rounds are optional for forms
    }
  };

  const addSection = () => {
    const newSection: FormSection = {
      id: `new-section-${Date.now()}`,
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
      id: `new-question-${Date.now()}`,
      section_id: sectionId,
      title: `New ${
        QUESTION_TYPES.find((q) => q.value === questionType)?.label
      }`,
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
                id: `opt-${Date.now()}`,
                option_text: "Option 1",
                option_value: "option_1",
                sort_order: 0,
              },
              {
                id: `opt-${Date.now() + 1}`,
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
      id: `new-question-${Date.now()}`,
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

  const buildFormConfig = () => {
    return {
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
  };

  const saveForm = async () => {
    if (!form.title.trim()) {
      setNotification({ type: "error", message: "Form title is required" });
      return;
    }

    setIsSaving(true);
    try {
      await updateProjectSubmissionForm({
        id: form.id,
        title: form.title,
        description: form.description || null,
        round_id: form.round_id,
        form_status: form.form_status,
        submission_state: form.submission_state,
        timezone: form.timezone,
        allow_early_view: form.allow_early_view,
        allow_draft_before_open: form.allow_draft_before_open,
        allow_edit_after_submit: form.allow_edit_after_submit,
        allow_resubmission: form.allow_resubmission,
        resubmission_policy: form.resubmission_policy,
        auto_lock_at_deadline: form.auto_lock_at_deadline,
        allow_member_submit: form.allow_member_submit,
        max_marks: form.max_marks,
        form_config: buildFormConfig(),
      });

      setNotification({
        type: "success",
        message: "Form saved successfully",
      });
      setIsSaving(false);
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save form",
      });
      setIsSaving(false);
    }
  };

  const updateFormField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePublish = async () => {
    if (form.form_status === "published") {
      await unpublishProjectSubmissionForm(form.id);
      setForm((prev) => ({
        ...prev,
        form_status: "unpublished",
        submission_state: "closed",
      }));
      setNotification({
        type: "success",
        message: "Form unpublished",
      });
    } else {
      await publishProjectSubmissionForm(form.id);
      setForm((prev) => ({
        ...prev,
        form_status: "published",
        submission_state: "open",
      }));
      setNotification({
        type: "success",
        message: "Form published",
      });
    }
  };

  const toggleArchive = async () => {
    await archiveProjectSubmissionForm(form.id);
    setNotification({
      type: "success",
      message: "Form archived",
    });
    router.push("/admin/submission-forms");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-secondary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-text-secondary uppercase tracking-wider">
            Loading form builder...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-tech">
      <div className="border-b border-border-color pb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[2px] text-accent-secondary font-bold mb-1">
            Edit Submission Form
          </p>
          <h1 className="text-2xl font-heading text-text-primary uppercase m-0">
            {form.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePublish}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
              form.form_status === "published"
                ? "border-status-warning/40 text-status-warning hover:bg-status-warning/10"
                : "border-status-success/40 text-status-success hover:bg-status-success/10"
            }`}
          >
            {form.form_status === "published" ? (
              <>
                <Play size={13} /> <span>Unpublish</span>
              </>
            ) : (
              <>
                <Send size={13} /> <span>Publish</span>
              </>
            )}
          </button>
          <button
            onClick={toggleArchive}
            className="px-4 py-2 border border-status-error/40 text-status-error rounded text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-status-error/10"
          >
            <Trash2 size={13} />
            <span>Archive</span>
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            className="px-4 py-2 border border-accent-secondary/40 text-accent-secondary rounded text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-accent-secondary/10"
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>
          <button
            onClick={() => router.push("/admin/submission-forms")}
            className="px-4 py-2 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
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
            {notification.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
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
            <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">
              Form Title
            </label>
            <input
              value={form.title}
              onChange={(e) => updateFormField("title", e.target.value)}
              placeholder="Enter form title"
              className="w-full px-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
            />
          </div>
        </div>
        <div className="col-span-full md:col-span-1">
          <div className="border border-border-color rounded-lg p-4">
            <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">
              Status
            </label>
            <select
              value={form.form_status}
              onChange={(e) =>
                updateFormField("form_status", e.target.value)
              }
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
            <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2">
              Associate Round
            </label>
            <select
              value={form.round_id || ""}
              onChange={(e) =>
                updateFormField("round_id", e.target.value || null)
              }
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
            <h3 className="font-heading text-lg text-text-primary uppercase m-0">
              Form Sections
            </h3>
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
                        s.id === section.id
                          ? { ...s, title: e.target.value }
                          : s
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
                        question.is_required
                          ? "border-accent-secondary text-accent-secondary"
                          : "border-border-color text-text-secondary"
                      }`}
                      >
                        {question.is_required ? "REQUIRED" : "OPTIONAL"}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          question.question_type.startsWith("file") ||
                          question.question_type.startsWith("image")
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
                        onClick={() =>
                          duplicateQuestion(section.id, question)
                        }
                        className="p-1.5 text-text-secondary hover:text-accent-secondary"
                        title="Duplicate"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() =>
                          deleteQuestion(section.id, question.id)
                        }
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
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        {question.description}
                      </p>
                    )}
                    {question.placeholder && (
                      <p className="text-[10px] text-text-secondary/70 italic mt-0.5">
                        Placeholder: {question.placeholder}
                      </p>
                    )}
                    {question.options && question.options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] font-bold text-text-secondary">
                          Options:
                        </p>
                        {question.options.map((opt) => (
                          <div
                            key={opt.id}
                            className="flex items-center gap-2 text-[10px]"
                          >
                            <span
                              className="w-4 h-4 border border-border-color rounded flex items-center justify-center"
                            >
                              {opt.sort_order + 1}
                            </span>
                            <span className="text-text-primary truncate">
                              {opt.option_text}
                            </span>
                            <span className="text-text-secondary/60 font-mono">
                              {opt.option_value}
                            </span>
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

      {/* Save Bar */}
      <div className="border-t border-border-color pt-4 flex items-center justify-between gap-4">
        <button
          onClick={saveForm}
          disabled={isSaving}
          className={`px-5 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,0,127,0.3)] ${isSaving ? "opacity-70" : ""}`}
        >
          <Save size={14} />
          <span>{isSaving ? "Saving..." : "Save Draft"}</span>
        </button>
      </div>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-color border border-border-color rounded-xl w-full max-w-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-border-color pb-4 mb-4 flex-shrink-0">
              <div>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                  Form Preview
                </h3>
                <p className="text-[10px] text-text-secondary m-0 mt-1">
                  How teams will see this form
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <span className="sr-only">Close</span>
                <span>✕</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              <div className="border border-border-color rounded-lg p-4 bg-surface-color/30">
                <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-2">
                  Form Settings
                </p>
                <p className="text-xs text-text-secondary">
                  <span className="font-bold">Status:</span>{" "}
                  {form.form_status}
                </p>
                <p className="text-xs text-text-secondary">
                  <span className="font-bold">Round:</span>{" "}
                  {form.round_id || "Not set"}
                </p>
              </div>

              {sections.map((section, sIdx) => (
                <div
                  key={section.id}
                  className="mb-6 border border-border-color rounded-lg overflow-hidden"
                >
                  <div className="bg-surface-color-light/50 border-b border-border-color p-3">
                    <p className="text-xs font-bold text-text-primary uppercase tracking-wider">
                      {section.title}
                    </p>
                    {section.description && (
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        {section.description}
                      </p>
                    )}
                  </div>
                  <div className="p-3">
                    {section.questions.map((q, qIdx) => (
                      <div
                        key={q.id}
                        className="mb-4 border-b border-border-color/30 pb-3 last:border-0"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-[9px] font-bold text-text-primary">
                            {qIdx + 1}.
                          </span>
                          <span className="text-sm text-text-primary">
                            {q.title}
                          </span>
                          {q.is_required && (
                            <span className="px-1 py-0 rounded text-[9px] font-bold bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20 ml-1">
                              Required
                            </span>
                          )}
                        </div>
                        {q.description && (
                          <p className="text-[10px] text-text-secondary mt-0.5">
                            {q.description}
                          </p>
                        )}
                        {q.placeholder && (
                          <p className="text-[10px] text-text-secondary/60 italic mt-0.5">
                            Placeholder: {q.placeholder}
                          </p>
                        )}
                        <p className="text-[9px] text-text-secondary/50 mt-1 font-mono">
                          {q.question_type.replace(/_/g, " ").toUpperCase()}
                        </p>
                        {q.options && q.options.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[9px] font-bold text-text-secondary">
                              Options:
                            </p>
                            {q.options.map((opt, oIdx) => (
                              <div
                                key={opt.id}
                                className="flex items-center gap-2 text-[9px]"
                              >
                                <span
                                  className="w-4 h-4 border border-border-color rounded flex items-center justify-center text-[9px]"
                                >
                                  {oIdx + 1}
                                </span>
                                <span className="text-text-primary truncate">
                                  {opt.option_text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 border border-border-color rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
