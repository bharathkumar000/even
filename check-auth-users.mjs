import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkAuthUsers() {
  const { data: listData, error: listError } = await sb.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list users:", listError);
    process.exit(1);
  }

  console.log("Auth users with demo emails:");
  for (const user of listData.users) {
    const email = user.email?.toLowerCase();
    const meta = user.user_metadata || {};
    if (['admin@demo.com', 'judge@demo.com', 'ops@demo.com', 'team@demo.com', 'admin@ivc.pulse', 'judge.arvind@ivc.pulse', 'ops@demo.com', 'team@demo.com'].includes(email)) {
      console.log(`  ${user.email} -> role: ${meta.role || 'NOT SET'}, name: ${meta.full_name || 'N/A'}`);
    }
  }
}

checkAuthUsers().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
