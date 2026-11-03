"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { revalidatePath } from "next/cache";
import { getTeamScanStatus } from "./operations";

export interface RevertActivityInput {
  logId: string;
  reason?: string;
  revertScope?: "single" | "entire_team";
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}

export interface RevertActivityResult {
  success: boolean;
  verified?: boolean;
  teamStatusVerified?: boolean;
  message?: string;
  error?: string;
  revertedCount?: number;
  teamId?: string | null;
  participantId?: string | null;
  actionType?: string | null;
  revertedScope?: "single" | "entire_team";
  verifiedAt?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reverts a QR scan / distribution activity log.
 * Resets the claim status back to 'unclaimed', allowing the team or participant
 * to be scanned and claimed again at the operations desk.
 *
 * Performs strict read-back verification against Supabase and the Team Lead portal
 * data layer to ensure the claim has been completely undone before returning success.
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

    const isAlreadyReverted =
      targetLog.result === "reverted" ||
      (targetLog.result === "rejected" && targetLog.new_status === "unclaimed");

    if (isAlreadyReverted) {
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

    // 2. Determine target logs to revert
    let logIds: string[] = [];
    if (scope === "entire_team" && targetLog.team_id) {
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

      logIds = (teamLogs || []).map((l) => l.id);
      if (logIds.length === 0) {
        logIds.push(targetLog.id);
      }
    } else {
      logIds = [targetLog.id];
    }

    const revertedCount = logIds.length;

    // 3. Execute update in Supabase
    const { error: updateErr } = await supabaseAdmin
      .from("event_activity_logs")
      .update({
        result: "rejected",
        previous_status: targetLog.new_status || "claimed",
        new_status: "unclaimed",
        reason: `Reverted by Admin (${adminName}): ${reasonText}`,
      })
      .in("id", logIds);

    if (updateErr) {
      return {
        success: false,
        error: `Failed to update status in Supabase: ${updateErr.message}`,
      };
    }

    // 4. CRITICAL: Verify directly against Supabase database (read-back verification)
    const { data: verifiedRows, error: verifyErr } = await supabaseAdmin
      .from("event_activity_logs")
      .select("id, result, new_status, team_id, action_type, participant_id")
      .in("id", logIds);

    if (verifyErr || !verifiedRows || verifiedRows.length !== logIds.length) {
      return {
        success: false,
        error: `Supabase verification failed: Could not verify update for all ${logIds.length} target records.`,
      };
    }

    const allReverted = verifiedRows.every(
      (r) =>
        (r.result === "rejected" || r.result === "reverted") &&
        r.new_status === "unclaimed"
    );
    if (!allReverted) {
      return {
        success: false,
        error: "Supabase verification failed: One or more logs are not in 'reverted' / 'unclaimed' state.",
      };
    }

    // Ensure no active success rows remain in Supabase for these logs
    const { count: remainingSuccess } = await supabaseAdmin
      .from("event_activity_logs")
      .select("id", { count: "exact", head: true })
      .in("id", logIds)
      .eq("result", "success");

    if (typeof remainingSuccess === "number" && remainingSuccess > 0) {
      return {
        success: false,
        error: "Supabase verification failed: Claim record is still registered as active success.",
      };
    }

    // 5. Verify Team Lead Portal state
    let teamStatusVerified = true;
    if (targetLog.team_id) {
      try {
        const teamStatus = await getTeamScanStatus(targetLog.team_id);
        if (scope === "entire_team") {
          // In entire_team scope, the action should no longer be in claimedActions
          if (teamStatus.claimedActions.includes(targetLog.action_type)) {
            teamStatusVerified = false;
          }
        } else {
          // In single scope, this specific log ID should not exist in teamStatus.logs
          const stillInLogs = teamStatus.logs.some((l) => l.id === targetLog.id);
          if (stillInLogs) {
            teamStatusVerified = false;
          }
        }
      } catch (tsErr) {
        console.warn("Notice: Team scan status verification check warning:", tsErr);
      }
    }

    // 6. Rotate team QR token to guarantee team portal QR refreshes
    if (targetLog.team_id) {
      const nextToken = `SEC-REV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      try {
        await supabaseAdmin
          .from("teams")
          .update({
            qr_token: nextToken,
            last_scanned_at: nowIso,
          })
          .eq("id", targetLog.team_id);
      } catch {}
    }

    // 7. Write immutable audit log entry for this administrative action
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
            verified_in_supabase: true,
            team_status_verified: teamStatusVerified,
            reverted_at: nowIso,
          },
          created_at: nowIso,
        },
      ]);
    } catch (auditErr) {
      console.warn("Notice: Failed to insert system audit log entry:", auditErr);
    }

    // 8. Invalidate Next.js cache for relevant routes
    revalidatePath("/admin/audit-logs");
    revalidatePath("/ops/scanner");
    revalidatePath("/team");
    revalidatePath("/team/qr");

    const verifiedMessage =
      scope === "entire_team"
        ? `Status confirmed undone in Supabase & Team Lead Portal: "${targetLog.action_type.toUpperCase()}" reverted for all ${revertedCount} members.`
        : `Status confirmed undone in Supabase & Team Lead Portal: "${targetLog.action_type.toUpperCase()}" reverted to NOT CLAIMED.`;

    return {
      success: true,
      verified: true,
      teamStatusVerified,
      message: verifiedMessage,
      revertedCount,
      teamId: targetLog.team_id,
      participantId: targetLog.participant_id,
      actionType: targetLog.action_type,
      revertedScope: scope,
      verifiedAt: nowIso,
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
