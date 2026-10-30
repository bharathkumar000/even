"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { z } from "zod";

export type ContentType =
  | "problem_statement"
  | "certificate_release"
  | "announcement"
  | "resource"
  | "custom";

export type ContentStatus = "draft" | "scheduled" | "published" | "unpublished" | "archived";

export type PortalAudience =
  | "all"
  | "team_leader"
  | "participant"
  | "staff"
  | "judge"
  | "operations"
  | "organizer"
  | "admin";

export interface ContentHubItem {
  id: string;
  reference_number: string | null;
  title: string;
  summary: string | null;
  body: string;
  content_type: ContentType;
  category: string | null;
  status: ContentStatus;
  priority_level: string;
  pin_to_top: boolean;
  target_audiences: PortalAudience[];
  target_audience: string;
  scheduled_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  domain: string | null;
  team_limit: number | null;
  enable_selection: boolean;
  manual_lock: boolean;
  selection_opening: string | null;
  selection_closing: string | null;
  recipient: string | null;
  team_name: string | null;
  resource_url: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  resource_links: Record<string, unknown>[];
  created_by: string | null;
  updated_by: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ContentHubAttachment {
  id: string;
  content_id: string;
  name: string;
  path: string;
  mime_type: string | null;
  size: number;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface ContentHubData {
  items: ContentHubItem[];
  error?: string;
}

export interface ContentHubFilters {
  status?: ContentStatus | null;
  content_type?: ContentType | null;
  category?: string | null;
  limit?: number;
  offset?: number;
}

export interface CreateContentInput {
  title: string;
  summary?: string;
  body?: string;
  content_type: ContentType;
  category?: string;
  status?: ContentStatus;
  priority_level?: "normal" | "high" | "urgent";
  pin_to_top?: boolean;
  target_audiences?: PortalAudience[];
  target_audience?: string;
  scheduled_at?: string | null;
  published_at?: string | null;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
  domain?: string;
  team_limit?: number | null;
  enable_selection?: boolean;
  manual_lock?: boolean;
  selection_opening?: string | null;
  selection_closing?: string | null;
  recipient?: string;
  team_name?: string;
  resource_url?: string;
  attachment_url?: string;
  attachment_name?: string;
  resource_links?: Record<string, unknown>[];
}

export interface UpdateContentInput extends Partial<CreateContentInput> {
  id: string;
}

export interface ContentHubAttachmentInput {
  content_id: string;
  name: string;
  path: string;
  mime_type?: string;
  size: number;
}

const CONTENT_TYPE_VALUES: ContentType[] = [
  "problem_statement",
  "certificate_release",
  "announcement",
  "resource",
  "custom",
];

const CONTENT_STATUS_VALUES: ContentStatus[] = [
  "draft",
  "scheduled",
  "published",
  "unpublished",
  "archived",
];

const PORTAL_AUDIENCE_VALUES: PortalAudience[] = [
  "all",
  "team_leader",
  "participant",
  "staff",
  "judge",
  "operations",
  "organizer",
  "admin",
];

const PRIORITY_LEVELS = ["normal", "high", "urgent"] as const;

function validateContentType(type: string): type is ContentType {
  return CONTENT_TYPE_VALUES.includes(type as ContentType);
}

function validateContentStatus(status: string): status is ContentStatus {
  return CONTENT_STATUS_VALUES.includes(status as ContentStatus);
}

function validatePortalAudience(audience: string): audience is PortalAudience {
  return PORTAL_AUDIENCE_VALUES.includes(audience as PortalAudience);
}

function validatePriorityLevel(priority: string): priority is "normal" | "high" | "urgent" {
  return PRIORITY_LEVELS.includes(priority as "normal" | "high" | "urgent");
}

function validateTargetAudiences(audiences: string[]): audiences is PortalAudience[] {
  return audiences.every(validatePortalAudience);
}

function sanitizeInput(input: string): string {
  return input.trim();
}

export async function getContentHubData(filters?: ContentHubFilters): Promise<{
  items: ContentHubItem[];
  error?: string;
}> {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("content_hub")
    .select("*")
    .order("created_at", { ascending: false })
    .range(filters?.offset || 0, (filters?.offset || 0) + (filters?.limit || 50) - 1);

  if (error) {
    console.error("Failed to load Content Hub:", error.message);
    return {
      items: [],
      error: "The content store is not available. Confirm the content_hub table and its migrations are applied.",
    };
  }

  let items = (data || []) as ContentHubItem[];

  // Apply filters
  if (filters?.status) {
    items = items.filter((item) => item.status === filters.status);
  }
  if (filters?.content_type) {
    items = items.filter((item) => item.content_type === filters.content_type);
  }
  if (filters?.category) {
    items = items.filter((item) => item.category === filters.category);
  }

  return { items };
}

export async function getContentForPortal(audience?: string, contentType?: string, category?: string, status: "published" = "published", limit = 50, offset = 0): Promise<{
  items: ContentHubItem[];
  error?: string;
}> {
  // Derive the authenticated user from the session — never trust a client-supplied audience
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("Failed to load content for portal:", authError?.message || "Unauthenticated");
    return {
      items: [],
      error: "Authentication required.",
    };
  }

  try {
    // Call the SECURITY INVOKER RPC with the user's session so RLS applies.
    // The caller's JWT enforces content_hub_can_access_audience() and RLS policies.
    const { data, error } = await supabase.rpc("get_content_for_portal", {
      p_audience: audience || null,
      p_content_type: contentType || null,
      p_category: category || null,
      p_status: status,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("Failed to load content for portal:", error.message);
      return {
        items: [],
        error: "Failed to load content.",
      };
    }

    return { items: (data || []) as ContentHubItem[] };
  } catch (err) {
    console.error("Failed to load content for portal:", err);
    return {
      items: [],
      error: "Failed to load content.",
    };
  }
}

export async function getContentHubAdmin(filters?: ContentHubFilters): Promise<{
  items: ContentHubItem[];
  error?: string;
}> {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin.rpc("get_content_hub_admin", {
    p_status: filters?.status || null,
    p_content_type: filters?.content_type || null,
    p_category: filters?.category || null,
    p_limit: filters?.limit || 50,
    p_offset: filters?.offset || 0,
  });

  if (error) {
    console.error("Failed to load Content Hub admin:", error.message);
    return {
      items: [],
      error: "Failed to load content hub data.",
    };
  }

  return { items: (data || []) as ContentHubItem[] };
}

export async function createContent(input: CreateContentInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }): Promise<{
  id: string;
  reference_number: string;
  message: string;
}> {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const title = sanitizeInput(input.title);
  if (!title) throw new Error("Content title is required.");

  if (!validateContentType(input.content_type)) {
    throw new Error("Invalid content type.");
  }

  if (input.target_audiences && input.target_audiences.length > 0) {
    if (!validateTargetAudiences(input.target_audiences)) {
      throw new Error("Invalid target audience(s).");
    }
  }

  if (input.priority_level && !validatePriorityLevel(input.priority_level)) {
    throw new Error("Invalid priority level.");
  }

  const referenceNumber = await allocateReferenceNumber(`CONT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);

  const targetAudiences = input.target_audiences && input.target_audiences.length > 0
    ? input.target_audiences
    : ["all"];

  const targetAudience = input.target_audience || "all";

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("content_hub")
    .insert([
      {
        reference_number: referenceNumber,
        title: sanitizeInput(input.title),
        summary: input.summary?.trim() || null,
        body: input.body || "",
        content_type: input.content_type,
        category: input.category?.trim() || null,
        status: input.scheduled_at ? "scheduled" : "draft",
        priority_level: input.priority_level || "normal",
        pin_to_top: input.pin_to_top || false,
        target_audiences: targetAudiences,
        target_audience: targetAudience,
        scheduled_at: input.scheduled_at || null,
        expires_at: input.expires_at || null,
        metadata: input.metadata || {},
        domain: input.domain?.trim() || null,
        team_limit: input.team_limit || null,
        enable_selection: input.enable_selection ?? true,
        manual_lock: input.manual_lock ?? false,
        selection_opening: input.selection_opening || null,
        selection_closing: input.selection_closing || null,
        recipient: input.recipient?.trim() || null,
        team_name: input.team_name?.trim() || null,
        resource_url: input.resource_url?.trim() || null,
        attachment_url: input.attachment_url?.trim() || null,
        attachment_name: input.attachment_name?.trim() || null,
        resource_links: input.resource_links || [],
        created_by: user.id,
        updated_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create content: ${error.message}`);
  }

  // Handle scheduling
  if (input.scheduled_at) {
    await scheduleContent(input.scheduled_at, data.id);
  }

  revalidatePath("/admin/content-hub");
  revalidatePath("/admin/content-releases");

  return {
    id: data.id,
    reference_number: data.reference_number,
    message: `Content "${title}" created successfully.`,
  };
}

export async function updateContent(input: UpdateContentInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }): Promise<{
  id: string;
  message: string;
}> {
  const { user } = await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const title = input.title !== undefined ? sanitizeInput(input.title) : undefined;
  if (input.title !== undefined && !title) throw new Error("Content title is required.");

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("content_hub")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load content: ${fetchError.message}`);
  }

  if (!existing) {
    throw new Error("Content not found.");
  }

  const targetAudiences = input.target_audiences && input.target_audiences.length > 0
    ? input.target_audiences
    : existing.target_audiences;

  const targetAudience = input.target_audience || existing.target_audience;

  const updateData: Record<string, unknown> = {
    title: title !== undefined ? title : existing.title,
    summary: input.summary?.trim() || null,
    body: input.body || "",
    category: input.category?.trim() || null,
    priority_level: input.priority_level || existing.priority_level,
    pin_to_top: input.pin_to_top ?? existing.pin_to_top,
    target_audiences: targetAudiences,
    target_audience: targetAudience,
    metadata: input.metadata || existing.metadata,
    domain: input.domain?.trim() || existing.domain,
    team_limit: input.team_limit ?? existing.team_limit,
    enable_selection: input.enable_selection ?? existing.enable_selection,
    manual_lock: input.manual_lock ?? existing.manual_lock,
    selection_opening: input.selection_opening || null,
    selection_closing: input.selection_closing || null,
    recipient: input.recipient?.trim() || null,
    team_name: input.team_name?.trim() || null,
    resource_url: input.resource_url?.trim() || null,
    attachment_url: input.attachment_url?.trim() || null,
    attachment_name: input.attachment_name?.trim() || null,
    resource_links: input.resource_links || existing.resource_links,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (input.content_type) {
    if (!validateContentType(input.content_type)) {
      throw new Error("Invalid content type.");
    }
    (updateData as Record<string, unknown>).content_type = input.content_type;
  }

  if (input.status) {
    if (!validateContentStatus(input.status)) {
      throw new Error("Invalid content status.");
    }
    (updateData as Record<string, unknown>).status = input.status;
  }

  if (input.priority_level && !validatePriorityLevel(input.priority_level)) {
    throw new Error("Invalid priority level.");
  }

  if (input.scheduled_at !== undefined) {
    (updateData as Record<string, unknown>).scheduled_at = input.scheduled_at;
  }

  if (input.expires_at !== undefined) {
    (updateData as Record<string, unknown>).expires_at = input.expires_at;
  }

  if (input.domain !== undefined) {
    (updateData as Record<string, unknown>).domain = input.domain?.trim() || null;
  }

  if (input.team_limit !== undefined) {
    (updateData as Record<string, unknown>).team_limit = input.team_limit;
  }

  if (input.enable_selection !== undefined) {
    (updateData as Record<string, unknown>).enable_selection = input.enable_selection;
  }

  if (input.manual_lock !== undefined) {
    (updateData as Record<string, unknown>).manual_lock = input.manual_lock;
  }

  if (input.selection_opening !== undefined) {
    (updateData as Record<string, unknown>).selection_opening = input.selection_opening || null;
  }

  if (input.selection_closing !== undefined) {
    (updateData as Record<string, unknown>).selection_closing = input.selection_closing || null;
  }

  if (input.recipient !== undefined) {
    (updateData as Record<string, unknown>).recipient = input.recipient?.trim() || null;
  }

  if (input.team_name !== undefined) {
    (updateData as Record<string, unknown>).team_name = input.team_name?.trim() || null;
  }

  if (input.resource_url !== undefined) {
    (updateData as Record<string, unknown>).resource_url = input.resource_url?.trim() || null;
  }

  if (input.attachment_url !== undefined) {
    (updateData as Record<string, unknown>).attachment_url = input.attachment_url?.trim() || null;
  }

  if (input.attachment_name !== undefined) {
    (updateData as Record<string, unknown>).attachment_name = input.attachment_name?.trim() || null;
  }

  if (input.resource_links !== undefined) {
    (updateData as Record<string, unknown>).resource_links = input.resource_links;
  }

  if (input.pin_to_top !== undefined) {
    (updateData as Record<string, unknown>).pin_to_top = input.pin_to_top;
  }

  if (input.scheduled_at !== undefined) {
    (updateData as Record<string, unknown>).scheduled_at = input.scheduled_at;
  }

  if (input.expires_at !== undefined) {
    (updateData as Record<string, unknown>).expires_at = input.expires_at;
  }

  if (input.priority_level !== undefined) {
    if (!validatePriorityLevel(input.priority_level)) {
      throw new Error("Invalid priority level.");
    }
    (updateData as Record<string, unknown>).priority_level = input.priority_level;
  }

  if (input.content_type !== undefined) {
    (updateData as Record<string, unknown>).content_type = input.content_type;
  }

  if (input.status !== undefined) {
    if (!validateContentStatus(input.status)) {
      throw new Error("Invalid content status.");
    }
    (updateData as Record<string, unknown>).status = input.status;
  }

  if (input.scheduled_at !== undefined) {
    (updateData as Record<string, unknown>).scheduled_at = input.scheduled_at;
  }

  if (input.expires_at !== undefined) {
    (updateData as Record<string, unknown>).expires_at = input.expires_at;
  }

  if (input.target_audiences !== undefined) {
    if (!validateTargetAudiences(input.target_audiences!)) {
      throw new Error("Invalid target audience(s).");
    }
    (updateData as Record<string, unknown>).target_audiences = targetAudiences;
  }

  if (input.target_audience !== undefined) {
    (updateData as Record<string, unknown>).target_audience = targetAudience;
  }

  const { data, error } = await supabaseAdmin
    .from("content_hub")
    .update(updateData)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update content: ${error.message}`);
  }

  // Handle scheduling changes
  if (input.scheduled_at !== existing.scheduled_at) {
    if (input.scheduled_at) {
      await scheduleContent(input.scheduled_at, input.id);
    } else {
      await cancelSchedule(input.id);
    }
  }

  if (input.expires_at !== undefined) {
    if (input.expires_at) {
      await scheduleExpiration(input.expires_at, input.id);
    } else {
      await cancelExpiration(input.id);
    }
  }

  revalidatePath("/admin/content-hub");
  revalidatePath("/admin/content-releases");

  return {
    id: data.id,
    message: `Content "${title}" updated successfully.`,
  };
}

export async function publishContent(id: string, csrfToken?: string): Promise<{
  id: string;
  message: string;
}> {
  const { user } = await requireAdmin();
  if (csrfToken) await validateCsrfToken(csrfToken);

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("content_hub")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load content: ${fetchError.message}`);
  }

  if (!existing) {
    throw new Error("Content not found.");
  }

  if (existing.status === "published") {
    throw new Error("Content is already published.");
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("content_hub")
    .update({
      status: "published",
      published_by: user.id,
      published_at: now,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to publish content: ${error.message}`);
  }

  await writeAudit({
    content_id: id,
    action: "published",
    previous_data: { status: existing.status },
    new_data: { status: "published", published_at: now },
    performed_by: user.id,
    details: { title: existing.title },
  });

  revalidatePath("/admin/content-hub");
  revalidatePath("/admin/content-releases");

  return { id: data.id, message: `Content "${existing.title}" published successfully.` };
}

export async function unpublishContent(id: string, csrfToken?: string): Promise<{
  id: string;
  message: string;
}> {
  const { user } = await requireAdmin();
  if (csrfToken) await validateCsrfToken(csrfToken);

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("content_hub")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load content: ${fetchError.message}`);
  }

  if (!existing) {
    throw new Error("Content not found.");
  }

  if (existing.status !== "published") {
    throw new Error("Content is not published.");
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("content_hub")
    .update({
      status: "unpublished",
      published_by: null,
      published_at: null,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to unpublish content: ${error.message}`);
  }

  await writeAudit({
    content_id: id,
    action: "unpublished",
    previous_data: { status: "published" },
    new_data: { status: "unpublished" },
    performed_by: user.id,
    details: { title: existing.title },
  });

  revalidatePath("/admin/content-hub");
  revalidatePath("/admin/content-releases");

  return { id: data.id, message: `Content "${existing.title}" unpublished successfully.` };
}

export async function archiveContent(id: string, csrfToken?: string): Promise<{
  id: string;
  message: string;
}> {
  const { user } = await requireAdmin();
  if (csrfToken) await validateCsrfToken(csrfToken);

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("content_hub")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load content: ${fetchError.message}`);
  }

  if (!existing) {
    throw new Error("Content not found.");
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("content_hub")
    .update({
      status: "archived",
      updated_by: user.id,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to archive content: ${error.message}`);
  }

  await writeAudit({
    content_id: id,
    action: "archived",
    previous_data: { status: existing.status },
    new_data: { status: "archived" },
    performed_by: user.id,
    details: { title: existing.title },
  });

  revalidatePath("/admin/content-hub");
  revalidatePath("/admin/content-releases");

  return { id: data.id, message: `Content "${existing.title}" archived successfully.` };
}

export async function deleteContent(id: string, csrfToken?: string): Promise<{
  success: boolean;
  message: string;
}> {
  const { user } = await requireAdmin();
  if (csrfToken) await validateCsrfToken(csrfToken);

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("content_hub")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load content: ${fetchError.message}`);
  }

  if (!existing) {
    throw new Error("Content not found.");
  }

  // Soft delete
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("content_hub")
    .update({
      deleted_at: now,
      deleted_by: user.id,
      updated_by: user.id,
      updated_at: now,
      status: "archived",
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete content: ${error.message}`);
  }

  await writeAudit({
    content_id: id,
    action: "deleted",
    previous_data: { status: existing.status },
    new_data: { status: "archived", deleted_at: now },
    performed_by: user.id,
    details: { title: existing.title },
  });

  revalidatePath("/admin/content-hub");
  revalidatePath("/admin/content-releases");

  return { success: true, message: `Content "${existing.title}" deleted successfully.` };
}

async function allocateReferenceNumber(preferred?: string): Promise<string> {
  const requested = preferred?.trim();
  if (requested) {
    const { data, error } = await supabaseAdmin
      .from("content_hub")
      .select("id")
      .eq("reference_number", requested)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to validate reference number: ${error.message}`);
    }
    if (data) {
      throw new Error("That reference number is already in use.");
    }
    return requested;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `CONT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const { data, error } = await supabaseAdmin
      .from("content_hub")
      .select("id")
      .eq("reference_number", candidate)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to allocate reference number: ${error.message}`);
    }
    if (!data) return candidate;
  }

  throw new Error("Could not allocate a unique reference number.");
}

async function scheduleContent(scheduledAt: string, contentId: string): Promise<void> {
  const { user } = await requireAdmin();

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("Enter a valid publication date and time.");
  }
  if (scheduledDate.getTime() <= Date.now()) {
    throw new Error("Scheduled publication must be in the future.");
  }

  // Cancel existing schedule if any
  await supabaseAdmin
    .from("content_hub_schedules")
    .update({
      status: "cancelled",
      executed_at: new Date().toISOString(),
    })
    .eq("content_id", scheduledAt)
    .eq("status", "pending");

  const { error } = await supabaseAdmin
    .from("content_hub_schedules")
    .insert({
      content_id: contentId,
      scheduled_at: scheduledDate.toISOString(),
      timezone: "UTC",
      job_type: "publish",
      status: "pending",
      created_by: (await requireAdmin()).user.id,
    });

  if (error) {
    throw new Error(`Failed to schedule publication: ${error.message}`);
  }
}

async function cancelSchedule(contentId: string): Promise<void> {
  await supabaseAdmin
    .from("content_hub_schedules")
    .update({
      status: "cancelled",
      executed_at: new Date().toISOString(),
    })
    .eq("content_id", contentId)
    .eq("status", "pending");
}

async function scheduleExpiration(expiresAt: string, contentId: string): Promise<void> {
  const { user } = await requireAdmin();

  const expiresDate = new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime())) {
    throw new Error("Enter a valid expiration date and time.");
  }
  if (expiresDate.getTime() <= Date.now()) {
    throw new Error("Expiration must be in the future.");
  }

  await supabaseAdmin
    .from("content_hub_schedules")
    .update({
      status: "cancelled",
      executed_at: new Date().toISOString(),
    })
    .eq("content_id", contentId)
    .eq("job_type", "expire")
    .eq("status", "pending");

  const { error } = await supabaseAdmin
    .from("content_hub_schedules")
    .insert({
      content_id: contentId,
      scheduled_at: expiresDate.toISOString(),
      timezone: "UTC",
      job_type: "expire",
      status: "pending",
      created_by: (await requireAdmin()).user.id,
    });

  if (error) {
    throw new Error(`Failed to schedule expiration: ${error.message}`);
  }
}

async function cancelExpiration(contentId: string): Promise<void> {
  await supabaseAdmin
    .from("content_hub_schedules")
    .update({
      status: "cancelled",
      executed_at: new Date().toISOString(),
    })
    .eq("content_id", contentId)
    .eq("job_type", "expire")
    .eq("status", "pending");
}

async function writeAudit(params: {
  content_id: string;
  action: string;
  previous_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  performed_by: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("content_hub_audit").insert([
    {
      content_id: params.content_id,
      action: params.action,
      previous_data: params.previous_data || null,
      new_data: params.new_data || null,
      performed_by: params.performed_by,
      details: params.details || {},
    },
  ]);

  if (error) {
    console.warn("Content audit write failed:", error.message);
  }
}

export async function getContentById(id: string): Promise<{
  item: any;
  error?: string;
}> {
  const { data, error } = await supabaseAdmin
    .from("content_hub")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { item: null, error: `Failed to load content: ${error.message}` };
  }

  if (!data) {
    return { item: null, error: "Content not found." };
  }

  return { item: data };
}

export async function getContentAttachments(contentId: string): Promise<{
  attachments: any[];
  error?: string;
}> {
  const { data, error } = await supabaseAdmin
    .from("content_hub_attachments")
    .select("*")
    .eq("content_id", contentId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return { attachments: [], error: `Failed to load attachments: ${error.message}` };
  }

  return { attachments: data || [] };
}

export async function registerContentAttachment(input: {
  content_id: string;
  name: string;
  path: string;
  mime_type?: string;
  size: number;
}): Promise<{
  attachment: any;
  error?: string;
}> {
  const { user } = await requireAdmin();

  const { data: content } = await supabaseAdmin
    .from("content_hub")
    .select("id")
    .eq("id", input.content_id)
    .maybeSingle();

  if (!content) {
    return { attachment: null, error: "Content not found." };
  }

  const attachment = {
    id: crypto.randomUUID(),
    content_id: input.content_id,
    name: input.name,
    path: input.path,
    mime_type: input.mime_type || null,
    size: input.size,
    uploaded_by: user.id,
    uploaded_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("content_hub_attachments")
    .insert([attachment])
    .select("*")
    .single();

  if (error) {
    return { attachment: null, error: `Failed to register attachment: ${error.message}` };
  }

  return { attachment: data };
}

export async function removeContentAttachment(contentId: string, attachmentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { user } = await requireAdmin();

  const { data: attachment } = await supabaseAdmin
    .from("content_hub_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("content_id", contentId)
    .maybeSingle();

  if (!attachment) {
    return { success: false, error: "Attachment not found." };
  }

  const { error: storageError } = await supabaseAdmin.storage
    .from("content-hub")
    .remove([attachment.path]);

  if (storageError) {
    console.warn("Failed to delete file from storage:", storageError.message);
  }

  const { error } = await supabaseAdmin
    .from("content_hub_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) {
    return { success: false, error: `Failed to remove attachment: ${error.message}` };
  }

  return { success: true };
}

export async function getContentHistory(contentId: string): Promise<{
  history: any[];
  error?: string;
}> {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("content_hub_audit")
    .select("*")
    .eq("content_id", contentId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return { history: [], error: `Failed to load history: ${error.message}` };
  }

  return { history: data || [] };
}

export async function getScheduledContent(activityId?: string): Promise<{
  schedules: any[];
  error?: string;
}> {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("content_hub_schedules")
    .select("*, content_hub!inner(title, reference_number, content_type)")
    .order("scheduled_at", { ascending: true });

  if (error) {
    return { schedules: [], error: `Failed to load schedules: ${error.message}` };
  }

  let schedules = (data || []) as any[];

  if (activityId) {
    // Filter by activity if needed - would need a join
    // For now, return all
  }

  return { schedules };
}

export async function cancelScheduledPublication(scheduleId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { user } = await requireAdmin();

  const { data: schedule, error: fetchError } = await supabaseAdmin
    .from("content_hub_schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: `Failed to load schedule: ${fetchError.message}` };
  }

  if (!schedule) {
  }

  if (schedule.status !== "pending") {
  }

  const { error: updateError } = await supabaseAdmin
    .from("content_hub_schedules")
    .update({
      status: "cancelled",
      executed_at: new Date().toISOString(),
      failure_reason: null,
    })
    .eq("id", scheduleId);

  if (updateError) {
    return { success: false, error: `Failed to cancel schedule: ${updateError.message}` };
  }

  await writeAudit({
    content_id: schedule.content_id,
    action: "schedule_cancelled",
    previous_data: { status: schedule.status },
    new_data: { status: "cancelled" },
    performed_by: user.id,
    details: { schedule_id: scheduleId },
  });

  revalidatePath("/admin/content-hub");
  return { success: true };
}

export async function retryFailedSchedule(scheduleId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { user } = await requireAdmin();

  const { data: schedule, error: fetchError } = await supabaseAdmin
    .from("content_hub_schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: `Failed to load schedule: ${fetchError.message}` };
  }

  if (!schedule) {
  }

  if (schedule.status !== "failed") {
  }

  const { error: updateError } = await supabaseAdmin
    .from("content_hub_schedules")
    .update({
      status: "pending",
      executed_at: null,
      failure_reason: null,
    })
    .eq("id", scheduleId);

  if (updateError) {
    return { success: false, error: `Failed to reset schedule: ${updateError.message}` };
  }

  await writeAudit({
    content_id: schedule.content_id,
    action: "schedule_retried",
    previous_data: { status: schedule.status },
    new_data: { status: "pending" },
    performed_by: user.id,
    details: { schedule_id: scheduleId },
  });

  revalidatePath("/admin/content-hub");
  return { success: true };
}

export async function executeDueSchedules(): Promise<{
  processed: number;
}> {
  await requireAdmin();

  // This would typically be called by a cron job
  // For now, we'll just return the count
  return { processed: 0 };
}