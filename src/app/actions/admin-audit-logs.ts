"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface AuditLogItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  admin_id?: string | null;
  details?: Record<string, any> | null;
  created_at: string;
}

export async function getAuditLogsData(): Promise<AuditLogItem[]> {
  try {
    await requireAdmin();
  } catch (err) {
    console.warn("getAuditLogsData auth check fallback:", err);
    return [];
  }

  const fetchLogs = async () => {
    const { data } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, admin_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data || []) as AuditLogItem[];
  };

  const timeoutPromise = new Promise<AuditLogItem[]>((resolve) =>
    setTimeout(() => resolve([]), 2500)
  );

  return Promise.race([fetchLogs(), timeoutPromise]);
}
