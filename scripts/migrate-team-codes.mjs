import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('No supabase credentials found in .env.local');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndMigrate() {
  console.log('Checking Supabase team_registrations for IVC-VV- prefix...');
  const { data: regs, error } = await supabase.from('team_registrations').select('id, team_name, generated_credentials');
  if (error) {
    console.error('Error fetching registrations:', error.message);
    return;
  }

  console.log(`Found ${regs.length} total registrations.`);
  let updatedCount = 0;
  for (const r of regs) {
    let creds = r.generated_credentials || {};

    if (creds.teamCode && creds.teamCode.includes('IVC-VV-')) {
      const oldCode = creds.teamCode;
      creds.teamCode = creds.teamCode.replace('IVC-VV-', 'IVC-RY-');

      const { error: updErr } = await supabase
        .from('team_registrations')
        .update({
          generated_credentials: creds
        })
        .eq('id', r.id);

      if (updErr) {
        console.error(`Failed to update ${r.team_name}:`, updErr.message);
      } else {
        console.log(`Updated registration ${r.team_name}: ${oldCode} -> ${creds.teamCode}`);
        updatedCount++;
      }
    }
  }

  // Also check teams table
  const { data: teams, error: teamsErr } = await supabase.from('teams').select('id, name, code');
  if (!teamsErr && teams) {
    for (const t of teams) {
      if (t.code && t.code.includes('IVC-VV-')) {
        const newTeamCode = t.code.replace('IVC-VV-', 'IVC-RY-');
        await supabase.from('teams').update({ code: newTeamCode }).eq('id', t.id);
        console.log(`Updated team in 'teams' table: ${t.name}: ${t.code} -> ${newTeamCode}`);
      }
    }
  }

  console.log(`Migration complete! Successfully updated ${updatedCount} registrations to IVC-RY- prefix.`);
}

checkAndMigrate();
