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
