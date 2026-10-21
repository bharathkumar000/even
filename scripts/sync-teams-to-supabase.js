#!/usr/bin/env node
/*
 * sync-teams-to-supabase.js
 * -----------------------------------
 * Scans the registration Google Sheet and automatically creates Supabase user
 * accounts (team leaders) and corresponding team entries. Existing teams or
 * users are left untouched – the script is idempotent and can be re‑run.
 *
 * Expected environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – Service role key with admin privileges
 *   GOOGLE_SHEETS_SPREADSHEET_ID – (optional) the public Google Sheet ID.
 *   DEFAULT_PASSWORD – (optional) password for generated accounts (default "123").
 */

const { createClient } = require("@supabase/supabase-js");

const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "10dkiwfcwbv2Qo8CIPjkpOlXJfg2l3yi3uXPKtRrOXEA";

if (!SUPABASE_URL) {
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
}
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
}
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || "123";

// Initialise Supabase admin client (bypass RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Helper: fetch and parse CSV from the public Google Sheet
// ---------------------------------------------------------------------------
async function fetchTeamRegistrations() {
  // SHEET_ID is defined globally
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed to fetch Google Sheet CSV", res.status);
    throw new Error(`Unable to fetch sheet CSV (status ${res.status})`);
  }
  const csv = await res.text();
  return parseCsv(csv);
}

function parseCsv(csv) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0 || values.every((v) => v.trim() === "")) continue;
    const row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j].trim()] = values[j] !== undefined ? values[j].trim() : "";
    }
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
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

// ---------------------------------------------------------------------------
// Helper to generate a random password: 4 letters + 4 digits
function generatePassword() {
  const letters = Array.from({ length: 4 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  const digits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');
  return letters + digits;
}

// Helper to sanitize team name for username (lowercase, hyphens)
function sanitizeTeamName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function writeCredsToSheet(rowNumber, username, password) {
  if (!GOOGLE_SHEETS_API_KEY) {
    console.warn('GOOGLE_SHEETS_API_KEY not set – skipping credential write to sheet.');
    return;
  }
  const range = `AH${rowNumber}:AI${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW&key=${GOOGLE_SHEETS_API_KEY}`;
  const body = {
    range,
    majorDimension: "ROWS",
    values: [[username, password]],
  };
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`Failed to write credentials to sheet row ${rowNumber}: ${res.status}`);
    }
  } catch (e) {
    console.warn(`Error writing credentials to sheet row ${rowNumber}:`, e);
  }
}

// ---------------------------------------------------------------------------
(async () => {
  console.log("Fetching registrations from Google Sheet...");
  const rows = await fetchTeamRegistrations();
  console.log(`Found ${rows.length} registration rows`);

  for (const row of rows) {
    const sheetRowNumber = rows.indexOf(row) + 2; // CSV header is row 1
    const teamName = (row["Team Name"] || "").trim();
    const leaderName = (row["Team Leader"] || "").trim();
    const leaderEmail = (row["Email"] || "").trim();
    const track = (row["Selected Domain"] || "").trim();
    const teamCode = (row["Team ID"] || "").trim();

    // Skip empty rows
    if (!teamName) continue;

    // Generate username and password for the team login
    const sanitizedTeam = sanitizeTeamName(teamName);
    const username = `ivc-${sanitizedTeam}`;
    const password = generatePassword();

    // ---------- Ensure team exists ----------

    const { data: existingTeam, error: teamErr } = await supabase
      .from("teams")
      .select("id")
      .eq("name", teamName)
      .maybeSingle();
    if (teamErr) {
      console.error(`Error checking team "${teamName}":`, teamErr);
      continue;
    }
    let teamId = existingTeam?.id;
    if (!teamId) {
      const { data: newTeam, error: insertErr } = await supabase
        .from("teams")
        .insert([
          {
            name: teamName,
            code: teamCode || null,
            track: track || null,
            leader_name: leaderName || null,
            status: "active",
          },
        ])
        .select("id")
        .single();
      if (insertErr) {
        console.error(`Failed to create team "${teamName}":`, insertErr);
        continue;
      }
      teamId = newTeam.id;
      console.log(`Created team "${teamName}" (id ${teamId})`);
    }

    // ---------- Ensure leader user exists ----------
    if (!leaderEmail) {
      console.warn(`Team "${teamName}" has no leader email – skipping user creation`);
      continue;
    }
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", leaderEmail)
      .maybeSingle();
    let userId = existingProfile?.id;
    if (!userId) {
      // Create auth user via admin API
        const { data: authRes, error: authErr } = await supabase.auth.admin.createUser({
          email: `${username}@ivc.pulse`,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: teamName,
            role: "participant",
          },
        });
      if (authErr) {
        console.error(`Failed to create auth user for ${leaderEmail}:`, authErr);
        continue;
      }
      userId = authRes?.user?.id;
      if (!userId) {
        console.error(`Auth created but no user id for ${leaderEmail}`);
        continue;
      }
        // Upsert profile record
        const { error: profErr } = await supabase.from("profiles").upsert({
          id: userId,
          email: `${username}@ivc.pulse`,
          full_name: teamName,
          role: "participant",
        });
      if (profErr) {
        console.error(`Failed to upsert profile for ${leaderEmail}:`, profErr);
        continue;
      }
        console.log(`Created user account for ${username}@ivc.pulse`);
    }

    // ---------- Ensure team‑member linkage (leader role) ----------
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingMember) {
        const { error: memErr } = await supabase.from("team_members").upsert(
          {
            team_id: teamId,
            user_id: userId,
            role: "leader",
            name: teamName,
            email: `${username}@ivc.pulse`,
          },
          { onConflict: "team_id,user_id" }
        );
      if (memErr) {
        console.error(`Failed to link leader ${leaderEmail} to team "${teamName}":`, memErr);
        } else {
          console.log(`Linked leader ${leaderEmail} to team "${teamName}"`);
        }
        // Save generated credentials back to the Google Sheet (AH = username, AI = password)
        await writeCredsToSheet(sheetRowNumber, username, password);
      }
    }


  console.log("Sync completed.");
})().catch((err) => {
  console.error("Unexpected error during sync:", err);
  process.exit(1);
});
