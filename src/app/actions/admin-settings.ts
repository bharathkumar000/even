"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const SettingsSchema = z.object({
  final_hours_open: z.boolean().optional(),
  team_qr_enabled: z.boolean().optional(),
});

type SettingsUpdateInput = z.infer<typeof SettingsSchema>;

export async function getEventSettings() {
  const { user } = await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("event_settings")
    .select("final_hours_open, team_qr_enabled")
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch event settings: ${error.message}`);
  }
  return data;
}

export async function updateEventSettings(data: SettingsUpdateInput) {
  const { user } = await requireAdmin();
  const validated = SettingsSchema.parse(data);

  // Check if a settings row already exists
  const { data: existing } = await supabaseAdmin
    .from("event_settings")
    .select("id")
    .maybeSingle();

  if (existing?.id) {
    const { data: updated, error } = await supabaseAdmin
      .from("event_settings")
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .single();
    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }
    // Audit log (non-blocking)
    void supabaseAdmin.from("audit_logs").insert([
      {
        action: "UPDATE_EVENT_SETTINGS",
        entity_type: "event_settings",
        entity_id: existing.id,
        admin_id: user.id,
        details: validated,
        created_at: new Date().toISOString(),
      },
    ]);
    return updated;
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("event_settings")
      .insert([validated])
      .select()
      .single();
    if (error) {
      throw new Error(`Failed to create settings: ${error.message}`);
    }
    // Audit log (non-blocking)
    void supabaseAdmin.from("audit_logs").insert([
      {
        action: "CREATE_EVENT_SETTINGS",
        entity_type: "event_settings",
        entity_id: inserted.id,
        admin_id: user.id,
        details: validated,
        created_at: new Date().toISOString(),
      },
    ]);
    return inserted;
  }
}
