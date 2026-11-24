/**
 * Relaython: immediate Google Sheets reporting for OFFLINE-FIRST REGISTRATION.
 * Add this as a NEW .gs file in the EXISTING Apps Script project.
 * It does NOT replace existing QR generation / Supabase scripts.
 *
 * Required Script Properties:
 *   RY_APPROVAL_SHEET_NAME = exact name of EXISTING sheet/tab with approval column L
 *   RY_SCAN_SHARED_SECRET  = long random secret (only Eventra backend + Script Properties)
 * Optional Script Property:
 *   RY_SPREADSHEET_ID = Google Spreadsheet ID
 *
 * The calling Eventra SERVER (not browser) POSTs JSON:
 * { "type":"relaython_registration_scan_v1", "secret":"...",
 *   "scan_id":"550e8400-e29b-41d4-a716-446655440000",
 *   "team_code":"IVC-RY-101", "qr_token":"ryt_...",
 *   "operator_id":"...", "operator_name":"...", "device_id":"...",
 *   "scanned_at":"2026-11-24T04:00:00.000Z" }
 *
 * All scans are matched by exact team_code+qr_token against RELAYTHON_PORTAL_READY.
 * The existing target sheet is matched by Team ID / Team Code in columns A:K;
 * only column L is modified. Nothing in A:K or M:X is changed.
 */
var RY_REG = Object.freeze({
  defaultSpreadsheetId: '1jaSyXl4iyhb5XGbXTRmTTszntVdoMD9sitaVT9bSLQE',
  registryTabName: 'RELAYTHON_PORTAL_READY',
  auditTabName: 'RELAYTHON_SCAN_LOGS',
  registrationColumn: 12, // L
  requestType: 'relaython_registration_scan_v1',
  lockWaitMs: 20000,
  registryCacheSeconds: 120
});

/**
 * In an existing doPost(e), route requests to this function BEFORE old routes:
 *   var response = relaythonTryHandleRegistrationPost(e);
 *   if (response) return response;
 *   // Existing doPost logic goes here.
 *
 * If your Apps Script project has NO doPost(e), create ONE:
 *   function doPost(e) { return relaythonTryHandleRegistrationPost(e) || ryRegJson_({ok:false,code:'UNKNOWN_ROUTE'}); }
 *
 * Do NOT define a second doPost if one already exists!
 */
function relaythonTryHandleRegistrationPost(e) {
  var body;
  try {
    if (!e || !e.postData || !e.postData.contents) return null;
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    // Let the existing doPost handler decide how to handle unrelated payloads.
    return null;
  }
  if (!body || body.type !== RY_REG.requestType) return null;
  try {
    return ryRegJson_(ryRegApply_(body));
  } catch (err) {
    console.error('Relaython Google Sheet sync error: ' + String(err && err.message || err));
    return ryRegJson_({ ok: false, code: 'RETRYABLE_ERROR', retryable: true });
  }
}

function ryRegApply_(p) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('RY_SCAN_SHARED_SECRET');
  var targetTab = props.getProperty('RY_APPROVAL_SHEET_NAME');
  if (!secret || secret.length < 24 || !targetTab) {
    return { ok: false, code: 'CONFIGURATION_MISSING', retryable: true };
  }
  if (typeof p.secret !== 'string' || p.secret !== secret) {
    return { ok: false, code: 'UNAUTHORIZED', retryable: false };
  }
  if (p.action_type && p.action_type !== 'registration') {
    return { ok: false, code: 'REGISTRATION_ONLY', retryable: false };
  }
  var scanId = String(p.scan_id || '').trim();
  var teamCode = String(p.team_code || '').trim();
  var qrToken = String(p.qr_token || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scanId) ||
      !/^IVC-RY-\d+$/.test(teamCode) ||
      !/^ryt_[A-Za-z0-9_-]{16,120}$/.test(qrToken)) {
    return { ok: false, code: 'INVALID_INPUT', retryable: false };
  }
  var spreadsheetId = props.getProperty('RY_SPREADSHEET_ID') || RY_REG.defaultSpreadsheetId;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(RY_REG.lockWaitMs)) {
    return { ok: false, code: 'BUSY_RETRY', retryable: true };
  }
  try {
    var book = SpreadsheetApp.openById(spreadsheetId);
    var registry = book.getSheetByName(RY_REG.registryTabName);
    var approval = book.getSheetByName(targetTab);
    if (!registry || !approval) {
      return { ok: false, code: 'SHEET_NOT_FOUND', retryable: true };
    }
    // Registry has A=SL NO, B=TEAM ID, C=Team Name, D=Team Leader,
    // E=DOMAIN, F=QR TOKEN, G=QR URL.
    var registryValues = registry.getDataRange().getValues();
    var registeredTeam = null;
    for (var i = 1; i < registryValues.length; i++) {
      var row = registryValues[i];
      if (String(row[1] || '').trim() === teamCode && String(row[5] || '').trim() === qrToken) {
        registeredTeam = { teamCode: teamCode, name: String(row[2] || '') };
        break;
      }
    }
    if (!registeredTeam) {
      return { ok: false, code: 'UNKNOWN_TEAM_OR_TOKEN', retryable: false };
    }

    var headers = approval.getRange(1, 1, 1, 11).getDisplayValues()[0];
    var teamIdCol = 0;
    for (var h = 0; h < headers.length; h++) {
      var normalized = String(headers[h]).trim().toLowerCase().replace(/[\s_-]+/g, '');
      if (normalized === 'teamid' || normalized === 'teamcode') {
        teamIdCol = h + 1;
        break;
      }
    }
    if (!teamIdCol) {
      return { ok: false, code: 'TEAM_ID_HEADER_NOT_FOUND', retryable: false };
    }
    var last = approval.getLastRow();
    if (last < 2) return { ok: false, code: 'TEAM_ROW_NOT_FOUND', retryable: false };
    var identifiers = approval.getRange(2, teamIdCol, last - 1, 1).getDisplayValues();
    var matchRow = 0;
    for (var j = 0; j < identifiers.length; j++) {
      if (String(identifiers[j][0]).trim() === teamCode) {
        if (matchRow) return { ok: false, code: 'DUPLICATE_TEAM_ROWS', retryable: false };
        matchRow = j + 2;
      }
    }
    if (!matchRow) return { ok: false, code: 'TEAM_ROW_NOT_FOUND', retryable: false };

    var audit = ryRegAuditSheet_(book);
    var existingAudit = ryRegFindScanId_(audit, scanId);
    if (existingAudit) {
      if (existingAudit.teamCode !== teamCode) {
        return { ok: false, code: 'SCAN_ID_CONFLICT', retryable: false };
      }
      return { ok: true, code: 'ALREADY_SYNCED', scan_id: scanId, team_code: teamCode, column: 'L' };
    }

    var cell = approval.getRange(matchRow, RY_REG.registrationColumn);
    var value = String(cell.getDisplayValue() || '').trim();
    var note = String(cell.getNote() || '');
    var ownScan = note.indexOf('RY_SCAN_ID=' + scanId) !== -1;
    if (value && !ownScan) {
      return { ok: false, code: 'ALREADY_REGISTERED', retryable: false, team_code: teamCode, row: matchRow };
    }

    // If audit append failed after a successful cell update, retry repairs audit
    // instead of consuming a second registration.
    if (!value) {
      cell.setValue('APPROVED');
      cell.setNote('RY_SCAN_ID=' + scanId + '\nScanned: ' + String(p.scanned_at || '') +
        '\nOperator: ' + String(p.operator_name || '').slice(0, 100));
      SpreadsheetApp.flush();
    }
    audit.appendRow([
      scanId,
      teamCode,
      registeredTeam.name,
      'registration',
      'L',
      ryRegSafeCell_(p.operator_id),
      ryRegSafeCell_(p.operator_name),
      ryRegSafeCell_(p.device_id),
      ryRegSafeCell_(p.scanned_at),
      new Date(),
      'APPROVED',
      matchRow
    ]);
    SpreadsheetApp.flush();
    return { ok: true, code: 'SYNCED', scan_id: scanId, team_code: teamCode, row: matchRow, column: 'L' };
  } finally {
    lock.releaseLock();
  }
}

function ryRegAuditSheet_(book) {
  var sheet = book.getSheetByName(RY_REG.auditTabName);
  if (!sheet) {
    sheet = book.insertSheet(RY_REG.auditTabName);
    sheet.getRange(1, 1, 1, 12).setValues([[
      'scan_id', 'team_code', 'team_name', 'action_type', 'column',
      'operator_id', 'operator_name', 'device_id', 'scanned_at',
      'received_at', 'result', 'approval_row'
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ryRegFindScanId_(sheet, scanId) {
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var matches = sheet.getRange(2, 1, last - 1, 1)
    .createTextFinder(scanId).matchEntireCell(true).findNext();
  if (!matches) return null;
  var row = matches.getRow();
  return { teamCode: String(sheet.getRange(row, 2).getDisplayValue()).trim() };
}

function ryRegSafeCell_(value) {
  var text = String(value || '').slice(0, 120);
  // Avoid spreadsheet formula injection via user-provided names/device identifiers.
  return /^[\s]*[=+@-]/.test(text) ? ("'" + text) : text;
}

function ryRegJson_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run manually to check config, without writing any attendance records. */
function relaythonRegistrationSetupCheck() {
  var props = PropertiesService.getScriptProperties();
  var book = SpreadsheetApp.openById(props.getProperty('RY_SPREADSHEET_ID') || RY_REG.defaultSpreadsheetId);
  var registry = book.getSheetByName(RY_REG.registryTabName);
  var targetName = props.getProperty('RY_APPROVAL_SHEET_NAME');
  var target = targetName && book.getSheetByName(targetName);
  console.log(JSON.stringify({
    spreadsheetName: book.getName(),
    registryPresent: !!registry,
    registryTeamRows: registry ? Math.max(0, registry.getLastRow() - 1) : 0,
    approvalTabConfigured: !!targetName,
    approvalTabFound: !!target,
    teamIdHeaders: target ? target.getRange(1, 1, 1, 11).getDisplayValues()[0] : [],
    columnLHeader: target ? target.getRange('L1').getDisplayValue() : '',
    sharedSecretConfigured: (props.getProperty('RY_SCAN_SHARED_SECRET') || '').length >= 24
  }));
}
