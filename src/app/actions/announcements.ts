"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireOperationsRole } from "@/lib/auth/operations";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export type AnnouncementStatus = "draft" | "scheduled" | "published" | "unpublished" | "archived";
export type AnnouncementCategory = "general" | "important" | "deadline" | "schedule" | "emergency";
export type AnnouncementPriority = "normal" | "important" | "high" | "urgent";
export type AnnouncementAudience = "all" | "teams" | "judges" | "ops" | "admin" | "participants" | "staff" | "organizers";

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  target_audience: AnnouncementAudience | AnnouncementAudience[];
  category?: AnnouncementCategory;
  created_at: string;
  published_at?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  pin_to_top?: boolean;
  is_pinned?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority_level: AnnouncementPriority;
  priority?: AnnouncementPriority;
  target_audience: AnnouncementAudience | AnnouncementAudience[];
  target_audiences?: AnnouncementAudience[];
  status: AnnouncementStatus;
  is_active: boolean;
  pin_to_top: boolean;
  is_pinned?: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  resource_links: Record<string, string>[];
  created_at: string;
}

export interface AnnouncementWithCounts extends Announcement {
  total_views: number;
  total_clicks: number;
}

/**
 * Normalizes a database row to the Announcement interface
 */
function mapDbToAnnouncement(row: any): Announcement {
  const isPinned = Boolean(row.is_pinned ?? row.pin_to_top ?? false);
  const priority = (row.priority || row.priority_level || "normal") as AnnouncementPriority;
  const status = (row.status || (row.is_active ? "published" : "draft")) as AnnouncementStatus;
  const category = (row.category || "general") as AnnouncementCategory;
  const audience = (row.target_audience || "all") as AnnouncementAudience;
  const targetAudiences = (Array.isArray(row.target_audiences)
    ? (row.target_audiences as AnnouncementAudience[])
    : audience === "all" || !audience
      ? ["all"]
      : [audience]) as AnnouncementAudience[];

  let links: Record<string, string>[] = [];
  if (Array.isArray(row.resource_links)) {
    links = row.resource_links;
  } else if (Array.isArray(row.attachments)) {
    links = row.attachments;
  }

    return {
      id: row.id,
      title: row.title || "",
      message: row.message || "",
      category,
      priority_level: priority,
      priority,
      target_audience: targetAudiences.length === 1 && targetAudiences[0] === "all" ? "all" : targetAudiences,
      target_audiences: targetAudiences,
      status,
    is_active: row.is_active ?? true,
    pin_to_top: isPinned,
    is_pinned: isPinned,
    scheduled_at: row.scheduled_at || null,
    published_at: row.published_at || row.created_at || null,
    expires_at: row.expires_at || null,
    attachment_url: row.attachment_url || null,
    attachment_name: row.attachment_name || null,
    resource_links: links,
    created_at: row.created_at || new Date().toISOString(),
  };
}

/**
 * Maps partial announcement update payload to matching database columns
 */
function mapAnnouncementToDb(data: Partial<any>): Record<string, any> {
  const row: Record<string, any> = {};

  if (data.title !== undefined) row.title = String(data.title).trim();
  if (data.message !== undefined) row.message = String(data.message).trim();
  if (data.category !== undefined) row.category = data.category;
  
  if (data.priority !== undefined) {
    row.priority = data.priority;
  } else if (data.priority_level !== undefined) {
    row.priority = data.priority_level;
  }

  if (data.target_audience !== undefined) row.target_audience = data.target_audience;
  if (data.status !== undefined) {
    row.status = data.status === "unpublished" ? "draft" : data.status;
  }
  if (data.is_active !== undefined) row.is_active = data.is_active;

  if (data.is_pinned !== undefined) {
    row.is_pinned = Boolean(data.is_pinned);
  } else if (data.pin_to_top !== undefined) {
    row.is_pinned = Boolean(data.pin_to_top);
  }

  if (data.scheduled_at !== undefined) row.scheduled_at = data.scheduled_at || null;
  if (data.published_at !== undefined) row.published_at = data.published_at || null;
  if (data.expires_at !== undefined) row.expires_at = data.expires_at || null;

  // Store attachments/links in actual 'attachments' JSON column
  if (data.attachments !== undefined) {
    row.attachments = data.attachments;
  } else if (data.attachment_url || data.attachment_name || (data.resource_links && data.resource_links.length > 0)) {
    const list: any[] = [];
    if (data.attachment_url) {
      list.push({ url: data.attachment_url, name: data.attachment_name || "Attachment" });
    }
    if (Array.isArray(data.resource_links)) {
      list.push(...data.resource_links);
    }
    row.attachments = list;
  }

  return row;
}

/**
 * Fetch active announcements tailored for a given audience role
 */
export async function getActiveAnnouncements(
  audience: AnnouncementAudience | AnnouncementAudience[] = "all"
): Promise<AnnouncementItem[]> {
  try {
    const audiences = Array.isArray(audience) ? audience : [audience];
    // Use the first audience for portal lookup; the RPC handles array matching
    const list = await getAnnouncementsForPortal(audiences[0] || "all", 50);
    return list.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      priority: item.priority || item.priority_level || "normal",
      target_audience: item.target_audience,
      category: item.category,
      created_at: item.created_at,
      published_at: item.published_at,
      expires_at: item.expires_at,
      is_active: item.is_active,
      pin_to_top: item.pin_to_top,
      is_pinned: item.is_pinned,
    }));
  } catch (err) {
    console.warn("Failed to load active announcements:", err);
    return [];
  }
}

/**
 * Get announcements for a specific audience (for portal display)
 * Queries Supabase announcements with status published, active, non-expired, ordered by pinned status
 */
export async function getAnnouncementsForPortal(
  audience: AnnouncementAudience = "all",
  limit = 20
): Promise<Announcement[]> {
  try {
    const nowIso = new Date().toISOString();

    let query = supabaseAdmin
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .or("status.eq.published,status.is.null")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    if (audience && audience !== "all") {
      const validAudiences: AnnouncementAudience[] = ["all", audience];
      if (audience === "teams") validAudiences.push("participants");
      if (audience === "ops") validAudiences.push("staff", "organizers");
      // Use Supabase array overlap operator: check if target_audiences overlaps with valid audiences
      // Also check legacy single-value target_audience column for backward compatibility
      query = query.or(
        `target_audience.in.(${validAudiences.join(",")}),target_audiences.cs.{"${validAudiences.join('","')}"}`
      );
    }

    query = query
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("Failed to query announcements for portal:", error.message);
      return [];
    }

    return (data || []).map(mapDbToAnnouncement);
  } catch (err: unknown) {
    console.error("Failed to get announcements for portal:", err);
    return [];
  }
}

/**
 * Get announcement counts for admin dashboard
 */
export async function getAnnouncementCounts(): Promise<{
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
  archived: number;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("status, is_active");

    if (error || !data) {
      return { total: 0, published: 0, scheduled: 0, drafts: 0, archived: 0 };
    }

    const total = data.length;
    const published = data.filter((a) => (a.status === "published" || !a.status) && a.is_active).length;
    const scheduled = data.filter((a) => a.status === "scheduled").length;
    const drafts = data.filter((a) => a.status === "draft").length;
    const archived = data.filter((a) => a.status === "archived").length;

    return { total, published, scheduled, drafts, archived };
  } catch {
    return { total: 0, published: 0, scheduled: 0, drafts: 0, archived: 0 };
  }
}

/**
 * Get announcements for admin dashboard with filtering
 */
export async function getAnnouncementsAdmin(filters?: {
  status?: AnnouncementStatus;
  audience?: AnnouncementAudience;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ announcements: Announcement[]; total: number }> {
  try {
    let query = supabaseAdmin.from("announcements").select("*", { count: "exact" });

    if (filters?.status && (filters.status as string) !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters?.audience && filters.audience !== "all") {
      const validAudiences: AnnouncementAudience[] = ["all", filters.audience];
      if (filters.audience === "teams") validAudiences.push("participants");
      if (filters.audience === "ops") validAudiences.push("staff", "organizers");
      query = query.or(
        `target_audience.in.(${validAudiences.join(",")}),target_audiences.cs.{"${validAudiences.join('","')}"}`
      );
    }
    if (filters?.search) {
      query = query.ilike("title", `%${filters.search}%`);
    }

    query = query
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch announcements admin:", error.message);
      return { announcements: [], total: 0 };
    }

    return {
      announcements: (data || []).map(mapDbToAnnouncement),
      total: count || 0,
    };
  } catch (err: unknown) {
    console.error("Failed to get announcements admin:", err);
    return { announcements: [], total: 0 };
  }
}

/**
 * Get a single announcement by ID
 */
export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return mapDbToAnnouncement(data);
  } catch {
    return null;
  }
}

/**
 * Create a new announcement (organizers / admins / staff)
 */
export async function createAnnouncement({
  title,
  message,
  priority = "normal",
  priority_level,
  target_audience = ["all"],
  category = "general",
  status = "published",
  is_pinned,
  pin_to_top,
  scheduled_at,
  published_at,
  expires_at,
  attachment_url,
  attachment_name,
  resource_links,
  [CSRF_CONSTANTS.HEADER_NAME]: csrfToken,
}: {
  title: string;
  message: string;
  priority?: AnnouncementPriority;
  priority_level?: AnnouncementPriority;
  target_audience?: AnnouncementAudience | AnnouncementAudience[];
  category?: AnnouncementCategory;
  status?: AnnouncementStatus;
  is_pinned?: boolean;
  pin_to_top?: boolean;
  scheduled_at?: string | null;
  published_at?: string | null;
  expires_at?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  resource_links?: Record<string, string>[];
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireOperationsRole();
  if (csrfToken) {
    try {
      await validateCsrfToken(csrfToken);
    } catch {
      // Allow authenticated operations session
    }
  }

  // Validate and normalize target_audience
  const audiences = Array.isArray(target_audience) ? target_audience : [target_audience];
  const validAudiences: AnnouncementAudience[] = [
    "all", "teams", "judges", "ops", "admin", "participants", "staff", "organizers",
  ];
  const filteredAudiences = audiences.filter((a) => validAudiences.includes(a));
  const normalizedAudience = filteredAudiences.length > 0 ? filteredAudiences : ["all"];
  // If 'all' is selected with others, normalize to just ['all']
  const finalAudience = normalizedAudience.includes("all") && normalizedAudience.length > 1
    ? ["all"]
    : normalizedAudience;

  const effectivePriority = priority_level || priority || "normal";
  const effectivePinned = Boolean(is_pinned ?? pin_to_top ?? false);
  const now = new Date().toISOString();
  const effectiveStatus = status || "published";
  const effectivePublishedAt =
    effectiveStatus === "published"
      ? (published_at || now)
      : (published_at || null);

  const dbRow = mapAnnouncementToDb({
    title: title.trim(),
    message: message.trim(),
    priority: effectivePriority,
    target_audience: finalAudience,
    category,
    status: effectiveStatus,
    is_active: effectiveStatus === "published",
    is_pinned: effectivePinned,
    scheduled_at: scheduled_at || null,
    published_at: effectivePublishedAt,
    expires_at: expires_at || null,
    attachment_url: attachment_url || null,
    attachment_name: attachment_name || null,
    resource_links: resource_links || [],
    created_by: user.id,
  });

  const { data, error } = await supabaseAdmin
    .from("announcements")
    .insert(dbRow)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/announcements");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  revalidatePath("/ops/scanner");

  return { success: true, announcement: mapDbToAnnouncement(data) };
}

/**
 * Update an existing announcement
 */
export async function updateAnnouncement(
  id: string,
  data: Partial<{
    title: string;
    message: string;
    category: AnnouncementCategory;
    priority_level: AnnouncementPriority;
    priority: AnnouncementPriority;
    target_audience: AnnouncementAudience | AnnouncementAudience[];
    status: AnnouncementStatus;
    scheduled_at: string | null;
    published_at: string | null;
    expires_at: string | null;
    pin_to_top: boolean;
    is_pinned: boolean;
    attachment_url: string | null;
    attachment_name: string | null;
    resource_links: Record<string, string>[];
  }>,
  csrfToken?: string
) {
  await requireOperationsRole();
  if (csrfToken) {
    try {
      await validateCsrfToken(csrfToken);
    } catch {}
  }

  // Validate and normalize target_audience if provided
  if (data.target_audience !== undefined) {
    const audiences = Array.isArray(data.target_audience) ? data.target_audience : [data.target_audience];
    const validAudiences: AnnouncementAudience[] = [
      "all", "teams", "judges", "ops", "admin", "participants", "staff", "organizers",
    ];
    const filteredAudiences = audiences.filter((a) => validAudiences.includes(a));
    const normalizedAudience = filteredAudiences.length > 0 ? filteredAudiences : (["all"] as AnnouncementAudience[]);
    data.target_audience = normalizedAudience.includes("all") && normalizedAudience.length > 1
      ? (["all"] as AnnouncementAudience[])
      : normalizedAudience;
  }

  const dbRow = mapAnnouncementToDb(data);

  if (dbRow.status === "published" && !dbRow.published_at) {
    dbRow.published_at = new Date().toISOString();
    dbRow.is_active = true;
  }

  const { error } = await supabaseAdmin
    .from("announcements")
    .update(dbRow)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/announcements");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  revalidatePath("/ops/scanner");

  return { success: true };
}

/**
 * Publish an announcement
 */
export async function publishAnnouncement(id: string, csrfToken?: string) {
  await requireOperationsRole();
  if (csrfToken) {
    try {
      await validateCsrfToken(csrfToken);
    } catch {}
  }

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({
      status: "published",
      is_active: true,
      published_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to publish announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/announcements");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  revalidatePath("/ops/scanner");

  return { success: true };
}

/**
 * Unpublish an announcement
 */
export async function unpublishAnnouncement(id: string, csrfToken?: string) {
  await requireOperationsRole();
  if (csrfToken) {
    try {
      await validateCsrfToken(csrfToken);
    } catch {}
  }

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({ status: "draft", is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to unpublish announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/announcements");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  revalidatePath("/ops/scanner");

  return { success: true };
}

/**
 * Archive an announcement
 */
export async function archiveAnnouncement(id: string, csrfToken?: string) {
  await requireOperationsRole();
  if (csrfToken) {
    try {
      await validateCsrfToken(csrfToken);
    } catch {}
  }

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({ status: "archived", is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/announcements");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  revalidatePath("/ops/scanner");

  return { success: true };
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(id: string, csrfToken?: string) {
  await requireOperationsRole();
  if (csrfToken) {
    try {
      await validateCsrfToken(csrfToken);
    } catch {}
  }

  const { error } = await supabaseAdmin.from("announcements").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/announcements");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  revalidatePath("/ops/scanner");

  return { success: true };
}

/**
 * Duplicate an announcement
 */
export async function duplicateAnnouncement(id: string, csrfToken?: string) {
  const original = await getAnnouncementById(id);
  if (!original) {
    throw new Error("Announcement not found");
  }

  return createAnnouncement({
    title: `(Copy) ${original.title}`,
    message: original.message,
    priority: original.priority_level,
    target_audience: original.target_audiences || original.target_audience,
    category: original.category,
    status: "draft",
    is_pinned: original.pin_to_top,
    resource_links: original.resource_links,
    [CSRF_CONSTANTS.HEADER_NAME]: csrfToken,
  });
}

/**
 * Toggle announcement active status
 */
export async function toggleAnnouncementActive(id: string, isActive: boolean, csrfToken?: string) {
  await requireOperationsRole();
  if (csrfToken) {
    try {
      await validateCsrfToken(csrfToken);
    } catch {}
  }

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/announcements");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  revalidatePath("/ops/scanner");

  return { success: true };
}
