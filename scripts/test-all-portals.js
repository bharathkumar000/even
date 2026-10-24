const { createClient } = require('@supabase/supabase-js');
const http = require('http');

try { process.loadEnvFile('.env.local'); } catch {}
try { process.loadEnvFile('.env'); } catch {}

// Load Supabase credentials from environment variables (do NOT commit actual keys)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

if (!SUPABASE_URL) {
  throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL');
}
if (!ANON_KEY) {
  throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}
if (!SERVICE_KEY) {
  throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });



// Helper to make HTTP request to Next.js dev server with optional cookies
function requestPage(path, cookies = []) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const headers = {};
    if (cookies.length > 0) {
      headers['Cookie'] = cookies.join('; ');
    }

    const start = Date.now();
    const req = http.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          path,
          statusCode: res.statusCode,
          headers: res.headers,
          durationMs: Date.now() - start,
          bodySnippet: body.slice(0, 300),
          is500: res.statusCode === 500,
          isError: res.statusCode >= 400 && res.statusCode !== 401 && res.statusCode !== 403,
          body
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        path,
        statusCode: 0,
        durationMs: Date.now() - start,
        error: err.message,
        isError: true,
      });
    });
  });
}

// Convert Supabase session into Next.js Supabase SSR cookie headers
function getSessionCookies(session) {
  if (!session) return [];
   const projectRef = (() => {
     const match = SUPABASE_URL && SUPABASE_URL.match(/^https:\/\/([^.]*)\.supabase\.co/);
     return match ? match[1] : '';
   })();
   const cookieName = `sb-${projectRef}-auth-token`;

  const sessionData = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user,
  });

  const base64Data = Buffer.from(sessionData).toString('base64');
  return [`${cookieName}=${base64Data}`];
}

async function runTestSuite() {
  console.log('='.repeat(80));
  console.log('  IVC-PULSE COMPREHENSIVE END-TO-END PLATFORM TEST SUITE');
  console.log('  Target: ' + BASE_URL);
  console.log('='.repeat(80));

  const testReport = [];

  // ==========================================
  // PHASE 1: DATABASE & METRICS AUDIT
  // ==========================================
  console.log('\n[PHASE 1] Checking Database Tables & Records...');
  const [
    { count: teamsCount, data: teamsSample, error: teamsErr },
    { count: profilesCount, data: profilesSample, error: profErr },
    { count: roundsCount, data: roundsSample, error: roundsErr },
    { count: criteriaCount, error: critErr },
    { count: evalsCount, error: evalsErr },
    { count: resultsCount, error: resErr },
    { count: spocCount, error: spocErr }
  ] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name, track, code, leader_name', { count: 'exact' }).limit(3),
    supabaseAdmin.from('profiles').select('id, email, full_name, role', { count: 'exact' }).limit(5),
    supabaseAdmin.from('evaluation_rounds').select('id, title, status, sequence_order', { count: 'exact' }).limit(3),
    supabaseAdmin.from('evaluation_criteria').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('evaluations').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('event_results').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('spoc_assignments').select('id', { count: 'exact', head: true })
  ]);

  console.log(`  ✓ Teams: ${teamsCount} (Error: ${teamsErr?.message || 'None'})`);
  console.log(`  ✓ Profiles: ${profilesCount} (Error: ${profErr?.message || 'None'})`);
  console.log(`  ✓ Evaluation Rounds: ${roundsCount} (Error: ${roundsErr?.message || 'None'})`);
  console.log(`  ✓ Scoring Criteria: ${criteriaCount} (Error: ${critErr?.message || 'None'})`);
  console.log(`  ✓ Evaluations: ${evalsCount} (Error: ${evalsErr?.message || 'None'})`);
  console.log(`  ✓ Event Results: ${resultsCount} (Error: ${resErr?.message || 'None'})`);
  console.log(`  ✓ SPOC Assignments: ${spocCount} (Error: ${spocErr?.message || 'None'})`);

  // ==========================================
  // PHASE 2: PUBLIC ROUTES TEST
  // ==========================================
  console.log('\n[PHASE 2] Testing Public Routes...');
  const publicRoutes = ['/login', '/signup', '/event-details', '/event-flow'];
  for (const route of publicRoutes) {
    const res = await requestPage(route);
    const passed = res.statusCode === 200;
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${route} -> Status ${res.statusCode} (${res.durationMs}ms)`);
    testReport.push({ portal: 'Public', route, status: res.statusCode, pass: passed, time: res.durationMs });
  }

  // ==========================================
  // PHASE 3: USER AUTHENTICATION AUDIT ACROSS ROLES
  // ==========================================
  console.log('\n[PHASE 3] Testing Authentication For All 5 Roles...');
  
  // Find accounts for each role
  const { data: allProfiles } = await supabaseAdmin.from('profiles').select('id, email, role, full_name');
  const roleAccounts = {
    admin: 'admin@ivc.com',
    judge: 'judge.arvind@ivc.pulse',
    staff: 'staff.aman@ivc.pulse',
    leader: 'lead.team1@ivc.pulse',
    participant: 'member1.team1@ivc.pulse',
  };

  console.log('  Identified Role Credentials:');
  for (const [r, email] of Object.entries(roleAccounts)) {
    console.log(`    - ${r.toUpperCase()}: ${email}`);
  }

  const roleSessions = {};
  const passwordsToTry = ['Password@123', 'Password123!', '123'];

  for (const [role, email] of Object.entries(roleAccounts)) {
    let session = null;
    for (const pwd of passwordsToTry) {
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password: pwd });
      if (data?.session) {
        session = data.session;
        break;
      }
    }
    roleSessions[role] = session;
    console.log(`  ${session ? '✓' : '✗'} Login [${role.toUpperCase()}]: ${session ? 'Authenticated' : 'Auth Failed'}`);
  }

  // ==========================================
  // PHASE 4: ADMIN PORTAL TESTING (/admin/*)
  // ==========================================
  console.log('\n[PHASE 4] Testing Admin Portal Features (/admin/*)...');
  const adminCookies = getSessionCookies(roleSessions.admin);
  const adminRoutes = [
    '/admin',
    '/admin/users',
    '/admin/assignments',
    '/admin/spoc',
    '/admin/rounds',
    '/admin/evaluations',
    '/admin/results',
    '/admin/audit-logs',
  ];

  for (const route of adminRoutes) {
    const res = await requestPage(route, adminCookies);
    const passed = res.statusCode === 200 || (res.statusCode === 307 && !res.bodySnippet.includes('Internal Server Error'));
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${route} -> Status ${res.statusCode} (${res.durationMs}ms)`);
    if (res.is500) {
      console.log(`      ERROR 500 Snippet: ${res.bodySnippet}`);
    }
    testReport.push({ portal: 'Admin', route, status: res.statusCode, pass: passed, time: res.durationMs });
  }

  // ==========================================
  // PHASE 5: JUDGE PORTAL TESTING (/judge/*)
  // ==========================================
  console.log('\n[PHASE 5] Testing Judge Portal Features (/judge/*)...');
  const judgeCookies = getSessionCookies(roleSessions.judge);
  const sampleTeamId = teamsSample?.[0]?.id || '22222222-2222-2222-2222-222222222222';
  const judgeRoutes = [
    '/judge',
    '/judge/rubrics',
    '/judge/results',
    `/judge/evaluate/${sampleTeamId}`,
  ];

  for (const route of judgeRoutes) {
    const res = await requestPage(route, judgeCookies);
    const passed = res.statusCode === 200;
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${route} -> Status ${res.statusCode} (${res.durationMs}ms)`);
    if (res.is500) {
      console.log(`      ERROR 500 Snippet: ${res.bodySnippet}`);
    }
    testReport.push({ portal: 'Judge', route, status: res.statusCode, pass: passed, time: res.durationMs });
  }

  // ==========================================
  // PHASE 6: OPERATIONS DESK TESTING (/ops/*)
  // ==========================================
  console.log('\n[PHASE 6] Testing Operations Desk Features (/ops/*)...');
  const staffCookies = getSessionCookies(roleSessions.staff);
  const opsRoutes = [
    '/ops/scanner',
    '/ops/judges-roster',
  ];

  for (const route of opsRoutes) {
    const res = await requestPage(route, staffCookies);
    const passed = res.statusCode === 200;
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${route} -> Status ${res.statusCode} (${res.durationMs}ms)`);
    if (res.is500) {
      console.log(`      ERROR 500 Snippet: ${res.bodySnippet}`);
    }
    testReport.push({ portal: 'Operations', route, status: res.statusCode, pass: passed, time: res.durationMs });
  }

  // ==========================================
  // PHASE 7: TEAM PORTAL TESTING (/team/*)
  // ==========================================
  console.log('\n[PHASE 7] Testing Team Portal Features (/team/*)...');
  const leaderCookies = getSessionCookies(roleSessions.leader);
  const teamRoutes = [
    '/team',
    '/team/qr',
    '/team/submission',
    '/team/results',
  ];

  for (const route of teamRoutes) {
    const res = await requestPage(route, leaderCookies);
    const passed = res.statusCode === 200;
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${route} -> Status ${res.statusCode} (${res.durationMs}ms)`);
    if (res.is500) {
      console.log(`      ERROR 500 Snippet: ${res.bodySnippet}`);
    }
    testReport.push({ portal: 'Team', route, status: res.statusCode, pass: passed, time: res.durationMs });
  }

  // ==========================================
  // PHASE 8: SERVER ACTIONS & API TEST
  // ==========================================
  console.log('\n[PHASE 8] Testing Core API Actions & Logic...');
  
  // 1. Team scan roster lookup
  const { data: memberLookup, error: memErr } = await supabaseAdmin
    .from('team_members')
    .select('id, user_id, role, name, email')
    .eq('team_id', sampleTeamId);
  console.log(`  ✓ Scan Lookup for Team ${sampleTeamId}: Found ${memberLookup?.length || 0} members (Err: ${memErr?.message || 'None'})`);

  // 2. Activity logs stream
  const { data: streamLogs, error: streamErr } = await supabaseAdmin
    .from('event_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(`  ✓ Activity Log Stream: Fetched ${streamLogs?.length || 0} recent scan events (Err: ${streamErr?.message || 'None'})`);

  // 3. Announcements
  const { data: announcements, error: annErr } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .limit(5);
  console.log(`  ✓ Announcements: Fetched ${announcements?.length || 0} alerts (Err: ${annErr?.message || 'None'})`);

  // 4. Evaluation Criteria check
  const { data: openRounds } = await supabaseAdmin
    .from('evaluation_rounds')
    .select('id, title, status')
    .eq('status', 'open');
  console.log(`  ✓ Open Rounds for Judging: ${openRounds?.length || 0} active`);

  // ==========================================
  // FINAL SCORECARD
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log('  TEST SCORECARD & SUMMARY');
  console.log('='.repeat(80));
  const passedCount = testReport.filter(r => r.pass).length;
  const totalCount = testReport.length;
  console.log(`Total Routes Tested : ${totalCount}`);
  console.log(`Passed              : ${passedCount}`);
  console.log(`Failed              : ${totalCount - passedCount}`);
  console.log(`Overall Health      : ${Math.round((passedCount / totalCount) * 100)}%`);
  console.log('='.repeat(80));

  return { testReport, passedCount, totalCount };
}

runTestSuite().catch(err => {
  console.error('Fatal Test Runner Exception:', err);
  process.exit(1);
});
