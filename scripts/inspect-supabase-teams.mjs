import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSupabase() {
  console.log('--- Inspecting Supabase team_registrations ---');
  const { data: regs, error } = await supabase.from('team_registrations').select('*');
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  for (const r of regs) {
    console.log({
      id: r.id,
      team_name: r.team_name,
      status: r.status,
      team_code: r.team_code,
      login_username: r.login_username,
      creds_teamCode: r.generated_credentials?.teamCode,
      creds_username: r.generated_credentials?.username
    });
  }

  console.log('\n--- Inspecting Supabase teams table ---');
  const { data: teams, error: tErr } = await supabase.from('teams').select('*');
  if (!tErr && teams) {
    for (const t of teams) {
      console.log({
        id: t.id,
        name: t.name,
        code: t.code
      });
    }
  }
}

inspectSupabase();
