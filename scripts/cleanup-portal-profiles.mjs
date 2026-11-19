import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
const getEnv = (key) => {
  const match = envText.match(new RegExp("^" + key + "=(.*)$", "m"));
  return match ? match[1].trim() : "";
};

const supabase = createClient(
  getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
);

async function clean() {
  console.log("=== REMOVING ALL PORTAL PROFILES EXCEPT CLUB STAFF AND ADMIN ===");

  // 1. Find all profiles that are not admin or staff
  const { data: allProfiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role");

  if (pErr) {
    console.error("Error reading profiles:", pErr);
    return;
  }

  const toRemove = (allProfiles || []).filter((p) => p.role !== "admin" && p.role !== "staff");
  console.log(`Found ${toRemove.length} non-staff/admin profiles to remove:`, toRemove);

  for (const p of toRemove) {
    const { error: delPErr } = await supabase.from("profiles").delete().eq("id", p.id);
    if (delPErr) {
      console.error(`Failed to delete profile ${p.email}:`, delPErr.message);
    } else {
      console.log(`✓ Deleted profile: ${p.email} (${p.role})`);
    }
  }

  // 2. Auth users
  const { data: authData, error: aErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (aErr) {
    console.error("Error listing auth users:", aErr);
    return;
  }

  const authToRemove = (authData?.users || []).filter((u) => {
    const r = u.user_metadata?.role;
    return r !== "admin" && r !== "staff";
  });

  console.log(`\nFound ${authToRemove.length} non-staff/admin auth accounts to remove:`, authToRemove.map((u) => ({ email: u.email, role: u.user_metadata?.role })));

  for (const u of authToRemove) {
    const { error: delAErr } = await supabase.auth.admin.deleteUser(u.id);
    if (delAErr) {
      console.error(`Failed to delete auth user ${u.email}:`, delAErr.message);
    } else {
      console.log(`✓ Deleted auth user: ${u.email}`);
    }
  }

  // 3. Verify final state
  const { data: finalProfiles } = await supabase.from("profiles").select("id, email, full_name, role");
  const { data: finalAuth } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  console.log("\n=== FINAL VERIFICATION ===");
  console.log(`Remaining Profiles (${finalProfiles?.length || 0}):`);
  for (const p of finalProfiles || []) {
    console.log(`  - [${p.role.toUpperCase()}] ${p.email} (${p.full_name})`);
  }

  console.log(`\nRemaining Auth Accounts (${finalAuth?.users?.length || 0}):`);
  for (const u of finalAuth?.users || []) {
    console.log(`  - [${u.user_metadata?.role || "no-role"}] ${u.email}`);
  }
}

clean().catch(console.error);
