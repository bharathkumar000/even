"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { z } from "zod";

export type ProjectFormStatus = "draft" | "scheduled" | "published" | "unpublished" | "archived";
export type ProjectSubmissionState = "not_open" | "open" | "closed" | "locked";

type CsrfInput = {
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
};

// NOTE: The live project_submission_forms table stores publication state in the
// `status` column (draft / published / ...) and timestamps submissions via
// `published_at`, `opens_at` / `closes_at`. The TypeScript interface below keeps
// the historical `form_status` / `submission_state` names so existing consumers
// (content-releases workspace) keep working; reads/writes are mapped to the live
// `status` column inside each action.

const CreateProjectFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  round_id: z.string().uuid().optional().nullable(),
  form_status: z.enum(["draft", "scheduled", "published", "unpublished", "archived"]).default("draft"),
  submission_state: z.enum(["not_open", "open", "closed", "locked"]).default("not_open"),
  timezone: z.string().default("Asia/Kolkata"),
  allow_early_view: z.boolean().default(false),
  allow_draft_before_open: z.boolean().default(false),
  allow_edit_after_submit: z.boolean().default(false),
  allow_resubmission: z.boolean().default(false),
  resubmission_policy: z.enum(["none", "until_deadline", "after_approval"]).default("none"),
  auto_lock_at_deadline: z.boolean().default(true),
  allow_member_submit: z.boolean().default(false),
  max_marks: z.number().optional().nullable(),
  form_config: z.record(z.string(), z.unknown()).optional(),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export interface ProjectFormQuestion {
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
  options: Array<{ id?: string; option_text: string; option_value: string; sort_order: number }>;
}

export interface ProjectFormSection {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  questions: ProjectFormQuestion[];
}

export interface ProjectSubmissionForm {
  id: string;
  event_id: string | null;
  round_id: string | null;
  title: string;
  description: string | null;
  form_status: ProjectFormStatus;
  submission_state: ProjectSubmissionState;
  version: number;
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
  form_config: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapProjectFormRow(row: any): ProjectSubmissionForm {
  const status: ProjectFormStatus = (row.form_status || "draft") as ProjectFormStatus;
  return {
    id: row.id,
    event_id: row.event_id ?? null,
    round_id: row.round_id ?? null,
    title: row.title,
    description: row.description ?? null,
    form_status: status,
    submission_state: row.submission_state ?? (status === "published" ? "open" : (status === "archived" ? "locked" : "not_open")),
    version: row.current_version ?? row.version ?? 1,
    view_available_at: row.view_available_at ?? null,
    submission_open_at: row.submission_open_at ?? null,
    submission_close_at: row.submission_close_at ?? null,
    timezone: row.timezone ?? "Asia/Kolkata",
    allow_early_view: Boolean(row.allow_early_view),
    allow_draft_before_open: Boolean(row.allow_draft_before_open),
    allow_edit_after_submit: Boolean(row.allow_edit_after_submit),
    allow_resubmission: false,
    resubmission_policy: "none",
    auto_lock_at_deadline: true,
    allow_member_submit: Boolean(row.allow_member_submit),
    max_marks: row.max_marks ?? null,
    evaluation_criteria_id: row.evaluation_criteria_id ?? null,
    form_config: row.form_config ?? {},
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getProjectSubmissionForms(): Promise<{
  forms: ProjectSubmissionForm[];
  error?: string;
}> {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("project_submission_forms")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { forms: [], error: error.message };
  }

  return { forms: ((data || []) as any[]).map(mapProjectFormRow) };
}

export async function getProjectSubmissionFormById(formId: string): Promise<{
  form: ProjectSubmissionForm | null;
  error?: string;
}> {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("project_submission_forms")
    .select("*")
    .eq("id", formId)
    .maybeSingle();

  if (error) {
    return { form: null, error: error.message };
  }

  if (!data) {
    return { form: null, error: "Form not found" };
  }

  return { form: mapProjectFormRow(data) };
}

export async function createProjectSubmissionForm(input: {
  title: string;
  description?: string;
  round_id?: string | null;
  form_status?: ProjectFormStatus;
  submission_state?: ProjectSubmissionState;
  timezone?: string;
  allow_early_view?: boolean;
  allow_draft_before_open?: boolean;
  allow_edit_after_submit?: boolean;
  allow_resubmission?: boolean;
  resubmission_policy?: string;
  auto_lock_at_deadline?: boolean;
  allow_member_submit?: boolean;
  max_marks?: number | null;
  form_config?: Record<string, unknown>;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const validated = CreateProjectFormSchema.parse(input);

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("project_submission_forms")
    .insert([
      {
        title: validated.title,
        description: validated.description || null,
        status: validated.form_status || "draft",
        form_config: validated.form_config || { sections: [], questions: [] },
        created_by: user.id,
        updated_by: user.id,
        created_at: now,
        updated_at: now,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create form: ${error.message}`);
  }

  revalidatePath("/admin/content-releases");
  revalidatePath("/admin/submission-forms");

  return { form: mapProjectFormRow(data) };
}

const UpdateProjectFormSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  round_id: z.string().uuid().optional().nullable(),
  form_status: z.enum(["draft", "scheduled", "published", "unpublished", "archived"]).optional(),
  submission_state: z.enum(["not_open", "open", "closed", "locked"]).optional(),
  timezone: z.string().optional(),
  allow_early_view: z.boolean().optional(),
  allow_draft_before_open: z.boolean().optional(),
  allow_edit_after_submit: z.boolean().optional(),
  allow_resubmission: z.boolean().optional(),
  resubmission_policy: z.enum(["none", "until_deadline", "after_approval"]).optional(),
  auto_lock_at_deadline: z.boolean().optional(),
  allow_member_submit: z.boolean().optional(),
  max_marks: z.number().optional().nullable(),
  form_config: z.record(z.string(), z.unknown()).optional(),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export async function updateProjectSubmissionForm(input: {
  id: string;
  title?: string;
  description?: string | null;
  round_id?: string | null;
  form_status?: ProjectFormStatus;
  submission_state?: ProjectSubmissionState;
  timezone?: string;
  allow_early_view?: boolean;
  allow_draft_before_open?: boolean;
  allow_edit_after_submit?: boolean;
  allow_resubmission?: boolean;
  resubmission_policy?: string;
  auto_lock_at_deadline?: boolean;
  allow_member_submit?: boolean;
  max_marks?: number | null;
  form_config?: Record<string, unknown>;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const validated = UpdateProjectFormSchema.parse(input);

  const updateData: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (validated.title !== undefined) updateData.title = validated.title;
  if (validated.description !== undefined) updateData.description = validated.description;
  if (validated.form_status !== undefined) updateData.status = validated.form_status;
  if (validated.form_config !== undefined) updateData.form_config = validated.form_config;
  if (validated.allow_draft_before_open !== undefined) updateData.allow_draft = validated.allow_draft_before_open;
  if (validated.allow_edit_after_submit !== undefined) updateData.allow_edit_after_submission = validated.allow_edit_after_submit;

  const { data, error } = await supabaseAdmin
    .from("project_submission_forms")
    .update(updateData)
    .eq("id", validated.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update form: ${error.message}`);
  }

  revalidatePath("/admin/content-releases");
  revalidatePath("/admin/submission-forms");

  return { form: mapProjectFormRow(data) };
}

export async function publishProjectSubmissionForm(formId: string, _options?: CsrfInput) {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("project_submission_forms")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to publish form: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return mapProjectFormRow(data);
}

export async function unpublishProjectSubmissionForm(formId: string, _options?: CsrfInput) {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("project_submission_forms")
    .update({
      status: "draft",
      published_at: null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to unpublish form: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return mapProjectFormRow(data);
}

export async function archiveProjectSubmissionForm(formId: string, _options?: CsrfInput) {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("project_submission_forms")
    .update({
      status: "archived",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to archive form: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return mapProjectFormRow(data);
}

export async function deleteProjectSubmissionForm(formId: string, _options?: CsrfInput) {
  const { user } = await requireAdmin();

  const { error } = await supabaseAdmin
    .from("project_submission_forms")
    .delete()
    .eq("id", formId);

  if (error) throw new Error(`Failed to delete form: ${error.message}`);

  revalidatePath("/admin/content-releases");
  return { success: true };
}
