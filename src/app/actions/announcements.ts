"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
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
  priority: "normal" | "important" | "urgent";
  target_audience: "all" | "teams" | "judges" | "ops";
  created_at: string;
  is_active: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority_level: AnnouncementPriority;
  target_audience: AnnouncementAudience;
  status: AnnouncementStatus;
  is_active: boolean;
  pin_to_top: boolean;
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
 * Fetch active announcements tailored for a given audience role
 */
export async function getActiveAnnouncements(
  audience?: "all" | "teams" | "judges" | "ops"
): Promise<AnnouncementItem[]> {
  try {
    let query = supabaseAdmin
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (audience && audience !== "all") {
      query = query.in("target_audience", ["all", audience]);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("Could not fetch announcements table:", error.message);
      return [];
    }

    return (data as AnnouncementItem[]) || [];
  } catch (err) {
    console.warn("Failed to load announcements:", err);
    return [];
  }
}

/**
 * Get announcements for a specific audience (for portal display)
 */
export async function getAnnouncementsForPortal(
  audience: AnnouncementAudience,
  limit = 20
): Promise<Announcement[]> {
  const { data, error } = await supabaseAdmin
    .rpc("get_announcements_for_audience", { p_audience: audience, p_limit: limit });

  if (error) {
    console.warn("Could not fetch announcements via RPC:", error.message);
    let query = supabaseAdmin
      .from("announcements")
      .select("*")
      .eq("status", "published")
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("pin_to_top", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (audience !== "all") {
      query = query.or(`target_audience.eq.all,target_audience.eq.${audience}`);
    }

    const { data: fallbackData, error: fallbackError } = await query;
    if (fallbackError) {
      console.error("Failed to fetch announcements:", fallbackError.message);
      return [];
    }
    return (fallbackData as Announcement[]) || [];
  }

  return (data as Announcement[]) || [];
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
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select("status, is_active");

  if (error || !data) {
    return { total: 0, published: 0, scheduled: 0, drafts: 0, archived: 0 };
  }

  const total = data.length;
  const published = data.filter((a) => a.status === "published" && a.is_active).length;
  const scheduled = data.filter((a) => a.status === "scheduled").length;
  const drafts = data.filter((a) => a.status === "draft").length;
  const archived = data.filter((a) => a.status === "archived").length;

  return { total, published, scheduled, drafts, archived };
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
  let query = supabaseAdmin.from("announcements").select("*", { count: "exact" });

  if (filters?.status && (filters.status as string) !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.audience && filters.audience !== "all") {
    query = query.in("target_audience", ["all", filters.audience]);
  }
  if (filters?.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }

  query = query.order("created_at", { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, (filters.offset + (filters.limit || 20)) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to fetch announcements admin:", error.message);
    return { announcements: [], total: 0 };
  }

  return {
    announcements: (data as Announcement[]) || [],
    total: count || 0,
  };
}

/**
 * Get a single announcement by ID
 */
export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Announcement;
}

/**
 * Create a new announcement (organizers / admins / staff)
 */
export async function createAnnouncement({
  title,
  message,
  priority = "normal",
  target_audience = "all",
  [CSRF_CONSTANTS.HEADER_NAME]: csrfToken,
}: {
  title: string;
  message: string;
  priority?: "normal" | "important" | "high" | "urgent";
  target_audience?: AnnouncementAudience;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireOperationsRole();
  await validateCsrfToken(csrfToken || null);

  const { data, error } = await supabaseAdmin
    .from("announcements")
    .insert({
      title: title.trim(),
      message: message.trim(),
      priority,
      target_audience,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  return { success: true, announcement: data };
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
    target_audience: AnnouncementAudience;
    status: AnnouncementStatus;
    scheduled_at: string | null;
    expires_at: string | null;
    pin_to_top: boolean;
    attachment_url: string | null;
    attachment_name: string | null;
    resource_links: Record<string, string>[];
  }>,
  csrfToken?: string
) {
  await validateCsrfToken(csrfToken || null);

  const { error } = await supabaseAdmin
    .from("announcements")
    .update(data as any)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  return { success: true };
}

/**
 * Publish an announcement
 */
export async function publishAnnouncement(id: string, csrfToken?: string) {
  await validateCsrfToken(csrfToken || null);

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({ status: "published", is_active: true, published_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to publish announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  return { success: true };
}

/**
 * Unpublish an announcement
 */
export async function unpublishAnnouncement(id: string, csrfToken?: string) {
  await validateCsrfToken(csrfToken || null);

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({ status: "unpublished", is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to unpublish announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  return { success: true };
}

/**
 * Archive an announcement
 */
export async function archiveAnnouncement(id: string, csrfToken?: string) {
  await validateCsrfToken(csrfToken || null);

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({ status: "archived", is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  return { success: true };
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(id: string, csrfToken?: string) {
  await validateCsrfToken(csrfToken || null);

  const { error } = await supabaseAdmin.from("announcements").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
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
    priority: original.priority_level as any,
    target_audience: original.target_audience,
    [CSRF_CONSTANTS.HEADER_NAME]: csrfToken,
  });
}

/**
 * Toggle announcement active status
 */
export async function toggleAnnouncementActive(id: string, isActive: boolean, csrfToken?: string) {
  await validateCsrfToken(csrfToken || null);

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update announcement: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/team");
  revalidatePath("/judge");
  revalidatePath("/ops");
  return { success: true };
}
