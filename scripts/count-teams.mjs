import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getRegisteredTeams() {
  const { data: regs, error } = await supabase
    .from('team_registrations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching registrations:', error.message);
    return;
  }

  console.log(`TOTAL_REGISTRATIONS: ${regs.length}`);
  regs.forEach((r, idx) => {
    console.log(`[${idx + 1}] Team: "${r.team_name}" | Code: ${r.generated_credentials?.teamCode || r.team_code || 'N/A'} | Status: ${r.status} | Leader: ${r.leader_name} (${r.leader_email}) | Sem: ${r.leader_sem || 'N/A'} | Registered: ${r.created_at}`);
  });
}

getRegisteredTeams();
