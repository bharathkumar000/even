#!/usr/bin/env node
/*
 * add-demo-qr.mjs
 * -------------------------------------------------------------------
 * Adds a demo QR record for the demo lead team (code: IVC-VV-100) to both
 * Supabase (team_checkin_qrs) and the PORTAL_ACCOUNTS Google Sheet.
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – Service role key (admin)
 *   GOOGLE_SHEETS_SPREADSHEET_ID – Spreadsheet ID containing the
 *     PORTAL_ACCOUNTS sheet (optional – defaults to same ID used by other scripts)
 *   GOOGLE_SHEETS_API_KEY – API key for Google Sheets API access
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
if (!SERVICE_KEY) throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Demo team constants
const DEMO_TEAM_CODE = "IVC-VV-100";
const DEMO_TEAM_NAME = "Demo Lead Team";
const DEMO_TEAM_TRACK = "Demo Track";
const DEMO_QR_TOKEN = "vvt_16ace9a60a7ba86a3f5807324c8a9728c67a202ae49624cb";
const DEMO_QR_URL = "https://vice-verse-ivc.vercel.app/checkin?token=vvt_16ace9a60a7ba86a3f5807324c8a9728c67a202ae49624cb&teamId=IVC-VV-100";

/** Upsert the demo team into the `teams` table */
async function upsertTeam() {
  const { data: existingTeam, error: checkErr } = await supabase
    .from("teams")
    .select("id")
    .eq("code", DEMO_TEAM_CODE)
    .maybeSingle();

  if (checkErr && checkErr.code !== "PGRST116") {
    console.warn("Team lookup error:", checkErr);
  }

  if (existingTeam?.id) {
    console.log(`Demo team already exists (id ${existingTeam.id})`);
    return existingTeam.id;
  }

  const { data: newTeam, error: insertErr } = await supabase
    .from("teams")
    .insert({ name: DEMO_TEAM_NAME, code: DEMO_TEAM_CODE, track: DEMO_TEAM_TRACK })
    .select("id")
    .single();
  if (insertErr) throw insertErr;
  console.log(`Created demo team with id ${newTeam.id}`);
  return newTeam.id;
}

/** Upsert the QR record into `team_checkin_qrs` */
async function upsertQrRecord() {
  const { data, error } = await supabase
    .from("team_checkin_qrs")
    .upsert({ team_code: DEMO_TEAM_CODE, qr_token: DEMO_QR_TOKEN, qr_url: DEMO_QR_URL })
    .select()
    .single();
  if (error) throw error;
  console.log("Upserted QR record:", data);
}

/** Update the PORTAL_ACCOUNTS Google Sheet (columns K – QR Token, L – QR URL) */
async function updatePortalAccountsSheet() {
  const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.SPREADSHEET_ID;
  const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (!SHEET_ID || !API_KEY) {
    console.warn("Missing Google Sheets credentials – skipping sheet update");
    return;
  }

  // Fetch column A to locate the row that matches the demo team code
  const fetchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/PORTAL_ACCOUNTS!A:A?key=${API_KEY}`;
  const res = await fetch(fetchUrl);
  if (!res.ok) {
    console.warn("Failed to read PORTAL_ACCOUNTS sheet", res.status);
    return;
  }
  const { values = [] } = await res.json();
  let rowIdx = null;
  for (let i = 0; i < values.length; i++) {
    if ((values[i][0] || "").trim() === DEMO_TEAM_CODE) {
      rowIdx = i + 1; // Sheets are 1‑indexed
      break;
    }
  }

  // If the team row is not found, we append a new row with the QR data.
  if (!rowIdx) {
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/PORTAL_ACCOUNTS!A:L:append?valueInputOption=RAW&key=${API_KEY}`;
    const body = {
      range: "PORTAL_ACCOUNTS!A:L",
      majorDimension: "ROWS",
      values: [[DEMO_TEAM_CODE, "", "", "", "", "", "", "", "", "", DEMO_QR_TOKEN, DEMO_QR_URL]],
    };
    const appendRes = await fetch(appendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!appendRes.ok) {
      console.warn("Failed to append demo row to sheet", appendRes.status);
    } else {
      console.log("Appended demo QR row to PORTAL_ACCOUNTS sheet");
    }
    return;
  }

  // Update K (col 11) and L (col 12) for the discovered row.
  const range = `PORTAL_ACCOUNTS!K${rowIdx}:L${rowIdx}`;
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW&key=${API_KEY}`;
  const updateBody = {
    range,
    majorDimension: "ROWS",
    values: [[DEMO_QR_TOKEN, DEMO_QR_URL]],
  };
  const updRes = await fetch(updateUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateBody),
  });
  if (!updRes.ok) {
    console.warn("Failed to update QR columns in sheet", updRes.status);
  } else {
    console.log("Updated QR token and URL in PORTAL_ACCOUNTS sheet at row", rowIdx);
  }
}

(async () => {
  try {
    await upsertTeam();
    await upsertQrRecord();
    await updatePortalAccountsSheet();
    console.log("Demo QR setup completed.");
  } catch (e) {
    console.error("Error during demo QR setup:", e);
    process.exit(1);
  }
})();
