/**
 * Relaython QR Registry Cache Endpoint
 *
 * Returns the Relaython team registry (team_code, team_name, leader_name, domain, qr_token)
 * from Google Sheets RELAYTHON_PORTAL_READY tab via the authenticated Apps Script backend.
 * Used by the cache-first QR scanner.
 *
 * Security:
 * - Requires authenticated session with operations role (admin, staff, organizer, spoc)
 * - Forwards API_SECRET (server-side only) to Google Apps Script for auth
 * - Never exposes API_SECRET or the Apps Script URL to the browser
 * - No Supabase dependency for QR matching
 * - Rate-limited implicitly by session auth
 */

import { NextResponse } from "next/server";
import { requireOperationsRole } from "@/lib/auth/operations";

const REQUEST_TIMEOUT_MS = 15000;

const RELAYTHON_REGISTRY_VERSION = "1";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, profile } = await requireOperationsRole();

    const appsScriptUrl =
      process.env.RELAYTHON_SHEETS_WEBAPP_URL ?? process.env.RELAYTHON_SHEETS_SYNC_URL;
    const apiSecret = process.env.RY_SCAN_SHARED_SECRET ?? process.env.API_SECRET;

    if (!appsScriptUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Registry not configured: RELAYTHON_SHEETS_WEBAPP_URL missing",
        },
        { status: 500 }
      );
    }

    if (!apiSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Registry not configured: RY_SCAN_SHARED_SECRET missing",
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
          action: "getRegistry",
          apiSecret: apiSecret,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        return NextResponse.json(
          { success: false, error: `Apps Script HTTP ${resp.status}` },
          { status: 502 }
        );
      }

      const result = await resp.json();

      const gsStatus = (result.status || "").toLowerCase();

      if (gsStatus === "found" || gsStatus === "ok" || gsStatus === "success") {
        const teams = (result.teams || []).map((entry: any) => ({
          team_code: entry.team_code,
          team_name: entry.team_name || "",
          leader_name: entry.leader_name || "",
          domain: entry.domain || "",
          qr_token: entry.qr_token,
        }));

        return NextResponse.json({
          success: true,
          version: RELAYTHON_REGISTRY_VERSION,
          count: result.count ?? teams.length,
          teams: teams,
          generated_at: new Date().toISOString(),
        });
      }

      return NextResponse.json(
        { success: false, error: result.message || "Failed to load relaython registry" },
        { status: 502 }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Apps Script request failed";
      return NextResponse.json(
        { success: false, error: msg },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Relaython registry endpoint error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg.includes("FORBIDDEN") || msg.includes("UNAUTHENTICATED") ? 403 : 500 }
    );
  }
}
