// src/lib/googleSheet.ts
// Utility functions for fetching team registration data from a public Google Sheet.
// The sheet is assumed to be publicly accessible via the CSV export URL.

/** Spreadsheet ID of the registration sheet. */
const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "10dkiwfcwbv2Qo8CIPjkpOlXJfg2l3yi3uXPKtRrOXEA";

/** Cached CSV rows after first fetch to avoid repeated network calls within the same process. */
let cachedRows: Record<string, string>[] | null = null;

/** Parse a single CSV line handling quoted fields and escaped quotes. */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // escaped quote within a quoted field
        cur += '"';
        i++; // skip the next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += char;
    }
  }
  result.push(cur);
  return result;
}

/** Parse CSV text into an array of objects keyed by header names. */
function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    // Skip completely empty rows (e.g., placeholder rows)
    if (values.length === 0 || values.every((v) => v.trim() === "")) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j].trim()] = values[j] !== undefined ? values[j].trim() : "";
    }
    rows.push(row);
  }
  return rows;
}

/** Fetch the raw CSV data from the Google Sheet. */
async function fetchCsv(): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed to fetch Google Sheet CSV", res.status);
    throw new Error(`Unable to fetch sheet CSV (status ${res.status})`);
  }
  return await res.text();
}

/** Retrieve all team registration rows, cached after the first successful fetch. */
export async function fetchTeamRegistrations(): Promise<Record<string, string>[]> {
  if (cachedRows) return cachedRows;
  const csv = await fetchCsv();
  cachedRows = parseCsv(csv);
  return cachedRows;
}

/** Find a registration row by the participant's email (case‑insensitive). */
export async function getTeamRegistrationByEmail(email: string): Promise<Record<string, string> | null> {
  const rows = await fetchTeamRegistrations();
  const target = email.trim().toLowerCase();
  // The column header for email is expected to be "Email" (as in the exported CSV).
  const emailKey = Object.keys(rows[0] ?? {}).find((k) => k.toLowerCase() === "email") || "Email";
  return rows.find((r) => (r[emailKey] ?? "").trim().toLowerCase() === target) || null;
}

/** Find a registration row by the "Team ID" column (exact match). */
export async function getTeamRegistrationByTeamId(teamId: string): Promise<Record<string, string> | null> {
  const rows = await fetchTeamRegistrations();
  const target = teamId.trim();
  const teamIdKey = Object.keys(rows[0] ?? {}).find((k) => k.toLowerCase() === "team id") || "Team ID";
  return rows.find((r) => (r[teamIdKey] ?? "").trim() === target) || null;
}
