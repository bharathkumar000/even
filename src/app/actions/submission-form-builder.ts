"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export type FormStatus = "draft" | "scheduled" | "published" | "unpublished" | "archived";
export type SubmissionState = "not_open" | "open" | "closed" | "locked";
export type QuestionType =
  | "short_answer"
  | "long_answer"
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "yes_no"
  | "checkbox"
  | "number"
  | "email"
  | "url"
  | "date"
  | "time"
  | "datetime"
  | "file_upload"
  | "image_upload"
  | "video_upload"
  | "rating"
  | "scale"
  | "section_heading"
  | "description";

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
  max_attachments: number | null;
  allowed_file_types: string[] | null;
  validation_rules: Record<string, unknown>;
  conditional_visibility: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  options: FormQuestionOption[];
}

export interface FormQuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  option_value: string;
  sort_order: number;
  created_at: string;
}

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
  submission_count?: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  sections: FormSection[];
}

export interface CreateFormInput {
  title: string;
  description?: string;
  round_id?: string;
  form_status?: FormStatus;
  submission_state?: SubmissionState;
  submission_open_at?: string | null;
  submission_close_at?: string | null;
  timezone?: string;
  allow_edit_after_submit?: boolean;
  allow_resubmission?: boolean;
  resubmission_policy?: string;
  auto_lock_at_deadline?: boolean;
  allow_member_submit?: boolean;
  max_marks?: number | null;
}

export interface CreateSectionInput {
  form_id: string;
  title: string;
  description?: string;
  sort_order?: number;
  is_required?: boolean;
}

export interface CreateQuestionInput {
  section_id: string;
  title: string;
  description?: string;
  placeholder?: string;
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
  max_attachments?: number | null;
  allowed_file_types?: string[] | null;
  validation_rules?: Record<string, unknown>;
  conditional_visibility?: Record<string, unknown>;
  options?: Array<{ option_text: string; option_value: string }>;
}

export interface UpdateQuestionInput {
  questionId: string;
  title?: string;
  description?: string;
  placeholder?: string;
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
  max_attachments?: number | null;
  allowed_file_types?: string[] | null;
  validation_rules?: Record<string, unknown>;
  conditional_visibility?: Record<string, unknown>;
}

export interface ReorderQuestionsInput {
  questionId: string;
  newSortOrder: number;
  sectionId: string;
}

const ALLOWED_QUESTION_TYPES: QuestionType[] = [
  "short_answer", "long_answer", "single_choice", "multiple_choice",
  "dropdown", "yes_no", "checkbox", "number", "email", "url",
  "date", "time", "datetime", "file_upload", "image_upload",
  "video_upload", "rating", "scale", "section_heading", "description",
];

function isValidQuestionType(value: string): value is QuestionType {
  return ALLOWED_QUESTION_TYPES.includes(value as QuestionType);
}

export async function createSubmissionForm(input: CreateFormInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const title = input.title.trim();
  if (!title) throw new Error("Form title is required.");

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("submission_forms")
    .insert([
      {
        title,
        description: input.description?.trim() || null,
        round_id: input.round_id || null,
        form_status: input.form_status || "draft",
        submission_state: input.submission_state || "not_open",
        submission_open_at: input.submission_open_at || null,
        submission_close_at: input.submission_close_at || null,
        timezone: input.timezone || "Asia/Kolkata",
        allow_edit_after_submit: input.allow_edit_after_submit ?? false,
        allow_resubmission: input.allow_resubmission ?? false,
        resubmission_policy: input.resubmission_policy || "none",
        auto_lock_at_deadline: input.auto_lock_at_deadline ?? true,
        allow_member_submit: input.allow_member_submit ?? false,
        max_marks: input.max_marks || null,
        created_by: user.id,
        updated_by: user.id,
        created_at: now,
        updated_at: now,
      },
    ])
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create form: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return data as SubmissionForm;
}

export async function updateSubmissionForm(
  formId: string,
  input: Partial<CreateFormInput> & { [CSRF_CONSTANTS.HEADER_NAME]?: string }
) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const updateData: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error("Form title is required.");
    updateData.title = title;
  }
  if (input.description !== undefined) updateData.description = input.description.trim() || null;
  if (input.round_id !== undefined) updateData.round_id = input.round_id;
  if (input.form_status !== undefined) updateData.form_status = input.form_status;
  if (input.submission_state !== undefined) updateData.submission_state = input.submission_state;
  if (input.submission_open_at !== undefined) updateData.submission_open_at = input.submission_open_at;
  if (input.submission_close_at !== undefined) updateData.submission_close_at = input.submission_close_at;
  if (input.timezone !== undefined) updateData.timezone = input.timezone;
  if (input.allow_edit_after_submit !== undefined) updateData.allow_edit_after_submit = input.allow_edit_after_submit;
  if (input.allow_resubmission !== undefined) updateData.allow_resubmission = input.allow_resubmission;
  if (input.resubmission_policy !== undefined) updateData.resubmission_policy = input.resubmission_policy;
  if (input.auto_lock_at_deadline !== undefined) updateData.auto_lock_at_deadline = input.auto_lock_at_deadline;
  if (input.allow_member_submit !== undefined) updateData.allow_member_submit = input.allow_member_submit;
  if (input.max_marks !== undefined) updateData.max_marks = input.max_marks;

  const { data, error } = await supabaseAdmin
    .from("submission_forms")
    .update(updateData)
    .eq("id", formId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update form: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return data as SubmissionForm;
}

export async function getSubmissionFormsByActivity(activityId: string): Promise<SubmissionForm[]> {
  await requireAdmin();

  // activity_id column does not exist on submission_forms; return all forms
  // and let the caller filter if needed.
  const { data: forms, error } = await supabaseAdmin
    .from("submission_forms")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load forms: ${error.message}`);

  const result: SubmissionForm[] = [];
  for (const form of (forms || []) as any[]) {
    const sections = await getFormSections(form.id);
    result.push({ ...form, sections } as SubmissionForm);
  }

  return result;
}

export async function getSubmissionFormById(formId: string): Promise<SubmissionForm | null> {
  await requireAdmin();

  const { data: form, error } = await supabaseAdmin
    .from("submission_forms")
    .select("*")
    .eq("id", formId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load form: ${error.message}`);
  if (!form) return null;

  const sections = await getFormSections(formId);

  return { ...form, sections } as SubmissionForm;
}

async function getFormSections(formId: string): Promise<FormSection[]> {
  const { data: sections, error } = await supabaseAdmin
    .from("form_sections")
    .select("*")
    .eq("form_id", formId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to load sections: ${error.message}`);

  const result: FormSection[] = [];
  for (const section of (sections || []) as any[]) {
    const questions = await getFormQuestions(section.id);
    result.push({ ...section, questions } as FormSection & { questions: FormQuestion[] });
  }

  return result as FormSection[];
}

async function getFormQuestions(sectionId: string): Promise<FormQuestion[]> {
  const { data: questions, error } = await supabaseAdmin
    .from("form_questions")
    .select("*")
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to load questions: ${error.message}`);

  const questionIds = (questions || []).map((q) => q.id);

  const optionsMap: Record<string, FormQuestionOption[]> = {};
  if (questionIds.length > 0) {
    const { data: options, error: optsError } = await supabaseAdmin
      .from("form_question_options")
      .select("*")
      .in("question_id", questionIds)
      .order("sort_order", { ascending: true });

    if (optsError) throw new Error(`Failed to load options: ${optsError.message}`);

    for (const opt of (options || []) as any[]) {
      if (!optionsMap[opt.question_id]) optionsMap[opt.question_id] = [];
      optionsMap[opt.question_id].push(opt as FormQuestionOption);
    }
  }

  return (questions || []).map((q: any) => ({
    ...q,
    options: optionsMap[q.id] || [],
  })) as FormQuestion[];
}

export async function createFormSection(input: CreateSectionInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const title = input.title.trim();
  if (!title) throw new Error("Section title is required.");

  const sortOrder = input.sort_order ?? 0;

  const { data, error } = await supabaseAdmin
    .from("form_sections")
    .insert([
      {
        form_id: input.form_id,
        title,
        description: input.description?.trim() || null,
        sort_order: sortOrder,
        is_required: input.is_required ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create section: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return data as FormSection;
}

export async function createFormQuestion(input: CreateQuestionInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  if (!isValidQuestionType(input.question_type)) {
    throw new Error("Invalid question type.");
  }

  const title = input.title.trim();
  if (!title) throw new Error("Question title is required.");

  const sortOrder = input.sort_order ?? 0;

  const { data, error } = await supabaseAdmin
    .from("form_questions")
    .insert([
      {
        section_id: input.section_id,
        title,
        description: input.description?.trim() || null,
        placeholder: input.placeholder?.trim() || null,
        question_type: input.question_type,
        is_required: input.is_required ?? true,
        sort_order: sortOrder,
        default_value: input.default_value ?? null,
        min_chars: input.min_chars ?? null,
        max_chars: input.max_chars ?? null,
        min_value: input.min_value ?? null,
        max_value: input.max_value ?? null,
        max_selections: input.max_selections ?? null,
        max_file_size: input.max_file_size ?? null,
        max_attachments: input.max_attachments ?? 1,
        allowed_file_types: input.allowed_file_types ?? null,
        validation_rules: input.validation_rules ?? {},
        conditional_visibility: input.conditional_visibility ?? {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create question: ${error.message}`);

  const question = data as any;

  // Create options if provided (for single_choice, multiple_choice, dropdown)
  if (input.options && input.options.length > 0) {
    const optionsToInsert = input.options.map((opt, idx) => ({
      question_id: question.id,
      option_text: opt.option_text.trim(),
      option_value: opt.option_value.trim(),
      sort_order: idx,
    }));

    await supabaseAdmin
      .from("form_question_options")
      .insert(optionsToInsert);
  }

  revalidatePath("/admin/content-releases");
  return { ...question, options: input.options || [] } as FormQuestion;
}

export async function updateFormQuestion(input: UpdateQuestionInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const updateData: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error("Question title is required.");
    updateData.title = title;
  }
  if (input.description !== undefined) updateData.description = input.description.trim() || null;
  if (input.placeholder !== undefined) updateData.placeholder = input.placeholder.trim() || null;
  if (input.question_type !== undefined) {
    if (!isValidQuestionType(input.question_type)) throw new Error("Invalid question type.");
    updateData.question_type = input.question_type;
  }
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
    .eq("id", input.questionId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update question: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return data as FormQuestion;
}

type CsrfInput = {
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
};

export async function deleteFormQuestion(questionId: string, _options?: CsrfInput) {
  const { user } = await requireAdmin();

  // Delete options first
  await supabaseAdmin
    .from("form_question_options")
    .delete()
    .eq("question_id", questionId);

  const { error } = await supabaseAdmin
    .from("form_questions")
    .delete()
    .eq("id", questionId);

  if (error) throw new Error(`Failed to delete question: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return { success: true };
}

export async function reorderFormQuestions(input: ReorderQuestionsInput & CsrfInput) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { error } = await supabaseAdmin
    .from("form_questions")
    .update({ sort_order: input.newSortOrder, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", input.questionId)
    .eq("section_id", input.sectionId);

  if (error) throw new Error(`Failed to reorder question: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return { success: true };
}

export async function publishSubmissionForm(formId: string, _options?: CsrfInput) {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("submission_forms")
    .update({
      form_status: "published",
      submission_state: "open",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to publish form: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return data as SubmissionForm;
}

export async function unpublishSubmissionForm(formId: string, _options?: CsrfInput) {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("submission_forms")
    .update({
      form_status: "unpublished",
      submission_state: "closed",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to unpublish form: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return data as SubmissionForm;
}

export async function archiveSubmissionForm(formId: string, _options?: CsrfInput) {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("submission_forms")
    .update({
      form_status: "archived",
      submission_state: "locked",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to archive form: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return data as SubmissionForm;
}

export async function deleteFormSection(sectionId: string, _options?: CsrfInput) {
  const { user } = await requireAdmin();

  const { error } = await supabaseAdmin
    .from("form_sections")
    .delete()
    .eq("id", sectionId);

  if (error) throw new Error(`Failed to delete section: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return { success: true };
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
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update section: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return data as FormSection;
}
