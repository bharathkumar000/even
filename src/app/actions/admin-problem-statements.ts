"use server";

export type { ProjectFormStatus } from "@/app/actions/project-submission-forms";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export interface ProblemStatement {
  id: string;
  reference_number: string;
  title: string;
  domain: string | null;
  summary: string | null;
  description: string;
  objectives: string | null;
  deliverables: string | null;
  constraints: string | null;
  evaluation_criteria: string | null;
  resource_links: any;
  attachments: any;
  display_order: number;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  team_limit: number | null;
  enable_selection: boolean;
  manual_lock: boolean;
  selection_opening: string | null;
  selection_closing: string | null;
  reading_started_at: string | null;
  reading_ended_at: string | null;
  selection_activated_at: string | null;
  selection_activated_by: string | null;
  // SIH 2025 Problem Statement fields
  sih_ps_number: string | null;
  organization: string | null;
  theme: string | null;
  category: string | null;
  department: string | null;
  internal_reference: string | null;
  sih_year: number | null;
  source_document: string | null;
  draft_content: any;
  published_content: any;
  is_visible_to_teams: boolean;
  selection_enabled: boolean;
  manually_locked: boolean;
  selection_open_at: string | null;
  selection_close_at: string | null;
  publication_timezone: string | null;
  max_teams: number | null;
  published_at: string | null;
}

// Get all problem statements (admin view)
export async function getProblemStatements(): Promise<ProblemStatement[]> {
  try {
    await requireAdmin();
  } catch (e) {
    console.warn("getProblemStatements auth notice:", e);
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch problem statements:", error.message);
    return [];
  }
  return ((data as ProblemStatement[]) || []).filter(
    isProblemStatementResourceLinks
  );
}

function isProblemStatementResourceLinks(row: ProblemStatement): boolean {
  const links = row.resource_links;
  if (!links || typeof links !== "object" || Array.isArray(links)) return true;

  const record = links as Record<string, unknown>;
  if (record.__hub_activity) return false;

  const marker = record.__hub_item;
  if (marker && typeof marker === "object" && !Array.isArray(marker)) {
    const itemType = (marker as Record<string, unknown>).item_type;
    if (typeof itemType === "string" && itemType !== "problem_statement") {
      return false;
    }
  }

  return true;
}

// Map display department to database department values
function getDepartmentFilter(department: string): string {
  switch (department) {
    case "cse-aiml":
      return "CSE / AIML";
    case "ece-eee":
      return "Electronics and Communication";
    case "me-cv":
      // me-cv includes both Mechanical and Civil
      return "Mechanical,Civil";
    default:
      return "";
  }
}

// Get only published statements for team leaders
export async function getPublishedProblemStatements(
  department?: "cse-aiml" | "ece-eee" | "me-cv"
): Promise<ProblemStatement[]> {
  let query = supabaseAdmin
    .from("problem_statements")
    .select("*")
    .eq("status", "published")
    .order("display_order", { ascending: true });

  // Department filtering based on department field (not domain)
  if (department) {
    const deptValue = getDepartmentFilter(department);
    if (deptValue.includes(",")) {
      // Multiple values - use or for multiple departments
      const values = deptValue.split(",").map(v => v.trim());
      const orConditions = values.map(v => `department.ilike.%${v}%`).join(",");
      query = query.or(orConditions);
    } else {
      query = query.ilike("department", `%${deptValue}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch published problem statements:", error.message);
    return [];
  }
  return ((data as ProblemStatement[]) || []).filter(
    isProblemStatementResourceLinks
  );
}

// Create a new draft
export async function createProblemStatement(data: {
  reference_number: string;
  title: string;
  domain?: string;
  summary?: string;
  description: string;
  team_limit?: number | null;
  enable_selection?: boolean;
  manual_lock?: boolean;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
    const payload = {
      reference_number: data.reference_number.trim(),
      title: data.title.trim(),
      domain: data.domain?.trim() || null,
      summary: data.summary?.trim() || null,
      description: data.description.trim(),
      status: "draft" as const,
      // Optional team limit – defaults to NULL (unlimited) if omitted.
      team_limit: data.team_limit ?? null,
      enable_selection: data.enable_selection ?? true,
      manual_lock: data.manual_lock ?? false,
      created_by: user.id,
      updated_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  const { data: inserted, error } = await supabaseAdmin
    .from("problem_statements")
    .insert([payload])
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to create problem statement: ${error.message}`);
  }
  // Audit log
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "CREATE_PROBLEM_STATEMENT",
      entity_type: "problem_statement",
      entity_id: inserted.id,
      admin_id: user.id,
      details: payload,
      created_at: new Date().toISOString(),
    },
  ]);
  revalidatePath("/admin/content-releases");
  return inserted;
}

// Update a draft (or any statement)
export async function updateProblemStatement(id: string, data: Partial<{
  reference_number: string;
  title: string;
  domain: string;
  summary: string;
  description: string;
  objectives: string;
  deliverables: string;
  constraints: string;
  evaluation_criteria: string;
  team_limit: number | null;
  enable_selection: boolean;
  manual_lock: boolean;
  selection_opening: string | null;
  selection_closing: string | null;
  [CSRF_CONSTANTS.HEADER_NAME]: string;
}>) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
  const payload: any = { ...data, updated_by: user.id, updated_at: new Date().toISOString() };
  delete payload[CSRF_CONSTANTS.HEADER_NAME];
  delete payload["x-csrf-token"];
  // Preserve optional fields if explicitly provided
  if (Object.prototype.hasOwnProperty.call(data, "team_limit")) payload.team_limit = (data as any).team_limit;
  if (Object.prototype.hasOwnProperty.call(data, "enable_selection")) payload.enable_selection = (data as any).enable_selection;
  if (Object.prototype.hasOwnProperty.call(data, "manual_lock")) payload.manual_lock = (data as any).manual_lock;
  const { data: updated, error } = await supabaseAdmin
    .from("problem_statements")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to update problem statement: ${error.message}`);
  }
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "UPDATE_PROBLEM_STATEMENT",
      entity_type: "problem_statement",
      entity_id: id,
      admin_id: user.id,
      details: payload,
      created_at: new Date().toISOString(),
    },
  ]);
  revalidatePath("/admin/content-releases");
  return updated;
}

// Publish a draft
export async function publishProblemStatement(id: string, csrfToken?: string) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);
  const payload = {
    status: "published" as const,
    published_by: user.id,
    published_at: new Date().toISOString(),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const { data: updated, error } = await supabaseAdmin
    .from("problem_statements")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to publish problem statement: ${error.message}`);
  }
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "PUBLISH_PROBLEM_STATEMENT",
      entity_type: "problem_statement",
      entity_id: id,
      admin_id: user.id,
      details: payload,
      created_at: new Date().toISOString(),
    },
  ]);
  revalidatePath("/admin/content-releases");
  revalidatePath("/team/problem-statements");
  return updated;
}

// Unpublish a statement (revert to draft)
export async function unpublishProblemStatement(id: string, csrfToken?: string) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);
  const payload = {
    status: "draft" as const,
    published_by: null,
    published_at: null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const { data: updated, error } = await supabaseAdmin
    .from("problem_statements")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to unpublish problem statement: ${error.message}`);
  }
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "UNPUBLISH_PROBLEM_STATEMENT",
      entity_type: "problem_statement",
      entity_id: id,
      admin_id: user.id,
      details: payload,
      created_at: new Date().toISOString(),
    },
  ]);
  revalidatePath("/admin/content-releases");
  revalidatePath("/team/problem-statements");
  return updated;
}

// Delete a statement (admin only)
export async function deleteProblemStatement(id: string, csrfToken?: string) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);
  const { error } = await supabaseAdmin.from("problem_statements").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete problem statement: ${error.message}`);
  }
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "DELETE_PROBLEM_STATEMENT",
      entity_type: "problem_statement",
      entity_id: id,
      admin_id: user.id,
      created_at: new Date().toISOString(),
    },
  ]);
  revalidatePath("/admin/content-releases");
  revalidatePath("/team/problem-statements");
  return { success: true };
}

// ================================================================================
// BULK ACTIONS
// ================================================================================

export async function bulkPublishProblemStatements(activityId: string, csrfToken?: string) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const { data: forms, error: formsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, title, status, resource_links")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (formsError) {
    throw new Error(`Failed to load problem statements: ${formsError.message}`);
  }

  // Filter to only items in this activity
  const activityItems = (forms || []).filter((row: any) => {
    const links = row.resource_links as Record<string, unknown>;
    const marker = links && links.__hub_item;
    return marker && typeof marker === "object" && (marker as Record<string, unknown>).activity_id === activityId;
  });

  const draftItems = activityItems.filter((f: any) => f.status === "draft");

  const publishedIds: string[] = [];
  const skippedItems: { id: string; title: string; reason: string }[] = [];
  const publishErrors: string[] = [];

  for (const item of draftItems) {
    const hasTitle = Boolean((item as any).title?.trim());
    const hasBodyOrSummary = Boolean((item as any).summary?.trim()) || Boolean((item as any).description?.trim());

    if (hasTitle && hasBodyOrSummary) {
      try {
        await supabaseAdmin
          .from("problem_statements")
          .update({
            status: "published",
            published_by: user.id,
            published_at: new Date().toISOString(),
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        publishedIds.push(item.id);
      } catch (err: unknown) {
        publishErrors.push(`${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    } else {
      skippedItems.push({
        id: item.id,
        title: (item as any).title || "Untitled",
        reason: !hasTitle ? "missing required title" : "missing required content",
      });
    }
  }

  await writeAudit({
    statementId: activityId,
    action: "published",
    previousStatus: "draft",
    newStatus: "published",
    userId: user.id,
    details: {
      activity_id: activityId,
      activity_type: "problem_statements",
      total_drafts: draftItems.length,
      published_count: publishedIds.length,
      skipped_count: skippedItems.length,
      error_count: publishErrors.length,
      published_ids: publishedIds,
      error_details: publishErrors,
    },
  });

  revalidatePath("/admin/content-releases");

  return {
    publishedCount: publishedIds.length,
    skippedCount: skippedItems.length,
    errorCount: publishErrors.length,
    publishedIds,
    errorDetails: publishErrors,
    message:
      publishedIds.length > 0 || skippedItems.length > 0
        ? `Published ${publishedIds.length} item${publishedIds.length === 1 ? "" : "s"}; skipped ${skippedItems.length} item${skippedItems.length === 1 ? "" : "s"}.${publishErrors.length > 0 ? ` ${publishErrors.length} failed.` : ""}`
        : "No draft items are ready to publish.",
  };
}

export async function bulkUnpublishProblemStatements(activityId: string, csrfToken?: string) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const { data: forms, error: formsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, title, status, resource_links")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (formsError) {
    throw new Error(`Failed to load problem statements: ${formsError.message}`);
  }

  const activityItems = (forms || []).filter((row: any) => {
    const links = row.resource_links as Record<string, unknown>;
    const marker = links && links.__hub_item;
    return marker && typeof marker === "object" && (marker as Record<string, unknown>).activity_id === activityId;
  });

  const publishedItems = activityItems.filter((f: any) => f.status === "published");

  const unpublishedIds: string[] = [];
  const unpublishErrors: string[] = [];

  for (const item of publishedItems) {
    try {
      await supabaseAdmin
        .from("problem_statements")
        .update({
          status: "draft",
          published_by: null,
          published_at: null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      unpublishedIds.push(item.id);
    } catch (err: unknown) {
      unpublishErrors.push(`${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  await writeAudit({
    statementId: activityId,
    action: "unpublished",
    previousStatus: "published",
    newStatus: "draft",
    userId: user.id,
    details: {
      activity_id: activityId,
      activity_type: "problem_statements",
      unpublished_count: unpublishedIds.length,
      error_count: unpublishErrors.length,
      unpublished_ids: unpublishedIds,
      error_details: unpublishErrors,
    },
  });

  revalidatePath("/admin/content-releases");

  return {
    unpublishedCount: unpublishedIds.length,
    errorCount: unpublishErrors.length,
    unpublishedIds,
    errorDetails: unpublishErrors,
    message: unpublishedIds.length > 0 ? `Unpublished ${unpublishedIds.length} item${unpublishedIds.length === 1 ? "" : "s"}.` : "No published items to unpublish.",
  };
}

export async function bulkAllowSelection(activityId: string, csrfToken?: string) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const { data: forms, error: formsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, title, status, enable_selection, resource_links")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (formsError) {
    throw new Error(`Failed to load problem statements: ${formsError.message}`);
  }

  const activityItems = (forms || []).filter((row: any) => {
    const links = row.resource_links as Record<string, unknown>;
    const marker = links && links.__hub_item;
    return marker && typeof marker === "object" && (marker as Record<string, unknown>).activity_id === activityId;
  });

  const enabledIds: string[] = [];
  const alreadyEnabledIds: string[] = [];
  const enableErrors: string[] = [];

  for (const item of activityItems) {
    if ((item as any).enable_selection) {
      alreadyEnabledIds.push(item.id);
      continue;
    }
    try {
      await supabaseAdmin
        .from("problem_statements")
        .update({ enable_selection: true, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      enabledIds.push(item.id);
    } catch (err: unknown) {
      enableErrors.push(`${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  await writeAudit({
    statementId: activityId,
    action: "edited",
    previousStatus: "selection_disabled",
    newStatus: "selection_enabled",
    userId: user.id,
    details: {
      activity_id: activityId,
      activity_type: "problem_statements",
      enabled_count: enabledIds.length,
      already_enabled_count: alreadyEnabledIds.length,
      error_count: enableErrors.length,
    },
  });

  revalidatePath("/admin/content-releases");

  return {
    enabledCount: enabledIds.length,
    alreadyEnabledCount: alreadyEnabledIds.length,
    errorCount: enableErrors.length,
    enabledIds,
    errorDetails: enableErrors,
    message: enabledIds.length > 0 ? `Enabled selection for ${enabledIds.length} item${enabledIds.length === 1 ? "" : "s"}.` : "No items needed enabling.",
  };
}

export async function bulkDisableSelection(activityId: string, csrfToken?: string) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const { data: forms, error: formsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, title, status, enable_selection, resource_links")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (formsError) {
    throw new Error(`Failed to load problem statements: ${formsError.message}`);
  }

  const activityItems = (forms || []).filter((row: any) => {
    const links = row.resource_links as Record<string, unknown>;
    const marker = links && links.__hub_item;
    return marker && typeof marker === "object" && (marker as Record<string, unknown>).activity_id === activityId;
  });

  const disabledIds: string[] = [];
  const alreadyDisabledIds: string[] = [];
  const disableErrors: string[] = [];

  for (const item of activityItems) {
    if (!(item as any).enable_selection) {
      alreadyDisabledIds.push(item.id);
      continue;
    }
    try {
      await supabaseAdmin
        .from("problem_statements")
        .update({ enable_selection: false, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      disabledIds.push(item.id);
    } catch (err: unknown) {
      disableErrors.push(`${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  await writeAudit({
    statementId: activityId,
    action: "edited",
    previousStatus: "selection_enabled",
    newStatus: "selection_disabled",
    userId: user.id,
    details: {
      activity_id: activityId,
      activity_type: "problem_statements",
      disabled_count: disabledIds.length,
      already_disabled_count: alreadyDisabledIds.length,
      error_count: disableErrors.length,
    },
  });

  revalidatePath("/admin/content-releases");

  return {
    disabledCount: disabledIds.length,
    alreadyDisabledCount: alreadyDisabledIds.length,
    errorCount: disableErrors.length,
    disabledIds,
    errorDetails: disableErrors,
    message: disabledIds.length > 0 ? `Disabled selection for ${disabledIds.length} item${disabledIds.length === 1 ? "" : "s"}.` : "No items needed disabling.",
  };
}

export async function bulkCloseSelection(activityId: string, csrfToken?: string) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const now = new Date().toISOString();

  const { data: forms, error: formsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, title, status, enable_selection, selection_closing, resource_links")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (formsError) {
    throw new Error(`Failed to load problem statements: ${formsError.message}`);
  }

  const activityItems = (forms || []).filter((row: any) => {
    const links = row.resource_links as Record<string, unknown>;
    const marker = links && links.__hub_item;
    return marker && typeof marker === "object" && (marker as Record<string, unknown>).activity_id === activityId;
  });

  const closedIds: string[] = [];
  const alreadyClosedIds: string[] = [];
  const closeErrors: string[] = [];

  for (const item of activityItems) {
    // Check if already closed (has closing date in the past)
    if ((item as any).selection_closing && new Date((item as any).selection_closing) <= new Date()) {
      alreadyClosedIds.push(item.id);
      continue;
    }
    try {
      await supabaseAdmin
        .from("problem_statements")
        .update({
          enable_selection: false,
          selection_closing: now,
          updated_by: user.id,
          updated_at: now,
        })
        .eq("id", item.id);
      closedIds.push(item.id);
    } catch (err: unknown) {
      closeErrors.push(`${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  await writeAudit({
    statementId: activityId,
    action: "edited",
    previousStatus: "selection_open",
    newStatus: "selection_closed",
    userId: user.id,
    details: {
      activity_id: activityId,
      activity_type: "problem_statements",
      closed_count: closedIds.length,
      already_closed_count: alreadyClosedIds.length,
      error_count: closeErrors.length,
    },
  });

  revalidatePath("/admin/content-releases");

  return {
    closedCount: closedIds.length,
    alreadyClosedCount: alreadyClosedIds.length,
    errorCount: closeErrors.length,
    closedIds,
    errorDetails: closeErrors,
    message: closedIds.length > 0 ? `Closed selection for ${closedIds.length} item${closedIds.length === 1 ? "" : "s"}.` : "No items needed closing.",
  };
}

// ================================================================================
// TIMER ACTIONS
// ================================================================================

export async function setReadingTimer(
  activityId: string,
  scheduledAt: string,
  autoPublish: boolean,
  csrfToken?: string
) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("Enter a valid publication date and time.");
  }
  if (scheduledDate.getTime() <= Date.now()) {
    throw new Error("Scheduled publication must be in the future.");
  }

  // Cancel any existing pending schedules for items in this activity
  const { data: activityRows } = await supabaseAdmin
    .from("problem_statements")
    .select("id")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  const activityItemIds = (activityRows || []).filter(
    (row: any) => {
      const links = row.resource_links as Record<string, unknown>;
      const marker = links && links.__hub_item;
      return marker && typeof marker === "object" && (marker as Record<string, unknown>).activity_id === activityId;
    }
  ).map((row: any) => row.id);

  if (activityItemIds.length > 0) {
    await supabaseAdmin
      .from("content_scheduled_publications")
      .delete()
      .in("item_id", activityItemIds)
      .eq("status", "pending");
  }

  // Create schedule records for all draft items
  const draftItems = (activityRows || []).filter(
    (row: any) => row.status === "draft"
  );

  for (const item of draftItems) {
    await supabaseAdmin
      .from("content_scheduled_publications")
      .insert({
        item_id: item.id,
        scheduled_at: scheduledDate.toISOString(),
        timezone: "UTC",
        status: "pending",
        created_by: user.id,
      });
  }

  await writeAudit({
    statementId: activityId,
    action: "scheduled",
    previousStatus: "draft",
    newStatus: "scheduled",
    userId: user.id,
    details: {
      activity_id: activityId,
      activity_type: "problem_statements",
      scheduled_at: scheduledDate.toISOString(),
      timezone: "UTC",
      auto_publish: autoPublish,
      scheduled_count: draftItems.length,
    },
  });

  revalidatePath("/admin/content-releases");

  return {
    scheduledCount: draftItems.length,
    scheduledAt: scheduledDate.toISOString(),
    message: `Scheduled ${draftItems.length} item${draftItems.length === 1 ? "" : "s"} for publication at ${scheduledDate.toLocaleString()}.`,
  };
}

export async function setSelectionTimer(
  activityId: string,
  selectionOpening: string | null,
  selectionClosing: string | null,
  csrfToken?: string
) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const openingDate = selectionOpening ? new Date(selectionOpening) : null;
  const closingDate = selectionClosing ? new Date(selectionClosing) : null;

  if (openingDate && Number.isNaN(openingDate.getTime())) {
    throw new Error("Invalid selection opening date.");
  }
  if (closingDate && Number.isNaN(closingDate.getTime())) {
    throw new Error("Invalid selection closing date.");
  }
  if (openingDate && closingDate && closingDate.getTime() <= openingDate.getTime()) {
    throw new Error("Selection closing must be after opening.");
  }

  const { data: forms, error: formsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, title, status, enable_selection, resource_links")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (formsError) {
    throw new Error(`Failed to load problem statements: ${formsError.message}`);
  }

  const activityItems = (forms || []).filter((row: any) => {
    const links = row.resource_links as Record<string, unknown>;
    const marker = links && links.__hub_item;
    return marker && typeof marker === "object" && (marker as Record<string, unknown>).activity_id === activityId;
  });

  const updatedIds: string[] = [];
  const updateErrors: string[] = [];

  for (const item of activityItems) {
    try {
      await supabaseAdmin
        .from("problem_statements")
        .update({
          selection_opening: selectionOpening,
          selection_closing: selectionClosing,
          // Auto-enable selection if an opening date is set
          enable_selection: selectionOpening ? true : (item as any).enable_selection,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      updatedIds.push(item.id);
    } catch (err: unknown) {
      updateErrors.push(`${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  await writeAudit({
    statementId: activityId,
    action: "edited",
    previousStatus: "selection_not_scheduled",
    newStatus: "selection_scheduled",
    userId: user.id,
    details: {
      activity_id: activityId,
      activity_type: "problem_statements",
      selection_opening: selectionOpening,
      selection_closing: selectionClosing,
      updated_count: updatedIds.length,
      error_count: updateErrors.length,
    },
  });

  revalidatePath("/admin/content-releases");

  return {
    updatedCount: updatedIds.length,
    errorCount: updateErrors.length,
    updatedIds,
    errorDetails: updateErrors,
    message: updatedIds.length > 0
      ? `Selection timer configured for ${updatedIds.length} item${updatedIds.length === 1 ? "" : "s"}.`
      : "No items to update.",
  };
}

export async function expireSelections(activityId: string, csrfToken?: string) {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const now = new Date().toISOString();

  const { data: forms, error: formsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, title, enable_selection, selection_closing, resource_links")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (formsError) {
    throw new Error(`Failed to load problem statements: ${formsError.message}`);
  }

  const activityItems = (forms || []).filter((row: any) => {
    const links = row.resource_links as Record<string, unknown>;
    const marker = links && links.__hub_item;
    return marker && typeof marker === "object" && (marker as Record<string, unknown>).activity_id === activityId;
  });

  const expiredIds: string[] = [];
  const expireErrors: string[] = [];

  for (const item of activityItems) {
    if (!(item as any).enable_selection) continue;
    if (!(item as any).selection_closing) continue;
    if (new Date((item as any).selection_closing) > new Date()) continue;

    try {
      await supabaseAdmin
        .from("problem_statements")
        .update({ enable_selection: false, updated_by: user.id, updated_at: now })
        .eq("id", item.id);
      expiredIds.push(item.id);
    } catch (err: unknown) {
      expireErrors.push(`${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (expiredIds.length > 0) {
    await writeAudit({
      statementId: activityId,
      action: "edited",
      previousStatus: "selection_open",
      newStatus: "selection_closed",
      userId: user.id,
      details: {
        activity_id: activityId,
        activity_type: "problem_statements",
        expired_count: expiredIds.length,
        expired_ids: expiredIds,
        reason: "selection_deadline_passed",
      },
    });
  }

  revalidatePath("/admin/content-releases");

  return {
    expiredCount: expiredIds.length,
    errorCount: expireErrors.length,
    expiredIds,
    errorDetails: expireErrors,
    message: expiredIds.length > 0 ? `Closed selection for ${expiredIds.length} item${expiredIds.length === 1 ? "" : "s"} (deadline passed).` : "No selections expired.",
  };
}

/**
 * Process expired scheduled timers for an activity.
 * Checks content_scheduled_publications for pending schedules whose
 * scheduled_at has passed, and executes the appropriate phase transition:
 *   - reading mode  -> startReadingPhase
 *   - selection mode -> publishForSelection
 * Idempotent: marks schedules as completed/failed so repeated calls are safe.
 */
export async function processExpiredSchedules(
  activityId: string,
  csrfToken?: string
): Promise<{
  success: boolean;
  processed: number;
  message: string;
  error?: string;
}> {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const now = new Date().toISOString();

  // Get all items in this activity
  const { data: activityRows, error: rowsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, resource_links")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (rowsError) {
    return { success: false, processed: 0, message: "Failed to load activity items.", error: rowsError.message };
  }

  const activityItemIds = (activityRows || []).filter(
    (row: any) => {
      const links = row.resource_links as Record<string, unknown>;
      const marker = links && links.__hub_item;
      return marker && typeof marker === "object" && (marker as Record<string, unknown>).activity_id === activityId;
    }
  ).map((row: any) => row.id);

  if (activityItemIds.length === 0) {
    return { success: false, processed: 0, message: "No problem statements found in this activity." };
  }

  // Find expired pending schedules for items in this activity
  const { data: expiredSchedules, error: schedError } = await supabaseAdmin
    .from("content_scheduled_publications")
    .select("id, item_id, scheduled_at, mode, status")
    .in("item_id", activityItemIds)
    .eq("status", "pending")
    .lt("scheduled_at", now);

  if (schedError) {
    return { success: false, processed: 0, message: "Failed to load scheduled timers.", error: schedError.message };
  }

  if ((expiredSchedules || []).length === 0) {
    return { success: true, processed: 0, message: "No expired schedules to process." };
  }

  // Determine the mode from the expired schedules (all should be same for an activity)
  const modes = new Set((expiredSchedules || []).map((s: any) => s.mode));
  const mode = modes.size > 0 ? Array.from(modes)[0] : "reading";

  let processed = 0;
  const errors: string[] = [];

  try {
    if (mode === "selection") {
      // Activate selection phase
      const res = await publishForSelection(activityId, csrfToken);
      if (!res.success) {
        throw new Error(res.error || "Failed to activate selection phase.");
      }
      processed = res.activatedCount;
    } else {
      // Start reading phase
      const res = await startReadingPhase(activityId, csrfToken);
      if (!res.success) {
        throw new Error(res.error || "Failed to start reading phase.");
      }
      processed = res.startedCount;
    }
  } catch (err: unknown) {
    errors.push(err instanceof Error ? err.message : "Unknown error");
  }

  // Mark all expired schedules as completed or failed
  const scheduleIds = (expiredSchedules || []).map((s: any) => s.id);
  if (scheduleIds.length > 0) {
    await supabaseAdmin
      .from("content_scheduled_publications")
      .update({
        status: errors.length > 0 ? "failed" : "completed",
        executed_at: now,
        failure_reason: errors.length > 0 ? errors.join("; ") : null,
      })
      .in("id", scheduleIds);
  }

  await writeAudit({
    statementId: activityId,
    action: "edited",
    previousStatus: "scheduled",
    newStatus: mode === "selection" ? "selection" : "reading",
    userId: user.id,
    details: {
      activity_id: activityId,
      activity_type: "problem_statements",
      mode,
      processed_count: processed,
      error_count: errors.length,
      schedule_ids: scheduleIds,
    },
  });

  revalidatePath("/admin/content-releases");
  revalidatePath("/team/problem-statements");

  return {
    success: errors.length === 0,
    processed,
    message: errors.length > 0
      ? `Processed ${processed} item(s) with ${errors.length} error(s).`
      : `Processed ${processed} item(s) for ${mode} phase.`,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// ================================================================================
// PHASE MANAGEMENT ACTIONS
// ================================================================================

/**
 * Start the Reading Phase for an activity.
 * - Sets status = 'published' for all items in the activity
 * - Sets reading_started_at = now()
 * - Sets enable_selection = false (teams can read but not select)
 * - Clears reading_ended_at
 */
export async function startReadingPhase(
  activityId: string,
  csrfToken?: string
): Promise<{
  success: boolean;
  startedCount: number;
  message: string;
  error?: string;
}> {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const now = new Date().toISOString();

  // Get all items in this activity
  const { data: activityRows, error: rowsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, status, enable_selection")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (rowsError) {
    return { success: false, startedCount: 0, message: "Failed to load activity items.", error: rowsError.message };
  }

  const itemIds = (activityRows || []).map((row: any) => row.id);

  if (itemIds.length === 0) {
    return { success: false, startedCount: 0, message: "No problem statements found in this activity." };
  }

  // Publish all items and enable reading phase
  const { error: updateError } = await supabaseAdmin
    .from("problem_statements")
    .update({
      status: "published",
      enable_selection: false,
      reading_started_at: now,
      reading_ended_at: null,
      selection_activated_at: null,
      selection_activated_by: null,
      manual_lock: false,
    })
    .in("id", itemIds);

  if (updateError) {
    return { success: false, startedCount: 0, message: "Failed to start reading phase.", error: updateError.message };
  }

  await writeAudit({
    statementId: activityId,
    action: "reading_phase_started",
    previousStatus: null,
    newStatus: "reading",
    userId: user.id,
    details: { activity_id: activityId, item_count: itemIds.length, started_at: now },
  });

  revalidatePath("/admin/content-releases");

  return {
    success: true,
    startedCount: itemIds.length,
    message: `Reading phase started for ${itemIds.length} problem statement${itemIds.length === 1 ? "" : "s"}.`,
  };
}

/**
 * Publish for Selection phase.
 * - Validates that reading phase has started (reading_started_at is not null)
 * - Sets enable_selection = true for all items
 * - Sets selection_activated_at = now()
 * - Sets selection_activated_by = current admin
 */
export async function publishForSelection(
  activityId: string,
  csrfToken?: string
): Promise<{
  success: boolean;
  activatedCount: number;
  message: string;
  error?: string;
}> {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const now = new Date().toISOString();

  // Get all items in this activity
  const { data: activityRows, error: rowsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, reading_started_at, enable_selection")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (rowsError) {
    return { success: false, activatedCount: 0, message: "Failed to load activity items.", error: rowsError.message };
  }

  const itemIds = (activityRows || []).map((row: any) => row.id);

  if (itemIds.length === 0) {
    return { success: false, activatedCount: 0, message: "No problem statements found in this activity." };
  }

  // Validate reading phase has started
  const notStarted = (activityRows || []).some(
    (row: any) => !row.reading_started_at
  );

  if (notStarted) {
    return {
      success: false,
      activatedCount: 0,
      message: "Reading phase has not started yet. Please start reading phase first before publishing for selection.",
    };
  }

  // Enable selection
  const { error: updateError } = await supabaseAdmin
    .from("problem_statements")
    .update({
      enable_selection: true,
      selection_opening: now,
      selection_activated_at: now,
      selection_activated_by: user.id,
      manual_lock: false,
    })
    .in("id", itemIds);

  if (updateError) {
    return { success: false, activatedCount: 0, message: "Failed to publish for selection.", error: updateError.message };
  }

  await writeAudit({
    statementId: activityId,
    action: "selection_phase_activated",
    previousStatus: "reading",
    newStatus: "selection",
    userId: user.id,
    details: { activity_id: activityId, item_count: itemIds.length, activated_at: now },
  });

  revalidatePath("/admin/content-releases");

  return {
    success: true,
    activatedCount: itemIds.length,
    message: `Selection phase activated for ${itemIds.length} problem statement${itemIds.length === 1 ? "" : "s"}.`,
  };
}

/**
 * Close the Selection phase.
 * - Sets enable_selection = false
 * - Sets manual_lock = true
 * - Preserves all existing selections
 */
export async function closeSelection(
  activityId: string,
  csrfToken?: string
): Promise<{
  success: boolean;
  closedCount: number;
  message: string;
  error?: string;
}> {
  const { user } = await requireAdmin();
  await validateCsrfToken(csrfToken || null);

  const now = new Date().toISOString();

  // Get all items in this activity
  const { data: activityRows, error: rowsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, enable_selection")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements");

  if (rowsError) {
    return { success: false, closedCount: 0, message: "Failed to load activity items.", error: rowsError.message };
  }

  const itemIds = (activityRows || []).map((row: any) => row.id);

  if (itemIds.length === 0) {
    return { success: false, closedCount: 0, message: "No problem statements found in this activity." };
  }

  // Close selection
  const { error: updateError } = await supabaseAdmin
    .from("problem_statements")
    .update({
      enable_selection: false,
      manual_lock: true,
    })
    .in("id", itemIds);

  if (updateError) {
    return { success: false, closedCount: 0, message: "Failed to close selection.", error: updateError.message };
  }

  await writeAudit({
    statementId: activityId,
    action: "selection_phase_closed",
    previousStatus: "selection",
    newStatus: "closed",
    userId: user.id,
    details: { activity_id: activityId, item_count: itemIds.length, closed_at: now },
  });

  revalidatePath("/admin/content-releases");

  return {
    success: true,
    closedCount: itemIds.length,
    message: `Selection phase closed for ${itemIds.length} problem statement${itemIds.length === 1 ? "" : "s"}.`,
  };
}

/**
 * Get the current phase status for an activity.
 * Returns phase state, timestamps, and item counts.
 */
export async function getPhaseStatus(
  activityId: string
): Promise<{
  success: boolean;
  phase: "not_started" | "reading" | "selection" | "closed";
  readingStartedAt: string | null;
  readingEndedAt: string | null;
  selectionActivatedAt: string | null;
  selectionActivatedBy: string | null;
  items: Array<{
    id: string;
    title: string;
    domain: string | null;
    status: string;
    enable_selection: boolean;
    manual_lock: boolean;
    team_limit: number | null;
    assigned_count: number;
  }>;
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, phase: "not_started", readingStartedAt: null, readingEndedAt: null, selectionActivatedAt: null, selectionActivatedBy: null, items: [], error: "Authentication required." };
  }

  const { data: activityRows, error: rowsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, title, domain, status, enable_selection, manual_lock, team_limit, reading_started_at, reading_ended_at, selection_activated_at, selection_activated_by")
    .eq("domain", "content_hub_activity")
    .eq("resource_links->__hub_activity->>type", "problem_statements")
    .order("display_order", { ascending: true });

  if (rowsError) {
    return { success: false, phase: "not_started", readingStartedAt: null, readingEndedAt: null, selectionActivatedAt: null, selectionActivatedBy: null, items: [], error: rowsError.message };
  }

  if ((activityRows || []).length === 0) {
    return { success: true, phase: "not_started", readingStartedAt: null, readingEndedAt: null, selectionActivatedAt: null, selectionActivatedBy: null, items: [] };
  }

  // Get assignment counts for each item
  const itemIds = activityRows.map((row: any) => row.id);
  const { data: assignments, error: assignError } = await supabaseAdmin
    .from("team_problem_statement_assignments")
    .select("problem_statement_id, team_id")
    .in("problem_statement_id", itemIds);

  const assignmentCounts: Record<string, number> = {};
  (assignments || []).forEach((a: any) => {
    assignmentCounts[a.problem_statement_id] = (assignmentCounts[a.problem_statement_id] || 0) + 1;
  });

  // Determine overall phase
  const anyReadingStarted = (activityRows || []).some((row: any) => row.reading_started_at);
  const anySelectionActivated = (activityRows || []).some((row: any) => row.selection_activated_at);
  const anySelectionEnabled = (activityRows || []).some((row: any) => row.enable_selection);

  let phase: "not_started" | "reading" | "selection" | "closed" = "not_started";
  if (anySelectionActivated && anySelectionEnabled) {
    phase = "selection";
  } else if (anySelectionActivated && !anySelectionEnabled) {
    phase = "closed";
  } else if (anyReadingStarted) {
    phase = "reading";
  }

  // Use the first item's timestamps as representative
  const firstRow = activityRows[0];

  const items = activityRows.map((row: any) => ({
    id: row.id,
    title: row.title,
    domain: row.domain,
    status: row.status,
    enable_selection: row.enable_selection,
    manual_lock: row.manual_lock,
    team_limit: row.team_limit,
    assigned_count: assignmentCounts[row.id] || 0,
  }));

  return {
    success: true,
    phase,
    readingStartedAt: firstRow.reading_started_at,
    readingEndedAt: firstRow.reading_ended_at,
    selectionActivatedAt: firstRow.selection_activated_at,
    selectionActivatedBy: firstRow.selection_activated_by,
    items,
  };
}

// Get assignment counts for multiple problem statements (server action for client use)
export async function getAssignmentCounts(
  statementIds: string[]
): Promise<Record<string, number>> {
  if (!statementIds || statementIds.length === 0) {
    return {};
  }

  const { data, error } = await supabaseAdmin
    .from("team_problem_statement_assignments")
    .select("problem_statement_id, team_id")
    .in("problem_statement_id", statementIds);

  if (error) {
    console.error("Failed to fetch assignment counts:", error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    counts[row.problem_statement_id] = (counts[row.problem_statement_id] || 0) + 1;
  });
  return counts;
}

// ================================================================================
// LOCAL HELPERS
// ================================================================================

async function writeAudit(params: {
  statementId: string | null;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  userId: string;
  details: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("audit_logs").insert([
    {
      action: params.action,
      entity_type: "problem_statement",
      entity_id: params.statementId,
      admin_id: params.userId,
      details: params.details,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.warn("Audit log write failed:", error.message);
  }
}

// Get all team problem statement selections with full details for admin view
export interface TeamSelectionRecord {
  assigned_at: string;
  team_id: string;
  team_name: string;
  team_code: string | null;
  problem_statement_id: string;
  ps_reference_number: string | null;
  ps_sih_ps_number: string | null;
  ps_title: string;
}

export async function getTeamProblemStatementSelections(): Promise<{
  selections: TeamSelectionRecord[];
  total: number;
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { selections: [], total: 0, error: "Authentication required." };
  }

  const { data, error } = await supabaseAdmin
    .from("team_problem_statement_assignments")
    .select(
      `
      assigned_at,
      team_id,
      teams!inner (
        id,
        name,
        code
      ),
      problem_statement_id,
      problem_statements!inner (
        id,
        reference_number,
        sih_ps_number,
        title
      )
    `
    )
    .order("assigned_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch team selections:", error.message);
    return { selections: [], total: 0, error: error.message };
  }

  const selections: TeamSelectionRecord[] = (data || []).map((row: any) => ({
    assigned_at: row.assigned_at,
    team_id: row.team_id,
    team_name: row.teams?.name || "Unknown Team",
    team_code: row.teams?.code || null,
    problem_statement_id: row.problem_statement_id,
    ps_reference_number: row.problem_statements?.reference_number || null,
    ps_sih_ps_number: row.problem_statements?.sih_ps_number || null,
    ps_title: row.problem_statements?.title || "Unknown Problem Statement",
  }));

  return { selections, total: selections.length };
}

// Export all team problem statement selections as CSV
export async function exportTeamProblemStatementSelections(): Promise<{
  csv: string;
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { csv: "", error: "Authentication required." };
  }

  const { data, error } = await supabaseAdmin
    .from("team_problem_statement_assignments")
    .select(
      `
      assigned_at,
      team_id,
      teams!inner (
        id,
        name,
        code
      ),
      problem_statement_id,
      problem_statements!inner (
        id,
        reference_number,
        sih_ps_number,
        title
      )
    `
    )
    .order("assigned_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch team selections for export:", error.message);
    return { csv: "", error: error.message };
  }

  const selections: TeamSelectionRecord[] = (data || []).map((row: any) => ({
    assigned_at: row.assigned_at,
    team_id: row.team_id,
    team_name: row.teams?.name || "Unknown Team",
    team_code: row.teams?.code || null,
    problem_statement_id: row.problem_statement_id,
    ps_reference_number: row.problem_statements?.reference_number || null,
    ps_sih_ps_number: row.problem_statements?.sih_ps_number || null,
    ps_title: row.problem_statements?.title || "Unknown Problem Statement",
  }));

  // CSV headers
  const headers = ["Selection Time", "Team ID", "Team Name", "PS Code", "PS Title"];

  // Helper to escape CSV fields
  const escapeCsv = (value: string): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Escape double quotes by doubling them
    const escaped = str.replace(/"/g, '""');
    // Wrap in quotes if contains comma, double quote, or newline
    if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n") || escaped.includes("\r")) {
      return `"${escaped}"`;
    }
    return escaped;
  };

  // Format timestamp in Asia/Kolkata
  const formatTime = (iso: string): string => {
    try {
      const date = new Date(iso);
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
    } catch {
      return iso;
    }
  };

  const rows = selections.map((s) => [
    formatTime(s.assigned_at),
    s.team_code || s.team_id.slice(0, 8),
    s.team_name,
    s.ps_reference_number || "N/A",
    s.ps_title,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  return { csv: csvContent };
}
