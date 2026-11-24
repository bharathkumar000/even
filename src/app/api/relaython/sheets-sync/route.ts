/**
 * Relaython Sheets Sync Endpoint (Eventra Backend)
 *
 * Receives locally saved Relaython scan records from SPOC devices and forwards
 * each one to the Google Apps Script bound to the existing approval spreadsheet
 * (1jaSyXl4iyhb5XGbXTRmTTszntVdoMD9sitaVT9bSLQE).
 *
 * Phase 1 scope: Morning Registration → Column L only. Lunch and Snacks are
 * intentionally deferred — those actions return "deferred" and are not written
 * to the sheet.
 *
 * Security:
 * - Requires authenticated session with operations role (admin, staff, organizer, spoc)
 * - Forwards API_SECRET (server-side only) to Google Apps Script for auth
 * - Never exposes API_SECRET or the Apps Script URL to the browser
 * - Rate-limited implicitly by session auth
 *
 * Idempotency:
 * - scan_id is the idempotency key; Google Apps Script skips already-approved cells
 * - Per-scan acknowledgements returned so the client can mark records synced/pending
 *
 * Observability:
 * - Logs the failing request stage, HTTP status, response content type, and a
 *   sanitized error response server-side. Never logs secrets, full QR tokens,
 *   or sensitive authentication headers.
 * - Distinguishes Google-generated HTML 401 responses from application-level
 *   JSON authorization errors.
 */

import { NextResponse } from "next/server";
import { requireOperationsRole } from "@/lib/auth/operations";

const MAX_BATCH_SIZE = 200;
const REQUEST_TIMEOUT_MS = 15000;

interface SyncRequestRecord {
  scan_id: string;
  team_code: string;
  qr_token_ref?: string;
  action_type: "registration" | "snacks_1" | "lunch" | "snacks_2";
  operator_id?: string;
  operator_name?: string;
  device_id?: string;
  scanned_at?: string;
  local_sequence_number?: number;
}

interface SyncResponseRecord {
  scan_id: string;
  status: "synced" | "already_approved" | "deferred" | "not_found" | "rejected" | "error";
  message?: string;
  error?: string;
}

interface SheetsSyncLog {
  stage: "validation" | "fetch" | "response" | "parse" | "unknown";
  status?: number;
  contentType?: string;
  error: string;
  sanitizedBody?: Record<string, unknown>;
}

function logSheetsSyncError(log: SheetsSyncLog): void {
  const safeLog: Record<string, unknown> = {
    stage: log.stage,
    error: log.error,
  };
  if (log.status !== undefined) safeLog.http_status = log.status;
  if (log.contentType !== undefined) safeLog.content_type = log.contentType;
  if (log.sanitizedBody) {
    // Sanitize: strip secrets and full QR tokens from any logged body
    const { apiSecret, ...rest } = log.sanitizedBody as Record<string, unknown>;
    safeLog.request_body = rest;
  }
  console.error("[Relaython Sheets Sync]", JSON.stringify(safeLog));
}

export const dynamic = "force-dynamic";

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

    const appsScriptUrl =
      process.env.RELAYTHON_SHEETS_WEBAPP_URL ?? process.env.RELAYTHON_SHEETS_SYNC_URL;
    const apiSecret = process.env.RY_SCAN_SHARED_SECRET ?? process.env.API_SECRET;

    if (!appsScriptUrl) {
      logSheetsSyncError({
        stage: "validation",
        error: "Sheets sync not configured: RELAYTHON_SHEETS_WEBAPP_URL missing",
      });
      return NextResponse.json(
        { success: false, error: "Sheets sync not configured: RELAYTHON_SHEETS_WEBAPP_URL missing" },
        { status: 500 }
      );
    }

    if (!apiSecret) {
      logSheetsSyncError({
        stage: "validation",
        error: "Sheets sync not configured: RY_SCAN_SHARED_SECRET missing",
      });
      return NextResponse.json(
        { success: false, error: "Sheets sync not configured: RY_SCAN_SHARED_SECRET missing" },
        { status: 500 }
      );
    }

    // Process each record with per-record acknowledgement.
    // Forward to Google Apps Script; each request is independent so one
    // failure does not block others. The Apps Script uses LockService internally.
    const results: SyncResponseRecord[] = [];

    for (const scan of scans as SyncRequestRecord[]) {
      const scanId = scan.scan_id;

      if (!scanId || !scan.team_code || !scan.action_type) {
        results.push({
          scan_id: scanId || "unknown",
          status: "rejected",
          error: "Missing required fields",
        });
        continue;
      }

      // Phase 1: only Registration → Column L is implemented.
      // Other action types are deferred without touching the sheet.
      if (scan.action_type !== "registration") {
        results.push({
          scan_id: scanId,
          status: "deferred",
          message: scan.action_type + " not yet implemented (Registration only).",
        });
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const resp = await fetch(appsScriptUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "approveRegistration",
            apiSecret: apiSecret,
            scan_id: scanId,
            team_code: scan.team_code,
            team_id: scan.team_code,
            action_type: scan.action_type,
            operator_name: scan.operator_name || "",
            operator: scan.operator_name || scan.operator_id || "",
            device_id: scan.device_id || "",
            scanned_at: scan.scanned_at || new Date().toISOString(),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = resp.headers.get("content-type") ?? "unknown";

        if (!resp.ok) {
          // Distinguish Google-generated HTML 401 (auth redirect / login page)
          // from application-level JSON authorization errors.
          let errorDetail: string | null = null;
          let isHtml401 = false;
          if (resp.status === 401 || resp.status === 403) {
            if (contentType.includes("text/html")) {
              isHtml401 = true;
              errorDetail = `Google-generated HTML ${resp.status} (likely auth redirect or login page)`;
            } else {
              errorDetail = `Application-level authorization error (HTTP ${resp.status})`;
            }
          }

          logSheetsSyncError({
            stage: "response",
            status: resp.status,
            contentType,
            error: isHtml401
              ? "Google Apps Script returned HTML 401/403 — check deployment permissions and Auth"
              : `Apps Script HTTP ${resp.status}`,
            sanitizedBody: {
              action: "approveRegistration",
              scan_id: scanId,
              team_code: scan.team_code,
              apiSecret: "[REDACTED]",
            },
          });

          results.push({
            scan_id: scanId,
            status: "error",
            error: `Apps Script HTTP ${resp.status}`,
          });
          continue;
        }

        let resultText: string;
        try {
          resultText = await resp.text();
        } catch (readErr) {
          logSheetsSyncError({
            stage: "response",
            status: resp.status,
            contentType,
            error: "Failed to read response body",
            sanitizedBody: {
              action: "approveRegistration",
              scan_id: scanId,
              team_code: scan.team_code,
              apiSecret: "[REDACTED]",
            },
          });
          results.push({
            scan_id: scanId,
            status: "error",
            error: "Failed to read Apps Script response",
          });
          continue;
        }

        // If content type is HTML but status is 2xx, this is unexpected — could be a redirect page
        if (contentType.includes("text/html") && !contentType.includes("application/json")) {
          logSheetsSyncError({
            stage: "response",
            status: resp.status,
            contentType,
            error: "Apps Script returned HTML instead of JSON — possible redirect or error page",
            sanitizedBody: {
              action: "approveRegistration",
              scan_id: scanId,
              team_code: scan.team_code,
              apiSecret: "[REDACTED]",
              response_preview: resultText.slice(0, 200),
            },
          });
          results.push({
            scan_id: scanId,
            status: "error",
            error: "Apps Script returned non-JSON response",
          });
          continue;
        }

        let result: {
          status?: string;
          message?: string;
          teamId?: string;
          row?: number;
          log?: { status?: string };
        };
        try {
          result = JSON.parse(resultText);
        } catch (parseErr) {
          logSheetsSyncError({
            stage: "parse",
            status: resp.status,
            contentType,
            error: "Failed to parse Apps Script JSON response",
            sanitizedBody: {
              action: "approveRegistration",
              scan_id: scanId,
              team_code: scan.team_code,
              apiSecret: "[REDACTED]",
              response_preview: resultText.slice(0, 200),
            },
          });
          results.push({
            scan_id: scanId,
            status: "error",
            error: "Failed to parse Apps Script response",
          });
          continue;
        }

        const gsStatus = (result.status || "").toLowerCase();

        let mapped: SyncResponseRecord["status"];
        switch (gsStatus) {
          case "approved":
          case "already_approved":
            mapped = gsStatus === "already_approved" ? "already_approved" : "synced";
            break;
          case "not_found":
            mapped = "not_found";
            break;
          case "deferred":
            mapped = "deferred";
            break;
          case "error":
          default:
            mapped = "error";
            break;
        }

        results.push({
          scan_id: scanId,
          status: mapped,
          message: result.message,
          error: mapped === "error" ? result.message : undefined,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Apps Script request failed";
        logSheetsSyncError({
          stage: "fetch",
          error: msg,
          sanitizedBody: {
            action: "approveRegistration",
            scan_id: scanId,
            team_code: scan.team_code,
            apiSecret: "[REDACTED]",
          },
        });
        results.push({
          scan_id: scanId,
          status: "error",
          error: msg,
        });
      }
    }

    const syncedCount = results.filter((r) => r.status === "synced").length;
    const alreadyCount = results.filter((r) => r.status === "already_approved").length;
    const deferredCount = results.filter((r) => r.status === "deferred").length;
    const rejectedCount = results.filter((r) => r.status === "rejected").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      total: scans.length,
      synced: syncedCount,
      already_approved: alreadyCount,
      deferred: deferredCount,
      rejected: rejectedCount,
      error: errorCount,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Relaython sheets sync error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg.includes("FORBIDDEN") || msg.includes("UNAUTHENTICATED") ? 403 : 500 }
    );
  }
}
