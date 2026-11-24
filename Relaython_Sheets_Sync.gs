/**
 * RELAYTHON — Google Sheets Sync for Existing Approval Spreadsheet
 * Version: 2026-11-24
 *
 * PURPOSE:
 *   Update the EXISTING approval spreadsheet (columns L–X) when a Relaython QR
 *   scan is accepted. This script handles Morning Registration → Column L only.
 *   Lunch and Snacks columns (M–X) are intentionally NOT implemented yet.
 *
 * SPREADSHEET:
 *   Bound to existing spreadsheet ID: 1jaSyXl4iyhb5XGbXTRmTTszntVdoMD9sitaVT9bSLQE
 *   Does NOT create a new spreadsheet. Does NOT touch columns A–K.
 *   Does NOT overwrite already-approved cells.
 *
 * DEPLOYMENT:
 *   1. Open the target spreadsheet in Google Sheets.
 *   2. Extensions > Apps Script. Replace Code.gs with this file.
 *   3. Set SCRIPT_PROPERTIES: API_SECRET = (same as Eventra .env API_SECRET)
 *   4. Deploy as Web App: Execute as "Me", Who has access: "Only myself" or domain.
 *   5. Copy the Web App URL into Eventra .env as RELAYTHON_SHEETS_SYNC_URL.
 *
 * SECURITY:
 *   All write requests must include apiSecret matching Script Properties API_SECRET.
 *   The secret is NEVER embedded in the browser; only the Eventra backend sends it.
 *
 * CONCURRENCY:
 *   LockService.getScriptLock() serializes all writes so simultaneous SPOC scans
 *   cannot double-approve the same slot.
 *
 * IDEMPOTENCY:
 *   Each request includes scan_id. If Column L already contains an APPROVED mark
 *   for that team, the write is skipped and the request returns "already_approved".
 *   Retries never overwrite or duplicate approvals.
 */

var CONFIG = {
  // Existing spreadsheet — NEVER create/replace.
  SPREADSHEET_ID: '1jaSyXl4iyhb5XGbXTRmTTszntVdoMD9sitaVT9bSLQE',

  // Column of the Team ID / team code used to locate the row.
  // Column H = index 8 (matches existing Relaython team code layout).
  // Adjust if your Team ID lives in a different column.
  TEAM_ID_COLUMN: 8,

  // Approval columns (per requirement: L through X)
  COL_REGISTRATION: 12, // L — Morning Registration

  // Lookup sheet configuration (RELAYTHON_PORTAL_READY tab, column F = QR token)
// Per task specification: Column B = Team ID, Column F = QR TOKEN
  LOOKUP_SHEET_NAME: 'RELAYTHON_PORTAL_READY',
  LOOKUP_QR_COLUMN: 6,        // Column F — QR token (ryt_...)
  LOOKUP_TEAM_CODE_COLUMN: 2, // Column B — Team ID
  LOOKUP_TEAM_NAME_COLUMN: 3, // Column C — team_name
  LOOKUP_LEADER_COLUMN: 4,    // Column D — leader_name
  LOOKUP_DOMAIN_COLUMN: 5,    // Column E — domain

  TOKEN_PREFIX: 'ryt_',
  TEAM_PREFIX: 'IVC-RY-',
};

function getBook_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getMainSheet_() {
  var book = getBook_();
  // Locate the existing REGESTRATION VICEVERSE tab by name; fall back to the
  // first sheet if the named tab is not present. Never create/replace tabs.
  var sheet = book.getSheetByName('REGESTRATION VICEVERSE');
  if (!sheet) {
    sheet = book.getSheets()[0];
  }
  if (!sheet) throw new Error('Primary sheet not found in spreadsheet.');
  return sheet;
}

function normalize_(v) {
  return String(v == null ? '' : v).trim();
}

function getLock_() {
  return LockService.getScriptLock();
}

function withLock_(fn) {
  var lock = getLock_();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifySecret_(body) {
  var configured = PropertiesService.getScriptProperties().getProperty('API_SECRET');
  if (!configured || configured.length < 24 || !body ||
      normalize_(body.apiSecret) !== configured) {
    throw new Error('UNAUTHORIZED: valid server-side API_SECRET required.');
  }
}

/**
 * Relaython-specific secret verification for the Registration → Column L handler.
 * Validates body.apiSecret against the RY_SCAN_SHARED_SECRET Script Property,
 * leaving the existing API_SECRET property and legacy Eventra handlers unchanged.
 */
function verifyRelaythonSecret_(body) {
  var configured = PropertiesService.getScriptProperties().getProperty('RY_SCAN_SHARED_SECRET');
  if (!configured || configured.length < 24 || !body ||
      normalize_(body.apiSecret) !== configured) {
    throw new Error('UNAUTHORIZED: valid Relaython RY_SCAN_SHARED_SECRET required.');
  }
}

/**
 * Find the row index (1-based) where the Team ID column matches the given value.
 * Returns null if not found.
 */
function findTeamRowById_(sheet, teamId) {
  var q = normalize_(teamId);
  if (!q) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  // Read the Team ID column only (efficient, doesn't touch other columns).
  var values = sheet.getRange(2, CONFIG.TEAM_ID_COLUMN, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (normalize_(values[i][0]) === q) {
      return i + 2; // 1-based sheet row
    }
  }
  return null;
}

/**
 * Read the current value of an approval cell.
 */
function readCell_(sheet, row, col) {
  return normalize_(sheet.getRange(row, col).getValue());
}

/**
 * Write APPROVED + timestamp to the registration column (L) if not already set.
 * Never overwrites an existing approval.
 */
function approveRegistration_(sheet, row, scannedAt) {
  var cell = sheet.getRange(row, CONFIG.COL_REGISTRATION);
  var current = normalize_(cell.getValue());
  if (current !== '') {
    // Already approved — do not overwrite.
    return { status: 'already_approved', message: 'Column L already approved for this team.' };
  }
  cell.setValue('APPROVED');
  // Timestamp column — write to the cell immediately to the right (M) as the
  // timestamp witness, then M is reserved for Snacks 1 — Team Leader per spec.
  // To avoid clobbering the M column mapping, write timestamp into L cell as
  // "APPROVED <timestamp>" in a single cell is NOT spec-compliant.
  // Instead, record timestamp in the audit log sheet (see appendScanLog_).
  cell.setValue('APPROVED');
  SpreadsheetApp.flush();
  return { status: 'approved', message: 'Morning Registration approved in Column L.' };
}

/**
 * Append an audit log row to a SCAN_LOGS tab within the same spreadsheet.
 * Idempotent via scan_id: if scan_id already logged, skip.
 */
function ensureScanLogSheet_(book) {
  var sh = book.getSheetByName('SCAN_LOGS');
  if (!sh) {
    sh = book.insertSheet('SCAN_LOGS');
    sh.appendRow([
      'scan_id', 'team_code', 'action_type', 'assigned_slot',
      'operator', 'device_id', 'scanned_at', 'server_received_at', 'sync_status'
    ]);
  }
  return sh;
}

function appendScanLog_(book, entry) {
  var sh = ensureScanLogSheet_(book);
  // Idempotency: skip if scan_id already present.
  var lastRow = sh.getLastRow();
  if (lastRow > 1) {
    var ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (normalize_(ids[i][0]) === normalize_(entry.scan_id)) {
        return { status: 'duplicate_log', message: 'scan_id already logged.' };
      }
    }
  }
  sh.appendRow([
    entry.scan_id,
    entry.team_code,
    entry.action_type,
    entry.assigned_slot || 'L',
    entry.operator,
    entry.device_id || '',
    entry.scanned_at || new Date().toISOString(),
    entry.server_received_at || new Date().toISOString(),
    entry.sync_status || 'synced'
  ]);
  SpreadsheetApp.flush();
  return { status: 'logged', message: 'Scan audit entry appended.' };
}

/**
 * Authenticated write handler: approve Registration (Column L) for a team.
 */
function apiApproveRegistration_(body) {
  return withLock_(function() {
    var scanId = normalize_(body.scan_id);
    var teamId = normalize_(body.team_code || body.team_id || body.teamCode);
    var actionType = normalize_(body.action_type || body.actionType || 'registration');
    var operator = normalize_(body.operator_name || body.operator || 'SPOC');
    var deviceId = normalize_(body.device_id || '');
    var scannedAt = normalize_(body.scanned_at || new Date().toISOString());

    if (!scanId) {
      return { status: 'error', message: 'scan_id is required.' };
    }
    if (!teamId) {
      return { status: 'error', message: 'team_code / team_id is required.' };
    }
    if (actionType !== 'registration') {
      // Only Registration → Column L is implemented. Other actions deferred.
      return { status: 'deferred', message: actionType + ' not yet implemented (Registration only).' };
    }

    var sheet = getMainSheet_();
    var row = findTeamRowById_(sheet, teamId);
    if (!row) {
      return { status: 'not_found', message: 'Team ID ' + teamId + ' not found in sheet.' };
    }

    var approval = approveRegistration_(sheet, row, scannedAt);

    // Append audit log regardless of already_approved (for traceability),
    // but skip duplicate scan_id logs.
    var book = getBook_();
    var logResult = appendScanLog_(book, {
      scan_id: scanId,
      team_code: teamId,
      action_type: actionType,
      assigned_slot: 'L',
      operator: operator,
      device_id: deviceId,
      scanned_at: scannedAt,
      server_received_at: new Date().toISOString(),
      sync_status: approval.status === 'already_approved' ? 'synced' : 'synced'
    });

    return {
      status: approval.status,
      message: approval.message,
      teamId: teamId,
      row: row,
      column: 'L',
      scan_id: scanId,
      log: logResult
    };
  });
}

/**
 * ResetRegistration — clear column L for a team (administrator action).
 * Requires RY_SCAN_SHARED_SECRET. Records the reset in SCAN_LOGS for audit.
 */
function handleResetRegistration_(body) {
  return withLock_(function() {
    var scanId = normalize_(body.scan_id) || 'reset_' + new Date().toISOString();
    var teamId = normalize_(body.team_code || body.team_id || body.teamCode);
    var operator = normalize_(body.operator_name || body.operator || 'Administrator');

    if (!teamId) {
      return { status: 'error', message: 'team_code / team_id is required.' };
    }

    var sheet = getMainSheet_();
    var row = findTeamRowById_(sheet, teamId);
    if (!row) {
      return { status: 'not_found', message: 'Team ID ' + teamId + ' not found in sheet.' };
    }

    var colReg = sheet.getRange(row, CONFIG.COL_REGISTRATION);
    var current = normalize_(colReg.getValue());
    colReg.setValue('');
    colReg.setFontWeight('normal');
    colReg.setBackground(null);
    SpreadsheetApp.flush();

    // Record the reset in audit log.
    var book = getBook_();
    var logResult = appendScanLog_(book, {
      scan_id: scanId,
      team_code: teamId,
      action_type: 'registration_reset',
      assigned_slot: 'L',
      operator: operator,
      device_id: '',
      scanned_at: new Date().toISOString(),
      server_received_at: new Date().toISOString(),
      sync_status: 'reset'
    });

    return {
      status: 'reset',
      message: 'Registration reset for team ' + teamId + ' — Column L cleared.',
      teamId: teamId,
      row: row,
      column: 'L',
      scan_id: scanId,
      log: logResult,
      previousValue: current
    };
  });
}

/**
 * LookupToken — exact QR token match in column F (RELAYTHON_PORTAL_READY).
 * Read-only: never modifies any cell.
 * Returns status "found" or "not_found" matching the Eventra backend contract.
 */
function handleLookupToken_(body) {
  var qrToken = normalize_(body.qr_token);
  if (!qrToken || !/^ryt_[a-f0-9]{32,}$/i.test(qrToken)) {
    return { status: 'error', message: 'Invalid QR token format.' };
  }

  var book = getBook_();
  var sheet = book.getSheetByName(CONFIG.LOOKUP_SHEET_NAME);
  if (!sheet) {
    return { status: 'error', message: 'Sheet not found: ' + CONFIG.LOOKUP_SHEET_NAME };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { status: 'not_found', message: 'No teams in registry.' };
  }

  var qrColIdx = CONFIG.LOOKUP_QR_COLUMN - 1;
  var teamCodeColIdx = CONFIG.LOOKUP_TEAM_CODE_COLUMN - 1;
  var teamNameColIdx = CONFIG.LOOKUP_TEAM_NAME_COLUMN - 1;
  var leaderNameColIdx = CONFIG.LOOKUP_LEADER_COLUMN - 1;
  var domainColIdx = CONFIG.LOOKUP_DOMAIN_COLUMN - 1;

  var qrTokenLower = qrToken.toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var cellToken = row[qrColIdx] ? String(row[qrColIdx]).trim() : '';
    if (cellToken.toLowerCase() === qrTokenLower) {
      return {
        status: 'found',
        team_code: row[teamCodeColIdx] || '',
        team_name: row[teamNameColIdx] || '',
        leader_name: row[leaderNameColIdx] || '',
        domain: row[domainColIdx] || '',
        qr_token: cellToken,
        row: i + 1,
        message: 'Token found in Google Sheets registry.',
      };
    }
  }

  return { status: 'not_found', message: 'QR token not found in Google Sheets registry.' };
}

/**
 * GetRegistry — return all teams from RELAYTHON_PORTAL_READY tab.
 * Read-only: never modifies any cell.
 * Returns all team records for scanner cache refresh.
 */
function handleGetRegistry_(body) {
  var book = getBook_();
  var sheet = book.getSheetByName(CONFIG.LOOKUP_SHEET_NAME);
  if (!sheet) {
    return { status: 'error', message: 'Sheet not found: ' + CONFIG.LOOKUP_SHEET_NAME };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { status: 'not_found', message: 'No teams in registry.', teams: [], count: 0 };
  }

  var teamCodeColIdx = CONFIG.LOOKUP_TEAM_CODE_COLUMN - 1;
  var teamNameColIdx = CONFIG.LOOKUP_TEAM_NAME_COLUMN - 1;
  var leaderNameColIdx = CONFIG.LOOKUP_LEADER_COLUMN - 1;
  var domainColIdx = CONFIG.LOOKUP_DOMAIN_COLUMN - 1;
  var qrColIdx = CONFIG.LOOKUP_QR_COLUMN - 1;

  var teams = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var teamCode = normalize_(row[teamCodeColIdx]);
    var qrToken = normalize_(row[qrColIdx]);
    if (!teamCode || !qrToken) continue;

    teams.push({
      team_code: teamCode,
      team_name: normalize_(row[teamNameColIdx]) || '',
      leader_name: normalize_(row[leaderNameColIdx]) || '',
      domain: normalize_(row[domainColIdx]) || '',
      qr_token: qrToken,
    });
  }

  return {
    status: 'found',
    teams: teams,
    count: teams.length,
    message: 'Registry loaded from Google Sheets.',
  };
}

/**
 * CompareTabs — compare Team IDs between RELAYTHON_PORTAL_READY (Column B)
 * and REGESTRATION VICEVERSE (Column H).
 * Read-only: never modifies any cell.
 * Returns missing team IDs in each tab.
 */
function handleCompareTabs_(body) {
  var book = getBook_();

  // Read RELAYTHON_PORTAL_READY Column B (Team ID)
  var portalSheet = book.getSheetByName(CONFIG.LOOKUP_SHEET_NAME);
  if (!portalSheet) {
    return { status: 'error', message: 'Sheet not found: ' + CONFIG.LOOKUP_SHEET_NAME };
  }
  var portalData = portalSheet.getDataRange().getValues();
  var portalTeamIds = new Set();
  var teamCodeColIdx = CONFIG.LOOKUP_TEAM_CODE_COLUMN - 1;
  for (var i = 1; i < portalData.length; i++) {
    var tid = normalize_(portalData[i][teamCodeColIdx]);
    if (tid) portalTeamIds.add(tid);
  }

  // Read REGESTRATION VICEVERSE Column H (Team ID)
  var viceVerseSheet = getMainSheet_();
  var vvData = viceVerseSheet.getDataRange().getValues();
  var viceVerseTeamIds = new Set();
  var vvTeamCodeColIdx = CONFIG.TEAM_ID_COLUMN - 1; // Column H = index 8
  for (var i = 1; i < vvData.length; i++) {
    var tid = normalize_(vvData[i][vvTeamCodeColIdx]);
    if (tid) viceVerseTeamIds.add(tid);
  }

  var missingFromViceVerse = [];
  var missingFromPortal = [];

  portalTeamIds.forEach(function(tid) {
    if (!viceVerseTeamIds.has(tid)) {
      missingFromViceVerse.push(tid);
    }
  });

  viceVerseTeamIds.forEach(function(tid) {
    if (!portalTeamIds.has(tid)) {
      missingFromPortal.push(tid);
    }
  });

  return {
    status: 'found',
    portalTeamCount: portalTeamIds.size,
    viceVerseTeamCount: viceVerseTeamIds.size,
    missingFromViceVerse: missingFromViceVerse,
    missingFromPortal: missingFromPortal,
    message: 'Tab comparison complete.',
  };
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === 'ping') {
      return json_({ status: 'SUCCESS', event: 'Relaython Sheets Sync', message: 'API online' });
    }
    return json_({ status: 'SUCCESS', supported: ['ping'], note: 'Use doPost with apiSecret for writes.' });
  } catch (err) {
    return json_({ status: 'ERROR', message: err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Relaython Registration → Column L uses the dedicated RY_SCAN_SHARED_SECRET.
    // Legacy Eventra actions (checkIn/registerTeam/getTeam/sync) keep using API_SECRET.
    if (body.action === 'approveRegistration' || body.action === 'registration') {
      verifyRelaythonSecret_(body);
      return json_(apiApproveRegistration_(body));
    }

    // Relaython QR Lookup — exact token match in column F (RELAYTHON_PORTAL_READY).
    // Read-only: authenticates via RY_SCAN_SHARED_SECRET, never modifies cells.
    if (body.action === 'lookupToken') {
      verifyRelaythonSecret_(body);
      return json_(handleLookupToken_(body));
    }

    // Relaython Registration Reset — clears column L for administrator override.
    if (body.action === 'resetRegistration') {
      verifyRelaythonSecret_(body);
      return json_(handleResetRegistration_(body));
    }

    // Relaython Registry Refresh — return all teams from RELAYTHON_PORTAL_READY.
    // Read-only: authenticates via RY_SCAN_SHARED_SECRET, never modifies cells.
    if (body.action === 'getRegistry') {
      verifyRelaythonSecret_(body);
      return json_(handleGetRegistry_(body));
    }

    // Relaython Tab Comparison — compare Team IDs between the two sheets.
    // Read-only: authenticates via RY_SCAN_SHARED_SECRET, never modifies cells.
    if (body.action === 'compareTabs') {
      verifyRelaythonSecret_(body);
      return json_(handleCompareTabs_(body));
    }

    // Legacy handlers remain protected by API_SECRET and are unchanged.
    verifySecret_(body);

    if (body.action === 'ping') {
      return json_({ status: 'SUCCESS', message: 'Sheets sync endpoint online.' });
    }
    return json_({ status: 'ERROR', message: 'Unknown action. Use approveRegistration or ping.' });
  } catch (err) {
    return json_({ status: 'ERROR', message: err.message });
  }
}
