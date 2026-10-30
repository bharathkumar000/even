"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireOperationsRole } from "@/lib/auth/operations";

export type AuditResult = "success" | "failure" | "rejected" | "already_completed";
export type AuditMethod = "qr" | "manual";
export type AuditAction =
  | "registration"
  | "goodies"
  | "lunch"
  | "snacks"
  | "certificates"
  | "scan_attempt"
  | "verification_success"
  | "verification_failed"
  | "correction"
  | "reversal";

export interface AuditRecordInput {
  /** Event identifier (optional; multi-event support) */
  eventId?: string | null;
  teamId: string;
  participantId?: string | null;
  teamName?: string | null;
  action: AuditAction;
  method: AuditMethod;
  result: AuditResult;
  itemName?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  reason?: string | null;
  /** Idempotency key. Duplicate retries with the same key are ignored. */
  correlationId: string;
  /** Reference to the related check-in / distribution record, where applicable. */
  referenceId?: string | null;
}

export interface AuditRecordOutcome {
  recorded: boolean;
  id: string | null;
  duplicate: boolean;
}

/**
 * Records a scanner/distribution audit event server-side.
 *
 * The operator identity is ALWAYS derived from the verified Supabase session
 * (never from caller-supplied input). An immutable snapshot of operator id,
 * name and role is stored so history survives profile deletion.
 *
 * Idempotency: if a row with the same correlation_id already exists, the call
 * is a no-op and returns { duplicate: true }.
 */
export async function recordScannerActivity(
  input: AuditRecordInput,
): Promise<AuditRecordOutcome> {
  const { user, profile } = await requireOperationsRole();

  const operatorId = user.id;
  const operatorName =
    profile?.role === "admin" || profile?.role === "staff" || profile?.role === "organizer"
      ? (typeof profile === "object" && profile !== null && "full_name" in profile
          ? (profile as { full_name?: string | null }).full_name ?? user.email ?? "Operations"
          : user.email ?? "Operations")
      : user.email ?? "Operations";

  const operatorRole = (profile?.role as string) || "staff";

  const correlationId = input.correlationId || crypto.randomUUID();

  // Idempotency check: ignore exact retries of the same request id.
  const { data: existing } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id")
    .eq("correlation_id", correlationId)
    .maybeSingle();

  if (existing?.id) {
    return { recorded: true, id: existing.id, duplicate: true };
  }

  const now = new Date().toISOString();

  const { data: record, error } = await supabaseAdmin
    .from("event_activity_logs")
    .insert([
      {
        team_id: input.teamId || null,
        participant_id: input.participantId || null,
        event_id: input.eventId || null,
        method: input.method,
        action_type: input.action,
        result: input.result,
        reason: input.reason || null,
        previous_status: input.previousStatus || null,
        new_status: input.newStatus || null,
        item_name: input.itemName || null,
        correlation_id: correlationId,
        reference_id: input.referenceId || null,
        operator_id: operatorId,
        operator_name: operatorName,
        operator_role: operatorRole,
        created_at: now,
      },
    ])
    .select("id")
    .maybeSingle();

  if (error) {
    // Do NOT swallow audit failures. Surface them so the caller can decide.
    throw new Error(`Failed to record scanner audit activity: ${error.message}`);
  }

  return {
    recorded: true,
    id: record?.id ?? null,
    duplicate: false,
  };
}
