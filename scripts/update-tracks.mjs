import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSupabaseTracks() {
  console.log('Fetching registrations from Supabase...');
  const { data: regs, error } = await supabase.from('team_registrations').select('id, team_name, leader_sem, track');
  if (error) {
    console.error('Error fetching registrations:', error.message);
    return;
  }

  for (const r of regs) {
    const sem = String(r.leader_sem || '').toLowerCase();
    const newTrack = sem.includes('3') ? '3rd Sem' : '1st Sem';
    
    const { error: updErr } = await supabase
      .from('team_registrations')
      .update({ track: newTrack })
      .eq('id', r.id);

    if (updErr) {
      console.error(`Failed to update track for ${r.team_name}:`, updErr.message);
    } else {
      console.log(`Updated ${r.team_name} (Sem: ${r.leader_sem}): track -> "${newTrack}"`);
    }
  }

  console.log('All Supabase registrations updated with 1st Sem / 3rd Sem track!');
}

updateSupabaseTracks();
