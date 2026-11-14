import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTeamGlitch() {
  const { data: reg, error } = await supabase
    .from('team_registrations')
    .select('*')
    .eq('team_name', 'Team Glitch')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Team Glitch Full Record:');
  console.log(JSON.stringify(reg, null, 2));
}

inspectTeamGlitch();
