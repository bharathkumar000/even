"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { requireOperationsRole } from "@/lib/auth/operations";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  priority: "normal" | "important" | "urgent";
  target_audience: "all" | "teams" | "judges" | "ops";
  created_at: string;
  is_active: boolean;
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
  priority?: "normal" | "important" | "urgent";
  target_audience?: "all" | "teams" | "judges" | "ops";
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
 * Delete or toggle an announcement
 */
export async function toggleAnnouncementActive(id: string, isActive: boolean, csrfToken?: string) {
  const { user } = await requireOperationsRole();
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
