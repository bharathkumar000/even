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
