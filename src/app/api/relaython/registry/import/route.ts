/**
 * Relaython CSV Registry Import Endpoint
 *
 * Allows authorized admins to import an updated CSV containing Relaython team
 * registrations. Validates structure, token uniqueness, and required fields.
 * Merges with existing registry: new teams added, existing teams updated,
 * never deletes.
 *
 * Security:
 * - Requires authenticated session with operations role
 * - Validates CSV structure before any writes
 * - Never exposes service-role key to browser
 */

import { NextResponse } from "next/server";
import { requireOperationsRole } from "@/lib/auth/operations";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_CSV_ROWS = 10000;

export const dynamic = "force-dynamic";

// Required CSV columns (case-insensitive)
const REQUIRED_CSV_COLUMNS = [
  "team_code",
  "team_name",
  "leader_name",
  "domain",
  "qr_token",
];

function parseCsv(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          fields.push(current);
          current = "";
        } else {
          current += char;
        }
      }
    }
    fields.push(current);
    return fields;
  });
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireOperationsRole();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No CSV file provided" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { success: false, error: "File must be a CSV" },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const rows = parseCsv(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "CSV is empty" },
        { status: 400 }
      );
    }

    if (rows.length - 1 > MAX_CSV_ROWS) {
      return NextResponse.json(
        { success: false, error: `CSV exceeds maximum of ${MAX_CSV_ROWS} data rows` },
        { status: 400 }
      );
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());

    // Check required columns
    for (const col of REQUIRED_CSV_COLUMNS) {
      if (!header.includes(col)) {
        return NextResponse.json(
          { success: false, error: `Missing required column: ${col}` },
          { status: 400 }
        );
      }
    }

    const colIndex = (name: string) => header.indexOf(name);
    const validTeams: any[] = [];
    const errors: string[] = [];
    const seenTokens = new Set<string>();
    const seenCodes = new Set<string>();

    // Validate each data row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const teamCode = row[colIndex("team_code")]?.trim();
      const teamName = row[colIndex("team_name")]?.trim();
      const leaderName = row[colIndex("leader_name")]?.trim();
      const domain = row[colIndex("domain")]?.trim();
      const qrToken = row[colIndex("qr_token")]?.trim();

      if (!teamCode || !teamName || !leaderName || !domain || !qrToken) {
        errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }

      if (!/^ryt_[a-f0-9]{32,}$/i.test(qrToken)) {
        errors.push(`Row ${i + 1}: Invalid QR token format`);
        continue;
      }

      if (seenTokens.has(qrToken)) {
        errors.push(`Row ${i + 1}: Duplicate QR token`);
        continue;
      }
      if (seenCodes.has(teamCode)) {
        errors.push(`Row ${i + 1}: Duplicate team code`);
        continue;
      }
      seenTokens.add(qrToken);
      seenCodes.add(teamCode);

      validTeams.push({
        team_code: teamCode,
        team_name: teamName,
        leader_name: leaderName,
        domain: domain,
        qr_token: qrToken,
        source_spreadsheet_id: file.name,
      });
    }

    if (errors.length > 0 && validTeams.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid teams found", errors },
        { status: 400 }
      );
    }

    // Upsert teams into relaython_qr_registry
    // Using on_conflict=team_code to update existing, insert new
    const { error: upsertErr } = await supabaseAdmin
      .from("relaython_qr_registry")
      .upsert(validTeams, {
        onConflict: "team_code",
        ignoreDuplicates: false,
      });

    if (upsertErr) {
      console.error("Registry upsert error:", upsertErr.message);
      return NextResponse.json(
        { success: false, error: "Failed to save registry to database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imported: validTeams.length,
      updated: 0, // tracked separately if needed
      skipped: errors.length,
      errors,
      total_teams: validTeams.length,
      message: `Imported ${validTeams.length} team(s) from CSV`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("CSV import error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg.includes("FORBIDDEN") || msg.includes("UNAUTHENTICATED") ? 403 : 500 }
    );
  }
}
