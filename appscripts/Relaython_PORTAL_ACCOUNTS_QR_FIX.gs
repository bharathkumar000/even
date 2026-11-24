/**
 * RELAYTHON — Google Sheets registration + QR + SPOC check-in backend
 * Version: 2026-11-23
 *
 * MAIN SHEET: A serial, B team, C leader, D/E/F members 2/3/4,
 * G track, H team code, I token, J QR URL, K QR image.
 * Check-ins are stored in a separate "Relaython_Checkins" tab.
 *
 * Uses the NEW Relaython spreadsheet ID while preserving the same existing
 * Supabase project. Existing Supabase credentials stay in Script Properties.
 * Do not embed any secret in the source. Set SHEET_NAME and CHECKIN_PAGE_URL.
 */

var CONFIG = {
  SPREADSHEET_ID: '1jaSyXl4iyhb5XGbXTRmTTszntVdoMD9sitaVT9bSLQE',  // Actual spreadsheet from supplied Google Sheets URL; same Supabase project
  SHEET_NAME: 'REGESTRATION VICEVERSE', // Exact registration tab shown in your screenshot
  CHECKIN_SHEET: 'Relaython_Checkins',
  REGISTRY_SHEET: 'Relaython_Registration_Keys',
  PORTAL_SHEET: 'Relaython_Portal_Sync_7col', // New tab to preserve existing 6-column output
  CHECKIN_PAGE_URL: 'https://eventra-ivc.vercel.app/checkin', // Confirm Relaython URL
  // Optional trusted Vercel endpoint for secure Supabase team upsert + portal provisioning.
  // Must verify API_SECRET header on the server. Leave blank until implemented.
  RELAYTHON_SYNC_ENDPOINT: '',
  QR_SIZE: 250,
  QR_ROW_HEIGHT: 90,
  QR_COLUMN_WIDTH: 110,
  TEAM_PREFIX: 'IVC-RY-',
  TOKEN_PREFIX: 'ryt_',
  TRACKS: {
    'first sem': { start: 101, display: 'First Sem' },
    'fasem': { start: 101, display: 'First Sem' },
    'first semester': { start: 101, display: 'First Sem' },
    '1st sem': { start: 101, display: 'First Sem' },
    'third sem': { start: 201, display: 'Third Sem' },
    'third semester': { start: 201, display: 'Third Sem' },
    '3rd sem': { start: 201, display: 'Third Sem' }
  },
  COL: { SERIAL: 1, TEAM_NAME: 2, LEADER: 3, MEMBER2: 4, MEMBER3: 5,
         MEMBER4: 6, TRACK: 7, CODE: 8, TOKEN: 9, URL: 10, QR: 11 }
};

function getBook_() {
  // Use the NEW Relaython spreadsheet ID; ignore legacy ViceVerse Script Properties values.
  if (CONFIG.SPREADSHEET_ID) {
    try { return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }
    catch (err) { throw new Error('Unable to open Relaython spreadsheet ID ' + CONFIG.SPREADSHEET_ID + '. Verify Apps Script account has access to https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID + '/edit. Details: ' + err.message); }
  }
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Set CONFIG.SPREADSHEET_ID to your NEW sheet ID for standalone/web-app execution.');
  return book;
}
function getMainSheet_() {
  var book = getBook_();
  var s = book.getSheetByName(CONFIG.SHEET_NAME);
  if (!s) throw new Error('Sheet tab \"' + CONFIG.SHEET_NAME + '\" missing; available: ' + book.getSheets().map(function(x){ return x.getName(); }).join(', '));
  var b = normalize_(s.getRange(1, 2).getDisplayValue()).toLowerCase();
  var g = normalize_(s.getRange(1, 7).getDisplayValue()).toLowerCase();
  if (b.indexOf('team') === -1 || g.indexOf('track') === -1) {
    throw new Error('STOP: unexpected headers in ' + s.getName() + '. B1 must be Team Name and G1 must be Track. Found B1=' + b + ', G1=' + g);
  }
  return s;
}
function normalize_(v) { return String(v == null ? '' : v).trim(); }
function trackKind_(v) {
  var x = normalize_(v).toLowerCase().replace(/\s+/g, ' ');
  var t = CONFIG.TRACKS[x];
  return t ? (t.start === 101 ? 'first' : 'third') : '';
}
function trackStart_(kind) { return kind === 'first' ? 101 : 201; }
function getLock_() { return LockService.getScriptLock(); }
function withLock_(fn) {
  var lock = getLock_();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function newToken_() {
  var entropy = [Utilities.getUuid(), Utilities.getUuid(), String(Date.now()), String(Math.random())].join(':');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, entropy);
  return CONFIG.TOKEN_PREFIX + bytes.map(function(b) {
    var n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('').slice(0, 48);
}
function makeUrl_(code, token) {
  var sep = CONFIG.CHECKIN_PAGE_URL.indexOf('?') < 0 ? '?' : '&';
  return CONFIG.CHECKIN_PAGE_URL + sep + 'token=' + encodeURIComponent(token) +
    '&teamId=' + encodeURIComponent(code);
}
function makeQrFormula_(row) {
  return '=IMAGE("https://quickchart.io/qr?size=' + CONFIG.QR_SIZE +
    '&text="&ENCODEURL(J' + row + '))';
}
function readTeams_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 11).getValues();
}
function isRegistration_(r) {
  return !!normalize_(r[1]); // A team name in B is necessary; never clear blank rows
}
function codeKind_(code) {
  var m = /^IVC-RY-(\d+)$/i.exec(normalize_(code));
  if (!m) return '';
  var n = Number(m[1]);
  if (n >= 101 && n < 201) return 'first';
  if (n >= 201) return 'third';
  return '';
}
function findNextCode_(kind, used) {
  var n = trackStart_(kind);
  while (used.has(CONFIG.TEAM_PREFIX + n)) n++;
  // The two ranges are guaranteed distinct for the planned <= 80 teams.
  // Fail safely rather than allocate an overlapping code if First Sem exceeds 100 teams.
  if (kind === 'first' && n >= 201) throw new Error('First Sem code range exhausted (101–200). Review the ID scheme before continuing.');
  var code = CONFIG.TEAM_PREFIX + n;
  used.add(code);
  return code;
}
/** Processes ALL valid rows, but writes only cells that actually need changes.
 * Existing IDs/tokens are stable unless a track change forces a new team code.
 * No registration input columns A–G are modified; no columns are cleared.
 */
function processRegistrations_() {
  var sheet = getMainSheet_();
  var data = readTeams_(sheet);
  var usedCodes = new Set();
  var usedTokens = new Set();
  var reservedCodes = new Set();
  // Reserve valid existing IDs so adding a row doesn't displace them.
  data.forEach(function(r) {
    if (!isRegistration_(r)) return;
    var k = trackKind_(r[6]);
    var code = normalize_(r[7]);
    if (k && codeKind_(code) === k) reservedCodes.add(code);
  });
  var usedForAllocation = new Set(reservedCodes);
  var changes = 0, generatedCodes = 0, generatedTokens = 0, skipped = 0;
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (!isRegistration_(r)) continue;
    var row = i + 2;
    var kind = trackKind_(r[6]);
    if (!kind) { skipped++; continue; } // Invalid/empty track: preserve all data
    var code = normalize_(r[7]);
    var token = normalize_(r[8]);
    var validCode = codeKind_(code) === kind && !usedCodes.has(code);
    if (!validCode) {
      code = findNextCode_(kind, usedForAllocation);
      sheet.getRange(row, 8).setValue(code);
      generatedCodes++; changes++;
    }
    usedCodes.add(code);
    var validToken = token.indexOf(CONFIG.TOKEN_PREFIX) === 0 && !usedTokens.has(token);
    if (!validToken) {
      do { token = newToken_(); } while (usedTokens.has(token));
      sheet.getRange(row, 9).setValue(token);
      generatedTokens++; changes++;
    }
    usedTokens.add(token);
    var url = makeUrl_(code, token);
    if (normalize_(r[9]) !== url) { sheet.getRange(row, 10).setValue(url); changes++; }
    var formula = makeQrFormula_(row);
    if (sheet.getRange(row, 11).getFormula() !== formula) {
      sheet.getRange(row, 11).setFormula(formula); changes++;
    }
    if (sheet.getRowHeight(row) < CONFIG.QR_ROW_HEIGHT) sheet.setRowHeight(row, CONFIG.QR_ROW_HEIGHT);
  }
  if (changes) SpreadsheetApp.flush();
  return { status: 'SUCCESS', rowsInspected: data.length, generatedCodes: generatedCodes,
    generatedTokens: generatedTokens, changedCells: changes, invalidTrackRows: skipped };
}
function processNewRegistrations() {
  var result = withLock_(processRegistrations_);
  Logger.log('RELAYTHON QR GENERATION: ' + JSON.stringify(result));
  return result;
}
/** Run this before the first Relaython migration to preserve the copied sheet. */
function backupRelaythonSheet() {
  var sh = getMainSheet_();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  var backup = sh.copyTo(getBook_());
  backup.setName('Relaython_Backup_' + stamp);
  Logger.log('BACKUP CREATED: ' + backup.getName());
  return { status: 'BACKUP_CREATED', sheet: backup.getName() };
}
/** First-time setup for copied sheet: create backup, then migrate legacy VV code/token/URL/QR. */
function setupRelaythonAndGenerate() {
  var backup = backupRelaythonSheet();
  var result = processNewRegistrations();
  return { backup: backup.sheet, result: result };
}
function runSafeDiagnostics() {
  var rows = readTeams_(getMainSheet_());
  var invalid = [], codes = new Set(), tokens = new Set(), duplicateCodes = [], duplicateTokens = [];
  rows.forEach(function(r, i) {
    if (!isRegistration_(r)) return;
    var n = i + 2, code = normalize_(r[7]), token = normalize_(r[8]);
    if (!trackKind_(r[6])) invalid.push(n);
    if (code && codes.has(code)) duplicateCodes.push(n);
    if (token && tokens.has(token)) duplicateTokens.push(n);
    if (code) codes.add(code);
    if (token) tokens.add(token);
  });
  return { status: 'DIAGNOSTICS_ONLY', rowsScanned: rows.length,
    invalidTrackRows: invalid, duplicateCodeRows: duplicateCodes, duplicateTokenRows: duplicateTokens };
}
/** Fires when users manually edit cells in this spreadsheet. */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;
  if (e.range.getLastRow() < 2 || e.range.getColumn() > 7) return;
  try { processNewRegistrations(); }
  catch (err) { console.error('Relaython onEdit: ' + err.message); }
}
/** Installable onChange catches row inserts, edits by some UI workflows, etc. */
function onRelaythonChange(e) {
  try { processNewRegistrations(); }
  catch (err) { console.error('Relaython onChange: ' + err.message); }
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Relaython Admin')
    .addItem('FIRST RUN: Backup + generate Relaython QR codes', 'setupRelaythonAndGenerate')
    .addItem('Generate / update QR codes', 'processNewRegistrations')
    .addItem('Sync seven columns to portal sheet and backend', 'syncRelaythonPortal')
    .addItem('FIRST RUN: Set up portal sheet (backup first)', 'setupRelaythonPortal')
    .addItem('Run read-only diagnostics', 'showRelaythonDiagnostics')
    .addItem('Inspect Supabase connection (no secrets)', 'inspectRelaythonConnection')
    .addItem('Preview Script Property cleanup', 'previewRelaythonPropertyCleanup')
    .addSeparator()
    .addItem('Enable auto-processing triggers', 'enableAutoProcessing')
    .addItem('Disable auto-processing triggers', 'disableAutoProcessing')
    .addToUi();
}
function showRelaythonDiagnostics() {
  var result = runSafeDiagnostics();
  SpreadsheetApp.getUi().alert(JSON.stringify(result, null, 2));
  return result;
}
function enableAutoProcessing() {
  disableAutoProcessing();
  var book = getBook_();
  ScriptApp.newTrigger('onRelaythonChange').forSpreadsheet(book).onChange().create();
  // Backup reconciliation: some external API/form writes do not fire onEdit.
  ScriptApp.newTrigger('syncRelaythonPortal').timeBased().everyMinutes(5).create();
  return 'Relaython generation on edit and periodic portal sync enabled.';
}
function disableAutoProcessing() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (['onRelaythonChange', 'processNewRegistrations', 'syncRelaythonPortal'].indexOf(t.getHandlerFunction()) !== -1)
      ScriptApp.deleteTrigger(t);
  });
  return 'Installable Relaython triggers disabled; built-in onEdit remains active.';
}

// ------------------------------- READ API ---------------------------------
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function findTeam_(value) {
  var q = normalize_(value);
  if (!q) return null;
  var rows = readTeams_(getMainSheet_());
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!isRegistration_(r)) continue;
    if (q === normalize_(r[8]) || q === normalize_(r[7])) {
      return { row: i + 2, teamName: r[1], teamLeader: r[2], member2: r[3],
        member3: r[4], member4: r[5], track: r[6], teamCode: r[7], token: r[8], url: r[9] };
    }
  }
  return null;
}
function publicTeam_(team) {
  return { teamName: team.teamName, teamLeader: team.teamLeader,
    member2: team.member2, member3: team.member3, member4: team.member4,
    track: team.track, teamCode: team.teamCode };
}
function apiGetTeam(query) {
  var team = findTeam_(query);
  if (!team) return { status: 'NOT_FOUND', message: 'Relaython team not found.' };
  return { status: 'SUCCESS', data: publicTeam_(team) };
}
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === 'ping') return json_({ status: 'SUCCESS', event: 'Relaython', message: 'API online' });
    if (p.action === 'getTeam') {
      // For token-based lookup, the QR token is possession-based access.
      // Use a server-side authenticated proxy for staff-only data.
      if (!normalize_(p.token)) return json_({ status: 'ERROR', message: 'QR token required.' });
      var team = findTeam_(p.token);
      if (!team || team.token !== normalize_(p.token)) return json_({ status: 'NOT_FOUND' });
      return json_({ status: 'SUCCESS', data: publicTeam_(team) });
    }
    // CRITICAL: No write operations over GET. Old ViceVerse did allow this.
    return json_({ status: 'SUCCESS', event: 'Relaython', supported: ['ping', 'getTeam'] });
  } catch (err) { return json_({ status: 'ERROR', message: err.message }); }
}

// --------------------------- AUTHENTICATED WRITE API ------------------------
/** Set API_SECRET in Apps Script Project Settings > Script Properties.
 * Only a trusted server (such as a Vercel Server Action/API route) should send it.
 * NEVER embed it in a browser bundle, QR image, or public URL.
 */
function verifySecret_(body) {
  var configured = PropertiesService.getScriptProperties().getProperty('API_SECRET');
  if (!configured || configured.length < 24 || !body ||
      normalize_(body.apiSecret) !== configured) {
    throw new Error('UNAUTHORIZED: valid server-side API_SECRET required.');
  }
}
function checkinSheet_() {
  var book = getBook_();
  var sh = book.getSheetByName(CONFIG.CHECKIN_SHEET);
  if (!sh) {
    sh = book.insertSheet(CONFIG.CHECKIN_SHEET);
    sh.appendRow(['Team Code', 'Action', 'Member', 'Checked At (UTC)', 'SPOC ID']);
  }
  return sh;
}
function actionMembers_(action, team) {
  var a = normalize_(action).toLowerCase().replace(/[\s_-]/g, '');
  var members = [team.teamLeader, team.member2, team.member3, team.member4];
  if (['registration', 'morningreg', 'morning', 'morningregistration'].indexOf(a) !== -1)
    return { action: 'registration', members: [0] };
  if (['goodies', 'goody', 'goodles'].indexOf(a) !== -1)
    return { action: 'goodies', members: [0] };
  if (a === 'lunchall' || a === 'snacksall') {
    var result = [];
    for (var i = 0; i < members.length; i++) if (normalize_(members[i])) result.push(i);
    return { action: a === 'lunchall' ? 'lunch' : 'snacks', members: result };
  }
  var match = /^(lunch|snacks)(tl|teamleader|leader|m2|member2|m3|member3|m4|member4)$/.exec(a);
  if (match) {
    var map = { tl: 0, teamleader: 0, leader: 0, m2: 1, member2: 1,
      m3: 2, member3: 2, m4: 3, member4: 3 };
    var idx = map[match[2]];
    if (!normalize_(members[idx])) throw new Error('This team has no Member ' + (idx + 1));
    return { action: match[1], members: [idx] };
  }
  throw new Error('Unsupported check-in action: ' + action);
}
/** Atomic duplicate prevention for 10 SPOCs through a script lock.
 * Recording is a separate tab; A–K team data is NEVER changed by scanning.
 */
function apiCheckIn_(body) {
  return withLock_(function() {
    var token = normalize_(body.token);
    if (!token) return { status: 'INVALID_QR', message: 'QR token required' };
    var team = findTeam_(token);
    if (!team || team.token !== token) return { status: 'INVALID_QR', message: 'Unknown QR token' };
    var spec = actionMembers_(body.type || body.actionType, team);
    var sh = checkinSheet_();
    var previous = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues() : [];
    var existing = new Set(previous.map(function(r) { return r.join('|'); }));
    var inserts = [], already = 0;
    spec.members.forEach(function(memberIndex) {
      var key = [team.teamCode, spec.action, String(memberIndex + 1)].join('|');
      if (existing.has(key)) { already++; return; }
      existing.add(key);
      inserts.push([team.teamCode, spec.action, String(memberIndex + 1),
        new Date().toISOString(), normalize_(body.spocId)]);
    });
    if (inserts.length) sh.getRange(sh.getLastRow() + 1, 1, inserts.length, 5).setValues(inserts);
    SpreadsheetApp.flush();
    return { status: inserts.length ? 'CHECKED_IN' : 'ALREADY_CHECKED_IN',
      teamCode: team.teamCode, teamName: team.teamName, action: spec.action,
      newlyChecked: inserts.length, alreadyChecked: already, totalRequested: spec.members.length };
  });
}
function registrationKeySheet_() {
  var book = getBook_();
  var sh = book.getSheetByName(CONFIG.REGISTRY_SHEET);
  if (!sh) {
    sh = book.insertSheet(CONFIG.REGISTRY_SHEET);
    sh.appendRow(['External Registration ID', 'Main Sheet Row']);
  }
  return sh;
}
/** Optional website registration sync. Uses a permanent external registrationId
 * to make retries update the same row instead of appending duplicates.
 */
function apiRegisterTeam_(body) {
  return withLock_(function() {
    var id = normalize_(body.registrationId || body.registration_id);
    var teamName = normalize_(body.teamName || body.team_name);
    var kind = trackKind_(body.track);
    if (!id || !teamName || !kind)
      return { status: 'ERROR', message: 'registrationId, teamName and valid track are required.' };
    var sh = getMainSheet_();
    var registry = registrationKeySheet_();
    var values = registry.getLastRow() > 1
      ? registry.getRange(2, 1, registry.getLastRow() - 1, 2).getValues() : [];
    var row = null;
    for (var i = 0; i < values.length; i++) {
      if (normalize_(values[i][0]) === id) { row = Number(values[i][1]); break; }
    }
    // Protect human edits: do not overwrite existing rows on website retries.
    if (row !== null && (!Number.isInteger(row) || row < 2 || row > sh.getLastRow()))
      return { status: 'ERROR', message: 'Stored registration mapping invalid; manual review required.' };
    if (row !== null && normalize_(body.updateExisting) !== 'true') {
      var existing = sh.getRange(row, 2, 1, 10).getValues()[0];
      return { status: 'ALREADY_REGISTERED', teamName: existing[0], teamCode: existing[6] };
    }
    var input = [teamName, normalize_(body.teamLeader || body.team_leader),
      normalize_(body.member2 || body.member_2), normalize_(body.member3 || body.member_3),
      normalize_(body.member4 || body.member_4), kind === 'first' ? 'First Sem' : 'Third Sem'];
    if (row === null) {
      row = Math.max(2, sh.getLastRow() + 1);
      sh.getRange(row, 2, 1, 6).setValues([input]);
      registry.appendRow([id, row]);
    } else {
      sh.getRange(row, 2, 1, 6).setValues([input]);
    }
    processRegistrations_();
    var v = sh.getRange(row, 8, 1, 3).getValues()[0];
    return { status: 'SUCCESS', teamName: teamName, teamCode: v[0], token: v[1], url: v[2] };
  });
}
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    verifySecret_(body);
    if (body.action === 'checkIn') return json_(apiCheckIn_(body));
    if (body.action === 'registerTeam') return json_(apiRegisterTeam_(body));
    if (body.action === 'getTeam') return json_(apiGetTeam(body.token || body.teamCode));
    if (body.action === 'sync') return json_(processNewRegistrations());
    return json_({ status: 'ERROR', message: 'Unknown action. Use checkIn, registerTeam, getTeam or sync.' });
  } catch (err) {
    return json_({ status: 'ERROR', message: err.message });
  }
}


// ==================== RELAYTHON PORTAL / SUPABASE SYNC ====================
// This SECTION outputs exactly seven fields and connects to the existing
// trusted Vercel backend. Use the SAME existing Supabase project.
// Supabase credentials must remain in Script Properties; do not hardcode keys.
// The existing Vercel endpoint must be implemented/adapted to accept the
// contract documented in Relaython_Portal_Integration_README.txt.
// Portal passwords must NEVER be stored in this sheet or logged here.

function relaythonPortalHeaders_() {
  return ['SL NO','TEAM ID','Team Name','Team Leader','DOMAIN','QR TOKEN','QR URL'];
}
function relaythonPortalSheet_() {
  var ss = getBook_();
  var sh = ss.getSheetByName(CONFIG.PORTAL_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.PORTAL_SHEET);
    sh.getRange(1,1,1,7).setValues([relaythonPortalHeaders_()]);
    sh.setFrozenRows(1);
  } else {
    var found = sh.getRange(1,1,1,7).getDisplayValues()[0];
    if (found.join('|') !== relaythonPortalHeaders_().join('|')) {
      throw new Error('STOP: '+CONFIG.PORTAL_SHEET+' already has different headers. No existing columns were overwritten. Rename the old tab or use a different PORTAL_SHEET.');
    }
  }
  return sh;
}
function relaythonPortalRecords_() {
  var main = getMainSheet_();
  var data = readTeams_(main);
  var result = [], codes = new Set(), tokens = new Set();
  data.forEach(function(r, index) {
    if (!isRegistration_(r)) return;
    var kind = trackKind_(r[6]);
    var code = normalize_(r[7]);
    var token = normalize_(r[8]);
    var url = normalize_(r[9]);
    if (!kind || codeKind_(code) !== kind || !token.startsWith(CONFIG.TOKEN_PREFIX) || !url) return;
    if (codes.has(code) || tokens.has(token)) throw new Error('STOP: duplicate team code or token in row '+(index+2));
    codes.add(code); tokens.add(token);
    result.push({serial: result.length+1, teamId: code, teamName: normalize_(r[1]),
      teamLeaderName: normalize_(r[2]), domain: normalize_(r[6]), qrToken: token, qrUrl: url});
  });
  return result;
}
/** Read-only configuration inspection. NEVER print secrets or secret values. */
function inspectRelaythonConnection() {
  var props = PropertiesService.getScriptProperties();
  var suppliedUrl = normalize_(props.getProperty('SUPABASE_URL')).replace(/\/+$/, '');
  var endpoint = normalize_(CONFIG.RELAYTHON_SYNC_ENDPOINT);
  var sh = getMainSheet_();
  var result = {
    event: 'RELAYTHON',
    spreadsheetId: getBook_().getId(),
    registrationSheet: sh.getName(),
    supabaseUrlConfigured: !!suppliedUrl,
    supabaseHost: suppliedUrl ? suppliedUrl.replace(/^https?:\/\//i, '').split('/')[0] : '',
    serviceRoleKeyPresent: !!props.getProperty('SUPABASE_SERVICE_ROLE_KEY'),
    apiSecretPresent: !!props.getProperty('API_SECRET'),
    remoteSyncEndpointConfigured: !!endpoint,
    warning: endpoint ? '' : 'Remote sync endpoint not set. Portal sheet works locally; NO Supabase upsert or login provisioning occurs.'
  };
  Logger.log(JSON.stringify(result));
  return result;
}
function portalSyncUrl_() {
  return normalize_(CONFIG.RELAYTHON_SYNC_ENDPOINT);
}
function pushRelaythonTeam_(rec) {
  var endpoint = portalSyncUrl_();
  var secret = normalize_(PropertiesService.getScriptProperties().getProperty('API_SECRET'));
  if (!endpoint) return {status:'NOT_CONFIGURED'};
  if (!/^https:\/\//i.test(endpoint)) throw new Error('Trusted sync endpoint must start with https://');
  if (secret.length < 24) throw new Error('API_SECRET must be at least 24 characters');
  // The Vercel endpoint MUST verify X-Relaython-Sync-Secret against its own
  // server-side API_SECRET environment variable. Never send the service role key.
  // The endpoint MUST perform authorized, idempotent upserts with existing schema
  // and provision portal logins only if absent (never reset passwords).
  var payload = {event:'RELAYTHON',action:'upsertTeam',
    idempotencyKey:'relaython:'+rec.teamId, teamId:rec.teamId,
    teamName:rec.teamName, teamLeaderName:rec.teamLeaderName,
    qrToken:rec.qrToken, qrUrl:rec.qrUrl,provisionPortalIfMissing:true};
  var resp = UrlFetchApp.fetch(endpoint, {
    method:'post',contentType:'application/json',
    headers:{'X-Relaython-Sync-Secret':secret},
    payload:JSON.stringify(payload),muteHttpExceptions:true,followRedirects:false
  });
  var status = resp.getResponseCode();
  if (status < 200 || status >= 300) throw new Error('Portal sync HTTP '+status+' for '+rec.teamId);
  var body;
  try { body = JSON.parse(resp.getContentText() || '{}'); }
  catch (_) { throw new Error('Portal sync response was not valid JSON for '+rec.teamId); }
  if (body.status !== 'SUCCESS' && body.status !== 'ALREADY_EXISTS' && body.status !== 'UNCHANGED')
    throw new Error('Portal API did not confirm successful upsert for '+rec.teamId);
  return {status:body.status};
}
/** Previews which Script Property names would be removed. No values are logged. */
function previewRelaythonPropertyCleanup() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var allowed = ['API_SECRET','SPREADSHEET_ID','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_URL'];
  var remove = Object.keys(props).filter(function(k){ return allowed.indexOf(k) < 0; }).sort();
  var result = { retained: allowed, willRemove: remove,
    newSpreadsheetId: CONFIG.SPREADSHEET_ID,
    warning: 'Removing legacy properties may break other integrations in this Apps Script project. Save a secure backup first.' };
  Logger.log(JSON.stringify(result));
  return result;
}
/**
 * MANUAL ONLY: Keep precisely four Script Properties, changing the sheet ID.
 * Does not touch Supabase tables, Sheets rows, Auth users, or Drive documents.
 * Before running, securely back up all existing Script Properties outside logs.
 */
function applyRelaythonPropertyCleanup() {
  var p = PropertiesService.getScriptProperties();
  var required = ['API_SECRET','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_URL'];
  var missing = required.filter(function(k){return !normalize_(p.getProperty(k));});
  if (missing.length) throw new Error('STOP: Required properties missing: '+missing.join(', '));
  // Validate target spreadsheet and tab before altering any properties.
  getMainSheet_();
  p.setProperty('SPREADSHEET_ID', CONFIG.SPREADSHEET_ID);
  var keep = ['API_SECRET','SPREADSHEET_ID','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_URL'];
  var original = p.getProperties();
  var removed = [];
  Object.keys(original).forEach(function(key){
    if (keep.indexOf(key) === -1) {p.deleteProperty(key); removed.push(key);}
  });
  var finalKeys = Object.keys(p.getProperties()).sort();
  var summary = {status:'DONE', spreadsheetId:CONFIG.SPREADSHEET_ID,
    removedPropertyNames:removed.sort(), remainingPropertyNames:finalKeys,
    warning:'Old integrations requiring removed properties will stop working. Remote Supabase sync still requires a matching configured trusted endpoint.'};
  Logger.log(JSON.stringify(summary));
  return summary;
}
function relaythonSnapshotToSheet_(records) {
  var sh = relaythonPortalSheet_();
  var oldCount = Math.max(0, sh.getLastRow()-1);
  var old = oldCount ? sh.getRange(2,1,oldCount,7).getValues() : [];
  var byToken = {}, usedRows = {}, appended = 0, updated = 0;
  old.forEach(function(r,i) {
    var tok = normalize_(r[5]);
    if (tok && !byToken[tok]) byToken[tok] = i+2;
  });
  records.forEach(function(rec) {
    var vals = [rec.serial,rec.teamId,rec.teamName,rec.teamLeaderName,rec.domain,rec.qrToken,rec.qrUrl];
    var row = byToken[rec.qrToken];
    if (!row) {
      row = sh.getLastRow()+1;
      sh.getRange(row,1,1,7).setValues([vals]);
      byToken[rec.qrToken] = row;
      appended++;
    } else {
      var prev = sh.getRange(row,1,1,7).getValues()[0];
      if (JSON.stringify(prev) !== JSON.stringify(vals)) {
        sh.getRange(row,1,1,7).setValues([vals]); updated++;
      }
    }
    usedRows[row] = true;
  });
  // Deliberately do not delete old rows: mismatches require manual review.
  var historicUnmatched = old.reduce(function(n,r,i) {
    return n + ((normalize_(r[5]) && !usedRows[i+2]) ? 1 : 0);
  },0);
  return {appended:appended,updated:updated,historicUnmatched:historicUnmatched};
}
/** Generates main QR data, updates seven-column mirror, syncs to trusted backend.
 * Safe to retry, but remote endpoint MUST implement idempotent upsert.
 */
function syncRelaythonPortal() {
  return withLock_(function() {
    processRegistrations_(); // cannot call processNewRegistrations: nested lock
    var records = relaythonPortalRecords_();
    var mirror = relaythonSnapshotToSheet_(records);
    var endpoint = portalSyncUrl_();
    var summary = {status:'SUCCESS',event:'RELAYTHON',teams:records.length,
      mirror:mirror,backendConfigured:!!endpoint,backendSuccess:0,backendFailed:0};
    if (!endpoint) {
      summary.status='LOCAL_ONLY_BACKEND_NOT_CONFIGURED';
      Logger.log(JSON.stringify(summary));
      return summary;
    }
    records.forEach(function(rec) {
      try { var pushed = pushRelaythonTeam_(rec); if (pushed.status === 'NOT_CONFIGURED') { summary.backendFailed++; } else { summary.backendSuccess++; } }
      catch(err) { summary.backendFailed++; Logger.log('Relaython portal sync failed for '+rec.teamId+': '+err.message); }
    });
    if (summary.backendFailed) summary.status='PARTIAL_BACKEND_FAILURE';
    Logger.log(JSON.stringify(summary));
    return summary;
  });
}
/** Safe first run: backup existing mirror if present; never delete or overwrite a legacy sheet. */
function setupRelaythonPortal() {
  var ss = getBook_();
  var existing = ss.getSheetByName(CONFIG.PORTAL_SHEET);
  if (existing) {
    var stamp = Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd_HHmmss');
    var copy = existing.copyTo(ss);
    copy.setName('Relaython_Portal_Backup_'+stamp);
  }
  return syncRelaythonPortal();
}
/**
 * RELAYTHON PORTAL_ACCOUNTS QR SYNC FIX — paste at bottom of EXISTING Code.gs.
 * This copies the SAME Team ID / QR TOKEN / QR URL from the MAIN registration
 * tab into PORTAL_ACCOUNTS, so scans won't break due to mismatched tokens.
 * It ONLY updates B, F, G on PORTAL_ACCOUNTS. Other columns stay untouched.
 * The main registration tab remains authoritative: B name C leader G track
 * H team code I token J URL. No remote Supabase writes happen here.
 */
function relaythonFixConfig_() {
  return {
    spreadsheetId: '1jaSyXl4iyhb5XGbXTRmTTszntVdoMD9sitaVT9bSLQE',
    mainTab: 'REGESTRATION VICEVERSE',
    portalTab: 'PORTAL_ACCOUNTS'
  };
}
function relaythonFixNorm_(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g,' ');
}
function relaythonFixTrack_(v) {
  var x = relaythonFixNorm_(v);
  if (['first sem','1st sem','fasem','first semester'].indexOf(x)>=0) return 'first';
  if (['third sem','3rd sem','third semester'].indexOf(x)>=0) return 'third';
  return '';
}
function relaythonFixSheets_() {
  var c=relaythonFixConfig_();
  var book=SpreadsheetApp.openById(c.spreadsheetId);
  var main=book.getSheetByName(c.mainTab);
  var portal=book.getSheetByName(c.portalTab);
  if(!main || !portal) throw new Error('Expected tabs missing. Available tabs: '+book.getSheets().map(function(x){return x.getName();}).join(', '));
  var heads=portal.getRange(1,1,1,7).getDisplayValues()[0].map(relaythonFixNorm_);
  if(heads[1]!=='team id'|| heads[2]!=='team name'||heads[3]!=='team leader'||
     heads[4]!=='domain'||heads[5]!=='qr token'||heads[6]!=='qr url') {
    throw new Error('PORTAL_ACCOUNTS headers changed. STOP: '+heads.join(' | '));
  }
  var mh=main.getRange(1,2,1,6).getDisplayValues()[0].map(relaythonFixNorm_);
  if(mh[0].indexOf('team')<0 || mh[5].indexOf('track')<0) throw new Error('Main registration headers B/G do not match expected layout.');
  return {book:book,main:main,portal:portal};
}
function relaythonFixData_(sheet,width) {
  var count=Math.max(0,sheet.getLastRow()-1);
  return count?sheet.getRange(2,1,count,width).getDisplayValues():[];
}
function relaythonFixBuildPlan_() {
  var ss=relaythonFixSheets_();
  var source=relaythonFixData_(ss.main,11), target=relaythonFixData_(ss.portal,7);
  var byKey={}, ambiguous={};
  source.forEach(function(row,i){
    var name=relaythonFixNorm_(row[1]);
    var track=relaythonFixTrack_(row[6]);
    if(!name || !track) return;
    var key=name+'|'+track;
    if(byKey[key]) ambiguous[key]=true;
    else byKey[key]={row:i+2,name:row[1],leader:row[2],track:track,
      code:String(row[7]||'').trim(),token:String(row[8]||'').trim(),url:String(row[9]||'').trim()};
  });
  var plan=[], warnings=[];
  target.forEach(function(row,i){
    var name=relaythonFixNorm_(row[2]);
    if(!name) return;
    var track=relaythonFixTrack_(row[4]);
    var key=name+'|'+track;
    var src=byKey[key];
    if(!track){warnings.push('Portal row '+(i+2)+': unrecognized DOMAIN');return;}
    if(ambiguous[key]) {warnings.push('Portal row '+(i+2)+': ambiguous team name+track in main sheet');return;}
    if(!src) {warnings.push('Portal row '+(i+2)+': no matching team in main sheet');return;}
    if(relaythonFixNorm_(row[3])!==relaythonFixNorm_(src.leader)) {
      warnings.push('Portal row '+(i+2)+': team leader differs from main; skipped for safety');return;
    }
    var expectedPrefix=track==='first'?/^IVC-RY-1\d\d$/i:/^IVC-RY-2\d\d$/i;
    if(!expectedPrefix.test(src.code)||!/^ryt_[0-9a-f]{48}$/i.test(src.token)||
       src.url.indexOf(encodeURIComponent(src.token))===-1) {
      warnings.push('Portal row '+(i+2)+': source code/token/URL not valid; run processNewRegistrations on main sheet first');return;
    }
    var actual=[String(row[1]||'').trim(),String(row[5]||'').trim(),String(row[6]||'').trim()];
    var wanted=[src.code,src.token,src.url];
    if(JSON.stringify(actual)!==JSON.stringify(wanted)) {
      plan.push({row:i+2,sourceRow:src.row,old:actual,newValues:wanted});
    }
  });
  return {ss:ss,mainRows:source.length,portalRows:target.length,changes:plan,warnings:warnings};
}
/** READ ONLY: Run first. No sheets or tokens are changed. */
function relaythonPreviewPortalQrSync() {
  var p=relaythonFixBuildPlan_();
  var result={status:'PREVIEW',mainRows:p.mainRows,portalRows:p.portalRows,
    rowsToUpdate:p.changes.map(function(x){return x.row;}),warningCount:p.warnings.length,
    warnings:p.warnings.slice(0,30)};
  Logger.log('RELAYTHON PORTAL PREVIEW '+JSON.stringify(result));
  return result;
}
/**
 * Run after review. Creates a full backup tab BEFORE updates.
 * Writes ONLY B (Team ID), F (QR TOKEN), G (QR URL) on PORTAL_ACCOUNTS.
 * Reuses MAIN registration tokens to avoid breaking the main QR images.
 */
function relaythonSyncExistingPortalQr() {
  var lock=LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var p=relaythonFixBuildPlan_();
    if(p.warnings.length) {
      throw new Error('STOP: '+p.warnings.length+' unmatched/unsafe rows. Run relaythonPreviewPortalQrSync and resolve warnings before modifying any rows. First: '+p.warnings[0]);
    }
    if(!p.changes.length){Logger.log('RELAYTHON PORTAL: Already synchronized; 0 cells changed');return {status:'ALREADY_SYNCED',rowsUpdated:0};}
    var copy=p.ss.portal.copyTo(p.ss.book);
    copy.setName('RY_Portal_Backup_'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'MMdd_HHmmss'));
    p.changes.forEach(function(x){
      p.ss.portal.getRange(x.row,2).setValue(x.newValues[0]);
      p.ss.portal.getRange(x.row,6,1,2).setValues([[x.newValues[1],x.newValues[2]]]);
    });
    SpreadsheetApp.flush();
    var result={status:'SHEET_SYNCED',rowsUpdated:p.changes.length,backup:copy.getName(),
      notice:'Supabase and portal logins NOT changed. This only copies main registration codes/tokens/URLs to PORTAL_ACCOUNTS.'};
    Logger.log('RELAYTHON PORTAL '+JSON.stringify(result));
    return result;
  } finally {lock.releaseLock();}
}
/**
 * RELAYTHON: SAFE CLEAN PORTAL MIRROR (ADD-ON ONLY).
 * Paste at bottom of existing working Code.gs. Does not declare CONFIG,
 * doGet, doPost, onEdit, or replace existing functions.
 * SOURCE: 'REGESTRATION VICEVERSE' A:K, including B name C leader G track
 * H team code I QR token J QR URL.
 * DESTINATION: 'RELAYTHON_PORTAL_READY' A:G (7 columns only).
 * Does NOT modify old PORTAL_ACCOUNTS, MAIN registration, Supabase or Auth.
 */
function ryCleanCfg_() {
  return {
    spreadsheetId: '1jaSyXl4iyhb5XGbXTRmTTszntVdoMD9sitaVT9bSLQE',
    source: 'REGESTRATION VICEVERSE',
    target: 'RELAYTHON_PORTAL_READY',
    headers: ['SL NO','TEAM ID','Team Name','Team Leader','DOMAIN','QR TOKEN','QR URL']
  };
}
function ryCleanText_(v) { return String(v == null ? '' : v).trim(); }
function ryCleanKind_(v) {
  var x = ryCleanText_(v).toLowerCase().replace(/\s+/g,' ');
  if (['1st sem','first sem','first semester','fasem'].indexOf(x)>=0) return 'first';
  if (['3rd sem','third sem','third semester'].indexOf(x)>=0) return 'third';
  return '';
}
function ryCleanPlan_() {
  var c = ryCleanCfg_(), ss = SpreadsheetApp.openById(c.spreadsheetId);
  var source = ss.getSheetByName(c.source);
  if (!source) throw new Error('Cannot find source tab: '+c.source+'. Available: '+ss.getSheets().map(function(s){return s.getName();}).join(', '));
  var b1 = ryCleanText_(source.getRange('B1').getDisplayValue()).toLowerCase();
  var g1 = ryCleanText_(source.getRange('G1').getDisplayValue()).toLowerCase();
  if (b1.indexOf('team')<0 || g1.indexOf('track')<0) throw new Error('Wrong source header B1/G1: '+b1+' / '+g1);
  var n = Math.max(0,source.getLastRow()-1);
  var rows = n ? source.getRange(2,1,n,11).getDisplayValues() : [];
  var out=[], errors=[], seenCodes={}, seenTokens={};
  rows.forEach(function(r,i){
    var sheetRow = i+2, name=ryCleanText_(r[1]);
    if (!name) return;
    var kind=ryCleanKind_(r[6]), code=ryCleanText_(r[7]), tok=ryCleanText_(r[8]), url=ryCleanText_(r[9]);
    if (!kind) errors.push('Source row '+sheetRow+': unrecognized track '+ryCleanText_(r[6]));
    if (!/^IVC-RY-(\d+)$/.test(code)) errors.push('Source row '+sheetRow+': invalid Relaython ID');
    else {
      var number=Number(code.split('-')[2]);
      if ((kind==='first' && (number<101||number>=201)) || (kind==='third' && number<201)) errors.push('Source row '+sheetRow+': team ID does not match track');
    }
    if (!/^ryt_[0-9a-f]{48}$/i.test(tok)) errors.push('Source row '+sheetRow+': missing/invalid Relaython token');
    if (!/^https:\/\//i.test(url) || (tok && url.indexOf(encodeURIComponent(tok))<0)) errors.push('Source row '+sheetRow+': URL missing, invalid, or token mismatch');
    if (seenCodes[code]) errors.push('Duplicate Team ID on source rows '+seenCodes[code]+' and '+sheetRow);
    if (seenTokens[tok]) errors.push('Duplicate QR token on source rows '+seenTokens[tok]+' and '+sheetRow);
    seenCodes[code]=sheetRow; seenTokens[tok]=sheetRow;
    out.push([out.length+1,code,name,ryCleanText_(r[2]),ryCleanText_(r[6]),tok,url]);
  });
  return {ss:ss,config:c,records:out,errors:errors,mainRows:rows.length};
}
/** READ ONLY. Run this before generating output. */
function relaythonPreviewCleanPortal() {
  var p=ryCleanPlan_();
  var result={status:'PREVIEW',sourceRows:p.mainRows,validCandidateTeams:p.records.length,
    problemCount:p.errors.length,problems:p.errors.slice(0,30),destination:p.config.target,
    oldPortalAccountsUnchanged:true,supabaseNotChanged:true};
  Logger.log('RELAYTHON CLEAN PORTAL PREVIEW '+JSON.stringify(result));
  return result;
}
/**
 * Creates or safely updates RELAYTHON_PORTAL_READY, never old PORTAL_ACCOUNTS.
 * Refuses to overwrite mismatching or duplicate team codes in existing destination.
 * It creates a sheet backup before updating existing destination rows.
 */
function relaythonBuildCleanPortal() {
  var lock=LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var p=ryCleanPlan_();
    if (p.errors.length) throw new Error('STOP: '+p.errors.length+' source issues. Run relaythonPreviewCleanPortal. First: '+p.errors[0]);
    if (!p.records.length) throw new Error('STOP: source contains no teams');
    var sh=p.ss.getSheetByName(p.config.target), created=false, updated=0, appended=0, backup='';
    if (!sh) {
      sh=p.ss.insertSheet(p.config.target); created=true;
      sh.getRange(1,1,1,7).setValues([p.config.headers]);
      sh.setFrozenRows(1);
    }
    var header=sh.getRange(1,1,1,7).getDisplayValues()[0];
    if (header.join('|')!==p.config.headers.join('|')) throw new Error('STOP: destination has unexpected headers');
    var n=Math.max(0,sh.getLastRow()-1);
    var existing=n?sh.getRange(2,1,n,7).getDisplayValues():[];
    var byCode={}, byToken={};
    existing.forEach(function(r,i){
      var code=ryCleanText_(r[1]),token=ryCleanText_(r[5]);
      if (!code && r.some(function(v){return ryCleanText_(v)!=='';})) throw new Error('STOP: destination row '+(i+2)+' has data without Team ID');
      if (code && byCode[code]) throw new Error('STOP: duplicate destination Team ID '+code);
      if (token && byToken[token] && byToken[token]!==code) throw new Error('STOP: duplicate destination token');
      if (code) byCode[code]=i+2;
      if (token) byToken[token]=code;
    });
    var desiredCodes={};
    p.records.forEach(function(record){
      var code=record[1], token=record[5]; desiredCodes[code]=true;
      if (byToken[token] && byToken[token]!==code) throw new Error('STOP: token collision for '+code);
      if (byCode[code]) {
        var idx=byCode[code]-2, old=existing[idx];
        if (old[5] && old[5]!==token) throw new Error('STOP: existing token differs for '+code+'; investigate before changing IDs');
      }
    });
    var obsolete=Object.keys(byCode).filter(function(code){return !desiredCodes[code];});
    if (obsolete.length) throw new Error('STOP: destination contains '+obsolete.length+' historical Team IDs absent from source; no records changed. First: '+obsolete[0]);
    var changes=[];
    p.records.forEach(function(record){
      var row=byCode[record[1]];
      if (!row) changes.push({action:'append',value:record});
      else if (JSON.stringify(existing[row-2].map(ryCleanText_))!==JSON.stringify(record.map(ryCleanText_))) changes.push({action:'update',row:row,value:record});
    });
    if (changes.length && !created) {
      var copy=sh.copyTo(p.ss);
      backup='RY_Clean_Backup_'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'MMdd_HHmmss');
      copy.setName(backup);
    }
    changes.forEach(function(change){
      if (change.action==='append') {sh.appendRow(change.value);appended++;}
      else {sh.getRange(change.row,1,1,7).setValues([change.value]);updated++;}
    });
    SpreadsheetApp.flush();
    var result={status:'SUCCESS',sheet:sh.getName(),teams:p.records.length,created:created,
      appended:appended,updated:updated,backup:backup,
      notice:'No changes to legacy PORTAL_ACCOUNTS, Supabase, Auth or source registration tab.'};
    Logger.log('RELAYTHON CLEAN PORTAL '+JSON.stringify(result));
    return result;
  } finally {lock.releaseLock();}
}
