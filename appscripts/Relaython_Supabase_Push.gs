/**
 * RELAYTHON -> existing Supabase project, direct server-to-server QR registry sync.
 * ADD to Code.gs as-is. No CONFIG redeclaration. No hard-coded secrets.
 * Requires Script Properties: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Run Relaython SQL once in the existing Supabase SQL Editor before syncing.
 * Does NOT create portal login accounts or change existing public.teams records.
 */
var RY_PUSH = Object.freeze({
  spreadsheetId: '1jaSyXl4iyhb5XGbXTRmTTszntVdoMD9sitaVT9bSLQE',
  sheetName: 'RELAYTHON_PORTAL_READY',
  table: 'relaython_qr_registry',
  batchSize: 20
});
function ryBook_() {return SpreadsheetApp.openById(RY_PUSH.spreadsheetId);}
function ryRows_() {
  var sh = ryBook_().getSheetByName(RY_PUSH.sheetName);
  if (!sh) throw new Error('Missing sheet: '+RY_PUSH.sheetName);
  var n = sh.getLastRow();
  if (n < 2) throw new Error('No Relaython teams in '+RY_PUSH.sheetName);
  var rows = sh.getRange(1,1,n,7).getDisplayValues();
  var want = ['SL NO','TEAM ID','Team Name','Team Leader','DOMAIN','QR TOKEN','QR URL'];
  if (rows[0].map(function(x){return x.trim().toLowerCase();}).join('|') !== want.map(function(x){return x.toLowerCase();}).join('|'))
    throw new Error('Unexpected headers: expected '+want.join(' | '));
  var out=[], usedCodes={},usedTokens={},skipped=0;
  rows.slice(1).forEach(function(r,i){
    var rowNum=i+2;
    if (!r.some(function(x){return String(x).trim();})) {skipped++;return;}
    var code=r[1].trim(), name=r[2].trim(), leader=r[3].trim(), domain=r[4].trim(), token=r[5].trim(), url=r[6].trim();
    if (!code || !name || !leader || !domain || !token || !url) throw new Error('Incomplete required data in row '+rowNum);
    var m=/^IVC-RY-(\d+)$/.exec(code);
    if (!m || +m[1]<101 || +m[1]>999) throw new Error('Invalid team code at row '+rowNum);
    // 101..199 First Sem, 201..299 Third Sem. Stop if a track spills into other range.
    // If a track exceeds 99 teams, assign a noncolliding range in a future version.
    if (domain!=='1st Sem' && domain!=='3rd Sem') throw new Error('Invalid DOMAIN at row '+rowNum+': '+domain);
    if ((domain==='1st Sem' && (+m[1]<101 || +m[1]>=200)) ||
        (domain==='3rd Sem' && (+m[1]<201 || +m[1]>=300))) throw new Error('Track/code mismatch at row '+rowNum);
    if (!/^ryt_[a-f0-9]{32,}$/i.test(token)) throw new Error('Invalid Relaython token in row '+rowNum);
    if (!/^https:\/\//i.test(url)) throw new Error('Invalid QR URL at row '+rowNum);
    var found=url.match(/[?&]token=([^&#]+)/);
    if (!found || decodeURIComponent(found[1])!==token) throw new Error('URL/token mismatch row '+rowNum);
    if (usedCodes[code] || usedTokens[token]) throw new Error('Duplicate team code or token in row '+rowNum);
    usedCodes[code]=true;usedTokens[token]=true;
    out.push({team_code:code,team_name:name,leader_name:leader,domain:domain,
      qr_token:token,qr_url:url,source_spreadsheet_id:RY_PUSH.spreadsheetId});
  });
  if (!out.length) throw new Error('No complete teams to sync');
  return {records:out,emptyRows:skipped};
}
function ryConfig_() {
  var p=PropertiesService.getScriptProperties();
  var url=(p.getProperty('SUPABASE_URL')||'').replace(/\/+$/,'');
  var key=p.getProperty('SUPABASE_SERVICE_ROLE_KEY')||'';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing/invalid');
  return {url:url,key:key};
}
function ryRequest_(method,path,payload,prefer) {
  var c=ryConfig_();
  var opts={method:method, muteHttpExceptions:true,contentType:'application/json',
    headers:{apikey:c.key,Authorization:'Bearer '+c.key}};
  if (prefer) opts.headers.Prefer=prefer;
  if (payload!==undefined) opts.payload=JSON.stringify(payload);
  var res=UrlFetchApp.fetch(c.url+'/rest/v1/'+path,opts);
  var code=res.getResponseCode(),body=res.getContentText();
  if (code<200 || code>=300) {
    // Avoid logging returned bodies: they may contain private record data.
    throw new Error('Supabase REST HTTP '+code+' on '+method+' '+path.split('?')[0]+'. Check table/RLS/schema and Supabase API logs.');
  }
  return body ? JSON.parse(body):[];
}
function relaythonPreviewSupabasePush() {
  var r=ryRows_();ryConfig_();
  var out={status:'PREVIEW',sheet:RY_PUSH.sheetName,validTeams:r.records.length,emptyRows:r.emptyRows,
    firstTeam:r.records[0].team_code,lastTeam:r.records[r.records.length-1].team_code,
    writesPerformed:0};
  Logger.log(JSON.stringify(out));return out;
}
/** Verify remote conflicts before any writes; stop on changed code->token mapping. */
function ryCheckRemote_(records) {
  for(var i=0;i<records.length;i+=RY_PUSH.batchSize){
    var block=records.slice(i,i+RY_PUSH.batchSize);
    var codes=block.map(function(x){return '"'+x.team_code+'"';}).join(',');
    var remote=ryRequest_('get',RY_PUSH.table+'?select=team_code,qr_token&team_code=in.('+encodeURIComponent(codes)+')',undefined);
    var local={};block.forEach(function(x){local[x.team_code]=x.qr_token;});
    remote.forEach(function(x){
      if (local[x.team_code] && local[x.team_code]!==x.qr_token)
        throw new Error('STOP: Supabase already has different QR token for '+x.team_code+'. No writes have been performed.');
    });
  }
}
function relaythonPushToSupabase() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw new Error('Another Relaython sync is in progress');
  try {
    var r=ryRows_(), records=r.records;
    ryConfig_();
    ryCheckRemote_(records);
    var sent=0;
    for(var i=0;i<records.length;i+=RY_PUSH.batchSize){
      var batch=records.slice(i,i+RY_PUSH.batchSize);
      ryRequest_('post',RY_PUSH.table+'?on_conflict=team_code',batch,'resolution=merge-duplicates,return=minimal');
      sent+=batch.length;
      Logger.log('RELAYTHON Supabase registry push progress: '+sent+'/'+records.length);
    }
    var result={status:'SUCCESS',table:RY_PUSH.table,recordsUpserted:sent,
      portalLoginsCreated:0,existingTeamsModified:0,note:'QR registry only. Scanner backend must read this table.'};
    Logger.log(JSON.stringify(result));return result;
  }finally{lock.releaseLock();}
}
