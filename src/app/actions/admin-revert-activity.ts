"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { revalidatePath } from "next/cache";

export interface RevertActivityInput {
  logId: string;
  reason?: string;
  revertScope?: "single" | "entire_team";
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}

export interface RevertActivityResult {
  success: boolean;
  message?: string;
  error?: string;
  revertedCount?: number;
  teamId?: string | null;
  actionType?: string | null;
  revertedScope?: "single" | "entire_team";
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reverts a QR scan / distribution activity log.
 * Resets the claim status back to 'unclaimed', allowing the team or participant
 * to be scanned and claimed again at the operations desk.
 */
export async function revertScanActivity(
  input: RevertActivityInput
): Promise<RevertActivityResult> {
  try {
    const { user, profile } = await requireAdmin();
    await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

    const logId = input.logId?.trim();
    if (!logId || !UUID_REGEX.test(logId)) {
      return { success: false, error: "A valid log identifier (UUID) is required." };
    }

    // 1. Fetch target activity log
    const { data: targetLog, error: fetchErr } = await supabaseAdmin
      .from("event_activity_logs")
      .select("*")
      .eq("id", logId)
      .maybeSingle();

    if (fetchErr || !targetLog) {
      return {
        success: false,
        error: `Activity log not found: ${fetchErr?.message || "Invalid ID"}`,
      };
    }

    if (targetLog.result === "reverted") {
      return {
        success: false,
        error: "This scan activity has already been reverted.",
      };
    }

    const adminName =
      (typeof profile === "object" && profile && "full_name" in profile
        ? (profile as { full_name?: string | null }).full_name
        : null) ||
      user.email ||
      "Administrator";

    const reasonText =
      input.reason?.trim() || "Claim reverted by Administrator to Not Claimed";
    const nowIso = new Date().toISOString();
    const scope = input.revertScope || "single";

    let revertedCount = 1;

    // 2. Execute reversion depending on scope
    if (scope === "entire_team" && targetLog.team_id) {
      // Find all successful claims for this team and action_type
      const { data: teamLogs, error: teamQueryErr } = await supabaseAdmin
        .from("event_activity_logs")
        .select("id")
        .eq("team_id", targetLog.team_id)
        .eq("action_type", targetLog.action_type)
        .eq("result", "success");

      if (teamQueryErr) {
        return {
          success: false,
          error: `Failed to find team claims: ${teamQueryErr.message}`,
        };
      }

      const logIds = (teamLogs || []).map((l) => l.id);
      if (logIds.length === 0) {
        logIds.push(targetLog.id);
      }

      revertedCount = logIds.length;

      const { error: updateErr } = await supabaseAdmin
        .from("event_activity_logs")
        .update({
          result: "reverted",
          previous_status: "claimed",
          new_status: "unclaimed",
          reason: `Reverted by Admin (${adminName}): ${reasonText}`,
        })
        .in("id", logIds);

      if (updateErr) {
        return {
          success: false,
          error: `Failed to revert team claims: ${updateErr.message}`,
        };
      }
    } else {
      // Single log reversion
      const { error: updateErr } = await supabaseAdmin
        .from("event_activity_logs")
        .update({
          result: "reverted",
          previous_status: targetLog.new_status || "claimed",
          new_status: "unclaimed",
          reason: `Reverted by Admin (${adminName}): ${reasonText}`,
        })
        .eq("id", targetLog.id);

      if (updateErr) {
        return {
          success: false,
          error: `Failed to revert activity: ${updateErr.message}`,
        };
      }
    }

    // 3. Write immutable audit log entry for this administrative action
    try {
      await supabaseAdmin.from("audit_logs").insert([
        {
          action: "REVERT_SCAN_ACTIVITY",
          entity_type: "event_activity_log",
          entity_id: targetLog.id,
          admin_id: user.id,
          details: {
            target_log_id: targetLog.id,
            team_id: targetLog.team_id,
            participant_id: targetLog.participant_id,
            action_type: targetLog.action_type,
            scope,
            reverted_count: revertedCount,
            reason: reasonText,
            admin_name: adminName,
            reverted_at: nowIso,
          },
          created_at: nowIso,
        },
      ]);
    } catch (auditErr) {
      console.warn("Notice: Failed to insert system audit log entry:", auditErr);
    }

    // 4. Invalidate relevant Next.js routes
    revalidatePath("/admin/audit-logs");
    revalidatePath("/ops/scanner");
    revalidatePath("/team");

    return {
      success: true,
      message:
        scope === "entire_team"
          ? `Successfully reverted "${targetLog.action_type.toUpperCase()}" for all ${revertedCount} members. Status reset to NOT CLAIMED.`
          : `Successfully reverted "${targetLog.action_type.toUpperCase()}" claim. Status reset to NOT CLAIMED.`,
      revertedCount,
      teamId: targetLog.team_id,
      actionType: targetLog.action_type,
      revertedScope: scope,
    };
  } catch (err: unknown) {
    console.error("revertScanActivity error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while reverting activity.",
    };
  }
}
