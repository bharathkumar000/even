const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function applyMigration() {
  const fs = require('fs');
  const migrationPath = './supabase/migrations/009_spoc_staff_unification.sql';
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Applying migration 009_spoc_staff_unification.sql...');
  
  // Try using the REST API directly with the service role key
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ sql })
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Failed:', response.status, text);
    
    // Try alternative: use the pg driver directly via a different approach
    // Try the supabase-js v2 method
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error('exec_sql also failed:', error.message);
      } else {
        console.log('Migration applied via exec_sql');
        return;
      }
    } catch (e) {
      console.error('exec_sql exception:', e.message);
    }
  } else {
    console.log('Migration applied via REST API');
    return;
  }
  
  // If all else fails, output the SQL for manual execution
  console.log('\n--- SQL to run manually in Supabase Dashboard ---\n');
  console.log(sql);
}

applyMigration().catch(console.error);
