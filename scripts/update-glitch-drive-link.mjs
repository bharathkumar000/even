import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateDriveLink() {
  await supabase
    .from('team_registrations')
    .update({ payment_proof_url: 'https://drive.google.com/file/d/1xE83GWVM6eaFJATuQBEdXqo4lHbgp4fD/view?usp=drivesdk' })
    .eq('team_name', 'Team Glitch');
  console.log('Updated Team Glitch payment_proof_url with Google Drive link in Supabase.');
}

updateDriveLink();
