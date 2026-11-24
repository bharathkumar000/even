/**
 * Relaython Google Apps Script — QR Lookup & Registration Approval
 *
 * Bound to the Relaython registration spreadsheet.
 * Handles two actions called from the Eventra backend:
 *   1. lookupToken  — exact match search in column F (RELAYTHON_PORTAL_READY)
 *   2. approveRegistration — mark Column L APPROVED only if blank, idempotent
 *
 * Security: All calls must include apiSecret matching RY_SCAN_SHARED_SECRET.
 * Never returns all QR tokens — only exact single-token lookups.
 */

const SHEET_NAME = "RELAYTHON_PORTAL_READY"; // or "Sheet1" — adjust to your tab
const COLUMN_QR_TOKEN = 6;   // Column F — QR token (ryt_...)
const COLUMN_TEAM_CODE = 1;  // Column A — team_code
const COLUMN_TEAM_NAME = 2;  // Column B — team_name
const COLUMN_LEADER_NAME = 3; // Column C — leader_name
const COLUMN_DOMAIN = 4;     // Column D — domain
const COLUMN_APPROVED = 12;  // Column L — APPROVED status

const SCAN_LOGS_SHEET = "SCAN_LOGS";

// ---------------------------------------------------------------------------
// doPost — entry point for all webhook calls
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    const params = typeof e.postData === "object" && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    const apiSecret = params.apiSecret;
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty("RY_SCAN_SHARED_SECRET");

    if (!apiSecret || apiSecret !== expectedSecret) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Unauthorized: invalid or missing apiSecret",
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const action = params.action;

    switch (action) {
      case "lookupToken":
        return handleLookupToken(params);
      case "approveRegistration":
        return handleApproveRegistration(params);
      default:
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Unknown action: " + action,
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString(),
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------------------------
// handleLookupToken — Phase 2: exact QR token match in column F
// ---------------------------------------------------------------------------

function handleLookupToken(params) {
  const qrToken = params.qr_token;

  if (!qrToken || !/^ryt_[a-f0-9]{32,}$/i.test(qrToken)) {
    return jsonResponse({ status: "error", message: "Invalid QR token format" });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ status: "error", message: "Sheet not found: " + SHEET_NAME });
  }

  // Get all data from the sheet (header + rows)
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return jsonResponse({ status: "not_found", message: "No teams in registry." });
  }

  // Header row is index 0; data starts at index 1
  const header = data[0];
  const qrColIdx = COLUMN_QR_TOKEN - 1;
  const teamCodeIdx = COLUMN_TEAM_CODE - 1;
  const teamNameIdx = COLUMN_TEAM_NAME - 1;
  const leaderNameIdx = COLUMN_LEADER_NAME - 1;
  const domainIdx = COLUMN_DOMAIN - 1;

  // Exact match scan — stop at first match, never return all tokens
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cellToken = row[qrColIdx] ? String(row[qrColIdx]).trim() : "";
    if (cellToken.toLowerCase() === qrToken.toLowerCase()) {
      return jsonResponse({
        status: "found",
        team_code: row[teamCodeIdx] || "",
        team_name: row[teamNameIdx] || "",
        leader_name: row[leaderNameIdx] || "",
        domain: row[domainIdx] || "",
        qr_token: cellToken,
        row: i + 1, // 1-based sheet row number
        message: "Token found in Google Sheets.",
      });
    }
  }

  return jsonResponse({
    status: "not_found",
    message: "QR token not found in Google Sheets registry.",
  });
}

// ---------------------------------------------------------------------------
// handleApproveRegistration — Phase 3: mark Column L APPROVED if blank
// ---------------------------------------------------------------------------

function handleApproveRegistration(params) {
  const scanId = params.scan_id;
  const teamCode = params.team_code;
  const teamId = params.team_id || team_code;
  const operatorName = params.operator_name || params.operator || "Unknown";
  const deviceId = params.device_id || "";
  const scannedAt = params.scanned_at || new Date().toISOString();

  if (!scanId || !teamCode) {
    return jsonResponse({ status: "rejected", error: "Missing scan_id or team_code" });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ status: "error", message: "Sheet not found: " + SHEET_NAME });
  }

  // Use LockService to prevent concurrent duplicate approvals
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // wait up to 30 seconds

  try {
    // Idempotency check: has this scan_id already been processed?
    const logsSheet = ss.getSheetByName(SCAN_LOGS_SHEET);
    if (logsSheet) {
      const logsData = logsSheet.getDataRange().getValues();
      for (let i = 1; i < logsData.length; i++) {
        if (String(logsData[i][0] || "") === scanId) {
          // Already processed — return prior result
          const priorStatus = logsData[i][4] || "synced";
          return jsonResponse({
            status: priorStatus === "already_approved" ? "already_approved" : "synced",
            message: "Scan " + scanId + " already processed (idempotent).",
            scan_id: scanId,
          });
        }
      }
    }

    // Find the team row by team_code in column A
    const data = sheet.getDataRange().getValues();
    const header = data[0];
    const teamCodeColIdx = COLUMN_TEAM_CODE - 1;
    const approvedColIdx = COLUMN_APPROVED - 1;

    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      const cellCode = data[i][teamCodeColIdx] ? String(data[i][teamCodeColIdx]).trim() : "";
      if (cellCode.toLowerCase() === teamCode.toLowerCase()) {
        targetRow = i + 1; // 1-based sheet row
        break;
      }
    }

    if (targetRow === -1) {
      // Record the failure in scan logs
      appendScanLog(logsSheet, scanId, teamCode, operatorName, deviceId, scannedAt, "not_found");
      return jsonResponse({
        status: "not_found",
        message: "Team " + teamCode + " not found in Google Sheets registry.",
        scan_id: scanId,
      });
    }

    // Check Column L (APPROVED) — only approve if blank
    const approvedCell = sheet.getRange(targetRow, COLUMN_APPROVED);
    const currentValue = approvedCell.getValue();

    if (currentValue && String(currentValue).trim() !== "") {
      // Already approved — return ALREADY REGISTERED
      appendScanLog(logsSheet, scanId, teamCode, operatorName, deviceId, scannedAt, "already_approved");
      return jsonResponse({
        status: "already_approved",
        message: "Team " + teamCode + " is already registered (Column L already approved).",
        scan_id: scanId,
        row: targetRow,
      });
    }

    // Mark Column L as APPROVED
    approvedCell.setValue("APPROVED");
    approvedCell.setFontWeight("bold");
    approvedCell.setBackground("#d9ead3"); // light green

    // Record successful approval in scan logs
    appendScanLog(logsSheet, scanId, teamCode, operatorName, deviceId, scannedAt, "approved");

    return jsonResponse({
      status: "synced",
      message: "Registration approved for team " + teamCode + " (Column L set to APPROVED).",
      scan_id: scanId,
      row: targetRow,
      teamId: teamId,
    });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function appendScanLog(logsSheet, scanId, teamCode, operatorName, deviceId, scannedAt, status) {
  if (!logsSheet) return;
  try {
    // Ensure headers exist
    if (logsSheet.getLastRow() === 0) {
      logsSheet.appendRow(["scan_id", "team_code", "operator_name", "device_id", "scanned_at", "status"]);
    }
    logsSheet.appendRow([scanId, teamCode, operatorName, deviceId, scannedAt, status]);
  } catch (err) {
    console.error("Failed to append scan log:", err.toString());
  }
}
