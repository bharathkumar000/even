"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { z } from "zod";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type FormStatus = "draft" | "scheduled" | "published" | "unpublished" | "archived";
export type SubmissionState = "not_open" | "open" | "closed" | "locked";
export type QuestionType =
  | "short_answer" | "long_answer" | "single_choice" | "multiple_choice"
  | "dropdown" | "yes_no" | "checkbox" | "number" | "email" | "url"
  | "date" | "time" | "datetime" | "file_upload" | "image_upload"
  | "video_link" | "rating" | "linear_scale" | "section_heading";

export interface SubmissionForm {
  id: string;
  event_id: string | null;
  round_id: string | null;
  title: string;
  description: string | null;
  form_status: FormStatus;
  submission_state: SubmissionState;
  view_available_at: string | null;
  submission_open_at: string | null;
  submission_close_at: string | null;
  timezone: string;
  allow_early_view: boolean;
  allow_draft_before_open: boolean;
  allow_edit_after_submit: boolean;
  allow_resubmission: boolean;
  resubmission_policy: string;
  auto_lock_at_deadline: boolean;
  allow_member_submit: boolean;
  max_marks: number | null;
  evaluation_criteria_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormSection {
  id: string;
  form_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormQuestion {
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
  created_at: string;
  updated_at: string;
}

export interface FormQuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  option_value: string;
  sort_order: number;
  created_at: string;
}

// ------------------------------------------------------------
// Form CRUD
// ------------------------------------------------------------

export async function getSubmissionForms(): Promise<{ forms: SubmissionForm[]; error?: string }> {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("submission_forms")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { forms: [], error: error.message };
  }

  return { forms: (data || []) as SubmissionForm[] };
}

export async function getSubmissionFormById(id: string): Promise<{
  form: SubmissionForm | null;
  sections: FormSection[];
  questions: FormQuestion[];
  options: Record<string, FormQuestionOption[]>;
  error?: string;
}> {
  await requireAdmin();

  const { data: form, error: formError } = await supabaseAdmin
    .from("submission_forms")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (formError) {
    return { form: null, sections: [], questions: [], options: {}, error: formError.message };
  }

  if (!form) {
    return { form: null, sections: [], questions: [], options: {}, error: "Form not found" };
  }

  const { data: sections, error: sectionsError } = await supabaseAdmin
    .from("form_sections")
    .select("*")
    .eq("form_id", id)
    .order("sort_order", { ascending: true });

  if (sectionsError) {
    return { form: null as any, sections: [], questions: [], options: {}, error: sectionsError.message };
  }

  const sectionIds = (sections || []).map((s) => s.id);

  const { data: questions, error: questionsError } = await supabaseAdmin
    .from("form_questions")
    .select("*")
    .in("section_id", sectionIds)
    .order("sort_order", { ascending: true });

  if (questionsError) {
    return { form: null as any, sections: [], questions: [], options: {}, error: questionsError.message };
  }

  const questionIds = (questions || []).map((q) => q.id);

  const { data: options, error: optionsError } = await supabaseAdmin
    .from("form_question_options")
    .select("*")
    .in("question_id", questionIds)
    .order("sort_order", { ascending: true });

  if (optionsError) {
    return { form: null as any, sections: [], questions: [], options: {}, error: optionsError.message };
  }

  const optionsMap: Record<string, FormQuestionOption[]> = {};
  for (const opt of (options || [])) {
    if (!optionsMap[opt.question_id]) optionsMap[opt.question_id] = [];
    optionsMap[opt.question_id].push(opt);
  }

  return {
    form: form as SubmissionForm,
    sections: (sections || []) as FormSection[],
    questions: (questions || []) as FormQuestion[],
    options: optionsMap,
  };
}

const CreateFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  event_id: z.string().uuid().optional().nullable(),
  round_id: z.string().uuid().optional().nullable(),
  form_status: z.enum(["draft", "scheduled", "published", "unpublished", "archived"]).default("draft"),
  submission_state: z.enum(["not_open", "open", "closed", "locked"]).default("not_open"),
  view_available_at: z.string().optional().nullable(),
  submission_open_at: z.string().optional().nullable(),
  submission_close_at: z.string().optional().nullable(),
  timezone: z.string().default("Asia/Kolkata"),
  allow_early_view: z.boolean().default(false),
  allow_draft_before_open: z.boolean().default(false),
  allow_edit_after_submit: z.boolean().default(false),
  allow_resubmission: z.boolean().default(false),
  resubmission_policy: z.enum(["none", "until_deadline", "after_approval"]).default("none"),
  auto_lock_at_deadline: z.boolean().default(true),
  allow_member_submit: z.boolean().default(false),
  max_marks: z.number().optional().nullable(),
  evaluation_criteria_id: z.string().uuid().optional().nullable(),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export async function createSubmissionForm(input: {
  title: string;
  description?: string;
  event_id?: string | null;
  round_id?: string | null;
  form_status?: FormStatus;
  submission_state?: SubmissionState;
  view_available_at?: string | null;
  submission_open_at?: string | null;
  submission_close_at?: string | null;
  timezone?: string;
  allow_early_view?: boolean;
  allow_draft_before_open?: boolean;
  allow_edit_after_submit?: boolean;
  allow_resubmission?: boolean;
  resubmission_policy?: string;
  auto_lock_at_deadline?: boolean;
  allow_member_submit?: boolean;
  max_marks?: number | null;
  evaluation_criteria_id?: string | null;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const validated = CreateFormSchema.parse(input);

  const { data, error } = await supabaseAdmin
    .from("submission_forms")
    .insert([
      {
        title: validated.title,
        description: validated.description || null,
        event_id: validated.event_id || null,
        round_id: validated.round_id || null,
        form_status: validated.form_status,
        submission_state: validated.submission_state,
        view_available_at: validated.view_available_at || null,
        submission_open_at: validated.submission_open_at || null,
        submission_close_at: validated.submission_close_at || null,
        timezone: validated.timezone,
        allow_early_view: validated.allow_early_view,
        allow_draft_before_open: validated.allow_draft_before_open,
        allow_edit_after_submit: validated.allow_edit_after_submit,
        allow_resubmission: validated.allow_resubmission,
        resubmission_policy: validated.resubmission_policy,
        auto_lock_at_deadline: validated.auto_lock_at_deadline,
        allow_member_submit: validated.allow_member_submit,
        max_marks: validated.max_marks ?? null,
        evaluation_criteria_id: validated.evaluation_criteria_id || null,
        created_by: user.id,
        updated_by: user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create form: ${error.message}`);
  }

  revalidatePath("/admin/content-releases");
  revalidatePath("/admin/submission-forms");

  return { form: data as SubmissionForm };
}

const UpdateFormSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  form_status: z.enum(["draft", "scheduled", "published", "unpublished", "archived"]).optional(),
  submission_state: z.enum(["not_open", "open", "closed", "locked"]).optional(),
  view_available_at: z.string().optional().nullable(),
  submission_open_at: z.string().optional().nullable(),
  submission_close_at: z.string().optional().nullable(),
  timezone: z.string().optional(),
  allow_early_view: z.boolean().optional(),
  allow_draft_before_open: z.boolean().optional(),
  allow_edit_after_submit: z.boolean().optional(),
  allow_resubmission: z.boolean().optional(),
  resubmission_policy: z.enum(["none", "until_deadline", "after_approval"]).optional(),
  auto_lock_at_deadline: z.boolean().optional(),
  allow_member_submit: z.boolean().optional(),
  max_marks: z.number().optional().nullable(),
  evaluation_criteria_id: z.string().uuid().optional().nullable(),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export async function updateSubmissionForm(input: {
  id: string;
  title?: string;
  description?: string | null;
  form_status?: FormStatus;
  submission_state?: SubmissionState;
  view_available_at?: string | null;
  submission_open_at?: string | null;
  submission_close_at?: string | null;
  timezone?: string;
  allow_early_view?: boolean;
  allow_draft_before_open?: boolean;
  allow_edit_after_submit?: boolean;
  allow_resubmission?: boolean;
  resubmission_policy?: string;
  auto_lock_at_deadline?: boolean;
  allow_member_submit?: boolean;
  max_marks?: number | null;
  evaluation_criteria_id?: string | null;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const validated = UpdateFormSchema.parse(input);

  const updateData: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (validated.title !== undefined) updateData.title = validated.title;
  if (validated.description !== undefined) updateData.description = validated.description;
  if (validated.form_status !== undefined) updateData.form_status = validated.form_status;
  if (validated.submission_state !== undefined) updateData.submission_state = validated.submission_state;
  if (validated.view_available_at !== undefined) updateData.view_available_at = validated.view_available_at;
  if (validated.submission_open_at !== undefined) updateData.submission_open_at = validated.submission_open_at;
  if (validated.submission_close_at !== undefined) updateData.submission_close_at = validated.submission_close_at;
  if (validated.timezone !== undefined) updateData.timezone = validated.timezone;
  if (validated.allow_early_view !== undefined) updateData.allow_early_view = validated.allow_early_view;
  if (validated.allow_draft_before_open !== undefined) updateData.allow_draft_before_open = validated.allow_draft_before_open;
  if (validated.allow_edit_after_submit !== undefined) updateData.allow_edit_after_submit = validated.allow_edit_after_submit;
  if (validated.allow_resubmission !== undefined) updateData.allow_resubmission = validated.allow_resubmission;
  if (validated.resubmission_policy !== undefined) updateData.resubmission_policy = validated.resubmission_policy;
  if (validated.auto_lock_at_deadline !== undefined) updateData.auto_lock_at_deadline = validated.auto_lock_at_deadline;
  if (validated.allow_member_submit !== undefined) updateData.allow_member_submit = validated.allow_member_submit;
  if (validated.max_marks !== undefined) updateData.max_marks = validated.max_marks;
  if (validated.evaluation_criteria_id !== undefined) updateData.evaluation_criteria_id = validated.evaluation_criteria_id;

  const { data, error } = await supabaseAdmin
    .from("submission_forms")
    .update(updateData)
    .eq("id", validated.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update form: ${error.message}`);
  }

  revalidatePath("/admin/content-releases");
  revalidatePath("/admin/submission-forms");

  return { form: data as SubmissionForm };
}

export async function deleteSubmissionForm(id: string, csrfToken?: string): Promise<{ success: boolean }> {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const { error } = await supabaseAdmin
    .from("submission_forms")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete form: ${error.message}`);
  }

  revalidatePath("/admin/content-releases");
  revalidatePath("/admin/submission-forms");

  return { success: true };
}

// ------------------------------------------------------------
// Section CRUD
// ------------------------------------------------------------

const CreateSectionSchema = z.object({
  form_id: z.string().uuid(),
  title: z.string().min(1, "Section title is required"),
  description: z.string().optional().nullable(),
  sort_order: z.number().default(0),
  is_required: z.boolean().default(true),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export async function createFormSection(input: {
  form_id: string;
  title: string;
  description?: string | null;
  sort_order?: number;
  is_required?: boolean;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const validated = CreateSectionSchema.parse(input);

  const { data, error } = await supabaseAdmin
    .from("form_sections")
    .insert([
      {
        form_id: validated.form_id,
        title: validated.title,
        description: validated.description || null,
        sort_order: validated.sort_order,
        is_required: validated.is_required,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create section: ${error.message}`);
  }

  revalidatePath("/admin/submission-forms");

  return { section: data as FormSection };
}

export async function updateFormSection(input: {
  id: string;
  title?: string;
  description?: string | null;
  sort_order?: number;
  is_required?: boolean;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;
  if (input.is_required !== undefined) updateData.is_required = input.is_required;

  const { data, error } = await supabaseAdmin
    .from("form_sections")
    .update(updateData)
    .eq("id", input.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update section: ${error.message}`);
  }

  revalidatePath("/admin/submission-forms");

  return { section: data as FormSection };
}

export async function deleteFormSection(id: string, csrfToken?: string): Promise<{ success: boolean }> {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const { error } = await supabaseAdmin
    .from("form_sections")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete section: ${error.message}`);
  }

  revalidatePath("/admin/submission-forms");

  return { success: true };
}

// ------------------------------------------------------------
// Question CRUD
// ------------------------------------------------------------

const CreateQuestionSchema = z.object({
  section_id: z.string().uuid(),
  title: z.string().min(1, "Question title is required"),
  description: z.string().optional().nullable(),
  placeholder: z.string().optional().nullable(),
  question_type: z.string(),
  is_required: z.boolean().default(true),
  sort_order: z.number().default(0),
  default_value: z.string().optional().nullable(),
  min_chars: z.number().optional().nullable(),
  max_chars: z.number().optional().nullable(),
  min_value: z.number().optional().nullable(),
  max_value: z.number().optional().nullable(),
  max_selections: z.number().optional().nullable(),
  max_file_size: z.number().optional().nullable(),
  max_attachments: z.number().default(1),
  allowed_file_types: z.array(z.string()).optional().nullable(),
  validation_rules: z.record(z.string(), z.unknown()).default({}),
  conditional_visibility: z.record(z.string(), z.unknown()).default({}),
  options: z.array(z.object({
    option_text: z.string(),
    option_value: z.string(),
    sort_order: z.number().default(0),
  })).optional(),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export async function createFormQuestion(input: {
  section_id: string;
  title: string;
  description?: string | null;
  placeholder?: string | null;
  question_type: QuestionType;
  is_required?: boolean;
  sort_order?: number;
  default_value?: string | null;
  min_chars?: number | null;
  max_chars?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  max_selections?: number | null;
  max_file_size?: number | null;
  max_attachments?: number;
  allowed_file_types?: string[] | null;
  validation_rules?: Record<string, unknown>;
  conditional_visibility?: Record<string, unknown>;
  options?: Array<{ option_text: string; option_value: string; sort_order?: number }>;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const validated = CreateQuestionSchema.parse(input);

  const { data, error } = await supabaseAdmin
    .from("form_questions")
    .insert([
      {
        section_id: validated.section_id,
        title: validated.title,
        description: validated.description || null,
        placeholder: validated.placeholder || null,
        question_type: validated.question_type,
        is_required: validated.is_required,
        sort_order: validated.sort_order,
        default_value: validated.default_value || null,
        min_chars: validated.min_chars ?? null,
        max_chars: validated.max_chars ?? null,
        min_value: validated.min_value ?? null,
        max_value: validated.max_value ?? null,
        max_selections: validated.max_selections ?? null,
        max_file_size: validated.max_file_size ?? null,
        max_attachments: validated.max_attachments,
        allowed_file_types: validated.allowed_file_types || null,
        validation_rules: validated.validation_rules,
        conditional_visibility: validated.conditional_visibility,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create question: ${error.message}`);
  }

  // Create options if provided (for MCQ, dropdown, checkbox, etc.)
  if (validated.options && validated.options.length > 0) {
    const optionsToInsert = validated.options.map((opt) => ({
      question_id: data.id,
      option_text: opt.option_text,
      option_value: opt.option_value,
      sort_order: opt.sort_order,
    }));

    const { error: optsError } = await supabaseAdmin
      .from("form_question_options")
      .insert(optionsToInsert);

    if (optsError) {
      throw new Error(`Failed to create question options: ${optsError.message}`);
    }
  }

  revalidatePath("/admin/submission-forms");

  return { question: data as FormQuestion };
}

export async function updateFormQuestion(input: {
  id: string;
  title?: string;
  description?: string | null;
  placeholder?: string | null;
  question_type?: QuestionType;
  is_required?: boolean;
  sort_order?: number;
  default_value?: string | null;
  min_chars?: number | null;
  max_chars?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  max_selections?: number | null;
  max_file_size?: number | null;
  max_attachments?: number;
  allowed_file_types?: string[] | null;
  validation_rules?: Record<string, unknown>;
  conditional_visibility?: Record<string, unknown>;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.placeholder !== undefined) updateData.placeholder = input.placeholder;
  if (input.question_type !== undefined) updateData.question_type = input.question_type;
  if (input.is_required !== undefined) updateData.is_required = input.is_required;
  if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;
  if (input.default_value !== undefined) updateData.default_value = input.default_value;
  if (input.min_chars !== undefined) updateData.min_chars = input.min_chars;
  if (input.max_chars !== undefined) updateData.max_chars = input.max_chars;
  if (input.min_value !== undefined) updateData.min_value = input.min_value;
  if (input.max_value !== undefined) updateData.max_value = input.max_value;
  if (input.max_selections !== undefined) updateData.max_selections = input.max_selections;
  if (input.max_file_size !== undefined) updateData.max_file_size = input.max_file_size;
  if (input.max_attachments !== undefined) updateData.max_attachments = input.max_attachments;
  if (input.allowed_file_types !== undefined) updateData.allowed_file_types = input.allowed_file_types;
  if (input.validation_rules !== undefined) updateData.validation_rules = input.validation_rules;
  if (input.conditional_visibility !== undefined) updateData.conditional_visibility = input.conditional_visibility;

  const { data, error } = await supabaseAdmin
    .from("form_questions")
    .update(updateData)
    .eq("id", input.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update question: ${error.message}`);
  }

  revalidatePath("/admin/submission-forms");

  return { question: data as FormQuestion };
}

export async function deleteFormQuestion(id: string, csrfToken?: string): Promise<{ success: boolean }> {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const { error } = await supabaseAdmin
    .from("form_questions")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete question: ${error.message}`);
  }

  revalidatePath("/admin/submission-forms");

  return { success: true };
}

// ------------------------------------------------------------
// Duplicate form
// ------------------------------------------------------------

export async function duplicateSubmissionForm(
  id: string,
  newTitle: string,
  csrfToken?: string
): Promise<{ form: SubmissionForm }> {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  // Fetch existing form with sections and questions
  const existing = await getSubmissionFormById(id);
  if (!existing.form) {
    throw new Error("Form not found");
  }

  // Create new form
  const { data: newForm, error: formError } = await supabaseAdmin
    .from("submission_forms")
    .insert([
      {
        title: newTitle,
        description: existing.form.description,
        event_id: existing.form.event_id,
        round_id: existing.form.round_id,
        form_status: "draft",
        submission_state: "not_open",
        view_available_at: existing.form.view_available_at,
        submission_open_at: existing.form.submission_open_at,
        submission_close_at: existing.form.submission_close_at,
        timezone: existing.form.timezone,
        allow_early_view: existing.form.allow_early_view,
        allow_draft_before_open: existing.form.allow_draft_before_open,
        allow_edit_after_submit: existing.form.allow_edit_after_submit,
        allow_resubmission: existing.form.allow_resubmission,
        resubmission_policy: existing.form.resubmission_policy,
        auto_lock_at_deadline: existing.form.auto_lock_at_deadline,
        allow_member_submit: existing.form.allow_member_submit,
        max_marks: existing.form.max_marks,
        evaluation_criteria_id: existing.form.evaluation_criteria_id,
        created_by: user.id,
        updated_by: user.id,
      },
    ])
    .select()
    .single();

  if (formError) {
    throw new Error(`Failed to duplicate form: ${formError.message}`);
  }

  // Duplicate sections
  const sectionMap: Record<string, string> = {};
  for (const section of existing.sections) {
    const { data: newSection, error: secError } = await supabaseAdmin
      .from("form_sections")
      .insert([
        {
          form_id: newForm.id,
          title: section.title,
          description: section.description,
          sort_order: section.sort_order,
          is_required: section.is_required,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (secError) {
      throw new Error(`Failed to duplicate section: ${secError.message}`);
    }

    sectionMap[section.id] = newSection.id;
  }

  // Duplicate questions and options
  for (const question of existing.questions) {
    const newSectionId = sectionMap[question.section_id];
    if (!newSectionId) continue;

    const { data: newQuestion, error: qError } = await supabaseAdmin
      .from("form_questions")
      .insert([
        {
          section_id: newSectionId,
          title: question.title,
          description: question.description,
          placeholder: question.placeholder,
          question_type: question.question_type,
          is_required: question.is_required,
          sort_order: question.sort_order,
          default_value: question.default_value,
          min_chars: question.min_chars,
          max_chars: question.max_chars,
          min_value: question.min_value,
          max_value: question.max_value,
          max_selections: question.max_selections,
          max_file_size: question.max_file_size,
          max_attachments: question.max_attachments,
          allowed_file_types: question.allowed_file_types,
          validation_rules: question.validation_rules,
          conditional_visibility: question.conditional_visibility,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (qError) {
      throw new Error(`Failed to duplicate question: ${qError.message}`);
    }

    const questionOptions = existing.options[question.id] || [];
    if (questionOptions.length > 0) {
      const optionsToInsert = questionOptions.map((opt) => ({
        question_id: newQuestion.id,
        option_text: opt.option_text,
        option_value: opt.option_value,
        sort_order: opt.sort_order,
      }));

      const { error: optsError } = await supabaseAdmin
        .from("form_question_options")
        .insert(optionsToInsert);

      if (optsError) {
        throw new Error(`Failed to duplicate question options: ${optsError.message}`);
      }
    }
  }

  revalidatePath("/admin/submission-forms");

  return { form: newForm as SubmissionForm };
}
