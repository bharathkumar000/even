import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const getEnv = (key) => {
  const match = envContent.match(new RegExp('^' + key + '=(.*)$', 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : process.env[key];
};

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, key);

async function executeMigration() {
  console.log("=== STARTING TEAM ID SERIES MIGRATION ===");
  console.log("1st Year Track (1st Sem) -> IVC-RY-101+");
  console.log("2nd Year Track (3rd Sem) -> IVC-RY-201+\n");

  const { data: regs, error } = await supabase
    .from('team_registrations')
    .select('id, team_name, team_code, track, status, created_at, leader_name, leader_email, generated_credentials')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching registrations:', error);
    return;
  }

  const { data: teams, error: teamErr } = await supabase
    .from('teams')
    .select('id, name, code, track, leader_name, dietary_preference');

  if (teamErr) {
    console.error('Error fetching teams:', teamErr);
    return;
  }

  const nonTestRegs = regs.filter(r => r.status !== 'test' && !r.team_code?.includes('TEST'));
  const firstSem = nonTestRegs.filter(r => (r.track || '').toLowerCase().includes('1'));
  const thirdSem = nonTestRegs.filter(r => (r.track || '').toLowerCase().includes('3'));

  console.log(`Processing ${firstSem.length} 1st Sem teams and ${thirdSem.length} 3rd Sem teams...`);

  const updates = [];

  // 1. Process 1st Sem
  for (let i = 0; i < firstSem.length; i++) {
    const r = firstSem[i];
    const newCode = `IVC-RY-${String(101 + i).padStart(3, '0')}`;
    updates.push({
      regId: r.id,
      teamName: r.team_name,
      leaderEmail: r.leader_email,
      track: '1st Sem',
      status: r.status,
      newCode: newCode,
      oldCode: r.team_code || r.generated_credentials?.teamCode || '',
      creds: r.generated_credentials || {}
    });
  }

  // 2. Process 3rd Sem
  for (let i = 0; i < thirdSem.length; i++) {
    const r = thirdSem[i];
    const newCode = `IVC-RY-${String(201 + i).padStart(3, '0')}`;
    updates.push({
      regId: r.id,
      teamName: r.team_name,
      leaderEmail: r.leader_email,
      track: '3rd Sem',
      status: r.status,
      newCode: newCode,
      oldCode: r.team_code || r.generated_credentials?.teamCode || '',
      creds: r.generated_credentials || {}
    });
  }

  let updatedRegsCount = 0;
  let updatedTeamsCount = 0;

  for (const u of updates) {
    const updatedCreds = {
      ...u.creds,
      teamCode: u.newCode,
      username: u.creds.username || u.teamName.toLowerCase().replace(/[^a-z0-9]/g, '')
    };

    // Update team_registrations
    const { error: regUpdateErr } = await supabase
      .from('team_registrations')
      .update({
        team_code: u.newCode,
        generated_credentials: updatedCreds
      })
      .eq('id', u.regId);

    if (regUpdateErr) {
      console.error(`Failed to update registration ${u.teamName}:`, regUpdateErr.message);
    } else {
      updatedRegsCount++;
    }

    // Match and update teams table if approved
    const cleanName = u.teamName.toLowerCase().trim();
    const matchedTeam = teams.find(t => {
      const tName = (t.name || '').toLowerCase().trim();
      if (tName === cleanName) return true;
      if (t.code && u.oldCode && t.code.toUpperCase() === u.oldCode.toUpperCase()) return true;
      return false;
    });

    if (matchedTeam) {
      let extra = {};
      try {
        extra = JSON.parse(matchedTeam.dietary_preference || '{}');
      } catch {}
      extra.teamCode = u.newCode;

      const { error: teamUpdateErr } = await supabase
        .from('teams')
        .update({
          code: u.newCode,
          dietary_preference: JSON.stringify(extra)
        })
        .eq('id', matchedTeam.id);

      if (teamUpdateErr) {
        console.error(`Failed to update team ${matchedTeam.name}:`, teamUpdateErr.message);
      } else {
        updatedTeamsCount++;
      }
    }
  }

  console.log(`\n✅ Migration Complete!`);
  console.log(`- Updated ${updatedRegsCount} registrations in 'team_registrations'.`);
  console.log(`- Updated ${updatedTeamsCount} teams in 'teams' table.`);
}

executeMigration().catch(console.error);
