/**
 * RELAYTHON — Google Sheets registration + QR + SPOC check-in backend
 * Version: 2026-11-23
 *
 * MAIN SHEET: A serial, B team, C leader, D/E/F members 2/3/4,
 * G track, H team code, I token, J QR URL, K QR image.
 * Check-ins are stored in a separate "Relaython_Checkins" tab.
 *
 * Copy this script into the Apps Script bound to your COPIED sheet.
 * Set SHEET_NAME and CHECKIN_PAGE_URL below. If using a standalone script,
 * also set SPREADSHEET_ID to the NEW copy's ID (never the ViceVerse sheet).
 */

var CONFIG = {
  SPREADSHEET_ID: '',  // Blank for sheet-bound script; otherwise NEW copied spreadsheet ID
  SHEET_NAME: 'FINAL-V1', // Change to your copied sheet's actual tab name
  CHECKIN_SHEET: 'Relaython_Checkins',
  REGISTRY_SHEET: 'Relaython_Registration_Keys',
  CHECKIN_PAGE_URL: 'https://eventra-ivc.vercel.app/checkin', // Confirm Relaython URL
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
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Set CONFIG.SPREADSHEET_ID to your NEW sheet ID for standalone/web-app execution.');
  return book;
}
function getMainSheet_() {
  var book = getBook_();
  var s = book.getSheetByName(CONFIG.SHEET_NAME);
  if (!s) throw new Error('Sheet tab "' + CONFIG.SHEET_NAME + '" missing; update CONFIG.SHEET_NAME.');
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
function processNewRegistrations() { return withLock_(processRegistrations_); }
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
    .addItem('Generate / update QR codes', 'processNewRegistrations')
    .addItem('Run read-only diagnostics', 'showRelaythonDiagnostics')
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
  ScriptApp.newTrigger('processNewRegistrations').timeBased().everyMinutes(5).create();
  return 'Relaython auto-processing enabled. onEdit is automatic in a bound script.';
}
function disableAutoProcessing() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (['onRelaythonChange', 'processNewRegistrations'].indexOf(t.getHandlerFunction()) !== -1)
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
