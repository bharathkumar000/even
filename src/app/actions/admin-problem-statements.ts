export type { ProjectFormStatus } from "@/app/actions/project-submission-forms";
"use server";

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

// Get only published statements for team leaders
export async function getPublishedProblemStatements(): Promise<ProblemStatement[]> {
  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .select("*")
    .eq("status", "published")
    .order("display_order", { ascending: true });
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
    .is("resource_links->__hub_activity->>type", "problem_statements");

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
    .is("resource_links->__hub_activity->>type", "problem_statements");

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
    .is("resource_links->__hub_activity->>type", "problem_statements");

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
    .is("resource_links->__hub_activity->>type", "problem_statements");

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
    .is("resource_links->__hub_activity->>type", "problem_statements");

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
    .is("resource_links->__hub_activity->>type", "problem_statements");

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
    .is("resource_links->__hub_activity->>type", "problem_statements");

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
    .is("resource_links->__hub_activity->>type", "problem_statements");

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
