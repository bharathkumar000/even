"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Eye,
  Send,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import {
  updateProjectSubmissionForm,
  publishProjectSubmissionForm,
} from "@/app/actions/project-submission-forms";
import { withCsrfToken } from "@/lib/csrf-client";
import { PublishConfirmationModal } from "@/components/admin/PublishConfirmationModal";

export type FBField = {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder: string;
};

export type FBSection = {
  id: string;
  title: string;
  description: string;
  fields: FBField[];
};

export type FBFormConfig = {
  sections: FBSection[];
  submitLabel?: string;
};

const FIELD_TYPES: Array<{ value: string; label: string }> = [
  { value: "textarea", label: "Textarea" },
  { value: "text", label: "Short Answer" },
  { value: "url", label: "URL / Link" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
];

function newSectionId() {
  return "section-" + crypto.randomUUID();
}
function newFieldId() {
  return "field-" + crypto.randomUUID();
}

function emptySection(): FBSection {
  return {
    id: newSectionId(),
    title: "New Section",
    description: "",
    fields: [],
  };
}

function emptyField(): FBField {
  return {
    id: newFieldId(),
    type: "text",
    label: "Untitled Question",
    required: false,
    placeholder: "",
  };
}

function initialConfig(formConfig: Record<string, unknown> | undefined | null): FBFormConfig {
  const fc = (formConfig || {}) as FBFormConfig;
  const rawSections = Array.isArray(fc.sections) ? fc.sections : [];
  const normalized: FBSection[] = rawSections.map((s: any) => {
    // Support both the live "fields" array and the legacy "questions" array shape.
    const rawFields = Array.isArray(s.fields)
      ? s.fields
      : Array.isArray(s.questions)
        ? s.questions
        : [];
    return {
      id: s.id || newSectionId(),
      title: s.title || "Untitled Section",
      description: s.description || "",
      fields: rawFields.map((f: any) => ({
        id: f.id || newFieldId(),
        type: f.type || f.question_type || "text",
        label: f.label || f.title || "Untitled Question",
        required: Boolean(f.required ?? f.is_required),
        placeholder: f.placeholder || "",
      })),
    };
  });
  return {
    sections: normalized.length ? normalized : [emptySection()],
    submitLabel: fc.submitLabel || "Submit",
  };
}

interface FormBuilderEditorProps {
  initialForm: {
    id: string;
    title: string;
    description: string | null;
    form_status: string;
    form_config: Record<string, unknown>;
  };
}

export function FormBuilderEditor({ initialForm }: FormBuilderEditorProps) {
  const [formId] = useState(initialForm.id);
  const [formTitle, setFormTitle] = useState(initialForm.title || "");
  const [config, setConfig] = useState<FBFormConfig>(() => initialConfig(initialForm.form_config));
  const [formStatus, setFormStatus] = useState(initialForm.form_status || "draft");

  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const draft = formStatus === "draft";
  const published = formStatus === "published";

  const totalSections = useMemo(() => config.sections.length, [config.sections]);
  const totalQuestions = useMemo(
    () => config.sections.reduce((sum, s) => sum + s.fields.length, 0),
    [config.sections]
  );

  const dismissNotification = () => setNotification(null);
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(dismissNotification, 5000);
  };

  const addSection = () => {
    setConfig((prev) => ({
      ...prev,
      sections: [...prev.sections, emptySection()],
    }));
  };

  const deleteSection = (index: number) => {
    if (config.sections.length <= 1) {
      showNotification("error", "At least one section is required.");
      return;
    }
    setConfig((prev) => {
      const next = [...prev.sections];
      next.splice(index, 1);
      return { ...prev, sections: next };
    });
  };

  const updateSection = (sectionIndex: number, key: keyof FBSection, value: unknown) => {
    setConfig((prev) => {
      const next = [...prev.sections];
      next[sectionIndex] = { ...next[sectionIndex], [key]: value };
      return { ...prev, sections: next };
    });
  };

  const addField = (sectionIndex: number) => {
    setConfig((prev) => {
      const next = [...prev.sections];
      next[sectionIndex] = {
        ...next[sectionIndex],
        fields: [...next[sectionIndex].fields, emptyField()],
      };
      return { ...prev, sections: next };
    });
  };

  const deleteField = (sectionIndex: number, fieldIndex: number) => {
    setConfig((prev) => {
      const next = [...prev.sections];
      next[sectionIndex] = {
        ...next[sectionIndex],
        fields: next[sectionIndex].fields.filter((_f, i) => i !== fieldIndex),
      };
      return { ...prev, sections: next };
    });
  };

  const updateField = (
    sectionIndex: number,
    fieldIndex: number,
    key: keyof FBField,
    value: unknown
  ) => {
    setConfig((prev) => {
      const next = [...prev.sections];
      next[sectionIndex] = {
        ...next[sectionIndex],
        fields: next[sectionIndex].fields.map((f, i) =>
          i === fieldIndex ? { ...f, [key]: value } : f
        ),
      };
      return { ...prev, sections: next };
    });
  };

  const moveItem = (arr: any[], index: number, dir: number): any[] => {
    const next = [...arr];
    const target = index + dir;
    if (target < 0 || target >= next.length) return next;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return next;
  };

  const moveSection = (index: number, dir: number) => {
    setConfig((prev) => ({
      ...prev,
      sections: moveItem(prev.sections, index, dir),
    }));
  };

  const moveField = (sectionIndex: number, fieldIndex: number, dir: number) => {
    setConfig((prev) => {
      const next = [...prev.sections];
      next[sectionIndex] = {
        ...next[sectionIndex],
        fields: moveItem(next[sectionIndex].fields, fieldIndex, dir),
      };
      return { ...prev, sections: next };
    });
  };

  const saveDraft = async () => {
    if (!formTitle.trim()) {
      showNotification("error", "Form title is required.");
      return;
    }
    setIsSaving(true);
    try {
      await updateProjectSubmissionForm({
        id: formId,
        title: formTitle.trim(),
        form_config: config,
        ...withCsrfToken(),
      });
      setFormStatus("draft");
      showNotification("success", "Draft saved successfully.");
    } catch (err: unknown) {
      showNotification("error", err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = () => {
    setPublishConfirmOpen(true);
  };

  const confirmPublish = async () => {
    setIsPublishing(true);
    try {
      await publishProjectSubmissionForm(formId);
      setFormStatus("published");
      setPublishConfirmOpen(false);
      showNotification("success", "Form published. It is now visible in the Team Leader Portal.");
    } catch (err: unknown) {
      showNotification("error", err instanceof Error ? err.message : "Failed to publish form.");
    } finally {
      setIsPublishing(false);
      setPublishConfirmOpen(false);
    }
  };

  const renderFieldPreview = (field: FBField) => {
    const base = "w-full px-3 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none disabled:opacity-60";
    switch (field.type) {
      case "textarea":
        return (
          <textarea
            disabled
            placeholder={field.placeholder}
            rows={3}
            className={`${base} resize-y`}
          />
        );
      case "url":
        return (
          <input
            type="url"
            disabled
            placeholder={field.placeholder}
            className={base}
          />
        );
      case "email":
        return (
          <input
            type="email"
            disabled
            placeholder={field.placeholder}
            className={base}
          />
        );
      case "number":
        return (
          <input
            type="number"
            disabled
            placeholder={field.placeholder}
            className={base}
          />
        );
      case "date":
        return (
          <input
            type="date"
            disabled
            className={base}
          />
        );
      default:
        return (
          <input
            type="text"
            disabled
            placeholder={field.placeholder}
            className={base}
          />
        );
    }
  };

  const notificationEl = notification ? (
    <div
      className={`p-3 border rounded flex items-center justify-between text-xs ${
        notification.type === "success"
          ? "bg-status-success/15 border-status-success text-status-success"
          : "bg-status-error/15 border-status-error text-status-error"
      }`}
    >
      <span className="flex items-center gap-2">
        {notification.type === "success" ? (
          <svg className="w-4 h-4 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        ) : (
          <svg className="w-4 h-4 text-status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        )}
        <span>{notification.message}</span>
      </span>
      <button onClick={dismissNotification} className="text-text-secondary hover:text-text-primary">
        Dismiss
      </button>
    </div>
  ) : null;

  return (
    <div className="space-y-6 font-tech">
      {notificationEl}

      {/* Header */}
      <div className="border-b border-border-color pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
            Admin HQ // Form Builder
          </p>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
            {formTitle || "Untitled Form"}
          </h1>
          <p className="font-tech text-text-secondary text-xs mt-2 max-w-2xl">
            Configure sections and questions for team project submissions. Changes are saved as a Draft until you publish.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <span className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase border ${
            published
              ? "bg-status-success/10 text-status-success border-status-success/40"
              : "bg-surface-color-light text-text-secondary border-border-color"
          }`}>
            {formStatus.toUpperCase()}
          </span>
          <button
            onClick={saveDraft}
            disabled={isSaving}
            className="px-4 py-2 border border-accent-secondary/40 text-accent-secondary rounded text-[10px] font-bold uppercase tracking-wider hover:bg-accent-secondary/10 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Send size={13} />}
            <span>Save Draft</span>
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing || !draft}
            className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
              draft
                ? "border-status-success/40 text-status-success bg-status-success/5 hover:bg-status-success/10"
                : "border-border-color text-text-secondary bg-surface-color hover:text-text-primary"
            }`}
          >
            {isPublishing ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Publishing...
              </>
            ) : draft ? (
              <>
                <Play size={13} />
                <span>Publish</span>
              </>
            ) : (
              <>
                <Pause size={13} />
                <span>Published</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-border-color bg-surface-color/50 rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">Sections</p>
          <p className="font-heading text-xl text-accent-tertiary m-0">{totalSections}</p>
        </div>
        <div className="border border-border-color bg-surface-color/50 rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">Questions</p>
          <p className="font-heading text-xl text-accent-tertiary m-0">{totalQuestions}</p>
        </div>
        <div className="border border-border-color bg-surface-color/50 rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">Status</p>
          <p className={`font-heading text-xl m-0 ${published ? "text-status-success" : "text-accent-primary"}`}>
            {formStatus}
          </p>
        </div>
      </div>

      {/* Form title */}
      <div className="glass-panel p-5 border border-border-color rounded-lg">
        <div className="space-y-3">
          <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
            Form Title
          </label>
          <input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="e.g. Project Details & Deliverables"
            className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
          />
        </div>
      </div>

      {/* Sections builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-base text-text-primary uppercase m-0">
              Sections &amp; Questions
            </h3>
            <p className="text-[10px] text-text-secondary m-0 mt-1">
              Edit labels, placeholders, types, and required flags. Add or remove sections and questions.
            </p>
          </div>
          <button
            onClick={addSection}
            className="inline-flex items-center gap-2 px-4 py-2 border border-accent-secondary/40 text-accent-secondary rounded text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
          >
            <Plus size={13} />
            <span>Add Section</span>
          </button>
        </div>

        {config.sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            className="glass-panel border border-border-color rounded-lg overflow-hidden"
          >
            <div className="border-b border-border-color/50 bg-surface-color/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:min-w-0">
                <button
                  onClick={() => moveSection(sectionIndex, -1)}
                  disabled={sectionIndex === 0}
                  className="p-1.5 border border-border-color rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => moveSection(sectionIndex, 1)}
                  disabled={sectionIndex === config.sections.length - 1}
                  className="p-1.5 border border-border-color rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ArrowDown size={13} />
                </button>
                <div className="flex flex-col gap-1">
                  <input
                    value={section.title}
                    onChange={(e) => updateSection(sectionIndex, "title", e.target.value)}
                    placeholder="Section title"
                    className="w-[200px] sm:w-auto px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary font-bold focus:border-accent-secondary outline-none"
                  />
                  <input
                    value={section.description}
                    onChange={(e) => updateSection(sectionIndex, "description", e.target.value)}
                    placeholder="Section description"
                    className="w-[260px] sm:w-auto px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-secondary focus:border-accent-secondary outline-none"
                  />
                </div>
                <button
                  onClick={() => deleteSection(sectionIndex)}
                  className="p-1.5 border border-status-error/40 text-status-error rounded hover:bg-status-error/10"
                  title="Delete section"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <button
                onClick={() => addField(sectionIndex)}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-accent-secondary/40 text-accent-secondary rounded text-[9px] font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
              >
                <Plus size={12} />
                <span>Add Question</span>
              </button>
            </div>

            <div className="p-4 space-y-3">
              {section.fields.map((field, fieldIndex) => (
                <div
                  key={field.id}
                  className="border border-border-color/50 rounded p-3 flex flex-col sm:flex-row sm:items-start gap-3"
                >
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <button
                      onClick={() => moveField(sectionIndex, fieldIndex, -1)}
                      disabled={fieldIndex === 0}
                      className="p-1 border border-border-color rounded text-text-secondary hover:text-text-primary disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp size={11} />
                    </button>
                    <button
                      onClick={() => moveField(sectionIndex, fieldIndex, 1)}
                      disabled={fieldIndex === section.fields.length - 1}
                      className="p-1 border border-border-color rounded text-text-secondary hover:text-text-primary disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown size={11} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2 sm:space-y-0 sm:flex sm:flex-col sm:gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                          Label
                        </label>
                        <input
                          value={field.label}
                          onChange={(e) => updateField(sectionIndex, fieldIndex, "label", e.target.value)}
                          placeholder="Question label"
                          className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                          Type
                        </label>
                        <select
                          value={field.type}
                          onChange={(e) => updateField(sectionIndex, fieldIndex, "type", e.target.value)}
                          className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary uppercase focus:border-accent-secondary outline-none"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                          Placeholder
                        </label>
                        <input
                          value={field.placeholder}
                          onChange={(e) => updateField(sectionIndex, fieldIndex, "placeholder", e.target.value)}
                          placeholder="Placeholder text"
                          className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-secondary focus:border-accent-secondary outline-none"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              updateField(sectionIndex, fieldIndex, "required", e.target.checked)
                            }
                            className="w-4 h-4 rounded border-border-color accent-accent-secondary"
                          />
                          <span className="text-[10px] uppercase font-bold text-text-secondary">
                            {field.required ? "Mandatory" : "Optional"}
                          </span>
                        </label>
                      </div>
                    </div>
                    {field.required && (
                      <span className="text-[10px] text-accent-secondary uppercase font-bold">
                        MANDATORY
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteField(sectionIndex, fieldIndex)}
                    className="p-1.5 border border-status-error/40 text-status-error rounded hover:bg-status-error/10"
                    title="Delete question"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {config.sections.length === 0 && (
          <div className="border border-dashed border-border-color bg-surface-color/30 rounded-lg p-12 text-center">
            <p className="text-xs text-text-secondary mt-2">No sections yet. Add a section to begin.</p>
          </div>
        )}
      </div>

      {/* Preview */}
      <button
        onClick={() => setPreviewOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 border border-accent-tertiary/40 text-accent-tertiary rounded text-xs font-bold uppercase tracking-wider hover:bg-accent-tertiary/10"
      >
        <Eye size={13} />
        <span>Preview Form</span>
      </button>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-border-color rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between border-b border-border-color pb-4 mb-4">
              <div>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                  Form Preview
                </h3>
                <p className="text-[10px] text-text-secondary m-0 mt-1">
                  How the form appears to team leaders.
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="border-b border-border-color pb-2">
                <h3 className="font-heading text-base text-text-primary uppercase m-0">{formTitle || "Untitled Form"}</h3>
              </div>
              {config.sections.map((section) => (
                <div key={section.id} className="space-y-4">
                  <div className="border-b border-border-color/60 pb-2">
                    <h4 className="font-heading text-sm text-text-primary uppercase m-0 flex items-center gap-2">
                      <span className="w-2 h-2 bg-accent-secondary rounded" />
                      {section.title}
                    </h4>
                    {section.description && (
                      <p className="text-[10px] text-text-secondary mt-1">{section.description}</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    {section.fields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <label className="block text-xs font-bold text-text-primary flex items-center justify-between gap-2">
                          <span>{field.label}</span>
                          {field.required && (
                            <span className="text-[10px] text-accent-secondary uppercase font-bold">
                              Mandatory
                            </span>
                          )}
                        </label>
                        {renderFieldPreview(field)}
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

      {/* Publish confirmation modal */}
      <PublishConfirmationModal
        open={publishConfirmOpen}
        onClose={() => setPublishConfirmOpen(false)}
        onConfirm={confirmPublish}
        content={{
          id: formId,
          title: formTitle || "Untitled Form",
          type: "Project Submission Form",
          currentStatus: draft ? "Draft" : "Published",
          visibility: "Team Leader Portal",
        }}
        loading={isPublishing}
      />
    </div>
  );
}
