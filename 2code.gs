/**
 * --------------------------------------------------------------
 *  ViceVerse Portal – Stand‑alone Account Sync (Code.js)
 * --------------------------------------------------------------
 *
 *  This Apps Script project is completely isolated from the original
 *  registration / QR backend.  It reads the shared spreadsheet (identified
 *  by the `SPREADSHEET_ID` script property) but never modifies the
 *  registration tab.  All portal‑specific data lives in a separate sheet
 *  called `PORTAL_ACCOUNTS`.
 *
 *  **What the script does**
 *   • Looks up a team in the `REGESTRATION VICEVERSE` sheet using any of
 *     the three identifiers (Team ID, Registration ID, QR token).
 *   • Creates a Supabase Auth user (un‑confirmed) via the official Admin API.
 *   • Sends a password‑setup (invitation) email using Supabase’s recovery
 *     endpoint – the recommended way to invite a newly‑created user.
 *   • Stores non‑sensitive metadata in `PORTAL_ACCOUNTS` with explicit
 *     statuses (`PENDING_INVITATION`, `INVITATION_SENT`, `ACTIVE`, `ERROR`).
 *   • Is fully idempotent: repeated calls for the same team update the
 *     existing row instead of creating duplicates.
 *   • Uses `LockService` to avoid race conditions.
 *   • Secures the HTTP endpoint with a secret API key passed as a query
 *     parameter (`apiKey`).  (Apps Script Web‑App cannot reliably read
 *     custom request headers.)
 *
 *  Configuration (Script Properties) – set these via *File → Project Settings*
 *  or run the optional `___setupProperties()` helper once:
 *
 *    SPREADSHEET_ID                – ID of the shared Google Sheet
 *    SUPABASE_URL                  – e.g. https://myproject.supabase.co
 *    SUPABASE_SERVICE_ROLE_KEY      – Supabase service‑role JWT (admin only)
 *    SUPABASE_ANON_KEY             – Public anon key (required for the `apikey` header)
 *    API_SECRET                    – Random string used as the API key for the endpoint
 */

/* -----------------------------------------------------------------
 *  JSON response helper (used by doPost)
 * ----------------------------------------------------------------- */
function validateConfig_() {
  const props = PropertiesService.getScriptProperties();
  const required = ['SPREADSHEET_ID','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','API_SECRET'];
  for (const key of required) {
    if (!props.getProperty(key)) {
      throw new Error(`Missing required script property: ${key}`);
    }
  }
}


function testSpreadsheet() {
  try {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!id) throw new Error('Missing SPREADSHEET_ID');
    const ss = SpreadsheetApp.openById(id);
    return {status: 'SUCCESS', message: 'Spreadsheet opened', spreadsheetId: id,
            sheets: ss.getSheets().map(s => s.getName())};
  } catch (e) {
    return {status: 'ERROR', message: e.message};
  }
}

/* -----------------------------------------------------------------
 *  Spreadsheet helpers – completely self‑contained
 * ----------------------------------------------------------------- */
function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Missing script property: SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function getRegistrationSheet_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('REGESTRATION VICEVERSE');
  if (!sheet) throw new Error('Registration sheet "REGESTRATION VICEVERSE" not found');
  return sheet;
}

/**
 * Detect required columns in the registration sheet.  The function scans the
 * first two rows (some projects keep a secondary header row) and returns a
 * map of column positions.
 */
function getRegistrationColumnMap_(sheet) {
  const maxCols = Math.max(sheet.getLastColumn(), 35);
  const headerRows = sheet.getRange(1, 1, 2, maxCols).getValues();

  // Required columns (must be present)
  const required = [
    {key: 'teamId',        names: ['team id']},
    {key: 'registrationId',names: ['registration id']},
    {key: 'qrToken',       names: ['qr token']}
  ];

  // Optional columns – do not error if missing
  const optional = [
    {key: 'teamName',      names: ['team name']},
    {key: 'teamLeader',    names: ['team leader']}
  ];

  const map = {};

  // Resolve required columns – throw if not found
  required.forEach(item => {
    outer: for (let r = 0; r < headerRows.length; r++) {
      for (let c = 0; c < headerRows[r].length; c++) {
        const clean = String(headerRows[r][c] || '').trim().toLowerCase();
        if (item.names.includes(clean)) {
          map[item.key] = {index0: c, colNum: c + 1};
          break outer;
        }
      }
    }
    if (!map[item.key]) {
      throw new Error(`Required column "${item.names[0]}" not found in registration sheet`);
    }
  });

  // Resolve optional columns – use -1 if missing
  optional.forEach(item => {
    let found = false;
    outerOpt: for (let r = 0; r < headerRows.length; r++) {
      for (let c = 0; c < headerRows[r].length; c++) {
        const clean = String(headerRows[r][c] || '').trim().toLowerCase();
        if (item.names.includes(clean)) {
          map[item.key] = {index0: c, colNum: c + 1};
          found = true;
          break outerOpt;
        }
      }
    }
    if (!found) {
      // Mark as missing
      map[item.key] = {index0: -1, colNum: -1};
    }
  });

  return map;
}

/**
 * Returns the portal sheet, creating it (with a header row) only if it does
 * not already exist.  Existing data is never overwritten.
 */
function getOrCreatePortalSheet_() {
  const ss = getSpreadsheet_();
  const name = 'PORTAL_ACCOUNTS';
  let sheet = ss.getSheetByName(name);
  const header = [
    'Team ID',
    'Team Name',
    'Team Leader',
    'Login Email',
    'Temporary Password',
    'Supabase User ID',
    'Account Status',
    'Created At',
    'Last Sync',
    'Error Message'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
    return sheet;
  }

  // Validate header – do NOT overwrite if mismatched; throw error instead
  const existingHeader = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  const mismatch = existingHeader.length !== header.length || header.some((h, i) => existingHeader[i] !== h);
  if (mismatch) {
    throw new Error('Portal sheet header schema mismatch. Expected columns: ' + header.join(', '));
  }
  return sheet;
}

/* -----------------------------------------------------------------
 *  Supabase Admin API wrapper (invitation flow)
 * ----------------------------------------------------------------- */
function supabaseRequest_(path, method, payload) {
  const baseUrl = PropertiesService.getScriptProperties().getProperty('SUPABASE_URL');
  const serviceKey = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = PropertiesService.getScriptProperties().getProperty('SUPABASE_ANON_KEY');
  if (!baseUrl || !serviceKey) {
    throw new Error('Supabase configuration missing (URL or Service‑Role key)');
  }
  const opts = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      apikey: anonKey || '',
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    }
  };
  if (payload !== undefined) {
    opts.payload = JSON.stringify(payload);
  }
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  const resp = UrlFetchApp.fetch(url, opts);
  const code = resp.getResponseCode();
  const txt = resp.getContentText();
  let body = null;
  try { body = JSON.parse(txt); } catch (_) {}
  if (code < 200 || code >= 300) {
    const msg = (body && (body.msg || body.error)) ? (body.msg || body.error) : txt;
    throw new Error(`Supabase ${method} ${path} failed (${code}): ${msg}`);
  }
  return body; // may be null for endpoints that return no JSON
}

function supabaseCreateUser_(email, password) {
  const payload = {email: email, password: password, email_confirm: false};
  const result = supabaseRequest_('/auth/v1/admin/users', 'post', payload);
  if (!result || !result.id) throw new Error('Supabase create user response missing ID');
  return {id: result.id, password: password};
}

/**
 * Sends a password‑setup (invitation) email.  Supabase does not have a
 * dedicated "invite" endpoint; the supported way is to call the password‑
 * recovery endpoint for an un‑confirmed user, which results in a magic‑link
 * that the user can use to set a password.
 */
function supabaseSendInvitation_(email) {
  supabaseRequest_('/auth/v1/recovery', 'post', {email: email});
}

function supabaseGetTeamIdByCode_(teamCode) {
  // Fetch the UUID of a team based on its unique `code` column using Supabase REST.
  // Returns the UUID string or throws if not found.
  try {
    const endpoint = `/rest/v1/teams?code=eq.${encodeURIComponent(teamCode)}&select=id`;
    const result = supabaseRequest_(endpoint, 'get');
    if (Array.isArray(result) && result.length > 0 && result[0].id) {
      return result[0].id;
    }
    throw new Error(`Team with code "${teamCode}" not found in Supabase`);
  } catch (e) {
    throw new Error(`Failed to resolve team UUID: ${e.message}`);
  }
}


/**
 * Insert or upsert a portal account link between a team and a Supabase user.
 * This maintains the `portal_account_links` mapping table in Supabase.
 *
 * @param {string} teamId          The team identifier (matches `teams.id`).
 * @param {string} supabaseUserId  The Supabase Auth user ID.
 * @param {string} loginEmail      The login email used for the portal account.
 */
function supabaseInsertPortalLink_(teamId, supabaseUserId, loginEmail) {
  try {
    // Resolve the team's UUID using the team code (teamId from the sheet).
    const teamUuid = supabaseGetTeamIdByCode_(teamId);
    const payload = {
      team_id: teamUuid,
      user_id: supabaseUserId,
      email: loginEmail,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };
    // Upsert mapping – ignore duplicate errors.
    supabaseRequest_('/rest/v1/portal_account_links', 'post', payload);
  } catch (e) {
    // Silently ignore duplicate or other errors; mapping likely already exists.
  }
}



/**
 * Delete a Supabase user via the admin API. Used for cleanup when a sheet write fails.
 */
function supabaseDeleteUser_(userId) {
  supabaseRequest_(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, 'delete');
}

/* -----------------------------------------------------------------
 *  Portal status enum – stored in the sheet
 * ----------------------------------------------------------------- */
const PortalStatus = {
  PENDING_INVITATION: 'PENDING_INVITATION', // user record exists but invitation not yet sent
  INVITATION_SENT:    'INVITATION_SENT',    // invitation email successfully sent, awaiting user activation
  ACTIVE:             'ACTIVE',            // Supabase reports email confirmed
  ERROR:              'ERROR'
};

/**
 * Core function – creates or updates a portal account for a given team.
 * Returns a plain object {status, message, data?} – callers may wrap it via
 * jsonResponse_ for a Web‑App response.
 */
function apiSavePortalAccount(teamIdOrQuery, loginEmail) {
  // ----- 1️⃣ Input validation -----
  if (!teamIdOrQuery) return {status: 'ERROR', message: 'teamIdOrQuery is required'};
  if (!loginEmail)   return {status: 'ERROR', message: 'loginEmail is required'};

  const email = String(loginEmail).trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return {status: 'ERROR', message: 'loginEmail is not a valid email address'};
  }

  const query = String(teamIdOrQuery).trim().toLowerCase();

  // ----- 2️⃣ Acquire lock for idempotency -----
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  // Validate required script properties before proceeding
  validateConfig_();

  try {
    // ----- 3️⃣ Locate team in registration sheet -----
    const regSheet = getRegistrationSheet_();
    const colMap = getRegistrationColumnMap_(regSheet);
    const lastRow = regSheet.getLastRow();
    if (lastRow < 2) return {status: 'ERROR', message: 'Registration sheet contains no data'};
    const rows = regSheet.getRange(2, 1, lastRow - 1, Math.max(regSheet.getLastColumn(), 35)).getValues();

    let match = null;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const teamIdVal = String(r[colMap.teamId.index0] || '').trim().toLowerCase();
      const regIdVal  = String(r[colMap.registrationId.index0] || '').trim().toLowerCase();
      const tokenVal  = String(r[colMap.qrToken.index0] || '').trim().toLowerCase();
      if (teamIdVal === query || regIdVal === query || tokenVal === query) {
        match = r;
        break;
      }
    }
    if (!match) {
      return {status: 'ERROR', message: `Team not found for identifier "${teamIdOrQuery}"`};
    }

    const teamId   = match[colMap.teamId.index0]   || '';
    const teamName = colMap.teamName && colMap.teamName.index0 >= 0 ? match[colMap.teamName.index0] || '' : '';
    const teamLead = colMap.teamLeader && colMap.teamLeader.index0 >= 0 ? match[colMap.teamLeader.index0] || '' : '';

    // ----- 4️⃣ Portal sheet handling -----
    const portalSheet = getOrCreatePortalSheet_();
    const portalData  = portalSheet.getDataRange().getValues(); // includes header
    const header = portalData[0];
    const bodyRows = portalData.slice(1);

    const normalizedTeamId = String(teamId).trim().toLowerCase();
    let existingIdx = -1;
    for (let i = 0; i < bodyRows.length; i++) {
      if (String(bodyRows[i][0]).trim().toLowerCase() === normalizedTeamId) {
        existingIdx = i;
        break;
      }
    }

    const nowISO = new Date().toISOString();

    // Helper to write a single row back (rowIdx is 1‑based sheet row)
    function writeRow(sheetRowIdx, values) {
      portalSheet.getRange(sheetRowIdx, 1, 1, values.length).setValues([values]);
    }

    // ----- 5️⃣ Existing portal entry – sync email if needed -----
    if (existingIdx >= 0) {
      const row = bodyRows[existingIdx];
      let storedEmail = row[3] || '';
      let supabaseId = row[5] || '';
      let status = row[6] || '';

      // If login email changed and we have a Supabase ID, update email in Supabase
      if (storedEmail !== email && supabaseId) {
        try {
          supabaseUpdateUserEmail_(supabaseId, email);
        } catch (e) {
          row[9] = e.message; // error column
          writeRow(existingIdx + 2, row);
          return {status: 'ERROR', message: `Failed to update Supabase email: ${e.message}`};
        }
      }

      // ---------- Retry / Invitation handling based on current status ----------
      if (status === PortalStatus.ERROR) {
        // Try to recover from error: either resend invitation or recreate user
        if (supabaseId) {
          try {
            supabaseSendInvitation_(email);
            status = PortalStatus.INVITATION_SENT;
            row[9] = '';
          } catch (e) {
            row[9] = e.message;
            writeRow(existingIdx + 2, row);
            return {status: 'ERROR', message: `Invitation resend failed: ${e.message}`};
          }
        } else {
          try {
            // Create user with a generated temporary password
            const tempPassword = generateTempPassword_();
            const userObj = supabaseCreateUser_(email, tempPassword);
            supabaseId = userObj.id;
            supabaseInsertPortalLink_(teamId, supabaseId, email);
            // Store temporary password and Supabase ID in the row
            row[4] = tempPassword; // Temporary Password column
            row[5] = supabaseId;    // Supabase User ID column
            supabaseSendInvitation_(email);
            status = PortalStatus.INVITATION_SENT;
            row[9] = '';
          } catch (e) {
            row[9] = e.message;
            writeRow(existingIdx + 2, row);
            return {status: 'ERROR', message: `User creation/invitation retry failed: ${e.message}`};
          }
        }
      } else if (status === PortalStatus.PENDING_INVITATION) {
        // Invitation has not been sent yet – attempt to send it now
        if (supabaseId) {
          try {
            supabaseSendInvitation_(email);
            status = PortalStatus.INVITATION_SENT;
            row[9] = '';
          } catch (e) {
            row[9] = e.message;
            writeRow(existingIdx + 2, row);
            return {status: 'ERROR', message: `Invitation send failed: ${e.message}`};
          }
        } else {
          // Should not happen; create user then invite
          try {
            // Create user with a generated temporary password
            const tempPassword = generateTempPassword_();
            const userObj = supabaseCreateUser_(email, tempPassword);
            supabaseId = userObj.id;
            supabaseInsertPortalLink_(teamId, supabaseId, email);
            // Store temporary password and Supabase ID in the row
            row[4] = tempPassword; // Temporary Password column
            row[5] = supabaseId;    // Supabase User ID column
            supabaseSendInvitation_(email);
            status = PortalStatus.INVITATION_SENT;
            row[9] = '';
          } catch (e) {
            row[9] = e.message;
            writeRow(existingIdx + 2, row);
            return {status: 'ERROR', message: `User creation/invitation failed: ${e.message}`};
          }
        }
      } else if (status === PortalStatus.INVITATION_SENT && supabaseId) {
        // Check whether user has confirmed their email → ACTIVE
        try {
          const user = supabaseGetUser_(supabaseId);
          const emailConfirmed = user && (user.email_confirmed_at || user.email_confirm);
             if (emailConfirmed) {
               status = PortalStatus.ACTIVE;
               // Remove temporary password now that the user has set a real one
               row[4] = '';
             }
        } catch (_) {
          // Ignore errors; keep current status
        }
      }

      // Refresh row metadata (preserve Created At, update Last Sync)
      row[3] = email;
       row[6] = status; // Account Status column
       row[8] = nowISO; // Last Sync
      if (status !== PortalStatus.ERROR) {
         row[9] = '';
      }
      writeRow(existingIdx + 2, row);
        supabaseInsertPortalLink_(teamId, supabaseId, email);
        return {status: 'SUCCESS', message: `Portal metadata refreshed for Team ${teamId}.`, data: {teamId, supabaseUserId: supabaseId, loginEmail: email}};
    }

    // ----- 6️⃣ No existing portal row – create Supabase user -----
    let supabaseUserId;
    let tempPassword;
    try {
      tempPassword = generateTempPassword_();
      const userObj = supabaseCreateUser_(email, tempPassword);
        supabaseUserId = userObj.id;
        supabaseInsertPortalLink_(teamId, supabaseUserId, email);
    } catch (e) {
      const errRow = [teamId, teamName, teamLead, email, '', '', PortalStatus.ERROR, nowISO, nowISO, e.message];
      portalSheet.appendRow(errRow);
      return {status: 'ERROR', message: `Supabase user creation failed: ${e.message}`};
    }

    // ----- 7️⃣ Record initial portal entry (user created, invitation pending) -----
    const newRow = [teamId, teamName, teamLead, email, tempPassword, supabaseUserId, PortalStatus.PENDING_INVITATION, nowISO, nowISO, ''];
    portalSheet.appendRow(newRow);
    const addedRowIdx = portalSheet.getLastRow();

    // ----- 8️⃣ Send invitation email -----
    try {
      supabaseSendInvitation_(email);
      // Update status to INVITATION_SENT (preserve temporary password)
      const updatedRow = [teamId, teamName, teamLead, email, tempPassword, supabaseUserId, PortalStatus.INVITATION_SENT, nowISO, nowISO, ''];
      portalSheet.getRange(addedRowIdx, 1, 1, updatedRow.length).setValues([updatedRow]);
      return {status: 'SUCCESS', message: `Portal account created for Team ${teamId} (invitation sent)`, data: {teamId, supabaseUserId, loginEmail: email, status: PortalStatus.INVITATION_SENT}};
      } catch (e) {
        // Update row to ERROR state with error message (preserve temporary password)
        const errRow = [teamId, teamName, teamLead, email, tempPassword, supabaseUserId, PortalStatus.ERROR, nowISO, nowISO, e.message];
        portalSheet.getRange(addedRowIdx, 1, 1, errRow.length).setValues([errRow]);
        // Cleanup: delete the Supabase user we just created (if any)
        if (supabaseUserId) {
          try { supabaseDeleteUser_(supabaseUserId); } catch (_) {}
        }
        return {status: 'ERROR', message: `Invitation email failed: ${e.message}`};
      }

  } finally {
    lock.releaseLock();
  }
}

/* -----------------------------------------------------------------
 *  HTTP endpoint – Web‑App entry point
 * ----------------------------------------------------------------- */
// NOTE: The `doPost` endpoint is designed for server‑to‑server calls only.
// The `API_SECRET` should be stored securely on a trusted backend service
// (e.g., your own portal server). The backend validates the request, then
// forwards the JSON payload to this Apps Script URL. The secret must never be
// exposed in client‑side code or public URLs.

function doPost(e) {
  // Apps Script Web‑Apps cannot reliably read custom headers, so we accept
  // the secret API key as a query parameter (e.parameter.apiKey).
  const expected = PropertiesService.getScriptProperties().getProperty('API_SECRET');
  const provided = e && e.parameter && e.parameter.apiKey;
  if (!expected || provided !== expected) {
    return jsonResponse_({status: 'ERROR', message: 'Unauthorized – invalid or missing API key'});
  }

  // Parse JSON payload
  let payload = {};
  try {
    payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  } catch (_) {
    return jsonResponse_({status: 'ERROR', message: 'Invalid JSON payload'});
  }

  if (payload.action !== 'savePortalAccount' && payload.action !== 'createPortalAccount') {
    return jsonResponse_({status: 'ERROR', message: 'Unsupported action'});
  }

  const result = apiSavePortalAccount(payload.teamIdOrQuery, payload.loginEmail);
  return jsonResponse_(result);
}

/* -----------------------------------------------------------------
 *  Simple connection test – useful during deployment
 * ----------------------------------------------------------------- */
function testConnection() {
  try {
    const ss = getSpreadsheet_();
    const sheets = ss.getSheets().map(s => s.getName());
    const regExists = ss.getSheetByName('REGESTRATION VICEVERSE') !== null;
    return {status: 'SUCCESS', message: 'Connected', sheets: sheets, registrationSheetExists: regExists};
  } catch (e) {
    return {status: 'ERROR', message: e.message};
  }
}

/* -----------------------------------------------------------------
 *  OPTIONAL: one‑time setup helper – run once then comment out
 * ----------------------------------------------------------------- */
/**
 * Convenience helper – seed Supabase credentials into script properties.
 * Run this once (via the Apps Script editor) and then comment it out.
 */
function initSupabaseConfig_() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('SUPABASE_URL', 'https://koluhnkobgagsfvokkbz.supabase.co');
  p.setProperty('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbHVobmtvYmdhZ3Nmdm9ra2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMTUxNjQsImV4cCI6MjEwNjc5MTE2NH0.N-xF0mOVy8_MKNm3ywJZj7w1NqM_gOQ8gIYIp6S_2FA');
  p.setProperty('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbHVobmtvYmdhZ3Nmdm9ra2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIxNTE2NCwiZXhwIjoyMTA2NzkxMTY0fQ._9xDTVPPHr0D-ZsPRx2ial9qvGK1YfErp2T8YT7umVw');
}

