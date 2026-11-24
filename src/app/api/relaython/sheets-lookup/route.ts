/**
 * Relaython Sheets Lookup Endpoint (Eventra Backend)
 *
 * Phase 2: Google Sheets fallback lookup for Relaython QR tokens.
 *
 * When the local CSV/IndexedDB registry cache is unavailable, corrupted,
 * outdated, or does not contain the scanned token, this endpoint calls the
 * Google Apps Script deployment securely to search column F (RELAYTHON_PORTAL_READY)
 * for an exact QR token match.
 *
 * Security:
 * - Requires authenticated session with operations role (admin, staff, organizer, spoc)
 * - Forwards API_SECRET (server-side only) to Google Apps Script for auth
 * - Never exposes API_SECRET or the Apps Script URL to the browser
 * - Never fetches all QR tokens for a single fallback query (exact match only)
 *
 * Observability:
 * - Logs the failing request stage, HTTP status, response content type, and a
 *   sanitized error response server-side. Never logs secrets or sensitive headers.
 * - Distinguishes Google-generated HTML 401 responses from application-level
 *   JSON authorization errors.
 *
 * Idempotency:
 * - Lookup is read-only; no state changes on the sheet
 * - Repeated lookups for the same token are safe
 */

import { NextResponse } from "next/server";
import { requireOperationsRole } from "@/lib/auth/operations";

const REQUEST_TIMEOUT_MS = 15000;

interface LookupRequest {
  qr_token: string;
}

interface LookupResponse {
  found: boolean;
  team_code?: string;
  team_name?: string;
  leader_name?: string;
  domain?: string;
  qr_token?: string;
  message?: string;
  error?: string;
}

interface SheetsLookupLog {
  stage: "validation" | "fetch" | "response" | "parse" | "unknown";
  status?: number;
  contentType?: string;
  error: string;
  sanitizedBody?: Record<string, unknown>;
}

function logSheetsLookupError(log: SheetsLookupLog): void {
  const safeLog: Record<string, unknown> = {
    stage: log.stage,
    error: log.error,
  };
  if (log.status !== undefined) safeLog.http_status = log.status;
  if (log.contentType !== undefined) safeLog.content_type = log.contentType;
  if (log.sanitizedBody) {
    const { apiSecret, ...rest } = log.sanitizedBody as Record<string, unknown>;
    safeLog.request_body = rest;
  }
  console.error("[Relaython Sheets Lookup]", JSON.stringify(safeLog));
}

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireOperationsRole();

    const body = (await req.json()) as LookupRequest;
    const { qr_token } = body;

    if (!qr_token || typeof qr_token !== "string") {
      logSheetsLookupError({
        stage: "validation",
        error: "qr_token is required",
      });
      return NextResponse.json(
        { success: false, error: "qr_token is required" },
        { status: 400 }
      );
    }

    // Validate Relaython token format: ryt_ + 32+ hex chars
    if (!/^ryt_[a-f0-9]{32,}$/i.test(qr_token)) {
      logSheetsLookupError({
        stage: "validation",
        error: "Invalid QR token format",
      });
      return NextResponse.json(
        { success: false, error: "Invalid QR token format" },
        { status: 400 }
      );
    }

    const appsScriptUrl =
      process.env.RELAYTHON_SHEETS_WEBAPP_URL ?? process.env.RELAYTHON_SHEETS_SYNC_URL;
    const apiSecret = process.env.RY_SCAN_SHARED_SECRET ?? process.env.API_SECRET;

    if (!appsScriptUrl) {
      logSheetsLookupError({
        stage: "validation",
        error: "Sheets lookup not configured: RELAYTHON_SHEETS_WEBAPP_URL missing",
      });
      return NextResponse.json(
        {
          success: false,
          error: "Sheets lookup not configured: RELAYTHON_SHEETS_WEBAPP_URL missing",
        },
        { status: 500 }
      );
    }

    if (!apiSecret) {
      logSheetsLookupError({
        stage: "validation",
        error: "Sheets lookup not configured: RY_SCAN_SHARED_SECRET missing",
      });
      return NextResponse.json(
        {
          success: false,
          error: "Sheets lookup not configured: RY_SCAN_SHARED_SECRET missing",
        },
        { status: 500 }
      );
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
          action: "lookupToken",
          apiSecret: apiSecret,
          token: qr_token,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = resp.headers.get("content-type") ?? "unknown";

      if (!resp.ok) {
        // Distinguish Google-generated HTML 401 from application-level JSON errors
        let isHtml401 = false;
        let errorDetail: string | null = null;
        if (resp.status === 401 || resp.status === 403) {
          if (contentType.includes("text/html")) {
            isHtml401 = true;
            errorDetail = `Google-generated HTML ${resp.status} (likely auth redirect or login page)`;
          } else {
            errorDetail = `Application-level authorization error (HTTP ${resp.status})`;
          }
        }

        logSheetsLookupError({
          stage: "response",
          status: resp.status,
          contentType,
          error: isHtml401
            ? "Google Apps Script returned HTML 401/403 — check deployment permissions and Auth"
            : `Apps Script HTTP ${resp.status}`,
          sanitizedBody: {
            action: "lookupToken",
            token: qr_token.slice(-8) + "...",
            apiSecret: "[REDACTED]",
          },
        });

        return NextResponse.json(
          {
            success: false,
            error: `Apps Script HTTP ${resp.status}`,
          },
          { status: 502 }
        );
      }

      let resultText: string;
      try {
        resultText = await resp.text();
      } catch (readErr) {
        logSheetsLookupError({
          stage: "response",
          status: resp.status,
          contentType,
          error: "Failed to read response body",
          sanitizedBody: {
            action: "lookupToken",
            token: qr_token.slice(-8) + "...",
            apiSecret: "[REDACTED]",
          },
        });
        return NextResponse.json(
          {
            success: false,
            error: "Failed to read Apps Script response",
          },
          { status: 502 }
        );
      }

      // If content type is HTML but status is 2xx, this is unexpected — could be a redirect page
      if (contentType.includes("text/html") && !contentType.includes("application/json")) {
        logSheetsLookupError({
          stage: "response",
          status: resp.status,
          contentType,
          error: "Apps Script returned HTML instead of JSON — possible redirect or error page",
          sanitizedBody: {
            action: "lookupToken",
            token: qr_token.slice(-8) + "...",
            apiSecret: "[REDACTED]",
            response_preview: resultText.slice(0, 200),
          },
        });
        return NextResponse.json(
          {
            success: false,
            error: "Apps Script returned non-JSON response",
          },
          { status: 502 }
        );
      }

      let result: {
        status?: string;
        message?: string;
        team_code?: string;
        team_name?: string;
        leader_name?: string;
        domain?: string;
        qr_token?: string;
        row?: number;
      };
      try {
        result = JSON.parse(resultText);
      } catch (parseErr) {
        logSheetsLookupError({
          stage: "parse",
          status: resp.status,
          contentType,
          error: "Failed to parse Apps Script JSON response",
          sanitizedBody: {
            action: "lookupToken",
            token: qr_token.slice(-8) + "...",
            apiSecret: "[REDACTED]",
            response_preview: resultText.slice(0, 200),
          },
        });
        return NextResponse.json(
          {
            success: false,
            error: "Failed to parse Apps Script response",
          },
          { status: 502 }
        );
      }

      const gsStatus = (result.status || "").toLowerCase();

      const response: LookupResponse = {
        found: false,
        message: result.message,
      };

      switch (gsStatus) {
        case "found":
        case "ok":
        case "success":
          response.found = true;
          response.team_code = result.team_code;
          response.team_name = result.team_name;
          response.leader_name = result.leader_name;
          response.domain = result.domain;
          response.qr_token = result.qr_token;
          break;
        case "not_found":
          response.found = false;
          response.message = result.message || "QR token not found in Google Sheets.";
          break;
        case "error":
          return NextResponse.json(
            {
              success: false,
              error: result.message || "Google Sheets lookup failed.",
            },
            { status: 502 }
          );
        case "unauthorized":
          return NextResponse.json(
            {
              success: false,
              error: "Apps Script unauthorized: invalid shared secret.",
            },
            { status: 401 }
          );
        case "deferred":
          return NextResponse.json(
            {
              success: false,
              error: "Apps Script deferred lookup.",
            },
            { status: 502 }
          );
        default:
          return NextResponse.json(
            {
              success: false,
              error: result.message || "Google Sheets lookup failed.",
            },
            { status: 502 }
          );
      }

      return NextResponse.json({ success: true, ...response });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Apps Script request failed";
      logSheetsLookupError({
        stage: "fetch",
        error: msg,
        sanitizedBody: {
          action: "lookupToken",
          token: qr_token.slice(-8) + "...",
          apiSecret: "[REDACTED]",
        },
      });
      return NextResponse.json(
        {
          success: false,
          error: msg,
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Relaython sheets lookup error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg.includes("FORBIDDEN") || msg.includes("UNAUTHENTICATED") ? 403 : 500 }
    );
  }
}
