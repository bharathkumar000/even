/**
 * RELAYTHON 2026 — REGISTRATION-ONLY GOOGLE SHEETS API, VERSION 1
 * ADD this file to EXISTING Apps Script project. It intentionally DOES NOT
 * define doPost(), so existing ViceVerse routes are not overwritten.
 *
 * At the VERY BEGINNING of the ONE existing doPost(e) function:
 *   var relaythonResponse = ry2026HandlePost_(e);
 *   if (relaythonResponse !== null) return relaythonResponse;
 *   // keep existing routing unchanged below
 *
 * Required Script Properties: RY_SCAN_SHARED_SECRET, RY_SPREADSHEET_ID,
 * RY_APPROVAL_SHEET_NAME (REGESTRATION VICEVERSE).
 * Eventra server POST JSON with action:"lookupToken" or "approveRegistration",
 * apiSecret:<same private RY_SCAN_SHARED_SECRET>.
 * No additional spreadsheet is created. For approved scans an audit TAB
 * RELAYTHON_SCAN_LOGS is created within the existing spreadsheet if absent.
 */
var RY2026_CONFIG = Object.freeze({
  spreadsheetId: '1jaSyXl4iyhb5XGbXTRmTTszntVdoMD9sitaVT9bSLQE',
  registryTab: 'RELAYTHON_PORTAL_READY',
  approvalTabDefault: 'REGESTRATION VICEVERSE',
  auditTab: 'RELAYTHON_SCAN_LOGS',
  registrationCol: 12, // L — Morning Registration
  lockTimeoutMs: 15000
});

/** Return null only for unrelated actions; protects all legacy handlers. */
function ry2026HandlePost_(e) {
  var b;
  try {
    if (!e || !e.postData || !e.postData.contents) return null;
    b = JSON.parse(e.postData.contents);
  } catch (err) { return null; }
  if (!b || typeof b !== 'object') return null;
  if (b.action !== 'lookupToken' && b.action !== 'approveRegistration' && b.action !== 'registration') return null;

  var secret = PropertiesService.getScriptProperties().getProperty('RY_SCAN_SHARED_SECRET') || '';
  if (secret.length < 24) return ry2026Reply_({status:'error',code:'CONFIG_MISSING',message:'Relaython secret not configured'});
  if (typeof b.apiSecret !== 'string' || b.apiSecret !== secret) {
    return ry2026Reply_({status:'unauthorized',code:'UNAUTHORIZED',message:'Unauthorized'});
  }

  try {
    if (b.action === 'lookupToken') return ry2026Reply_(ry2026Lookup_(b));
    return ry2026Reply_(ry2026Approve_(b));
  } catch (err) {
    // Do not log body, token, or secret.
    console.error('Relaython handler failed: ' + String(err && err.message || err).slice(0,200));
    return ry2026Reply_({status:'error',code:'RETRYABLE_ERROR',retryable:true,message:'Temporary Google Sheets error'});
  }
}

function ry2026Book_() {
  var id = PropertiesService.getScriptProperties().getProperty('RY_SPREADSHEET_ID') || RY2026_CONFIG.spreadsheetId;
  return SpreadsheetApp.openById(id);
}
function ry2026Norm_(v) { return String(v == null ? '' : v).trim(); }
function ry2026TokenFrom_(b) {
  var token = ry2026Norm_(b.qr_token || b.token || b.qrToken);
  // Accept a fully decoded QR URL only as an input convenience.
  if (/^https?:\/\//i.test(token)) {
    var m = token.match(/[?&]token=([^&#]+)/i);
    if (m) { try { token = decodeURIComponent(m[1]); } catch (ignore) { return ''; } }
  }
  return /^ryt_[A-Za-z0-9_-]{16,120}$/.test(token) ? token : '';
}
function ry2026FindRegistry_(book, token, teamCode) {
  var tab = book.getSheetByName(RY2026_CONFIG.registryTab);
  if (!tab) throw new Error('RELAYTHON_PORTAL_READY missing');
  var last = tab.getLastRow();
  if (last < 2) return null;
  // B=team_code, C=name, D=leader, E=domain, F=QR token.
  var rows = tab.getRange(2, 2, last - 1, 5).getDisplayValues();
  var found = null;
  for (var i=0; i<rows.length; i++) {
    var r = rows[i], code=ry2026Norm_(r[0]), tok=ry2026Norm_(r[4]);
    if (token ? tok === token : code === teamCode) {
      if (teamCode && code !== teamCode) continue;
      if (found) throw new Error('Duplicate registry identity');
      found={team_code:code,team_name:ry2026Norm_(r[1]),leader_name:ry2026Norm_(r[2]),domain:ry2026Norm_(r[3]),qr_token:tok};
    }
  }
  return found;
}

/** Exact read-only match. App API expects status found/not_found. */
function ry2026Lookup_(b) {
  var token = ry2026TokenFrom_(b);
  if (!token) return {status:'error',code:'INVALID_TOKEN',message:'Invalid QR token format'};
  var team = ry2026FindRegistry_(ry2026Book_(),token,'');
  if (!team) return {status:'not_found',message:'No registered Relaython team matched'};
  return {status:'found',team_code:team.team_code,team_name:team.team_name,
    leader_name:team.leader_name,domain:team.domain,qr_token:team.qr_token};
}

/** Server-side approved registration; updates ONLY approval column L. */
function ry2026Approve_(b) {
  if (b.action_type && b.action_type !== 'registration')
    return {status:'error',code:'REGISTRATION_ONLY',message:'Only registration is active'};
  var scanId=ry2026Norm_(b.scan_id);
  var teamCode=ry2026Norm_(b.team_code || b.team_id);
  var token=ry2026TokenFrom_(b); // optional for existing Eventra request contract
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scanId))
    return {status:'error',code:'INVALID_SCAN_ID',message:'scan_id must be UUID'};
  if (!/^IVC-RY-\d+$/.test(teamCode))
    return {status:'error',code:'INVALID_TEAM_CODE',message:'Invalid team code'};
  if ((b.qr_token || b.token || b.qrToken) && !token)
    return {status:'error',code:'INVALID_TOKEN',message:'Invalid supplied QR token'};

  var lock=LockService.getScriptLock();
  if (!lock.tryLock(RY2026_CONFIG.lockTimeoutMs))
    return {status:'deferred',retryable:true,message:'Sheet busy; retry later'};
  try {
    var book=ry2026Book_();
    var team=ry2026FindRegistry_(book,token,teamCode);
    if (!team) return {status:'not_found',message:'Team code/token not in registry'};
    // This endpoint trusts only server-authenticated callers; frontend MUST NOT call Apps Script directly.
    var approvalName=PropertiesService.getScriptProperties().getProperty('RY_APPROVAL_SHEET_NAME') || RY2026_CONFIG.approvalTabDefault;
    var sheet=book.getSheetByName(approvalName);
    if (!sheet) return {status:'error',code:'APPROVAL_TAB_MISSING',message:'Approval tab unavailable'};
    var headers=sheet.getRange(1,1,1,11).getDisplayValues()[0];
    var teamCol=0;
    for (var i=0;i<headers.length;i++) {
      var key=ry2026Norm_(headers[i]).toLowerCase().replace(/[\s_-]/g,'');
      if (key==='teamid'||key==='teamcode') { teamCol=i+1;break; }
    }
    if (!teamCol) return {status:'error',code:'TEAM_ID_HEADER_MISSING',message:'Team ID header not found in A:K'};
    var row=0,last=sheet.getLastRow();
    if (last>=2) {
      var cells=sheet.getRange(2,teamCol,last-1,1).getDisplayValues();
      for (var j=0;j<cells.length;j++) {
        if (ry2026Norm_(cells[j][0])===teamCode) {
          if (row) return {status:'error',code:'DUPLICATE_TEAM_IDS',message:'Duplicate team IDs in approval sheet'};
          row=j+2;
        }
      }
    }
    if (!row) return {status:'not_found',message:'Team not present in approval tab'};

    var audit=ry2026Audit_(book);
    var seen=ry2026FindAudit_(audit,scanId);
    if (seen) {
      if (seen.teamCode!==teamCode) return {status:'error',code:'SCAN_ID_CONFLICT',message:'scan_id belongs to another team'};
      return {status:'approved',code:'ALREADY_SYNCED',scan_id:scanId,team_code:teamCode,row:row,column:'L'};
    }
    var target=sheet.getRange(row,RY2026_CONFIG.registrationCol);
    var value=ry2026Norm_(target.getDisplayValue());
    var note=target.getNote() || '';
    if (value && note.indexOf('RY_SCAN_ID='+scanId)===-1)
      return {status:'already_approved',code:'ALREADY_REGISTERED',team_code:teamCode,row:row,column:'L'};

    if (!value) {
      target.setValue('APPROVED');
      target.setNote('RY_SCAN_ID='+scanId+'\nRegistered: '+ry2026Norm_(b.scanned_at).slice(0,40));
      SpreadsheetApp.flush();
    }
    // Recovery: if cell write succeeded but audit append failed, a retry with same
    // scan_id appends the audit record rather than issuing a second registration.
    var safe=function(v){var s=ry2026Norm_(v).slice(0,150);return /^[\s]*[=+@-]/.test(s)?"'"+s:s;};
    audit.appendRow([scanId,teamCode,'registration',safe(b.operator_name||b.operator),safe(b.device_id),safe(b.scanned_at),new Date(),'APPROVED',row]);
    SpreadsheetApp.flush();
    return {status:'approved',code:'APPROVED',scan_id:scanId,team_code:teamCode,row:row,column:'L'};
  } finally { lock.releaseLock(); }
}

function ry2026Audit_(book) {
  var tab=book.getSheetByName(RY2026_CONFIG.auditTab);
  var want=['scan_id','team_code','action_type','operator_name','device_id','scanned_at','received_at','result','approval_row'];
  if (!tab) {
    tab=book.insertSheet(RY2026_CONFIG.auditTab);
    tab.getRange(1,1,1,want.length).setValues([want]);
    tab.setFrozenRows(1);
  } else {
    var got=tab.getRange(1,1,1,want.length).getDisplayValues()[0];
    if (got.join('|')!==want.join('|'))
      throw new Error('Audit tab header mismatch; refusing to overwrite existing layout');
  }
  return tab;
}
function ry2026FindAudit_(tab,scanId) {
  var last=tab.getLastRow(); if(last<2)return null;
  var found=tab.getRange(2,1,last-1,1).createTextFinder(scanId).matchEntireCell(true).findNext();
  return found?{teamCode:ry2026Norm_(tab.getRange(found.getRow(),2).getDisplayValue())}:null;
}
function ry2026Reply_(v) {
  return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);
}

/** Read-only setup diagnostic. Run this from Apps Script dropdown. */
function relaythonFinalSetupCheck() {
  var p=PropertiesService.getScriptProperties(),book=ry2026Book_();
  var registry=book.getSheetByName(RY2026_CONFIG.registryTab);
  var approval=book.getSheetByName(p.getProperty('RY_APPROVAL_SHEET_NAME')||RY2026_CONFIG.approvalTabDefault);
  var ids=approval?approval.getRange(1,1,1,11).getDisplayValues()[0]:[];
  console.log(JSON.stringify({spreadsheetName:book.getName(),registryExists:!!registry,
    registryRows:registry?Math.max(0,registry.getLastRow()-1):0,
    approvalTabExists:!!approval,teamIDHeaders:ids,
    columnLHeader:approval?approval.getRange('L1').getDisplayValue():null,
    secretConfigured:(p.getProperty('RY_SCAN_SHARED_SECRET')||'').length>=24}));
}

/** Safe read-only self-test; never logs the real QR token. */
function relaythonFinalLookupSelfTest() {
  var book=ry2026Book_(),tab=book.getSheetByName(RY2026_CONFIG.registryTab);
  if (!tab || tab.getLastRow()<2) throw new Error('Registry empty or missing');
  var token=ry2026Norm_(tab.getRange(2,6).getDisplayValue());
  var out=ry2026Lookup_({token:token});
  console.log(JSON.stringify({status:out.status,team_code:out.team_code||null,
    token_length:token.length,token_logged:false}));
  if (out.status!=='found') throw new Error('First registry token lookup failed');
}
