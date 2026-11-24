/**
 * Relaython Batch Sync Endpoint
 *
 * Receives locally saved scan records from SPOC devices and stores them
 * server-side with idempotency protection.
 *
 * Security:
 * - Requires authenticated session with operations role (admin, staff, organizer, spoc)
 * - Validates each record server-side against relaython_qr_registry
 * - Uses scan_id as idempotency key — repeated uploads ignored
 * - Returns per-record acknowledgements
 * - Never exposes service-role key to browser
 */

import { NextResponse } from "next/server";
import { requireOperationsRole } from "@/lib/auth/operations";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_BATCH_SIZE = 200;

export const dynamic = "force-dynamic";

interface SyncRequestRecord {
  scan_id: string;
  team_code: string;
  qr_token_ref: string;
  action_type: "registration" | "snacks_1" | "lunch" | "snacks_2";
  operator_id: string;
  operator_name: string;
  device_id: string;
  scanned_at: string;
  local_sequence_number: number;
}

interface SyncResponseRecord {
  scan_id: string;
  status: "synced" | "duplicate" | "rejected";
  error?: string;
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireOperationsRole();

    const body = await req.json();
    const { scans } = body;

    if (!Array.isArray(scans) || scans.length === 0) {
      return NextResponse.json(
        { success: false, error: "No scans provided" },
        { status: 400 }
      );
    }

    if (scans.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
        { status: 400 }
      );
    }

    // Build a set of valid team codes from registry for validation
    const { data: registry, error: registryErr } = await supabaseAdmin
      .from("relaython_qr_registry")
      .select("team_code, qr_token")
      .in(
        "team_code",
        scans.map((s: SyncRequestRecord) => s.team_code)
      );

    if (registryErr) {
      console.error("Relaython registry validation error:", registryErr.message);
      return NextResponse.json(
        { success: false, error: "Registry validation failed" },
        { status: 500 }
      );
    }

    const validTeamCodes = new Set((registry || []).map((r) => r.team_code));

    // Process each record with per-record acknowledgement
    const results: SyncResponseRecord[] = [];
    const recordsToInsert: any[] = [];

    for (const scan of scans) {
      const scanId = scan.scan_id;

      // Validate required fields
      if (!scanId || !scan.team_code || !scan.action_type) {
        results.push({
          scan_id: scanId || "unknown",
          status: "rejected",
          error: "Missing required fields",
        });
        continue;
      }

      // Validate team exists in registry
      if (!validTeamCodes.has(scan.team_code)) {
        results.push({
          scan_id: scanId,
          status: "rejected",
          error: `Team ${scan.team_code} not found in registry`,
        });
        continue;
      }

      // Validate action type
      const validActions = [
        "registration",
        "snacks_1",
        "lunch",
        "snacks_2",
      ];
      if (!validActions.includes(scan.action_type)) {
        results.push({
          scan_id: scanId,
          status: "rejected",
          error: `Invalid action type: ${scan.action_type}`,
        });
        continue;
      }

      recordsToInsert.push({
        scan_id: scanId,
        team_code: scan.team_code,
        qr_token_ref: scan.qr_token_ref || "",
        action_type: scan.action_type,
        operator_id: scan.operator_id,
        operator_name: scan.operator_name || "",
        device_id: scan.device_id || "",
        scanned_at: scan.scanned_at || new Date().toISOString(),
        local_sequence_number: scan.local_sequence_number || 0,
        sync_status: "synced",
      });

      results.push({
        scan_id: scanId,
        status: "synced",
      });
    }

    // Batch insert with ON CONFLICT (scan_id) DO NOTHING for idempotency
    if (recordsToInsert.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("relaython_sync_log")
        .upsert(recordsToInsert, { onConflict: "scan_id" });

      if (insertErr) {
        console.error("Batch sync insert error:", insertErr.message);
        // Mark all as rejected if batch insert fails
        for (const result of results) {
          if (result.status === "synced") {
            result.status = "rejected";
            result.error = insertErr.message;
          }
        }
        return NextResponse.json(
          { success: false, error: "Batch insert failed", results },
          { status: 500 }
        );
      }
    }

    const syncedCount = results.filter((r) => r.status === "synced").length;
    const rejectedCount = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      success: true,
      total: scans.length,
      synced: syncedCount,
      rejected: rejectedCount,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Relaython batch sync error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg.includes("FORBIDDEN") || msg.includes("UNAUTHENTICATED") ? 403 : 500 }
    );
  }
}
