"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { requireAdmin } from "@/lib/auth/admin";
import { z } from "zod";

export interface SubmissionDraft {
  id: string;
  form_id: string;
  team_id: string;
  answers: Record<string, unknown>;
  file_references: Array<{
    question_id: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    size: number;
  }>;
  last_saved_by: string | null;
  last_saved_at: string;
  created_at: string;
  updated_at: string;
}

export interface SubmissionFinal {
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
  evaluation_score: number | null;
  evaluation_feedback: string | null;
  admin_remarks: string | null;
  created_at: string;
  updated_at: string;
  teams?: {
    id: string;
    name: string;
    track: string | null;
    leader_name: string | null;
  };
}

export interface SubmissionAttachment {
  id: string;
  submission_id: string | null;
  draft_id: string | null;
  question_id: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number;
  uploaded_at: string;
  is_final: boolean;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
  ".csv", ".zip", ".jpg", ".jpeg", ".png", ".webp", ".mp4",
  ".mov", ".avi", ".txt", ".md", ".json",
];

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

// ------------------------------------------------------------
// Get the active published form for a team's round
// ------------------------------------------------------------

export async function getActiveSubmissionForm(teamId: string): Promise<{
  form: any | null;
  sections: any[];
  questions: any[];
  options: Record<string, any[]>;
  error?: string;
  errorType?: "auth" | "no_team" | "no_event" | "no_form" | "db_error" | "access_denied";
}> {
  // Get user's team membership to find team_id if not provided
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { form: null, sections: [], questions: [], options: {}, error: "Authentication required", errorType: "auth" };
  }

  // Find team membership
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("team_members")
    .select("team_id, role, teams!inner(id, name, event_id, track, leader_name, status)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return { form: null, sections: [], questions: [], options: {}, error: "Failed to load team membership", errorType: "db_error" };
  }

  const effectiveTeamId = teamId || membership?.team_id || null;

  if (!effectiveTeamId) {
    return { form: null, sections: [], questions: [], options: {}, error: "No team membership found. Please contact your team leader.", errorType: "no_team" };
  }

  const teamsObj = Array.isArray(membership?.teams) ? membership?.teams[0] : (membership?.teams as any);
  let teamEventId = teamsObj?.event_id || null;

  if (!teamEventId) {
    const { data: defaultEv } = await supabaseAdmin.from("events").select("id").limit(1).maybeSingle();
    teamEventId = defaultEv?.id || null;
  }

  // Get the published project submission form
  const { data: forms, error: formsError } = await supabaseAdmin
    .from("project_submission_forms")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1);

  if (formsError) {
    return { form: null, sections: [], questions: [], options: {}, error: "Database query failed.", errorType: "db_error" };
  }

  if (!forms || forms.length === 0) {
    return { form: null, sections: [], questions: [], options: {}, error: "No published submission form is available for your event at this time.", errorType: "no_form" };
  }

  const row = forms[0] as any;

  // Check if submissions are open
  const now = new Date();
  const openAt = row.opens_at ? new Date(row.opens_at) : (row.submission_open_at ? new Date(row.submission_open_at) : null);
  const closeAt = row.closes_at ? new Date(row.closes_at) : (row.submission_close_at ? new Date(row.submission_close_at) : null);

  let submissionState = (row.status === "published" || row.form_status === "published") ? "open" : "not_open";
  if (openAt && now < openAt) submissionState = "not_open";
  if (closeAt && now > closeAt && (row.auto_lock_at_deadline ?? false)) submissionState = "locked";

  const form = {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    form_status: row.status ?? row.form_status ?? "published",
    submission_state: submissionState,
    submission_open_at: (row.opens_at || row.submission_open_at) ?? null,
    submission_close_at: (row.closes_at || row.submission_close_at) ?? null,
    timezone: row.timezone ?? "Asia/Kolkata",
    allow_member_submit: true,
    auto_lock_at_deadline: Boolean(row.auto_lock_at_deadline ?? false),
    max_marks: row.max_marks ?? 50,
    event_id: teamEventId,
    round_id: row.round_id ?? null,
  };

  // Build sections/questions from the JSONB form_config.
  const formConfig = row.form_config || {};
  const rawSections = Array.isArray(formConfig.sections) ? formConfig.sections : [];
  const typeMap: Record<string, string> = {
    textarea: "long_answer",
    text: "short_answer",
    url: "url",
    email: "email",
    number: "number",
    date: "date",
  };
  const sections = rawSections.map((s: any, sIdx: number) => {
    const rawItems = Array.isArray(s.fields) && s.fields.length > 0
      ? s.fields
      : (Array.isArray(s.questions) ? s.questions : []);

    return {
      id: s.id || `section-${sIdx}`,
      form_id: row.id,
      title: s.title || "Untitled Section",
      description: s.description ?? null,
      sort_order: s.sort_order ?? sIdx,
      is_required: Boolean(s.is_required),
      questions: rawItems.map((f: any, fIdx: number) => ({
        id: f.id || `field-${sIdx}-${fIdx}`,
        section_id: s.id || `section-${sIdx}`,
        title: f.title || f.label || "Untitled Question",
        description: f.description ?? null,
        placeholder: f.placeholder ?? null,
        question_type: typeMap[f.type] || f.question_type || "short_answer",
        is_required: Boolean(f.required ?? f.is_required),
        sort_order: f.sort_order ?? fIdx,
        default_value: f.default_value ?? null,
        min_chars: f.min_chars ?? null,
        max_chars: f.max_chars ?? null,
        min_value: f.min_value ?? null,
        max_value: f.max_value ?? null,
        max_selections: f.max_selections ?? null,
        max_file_size: f.max_file_size ?? null,
        max_attachments: f.max_attachments ?? 1,
        allowed_file_types: f.allowed_file_types ?? null,
        validation_rules: f.validation_rules ?? {},
        conditional_visibility: f.conditional_visibility ?? {},
        options: f.options ?? [],
      })),
    };
  });

  if (sections.length === 0) {
    return { form: null, sections: [], questions: [], options: {}, error: "The published form has no sections or questions configured.", errorType: "no_form" };
  }

  return {
    form,
    sections,
    questions: [],
    options: {},
  };
}

// ------------------------------------------------------------
// Draft operations
// ------------------------------------------------------------

const SaveDraftSchema = z.object({
  form_id: z.string().uuid(),
  team_id: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  file_references: z.array(z.object({
    question_id: z.string(),
    file_name: z.string(),
    file_path: z.string(),
    mime_type: z.string().optional().nullable(),
    size: z.number(),
  })).optional(),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export async function saveSubmissionDraft(input: {
  form_id: string;
  team_id: string;
  answers: Record<string, unknown>;
  file_references?: Array<{
    question_id: string;
    file_name: string;
    file_path: string;
    mime_type?: string | null;
    size: number;
  }>;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}): Promise<{ draft: SubmissionDraft }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authentication required");
  }
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const validated = SaveDraftSchema.parse(input);

  // Verify team membership - use authenticated user's id, not admin's
  const { data: membership } = await supabaseAdmin
    .from("team_members")
    .select("role")
    .eq("team_id", validated.team_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    throw new Error("You are not a member of this team");
  }

  const now = new Date().toISOString();

  // Upsert draft
  const { data, error } = await supabaseAdmin
    .from("team_submission_drafts")
    .upsert(
      {
        form_id: validated.form_id,
        team_id: validated.team_id,
        answers: validated.answers,
        file_references: validated.file_references || [],
        last_saved_by: user.id,
        last_saved_at: now,
        updated_at: now,
      },
      { onConflict: "form_id, team_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save draft: ${error.message}`);
  }

  revalidatePath("/team/submission");

  return { draft: data as SubmissionDraft };
}

export async function getSubmissionDraft(
  formId: string,
  teamId: string
): Promise<{ draft: SubmissionDraft | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { draft: null, error: "Authentication required" };
  }

  // Verify membership
  const { data: membership } = await supabaseAdmin
    .from("team_members")
    .select("team_id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { draft: null, error: "Not a team member" };
  }

  const { data, error } = await supabaseAdmin
    .from("team_submission_drafts")
    .select("*")
    .eq("form_id", formId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    return { draft: null, error: error.message };
  }

  return { draft: data as SubmissionDraft | null };
}

// ------------------------------------------------------------
// Final submission
// ------------------------------------------------------------

const SubmitFinalSchema = z.object({
  form_id: z.string().uuid(),
  team_id: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  file_references: z.array(z.object({
    question_id: z.string(),
    file_name: z.string(),
    file_path: z.string(),
    mime_type: z.string().optional().nullable(),
    size: z.number(),
  })).optional(),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export async function submitFinalSubmission(input: {
  form_id: string;
  team_id: string;
  answers: Record<string, unknown>;
  file_references?: Array<{
    question_id: string;
    file_name: string;
    file_path: string;
    mime_type?: string | null;
    size: number;
  }>;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}): Promise<{ submission: SubmissionFinal }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authentication required");
  }
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const validated = SubmitFinalSchema.parse(input);

  // Verify team membership - use authenticated user's id
  const { data: membership } = await supabaseAdmin
    .from("team_members")
    .select("role")
    .eq("team_id", validated.team_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    throw new Error("You are not a member of this team");
  }

  // Check if form allows member submit or user is leader
  const { data: form } = await supabaseAdmin
    .from("project_subjection_forms")
    .select("status, closes_at, allow_edit_after_submission, form_config")
    .eq("id", validated.form_id)
    .maybeSingle();

  if (!form) {
    throw new Error("Form not found");
  }

  if (form.status !== "published") {
    throw new Error("Submissions are not open at this time");
  }

  // Server-side validation: required fields and URL validation
  const formConfig = form.form_config || {};
  const rawSections = Array.isArray(formConfig.sections) ? formConfig.sections : [];
  const missingRequired: string[] = [];
  const invalidUrls: string[] = [];

  rawSections.forEach((section: any) => {
    const fields = Array.isArray(section.fields) ? section.fields : [];
    fields.forEach((f: any) => {
      const value = validated.answers[f.id];
      const strValue = value ? value.toString() : "";

      // Check required fields
      if (Boolean(f.required) && (!strValue || strValue.trim() === "")) {
        missingRequired.push(f.label || f.title || "Untitled Question");
      }

      // URL validation for URL-type questions that have a value
      if (value && f.question_type === "url") {
        try {
          new URL(String(value));
        } catch {
          invalidUrls.push(f.label || f.title || "Untitled Question");
        }
      }
    });
  });

  if (missingRequired.length > 0) {
    throw new Error(`Required fields missing: ${missingRequired.join(", ")}`);
  }

  if (invalidUrls.length > 0) {
    throw new Error(`Invalid URL format for: ${invalidUrls.join(", ")}`);
  }

  if (!form.allow_edit_after_submission && membership.role !== "leader") {
    throw new Error("Only the team leader can submit final answers");
  }

  // Check deadline
  const nowDate = new Date();
  if (form.closes_at && new Date(form.closes_at) < nowDate) {
    throw new Error("Submission deadline has passed");
  }

  // Check for existing submission
  const { data: existing } = await supabaseAdmin
    .from("team_submission_final")
    .select("id, version, status, reference_number")
    .eq("form_id", validated.form_id)
    .eq("team_id", validated.team_id)
    .maybeSingle();

  let newVersion = 1;
  const referenceNumber = `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  if (existing) {
    newVersion = existing.version + 1;

    // Archive existing as a version
    const { data: existingFull } = await supabaseAdmin
      .from("team_submission_final")
      .select("*")
      .eq("id", existing.id)
      .maybeSingle();

    if (existingFull) {
      await supabaseAdmin
        .from("submission_versions")
        .insert([
          {
            submission_id: existing.id,
            version: existingFull.version,
            answers: existingFull.answers,
            file_references: existingFull.file_references,
            submitted_by: existingFull.submitted_by,
            submitted_at: existingFull.submitted_at,
          },
        ]);
    }
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("team_submission_final")
    .upsert(
      {
        form_id: validated.form_id,
        team_id: validated.team_id,
        version: newVersion,
        status: "submitted",
        answers: validated.answers,
        file_references: validated.file_references || [],
        submitted_by: user.id,
        submitted_at: now,
        reference_number: referenceNumber,
        updated_at: now,
      },
      { onConflict: "form_id, team_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to submit: ${error.message}`);
  }

  // Clear draft after successful submission
  await supabaseAdmin
    .from("team_submission_drafts")
    .delete()
    .eq("form_id", validated.form_id)
    .eq("team_id", validated.team_id);

  revalidatePath("/team/submission");
  revalidatePath("/admin/submission-forms");

  return { submission: data as SubmissionFinal };
}

export async function getTeamFinalSubmission(
  formId: string,
  teamId: string
): Promise<{ submission: SubmissionFinal | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { submission: null, error: "Authentication required" };
  }

  const { data, error } = await supabaseAdmin
    .from("team_submission_final")
    .select("*")
    .eq("form_id", formId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    return { submission: null, error: error.message };
  }

  return { submission: data as SubmissionFinal | null };
}

// ------------------------------------------------------------
// File upload
// ------------------------------------------------------------

const STORAGE_BUCKET = "submission-attachments";

export async function prepareSubmissionFileUpload(input: {
  draftId?: string | null;
  submissionId?: string | null;
  questionId?: string | null;
  fileName: string;
  mimeType?: string;
  size: number;
}): Promise<{
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  const ext = fileExtension(input.fileName);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }

  if (input.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB limit`);
  }

  const uploadResult = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(
      `submissions/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    );

  const uploadData = (uploadResult as any).data;
  const error = (uploadResult as any).error;

  if (error || !uploadData) {
    throw new Error(`Failed to prepare upload: ${error?.message || "Unknown error"}`);
  }

  return {
    bucket: STORAGE_BUCKET,
    path: uploadData.path,
    token: uploadData.token,
    signedUrl: uploadData.signedUrl,
  };
}

export async function registerSubmissionAttachment(input: {
  draftId?: string | null;
  submissionId?: string | null;
  questionId?: string | null;
  fileName: string;
  filePath: string;
  mimeType?: string | null;
  size: number;
}): Promise<{ attachment: SubmissionAttachment }> {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("submission_attachments")
    .insert([
      {
        draft_id: input.draftId || null,
        submission_id: input.submissionId || null,
        question_id: input.questionId || null,
        file_name: input.fileName,
        file_path: input.filePath,
        mime_type: input.mimeType || null,
        size_bytes: input.size,
        uploaded_by: user.id,
        is_final: !!input.submissionId,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to register attachment: ${error.message}`);
  }

  return { attachment: data as SubmissionAttachment };
}

export async function getSubmissionAttachments(
  submissionId?: string | null,
  draftId?: string | null
): Promise<{ attachments: SubmissionAttachment[]; error?: string }> {
  const { user } = await requireAdmin();

  let query = supabaseAdmin
    .from("submission_attachments")
    .select("*")
    .order("uploaded_at", { ascending: true });

  if (submissionId) {
    query = query.eq("submission_id", submissionId);
  } else if (draftId) {
    query = query.eq("draft_id", draftId);
  }

  const { data, error } = await query;

  if (error) {
    return { attachments: [], error: error.message };
  }

  return { attachments: (data || []) as SubmissionAttachment[] };
}

export async function getAttachmentDownloadUrl(filePath: string): Promise<{ url: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 300);

  if (error || !data) {
    throw new Error(`Failed to create download URL: ${error?.message || "Unknown error"}`);
  }

  return { url: data.signedUrl };
}

export async function removeSubmissionAttachment(attachmentId: string): Promise<{ success: boolean }> {
  const { user } = await requireAdmin();

  const { data: attachment } = await supabaseAdmin
    .from("submission_attachments")
    .select("*")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!attachment) {
    throw new Error("Attachment not found");
  }

  // Delete from storage
  await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([(attachment as any).file_path]);

  const { error } = await supabaseAdmin
    .from("submission_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) {
    throw new Error(`Failed to remove attachment: ${error.message}`);
  }

  revalidatePath("/team/submission");

  return { success: true };
}

// ------------------------------------------------------------
// Admin submission management
// ------------------------------------------------------------

export async function getAllSubmissions(formId?: string): Promise<{
  submissions: SubmissionFinal[];
  error?: string;
}> {
  await requireAdmin();

  let query = supabaseAdmin
    .from("team_submission_final")
    .select(`
      *,
      teams (id, name, track, leader_name),
      submitted_by_profile: profiles (id, full_name, email)
    `)
    .order("submitted_at", { ascending: false });

  if (formId) {
    query = query.eq("form_id", formId);
  }

  const { data, error } = await query;

  if (error) {
    return { submissions: [], error: error.message };
  }

  return { submissions: (data || []) as SubmissionFinal[] };
}

export interface TeamSubmissionStatus {
  team_id: string;
  team_name: string;
  team_track: string | null;
  team_leader_name: string | null;
  status: "not_started" | "draft" | "submitted";
  submission_id: string | null;
  version: number | null;
  submitted_at: string | null;
  reference_number: string | null;
  answers: Record<string, unknown> | null;
  file_references: any[] | null;
}

export interface FormSubmissionOverview {
  totalTeams: number;
  notStarted: number;
  draftCount: number;
  submittedCount: number;
  completionPercentage: number;
  teams: TeamSubmissionStatus[];
}

export async function getFormSubmissionOverview(formId: string): Promise<{
  overview: FormSubmissionOverview | null;
  error?: string;
}> {
  await requireAdmin();

  // Get all teams
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, name, track, leader_name")
    .order("name", { ascending: true });

  if (teamsError) {
    return { overview: null, error: teamsError.message };
  }

  const allTeams = (teams || []) as Array<{
    id: string;
    name: string;
    track: string | null;
    leader_name: string | null;
  }>;

  // Get final submissions for this form
  const { data: finalSubmissions, error: finalError } = await supabaseAdmin
    .from("team_submission_final")
    .select("team_id, status, version, submitted_at, reference_number, answers, file_references")
    .eq("form_id", formId);

  if (finalError) {
    return { overview: null, error: finalError.message };
  }

  const finalMap: Record<string, any> = {};
  for (const s of (finalSubmissions || [])) {
    finalMap[s.team_id] = s;
  }

  // Get drafts for this form
  const { data: drafts, error: draftError } = await supabaseAdmin
    .from("team_submission_drafts")
    .select("team_id, answers, file_references, last_saved_at")
    .eq("form_id", formId);

  if (draftError) {
    return { overview: null, error: draftError.message };
  }

  const draftMap: Record<string, any> = {};
  for (const d of (drafts || [])) {
    draftMap[d.team_id] = d;
  }

  // Build team status list
  const teamStatuses: TeamSubmissionStatus[] = allTeams.map((team) => {
    const final = finalMap[team.id];
    const draft = draftMap[team.id];

    if (final) {
      return {
        team_id: team.id,
        team_name: team.name,
        team_track: team.track,
        team_leader_name: team.leader_name,
        status: "submitted" as const,
        submission_id: final.id,
        version: final.version,
        submitted_at: final.submitted_at,
        reference_number: final.reference_number,
        answers: final.answers,
        file_references: final.file_references,
      };
    }

    if (draft) {
      return {
        team_id: team.id,
        team_name: team.name,
        team_track: team.track,
        team_leader_name: team.leader_name,
        status: "draft" as const,
        submission_id: null,
        version: null,
        submitted_at: draft.last_saved_at,
        reference_number: null,
        answers: draft.answers,
        file_references: draft.file_references,
      };
    }

    return {
      team_id: team.id,
      team_name: team.name,
      team_track: team.track,
      team_leader_name: team.leader_name,
      status: "not_started" as const,
      submission_id: null,
      version: null,
      submitted_at: null,
      reference_number: null,
      answers: null,
      file_references: null,
    };
  });

  const totalTeams = allTeams.length;
  const submittedCount = teamStatuses.filter((t) => t.status === "submitted").length;
  const draftCount = teamStatuses.filter((t) => t.status === "draft").length;
  const notStarted = teamStatuses.filter((t) => t.status === "not_started").length;
  const completionPercentage = totalTeams > 0 ? Math.round((submittedCount / totalTeams) * 100) : 0;

  const overview: FormSubmissionOverview = {
    totalTeams,
    notStarted,
    draftCount,
    submittedCount,
    completionPercentage,
    teams: teamStatuses,
  };

  return { overview };
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: "approved" | "rejected" | "resubmission_requested",
  adminRemarks?: string,
  csrfToken?: string
): Promise<{ submission: SubmissionFinal }> {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (adminRemarks !== undefined) updateData.admin_remarks = adminRemarks;

  if (status === "rejected" || status === "approved") {
    updateData.evaluated_by = user.id;
    updateData.evaluated_at = new Date().toISOString();
  }

  if (status === "resubmission_requested") {
    updateData.resubmission_requested_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("team_submission_final")
    .update(updateData)
    .eq("id", submissionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update submission: ${error.message}`);
  }

  revalidatePath("/admin/submission-forms");

  return { submission: data as SubmissionFinal };
}

export async function getSubmissionVersions(submissionId: string): Promise<{
  versions: any[];
  error?: string;
}> {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("submission_versions")
    .select("*")
    .eq("submission_id", submissionId)
    .order("version", { ascending: true });

  if (error) {
    return { versions: [], error: error.message };
  }

  return { versions: (data || []) as any[] };
}
