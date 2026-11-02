import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkAllAuth() {
  let page = 1;
  let allUsers = [];
  
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error("Error:", error);
      break;
    }
    if (!data.users || data.users.length === 0) break;
    
    allUsers.push(...data.users);
    if (data.users.length < 100) break;
    page++;
  }

  console.log(`Total users: ${allUsers.length}`);
  
  const demoEmails = ['admin@demo.com', 'judge@demo.com', 'ops@demo.com', 'team@demo.com'];
  
  for (const user of allUsers) {
    const email = user.email?.toLowerCase();
    const meta = user.user_metadata || {};
    if (demoEmails.includes(email)) {
      console.log(`  ${user.email} -> role: ${meta.role || 'NOT SET'}, name: ${meta.full_name || 'N/A'}`);
    }
  }
}

checkAllUsers().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
