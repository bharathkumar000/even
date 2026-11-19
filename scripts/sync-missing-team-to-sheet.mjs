import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

if (!supabaseUrl || !supabaseKey || !webhookUrl) {
  console.error('Missing configuration in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncTeamGlitch() {
  console.log('Fetching Team Glitch from Supabase...');
  const { data: reg, error } = await supabase
    .from('team_registrations')
    .select('*')
    .eq('team_name', 'Team Glitch')
    .single();

  if (error || !reg) {
    console.error('Error finding Team Glitch:', error);
    return;
  }

  const members = Array.isArray(reg.members) ? reg.members : [];
  const d2 = members[0] || {};
  const d3 = members[1] || {};
  const d4 = members[2] || {};

  const sheetPayload = {
    teamName: reg.team_name,
    track: reg.track || 'GRAND PRIX',
    teamCode: reg.generated_credentials?.teamCode || 'IVC-RY-007',
    status: 'Pending',
    decisionAt: reg.created_at,
    rejectionReason: '',

    // Driver 1 (Leader)
    leaderName: reg.leader_name || '',
    leaderEmail: reg.leader_email || '',
    leaderPhone: reg.leader_phone || reg.payment_phone || '',
    leaderCollege: reg.leader_college || '',
    leaderUsn: reg.leader_usn || '',
    leaderBranch: reg.leader_branch || '',
    leaderSem: reg.leader_sem || '',

    // Driver 2
    driver2Name: d2.name || '',
    driver2Email: d2.email || '',
    driver2Phone: d2.phone || '',
    driver2College: d2.college || '',
    driver2Usn: d2.usn || '',
    driver2Branch: d2.branch || '',
    driver2Sem: d2.sem || '',

    // Driver 3
    driver3Name: d3.name || '',
    driver3Email: d3.email || '',
    driver3Phone: d3.phone || '',
    driver3College: d3.college || '',
    driver3Usn: d3.usn || '',
    driver3Branch: d3.branch || '',
    driver3Sem: d3.sem || '',

    // Driver 4
    driver4Name: d4.name || '',
    driver4Email: d4.email || '',
    driver4Phone: d4.phone || '',
    driver4College: d4.college || '',
    driver4Usn: d4.usn || '',
    driver4Branch: d4.branch || '',
    driver4Sem: d4.sem || '',

    // Payment
    transactionId: reg.payment_utr || '',
    paymentPhone: reg.payment_phone || '',
    paymentProofUrl: reg.payment_proof_url && !reg.payment_proof_url.startsWith('data:') ? reg.payment_proof_url : '',
    paymentProofBase64: reg.payment_proof_url && reg.payment_proof_url.startsWith('data:') ? reg.payment_proof_url : undefined,

    // Credentials
    loginPassword: '',
    portalUrl: '',
    whatsappGroup: 'https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld',
    emailDispatchStatus: 'PENDING_APPROVAL',
    sheetName: 'Registrations',
  };

  console.log(`Sending Team Glitch (Code: ${sheetPayload.teamCode}) to Google Sheets Webhook...`);
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sheetPayload),
    redirect: 'follow',
  });

  const resText = await res.text();
  console.log(`Webhook Response (Status ${res.status}):`, resText);
}

syncTeamGlitch();
