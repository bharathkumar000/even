/**
 * VICEVERSE PORTAL BACKEND
 *
 * Source: REGESTRATION VICEVERSE (read-only)
 * Destination: PORTAL_ACCOUNTS
 *
 * Required Script Properties:
 * SPREADSHEET_ID
 * SUPABASE_SERVICE_ROLE_KEY
 * API_SECRET
 *
 * Optional:
 * SUPABASE_URL
 *
 * Run enableAutoProcessing() once to install the five-minute trigger.
 */

const VV = {
  SUPABASE_URL: 'https://koluhnkobgagsfvokkbz.supabase.co',
  SOURCE_TAB: 'REGESTRATION VICEVERSE',
  PORTAL_TAB: 'PORTAL_ACCOUNTS',
  HEADERS: [
    'Team ID',
    'Team Name',
    'Team Leader',
    'username',
    'Password',
    'Supabase User ID',
    'Account Status',
    'Created At',
    'Last Sync',
    'Error Message'
  ],
  PASSWORD_PREFIX: 'VV_PASSWORD_'
};

/* ================= CONFIGURATION ================= */

function vvConfig_() {
  const p = PropertiesService.getScriptProperties();

  const c = {
    spreadsheetId: p.getProperty('SPREADSHEET_ID'),
    url: (p.getProperty('SUPABASE_URL') || VV.SUPABASE_URL)
      .replace(/\/+$/, ''),
    key: p.getProperty('SUPABASE_SERVICE_ROLE_KEY'),
    apiSecret: p.getProperty('API_SECRET')
  };

  ['spreadsheetId', 'key', 'apiSecret'].forEach(function(k) {
    if (!c[k]) {
      throw new Error('Missing Script Property: ' + k);
    }
  });

  return c;
}

function vvSS_() {
  return SpreadsheetApp.openById(vvConfig_().spreadsheetId);
}

function vvSource_() {
  const s = vvSS_().getSheetByName(VV.SOURCE_TAB);

  if (!s) {
    throw new Error('Source tab not found: ' + VV.SOURCE_TAB);
  }

  return s;
}

function vvPortal_() {
  const ss = vvSS_();
  let sheet = ss.getSheetByName(VV.PORTAL_TAB);

  if (!sheet) {
    sheet = ss.insertSheet(VV.PORTAL_TAB);
  }

  const expected = VV.HEADERS.map(function (v) {
    return String(v).trim().toLowerCase();
  });

  const current = sheet
    .getRange(1, 1, 1, VV.HEADERS.length)
    .getDisplayValues()[0]
    .map(function (v) {
      return String(v || '').trim().toLowerCase();
    });

  const matches = expected.every(function (v, i) {
    return current[i] === v;
  });

  if (!matches) {
    sheet.getRange(1, 1, 1, VV.HEADERS.length)
      .setValues([VV.HEADERS]);
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
    console.log('PORTAL_ACCOUNTS headers repaired.');
  }

  return sheet;
}

/* ================= SOURCE REGISTRATIONS ================= */

function vvNorm_(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function vvCol_(headers, aliases) {
  const a = aliases.map(vvNorm_);

  for (let i = 0; i < headers.length; i++) {
    if (a.indexOf(vvNorm_(headers[i])) !== -1) {
      return i;
    }
  }

  return -1;
}

function vvRegistrations_() {
  const sheet = vvSource_();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    throw new Error('Source registration sheet is empty.');
  }

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function (h) {
      return String(h || '').trim().toLowerCase();
    });

  function col(name) {
    return headers.indexOf(name.toLowerCase());
  }

  const teamNameCol = col('Team Name');
  const teamIdCol = col('Team ID');
  const leaderCol = col('Team Leader');
  const emailCol = col('Email');
  const trackCol = col('SELECTED DOMAIN');
  const qrCol = col('QR Token');

  if (teamNameCol < 0 || teamIdCol < 0) {
    throw new Error(
      'Required source headers missing. Found: ' +
      headers.join(' | ')
    );
  }

  if (lastRow < 2) return [];

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastCol)
    .getDisplayValues();

  const registrations = [];

  values.forEach(function (row, index) {
    const teamName = String(row[teamNameCol] || '').trim();
    const teamId = String(row[teamIdCol] || '').trim();

    // Ignore completely empty registration rows.
    if (!teamName && !teamId) return;

    // Ignore incomplete rows instead of creating accounts for them.
    if (!teamName || !teamId) {
      console.log(
        'Skipping incomplete source row ' + (index + 2) +
        ': Team ID=' + teamId + ', Team Name=' + teamName
      );
      return;
    }

    registrations.push({
      sourceRow: index + 2,
      teamId: teamId,
      teamName: teamName,
      leader: leaderCol < 0
        ? ''
        : String(row[leaderCol] || '').trim(),
      email: emailCol < 0
        ? ''
        : String(row[emailCol] || '').trim().toLowerCase(),
      track: trackCol < 0
        ? ''
        : String(row[trackCol] || '').trim(),
      registrationId: '',
      qrToken: qrCol < 0
        ? ''
        : String(row[qrCol] || '').trim()
    });
  });

  const seen = {};

  registrations.forEach(function (registration) {
    const key = registration.teamId.toLowerCase();

    if (seen[key]) {
      throw new Error(
        'Duplicate Team ID "' + registration.teamId +
        '" at source rows ' + seen[key] +
        ' and ' + registration.sourceRow
      );
    }

    seen[key] = registration.sourceRow;
  });

  console.log(
    'Source registrations found: ' + registrations.length
  );

  return registrations;
}

/* ================= USERNAME AND PASSWORD ================= */

function vvRandom_(n) {
  const limit = Math.floor(256 / n) * n;

  while (true) {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + ':' + Utilities.getUuid(),
      Utilities.Charset.UTF_8
    );

    for (let i = 0; i < bytes.length; i++) {
      const x = bytes[i] & 255;

      if (x < limit) return x % n;
    }
  }
}

function vvPassword_() {
  let s = '';

  for (let i = 0; i < 4; i++) {
    s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(vvRandom_(26));
  }

  for (let j = 0; j < 4; j++) {
    s += String(vvRandom_(10));
  }

  return s;
}

function vvUsername_(name) {
  let slug = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!slug) slug = 'team';

  return 'ivc-' + slug;
}

function vvPasswordKey_(teamId) {
  return VV.PASSWORD_PREFIX +
    Utilities.base64EncodeWebSafe(String(teamId))
      .replace(/=+$/g, '');
}

function vvGetSavedPassword_(teamId) {
  return PropertiesService.getScriptProperties()
    .getProperty(vvPasswordKey_(teamId)) || '';
}

function vvSavePassword_(teamId, password) {
  PropertiesService.getScriptProperties()
    .setProperty(vvPasswordKey_(teamId), password);
}

/* ================= SUPABASE HTTP ================= */

function vvSB_(path, method, body, prefer) {
  const c = vvConfig_();

  const headers = {
    apikey: c.key,
    Authorization: 'Bearer ' + c.key,
    'Content-Type': 'application/json'
  };

  if (prefer) headers.Prefer = prefer;

  const options = {
    method: String(method || 'get').toLowerCase(),
    headers: headers,
    muteHttpExceptions: true
  };

  if (body !== undefined) {
    options.payload = JSON.stringify(body);
  }

  const response = UrlFetchApp.fetch(c.url + path, options);
  const status = response.getResponseCode();
  const raw = response.getContentText();

  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (e) {
    data = raw;
  }

  if (status < 200 || status >= 300) {
    const msg = data &&
      (data.message ||
       data.msg ||
       data.error_description ||
       data.error ||
       data.details);

    throw new Error(
      'Supabase HTTP ' + status + ' ' + path +
      (msg ? ': ' + String(msg).slice(0, 300) : '')
    );
  }

  return data;
}

function vvAuthList_() {
  let all = [];

  for (let page = 1; page <= 50; page++) {
    const d = vvSB_(
      '/auth/v1/admin/users?page=' + page + '&per_page=100',
      'get'
    );

    const users = d && d.users ? d.users : [];
    all = all.concat(users);

    if (users.length < 100) break;
  }

  return all;
}

function vvAuthByEmail_(email) {
  const e = String(email || '').toLowerCase();

  return vvAuthList_().find(function(u) {
    return String(u.email || '').toLowerCase() === e;
  }) || null;
}

function vvAuthById_(id) {
  const d = vvSB_(
    '/auth/v1/admin/users/' + encodeURIComponent(id),
    'get'
  );

  return d && d.user ? d.user : d;
}

function vvCreateAuth_(t, email, password, username) {
  const d = vvSB_('/auth/v1/admin/users', 'post', {
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      full_name: t.leader || t.teamName,
      role: 'leader',
      team_id: t.teamId,
      team_name: t.teamName,
      username: username
    }
  });

  if (!d || !d.id) {
    throw new Error('Supabase did not return a new user ID.');
  }

  return d;
}

function vvSetPassword_(id, password) {
  vvSB_(
    '/auth/v1/admin/users/' + encodeURIComponent(id),
    'put',
    {
      password: password,
      email_confirm: true
    }
  );
}

/* ================= SUPABASE TEAM AND LINKS ================= */

function vvEnsureTeam_(t) {
  const path =
    '/rest/v1/teams?select=id,code,name,leader_name,track' +
    '&code=eq.' + encodeURIComponent(t.teamId);

  const rows = vvSB_(path, 'get') || [];

  if (rows.length > 1) {
    throw new Error('Duplicate Supabase team code: ' + t.teamId);
  }

  if (!rows.length) {
    const body = {
      code: t.teamId,
      name: t.teamName,
      status: 'active'
    };

    if (t.leader) body.leader_name = t.leader;
    if (t.track) body.track = t.track;

    const made = vvSB_(
      '/rest/v1/teams?select=id,code,name,leader_name,track',
      'post',
      body,
      'return=representation'
    );

    if (!made || !made[0] || !made[0].id) {
      throw new Error('Could not create team ' + t.teamId);
    }

    return made[0];
  }

  const old = rows[0];
  const patch = {
    name: t.teamName
  };

  if (t.leader) patch.leader_name = t.leader;
  if (t.track) patch.track = t.track;

  const updated = vvSB_(
    '/rest/v1/teams?id=eq.' + encodeURIComponent(old.id),
    'patch',
    patch,
    'return=representation'
  );

  return updated && updated[0]
    ? updated[0]
    : Object.assign({}, old, patch);
}

function vvGetPortalRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];

  return sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    VV.HEADERS.length
  ).getDisplayValues().map(function(r, i) {
    return {
      r: r,
      n: i + 2
    };
  });
}

function vvFindTeamRow_(rows, teamId) {
  const id = String(teamId || '').trim().toLowerCase();

  if (!id) return null;

  const matches = rows.filter(function(x) {
    return String(x.r[0] || '').trim().toLowerCase() === id;
  });

  if (matches.length > 1) {
    throw new Error(
      'Duplicate PORTAL_ACCOUNTS rows for ' + teamId +
      '. Remove duplicates manually.'
    );
  }

  return matches.length ? matches[0] : null;
}

function vvGetLinkByTeam_(teamId) {
  const rows = vvSB_(
    '/rest/v1/portal_account_links?select=registration_team_id,' +
    'team_id,user_id,login_email,username,account_status' +
    '&registration_team_id=eq.' + encodeURIComponent(teamId),
    'get'
  ) || [];

  if (rows.length > 1) {
    throw new Error(
      'Duplicate Supabase account links for ' + teamId
    );
  }

  return rows[0] || null;
}

function vvGetLinkByUser_(userId) {
  const rows = vvSB_(
    '/rest/v1/portal_account_links?select=registration_team_id,' +
    'team_id,user_id,login_email,username,account_status' +
    '&user_id=eq.' + encodeURIComponent(userId),
    'get'
  ) || [];

  if (rows.length > 1) {
    throw new Error('User is linked to multiple portal teams.');
  }

  return rows[0] || null;
}

function vvEnsureDBLinks_(t, userId, username, team) {
  const email = t.authEmail || t.email;
  const byUser = vvGetLinkByUser_(userId);

  if (
    byUser &&
    String(byUser.registration_team_id).toLowerCase() !==
      t.teamId.toLowerCase()
  ) {
    throw new Error(
      'User already linked to ' + byUser.registration_team_id +
      '. No account was moved.'
    );
  }

  const byTeam = vvGetLinkByTeam_(t.teamId);

  if (byTeam && byTeam.user_id !== userId) {
    throw new Error(
      'Team already belongs to a different Supabase user. ' +
      'Manual review required.'
    );
  }

  vvSB_(
    '/rest/v1/profiles?on_conflict=id',
    'post',
    {
      id: userId,
      email: email,
      full_name: t.leader || t.teamName,
      role: 'leader'
    },
    'resolution=merge-duplicates,return=minimal'
  );

  const members = vvSB_(
    '/rest/v1/team_members?select=id&team_id=eq.' +
    encodeURIComponent(team.id) +
    '&user_id=eq.' + encodeURIComponent(userId),
    'get'
  ) || [];

  if (!members.length) {
    vvSB_(
      '/rest/v1/team_members',
      'post',
      {
        team_id: team.id,
        user_id: userId,
        role: 'leader',
        name: t.leader || t.teamName,
        email: email
      },
      'return=minimal'
    );
  }

  const linkBody = {
    team_id: team.id,
    user_id: userId,
    login_email: email,
    username: username,
    account_status: 'active',
    updated_at: new Date().toISOString()
  };

  if (byTeam) {
    vvSB_(
      '/rest/v1/portal_account_links?registration_team_id=eq.' +
      encodeURIComponent(t.teamId),
      'patch',
      linkBody,
      'return=minimal'
    );
  } else {
    linkBody.registration_team_id = t.teamId;

    vvSB_(
      '/rest/v1/portal_account_links',
      'post',
      linkBody,
      'return=minimal'
    );
  }
}

/* ================= ACCOUNT SYNCHRONIZATION ================= */

function vvSyncOne_(t) {
  if (t.validationError) {
    throw new Error(t.validationError);
  }

  if (!t.email) {
    throw new Error(
      'Leader email is required. Add an Email column to the source sheet.'
    );
  }

  const sheet = vvPortal_();
  const rows = vvGetPortalRows_(sheet);
  const old = vvFindTeamRow_(rows, t.teamId);
  const now = new Date().toISOString();

  let username = old && old.r[3]
    ? String(old.r[3]).trim()
    : vvUsername_(t.teamName);

  let password = old && old.r[4]
    ? String(old.r[4]).trim()
    : vvGetSavedPassword_(t.teamId);

  let userId = old && old.r[5]
    ? String(old.r[5]).trim()
    : '';

  const team = vvEnsureTeam_(t);
  const link = vvGetLinkByTeam_(t.teamId);

  if (link) {
    if (userId && link.user_id !== userId) {
      throw new Error(
        'Sheet user ID conflicts with Supabase. Manual review required.'
      );
    }

    userId = link.user_id;

    if (link.username) username = link.username;
  }

  let auth = null;

  if (userId) {
    auth = vvAuthById_(userId);

    if (!auth || !auth.id) {
      throw new Error('Linked Auth user was not found: ' + userId);
    }
  } else {
    auth = vvAuthByEmail_(t.email);

    if (auth) {
      userId = auth.id;

      const existingLink = vvGetLinkByUser_(userId);

      if (
        existingLink &&
        existingLink.registration_team_id.toLowerCase() !==
          t.teamId.toLowerCase()
      ) {
        throw new Error(
          'Email is already linked to ' +
          existingLink.registration_team_id
        );
      }
    } else {
      if (!password) password = vvPassword_();

      auth = vvCreateAuth_(t, t.email, password, username);
      userId = auth.id;
    }
  }

  const authEmail = String(auth.email || t.email).toLowerCase();
  t.authEmail = authEmail;

  /*
   * Password handling:
   * Existing password is preserved when available.
   * Saved backup is used to restore a deleted spreadsheet row.
   * If no password or backup exists, a new password is generated.
   */
  if (!password) {
    password = vvPassword_();
    vvSetPassword_(userId, password);
  }

  vvSavePassword_(t.teamId, password);

  vvEnsureDBLinks_(t, userId, username, team);

  // Prevent the same Auth user from appearing under another team.
  const latest = vvGetPortalRows_(sheet);

  const duplicate = latest.find(function(x) {
    return x.r[5] === userId &&
      String(x.r[0] || '').toLowerCase() !==
        t.teamId.toLowerCase();
  });

  if (duplicate) {
    throw new Error(
      'User ID already appears under another portal team.'
    );
  }

  const created = old && old.r[7] ? old.r[7] : now;

  const row = [
    t.teamId,
    t.teamName,
    t.leader,
    username,
    password,
    userId,
    'ACTIVE',
    created,
    now,
    ''
  ];

  let action;

 
if (old) {
  // Update the existing account in its current position.
  sheet.getRange(
    old.n,
    1,
    1,
    VV.HEADERS.length
  ).setValues([row]);

  action = 'UPDATED_EXISTING_ROW';

} else {
  // Find the first completely empty row beneath the header.
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const existingRows = lastRow > 1
    ? sheet.getRange(
        2,
        1,
        lastRow - 1,
        VV.HEADERS.length
      ).getValues()
    : [];

  let targetRow = 2;

  for (let i = 0; i < existingRows.length; i++) {
    const isEmpty = existingRows[i].every(function (value) {
      return String(value == null ? '' : value).trim() === '';
    });

    if (isEmpty) {
      targetRow = i + 2;
      break;
    }

    targetRow = i + 3;
  }

  sheet.getRange(
    targetRow,
    1,
    1,
    VV.HEADERS.length
  ).setValues([row]);

  SpreadsheetApp.flush();

  action = 'RESTORED_MISSING_ROW';
}


  return {
    status: 'SUCCESS',
    teamId: t.teamId,
    teamUUID: team.id,
    userId: userId,
    username: username,
    action: action
  };
}

/* ================= ERROR LOGGING ================= */

function vvRecordError_(t, error) {
  try {
    const sheet = vvPortal_();
    const rows = vvGetPortalRows_(sheet);
    const old = vvFindTeamRow_(rows, t.teamId || '');
    const now = new Date().toISOString();

    const message = String(
      error && error.message || error
    ).slice(0, 500);

    if (old) {
      const row = old.r;

      row[1] = t.teamName || row[1];
      row[2] = t.leader || row[2];
      row[6] = 'ERROR';
      row[8] = now;
      row[9] = message;

      sheet.getRange(
        old.n,
        1,
        1,
        VV.HEADERS.length
      ).setValues([row]);
    } else {
  const targetRow = vvFindFirstEmptyPortalRow_(sheet);

  sheet.getRange(
    targetRow,
    1,
    1,
    VV.HEADERS.length
  ).setValues([[
    t.teamId || '',
    t.teamName || '',
    t.leader || '',
    vvUsername_(t.teamName),
    '',
    '',
    'ERROR',
    now,
    now,
    message
  ]]);
}
  } catch (e) {
    console.error('Error logging failed: ' + e.message);
  }
}

/* ================= MAIN SYNC ================= */

function processAllRegistrations() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    console.log('Another sync is already running. Skipping this run.');

    return {
      status: 'SKIPPED',
      reason: 'SYNC_ALREADY_RUNNING'
    };
  }

  try {
    const registrations = vvRegistrations_();
    const results = [];

    registrations.forEach(function(t) {
      try {
        results.push(vvSyncOne_(t));
      } catch (e) {
        vvRecordError_(t, e);

        results.push({
          status: 'ERROR',
          teamId: t.teamId || '(missing Team ID)',
          sourceRow: t.sourceRow,
          message: String(e.message || e)
        });
      }
    });

    const summary = {
      status: 'COMPLETED',
      total: results.length,
      succeeded: results.filter(function(x) {
        return x.status === 'SUCCESS';
      }).length,
      failed: results.filter(function(x) {
        return x.status !== 'SUCCESS';
      }).length,
      results: results
    };

    console.log(JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    lock.releaseLock();
  }
}

/* ================= DIAGNOSTICS ================= */

function testConnection() {
  const c = vvConfig_();
  const ss = vvSS_();
  const src = vvSource_();
  const portal = vvPortal_();

  const result = {
    status: 'SUCCESS',
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    registrationTabFound: !!src,
    portalTabFound: !!portal,
    registrations: vvRegistrations_().length,
    supabaseUrl: c.url
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function diagnoseRegistrations() {
  const rows = vvRegistrations_();

  const result = {
    totalRows: rows.length,
    validRows: rows.filter(function(t) {
      return !t.validationError;
    }).length,
    invalidRows: rows.filter(function(t) {
      return !!t.validationError;
    }).map(function(t) {
      return {
        sourceRow: t.sourceRow,
        teamId: t.teamId,
        teamName: t.teamName,
        error: t.validationError
      };
    }),
    note: 'Source tab is read-only.'
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function diagnosePortalDestination() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');

  console.log('SPREADSHEET_ID property: ' + id);

  if (!id) {
    throw new Error('SPREADSHEET_ID is missing from Script Properties.');
  }

  const ss = SpreadsheetApp.openById(id);

  console.log('Spreadsheet name: ' + ss.getName());
  console.log('Spreadsheet URL: ' + ss.getUrl());

  console.log('Tabs: ' + JSON.stringify(
    ss.getSheets().map(function(sheet) {
      return {
        name: sheet.getName(),
        lastRow: sheet.getLastRow(),
        lastColumn: sheet.getLastColumn()
      };
    })
  ));

  const portal = ss.getSheetByName(VV.PORTAL_TAB);

  if (!portal) {
    throw new Error(
      'PORTAL_ACCOUNTS does not exist in this spreadsheet.'
    );
  }

  console.log(
    'PORTAL_ACCOUNTS headers: ' +
    JSON.stringify(
      portal.getRange(1, 1, 1, portal.getLastColumn())
        .getDisplayValues()[0]
    )
  );
}

/* ================= AUTOMATION ================= */

function enableAutoProcessing() {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(trigger) {
    if (
      trigger.getHandlerFunction() === 'processAllRegistrations'
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('processAllRegistrations')
    .timeBased()
    .everyMinutes(1)
    .create();

  console.log('Automatic sync enabled: every 1 minutes.');
}

function disableAutoProcessing() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (
      trigger.getHandlerFunction() === 'processAllRegistrations'
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  console.log('Automatic sync disabled.');
}


/**
 * Reconcile registrations removed from the source sheet.
 * Deletes stale ViceVerse Auth accounts and portal-account links.
 * Preserves registrations still present in the source sheet.
 */
function reconcileRemovedRegistrations() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    console.log('Another sync is running. Reconciliation skipped.');
    return {
      status: 'SKIPPED',
      reason: 'SYNC_ALREADY_RUNNING'
    };
  }

  try {
    // Read the source registration sheet.
    const registrations = vvRegistrations_();

    if (!Array.isArray(registrations) || registrations.length === 0) {
      throw new Error(
        'Source registrations are empty or unavailable. No deletion performed.'
      );
    }

    // Only consider official ViceVerse registration IDs.
    const activeIds = new Set(
      registrations
        .map(function (registration) {
          return String(registration.teamId || '').trim().toUpperCase();
        })
        .filter(function (id) {
          return /^IVC-VV-\d+$/.test(id);
        })
    );

    if (activeIds.size === 0) {
      throw new Error(
        'No valid IVC-VV registration IDs found. Deletion aborted.'
      );
    }

    // Fetch ALL portal links from Supabase, not PORTAL_ACCOUNTS.
    const links = vvSB_(
      '/rest/v1/portal_account_links?select=registration_team_id,user_id,team_id,login_email,account_status'
    );

    if (!Array.isArray(links)) {
      throw new Error(
        'Could not safely read Supabase portal_account_links. No deletion performed.'
      );
    }

    const results = [];

    links.forEach(function (link) {
      const teamId = String(link.registration_team_id || '')
        .trim()
        .toUpperCase();

      // Never touch accounts outside the ViceVerse ID format.
      if (!/^IVC-VV-\d+$/.test(teamId)) return;

      // Keep every registration that still exists in the source.
      if (activeIds.has(teamId)) return;

      const userId = String(link.user_id || '').trim();

      try {
        // Delete Auth user first. Supabase may cascade linked records.
        if (userId) {
          try {
            vvSB_(
              '/auth/v1/admin/users/' + encodeURIComponent(userId),
              'delete'
            );
          } catch (authError) {
            const message = String(authError.message || authError);

            // If already absent, continue with explicit link cleanup.
            if (!/404|user not found|not found/i.test(message)) {
              throw authError;
            }
          }
        }

        // Explicit cleanup for the portal-account link.
        vvSB_(
          '/rest/v1/portal_account_links?registration_team_id=eq.' +
            encodeURIComponent(teamId),
          'delete'
        );

        results.push({
          teamId: teamId,
          status: 'DELETED',
          userId: userId || null
        });

        console.log('Removed stale portal account: ' + teamId);

      } catch (error) {
        results.push({
          teamId: teamId,
          status: 'ERROR',
          message: String(error.message || error)
        });

        console.error(
          'Failed to remove ' + teamId + ': ' +
          String(error.message || error)
        );
      }
    });

    // Update remaining portal-sheet rows if a stale ID still exists there.
    const portalSheet = vvPortal_();
    const portalRows = vvGetPortalRows_(portalSheet);

    results.forEach(function (result) {
      if (result.status !== 'DELETED') return;

      portalRows.forEach(function (item) {
        const rowTeamId = String(item.r[0] || '')
          .trim()
          .toUpperCase();

        if (rowTeamId !== result.teamId) return;

        item.r[6] = 'DELETED';
        item.r[8] = new Date().toISOString();
        item.r[9] = 'Registration removed from source; Supabase account deleted.';

        portalSheet
          .getRange(item.n, 1, 1, VV.HEADERS.length)
          .setValues([item.r]);
      });
    });

    SpreadsheetApp.flush();

    const summary = {
      status: 'COMPLETED',
      activeSourceRegistrations: activeIds.size,
      supabaseLinksChecked: links.length,
      staleAccountsFound: results.length,
      results: results
    };

    console.log(JSON.stringify(summary, null, 2));
    return summary;

  } finally {
    lock.releaseLock();
  }
}
/*================= WEB APP ENDPOINT ================= */

function doPost(e) {
  try {
    const c = vvConfig_();

    const key = e && e.parameter
      ? String(e.parameter.apiKey || '')
      : '';

    if (!key || key !== c.apiSecret) {
      return vvJson_({
        status: 'ERROR',
        message: 'Unauthorized'
      });
    }

    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    if (body.action === 'testConnection') {
      return vvJson_(testConnection());
    }

    if (body.action === 'syncAll') {
      return vvJson_(processAllRegistrations());
    }

    if (
      body.action === 'createPortalAccount' ||
      body.action === 'savePortalAccount'
    ) {
      const id = String(body.teamIdOrQuery || '')
        .trim()
        .toLowerCase();

      const matches = vvRegistrations_().filter(function(t) {
        return [
          t.teamId,
          t.registrationId,
          t.qrToken
        ].some(function(v) {
          return String(v || '').trim().toLowerCase() === id;
        });
      });

      if (matches.length !== 1) {
        throw new Error(
          'Expected exactly one source registration match; found ' +
          matches.length
        );
      }

      return vvJson_(vvSyncOne_(matches[0]));
    }

    return vvJson_({
      status: 'ERROR',
      message: 'Unsupported action'
    });
  } catch (e) {
    console.error(String(e.stack || e));

    return vvJson_({
      status: 'ERROR',
      message: String(
        e.message || 'Operation failed'
      ).slice(0, 500)
    });
  }
}

function vvJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ================= SPREADSHEET MENU ================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ViceVerse Portal')
    .addItem('Test connection', 'testConnection')
    .addItem('Diagnose registrations', 'diagnoseRegistrations')
    .addItem('Diagnose portal destination', 'diagnosePortalDestination')
    .addItem('Sync all registrations now', 'processAllRegistrations')
    .addSeparator()
    .addItem('Enable automatic sync', 'enableAutoProcessing')
    .addItem('Disable automatic sync', 'disableAutoProcessing')
    .addToUi();
}
function testPortalWrite() {
  const ss = vvSS_();
  const sheet = ss.getSheetByName('PORTAL_ACCOUNTS');

  if (!sheet) {
    throw new Error('PORTAL_ACCOUNTS tab not found');
  }

  sheet.getRange('J1').setValue('WRITE TEST ' + new Date().toISOString());
  SpreadsheetApp.flush();

  console.log('Spreadsheet URL: ' + ss.getUrl());
  console.log('Tab: ' + sheet.getName());
  console.log('J1 value: ' + sheet.getRange('J1').getDisplayValue());
  console.log('Last row: ' + sheet.getLastRow());
}
/**
 * Run this function ONCE to enable automatic syncing.
 * After setup, Apps Script runs the sync every 5 minutes.
 */
function enableRemovedRegistrationReconciliation() {
  const handler = 'reconcileRemovedRegistrations';

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyMinutes(1)
    .create();

  console.log('Automatic removed-registration reconciliation enabled.');
}

function diagnoseSourceHeaders() {
  const sheet = vvSource_();

  const result = {
    sheetName: sheet.getName(),
    lastRow: sheet.getLastRow(),
    lastColumn: sheet.getLastColumn(),
    headers: sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn())
          .getDisplayValues()[0]
      : [],
    sampleRows: sheet.getLastRow() > 1
      ? sheet.getRange(
          2, 1,
          Math.min(sheet.getLastRow() - 1, 5),
          sheet.getLastColumn()
        ).getDisplayValues()
      : []
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
/**
 * Find the first empty data row in PORTAL_ACCOUNTS.
 * Reuses gaps instead of always appending at the bottom.
 */
function vvFindFirstEmptyPortalRow_(sheet) {
  const lastColumn = VV.HEADERS.length;
  const lastRow = Math.max(sheet.getLastRow(), 2);

  // Scan from row 2 down, checking Team ID in column A.
  const teamIds = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues();

  for (let i = 0; i < teamIds.length; i++) {
    if (String(teamIds[i][0] || '').trim() === '') {
      return i + 2;
    }
  }

  return lastRow + 1;
}
function compactPortalAccounts() {
  const sheet = vvPortal_();
  const lastRow = sheet.getLastRow();
  const lastColumn = VV.HEADERS.length;

  if (lastRow < 2) return;

  const data = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  // Keep complete account rows together.
  const accounts = data.filter(function(row) {
    return String(row[0] || '').trim() !== '';
  });

  // Clear the existing data area, then rewrite accounts from row 2.
  sheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent();

  if (accounts.length > 0) {
    sheet.getRange(2, 1, accounts.length, lastColumn)
      .setValues(accounts);
  }

  SpreadsheetApp.flush();

  console.log(JSON.stringify({
    status: 'COMPLETED',
    accountsMoved: accounts.length,
    firstDataRow: accounts.length > 0 ? 2 : null
  }));
}

/**
 * React to edits in either portal spreadsheet tab.
 * Uses an installable trigger so authorized services can run.
 */
function handleViceVerseSheetEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const name = sheet.getName();

  if (
    name !== 'REGESTRATION VICEVERSE' &&
    name !== 'PORTAL_ACCOUNTS'
  ) {
    return;
  }

  // Never write registration data back to the source tab.
  // Sync and reconcile using the existing backend functions.
  if (name === 'REGESTRATION VICEVERSE') {
    processAllRegistrations();
    reconcileRemovedRegistrations();
  } else {
    console.log(
      'PORTAL_ACCOUNTS edited. Changes will be checked by reconciliation.'
    );
  }
}