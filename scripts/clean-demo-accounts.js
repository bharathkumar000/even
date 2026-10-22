// scripts/clean-demo-accounts.js
// This script removes all user accounts from Supabase except the predefined demo accounts.
// It also ensures the demo accounts exist (creates them if missing).

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";

// Load credentials from environment (same as test script)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
}
if (!SERVICE_KEY) {
  throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Demo account definitions (email => role)
const demoAccounts = [
  { email: "admin@demo.com", role: "admin" },
  { email: "judge@demo.com", role: "judge" },
  { email: "ops@demo.com", role: "staff" },
  { email: "team@demo.com", role: "participant" },
];

const demoEmailSet = new Set(demoAccounts.map((a) => a.email.toLowerCase()));

async function purgeAndEnsure() {
  console.log("Fetching all profiles...");
  const { data: profiles, error } = await supabase.from("profiles").select("id,email");
  if (error) throw error;

  // Identify non‑demo profiles
  const nonDemo = profiles.filter((p) => !demoEmailSet.has((p.email || "").toLowerCase()));
  console.log(`Total profiles: ${profiles.length}, non‑demo: ${nonDemo.length}`);

  // Delete non‑demo auth users and profiles
  for (const user of nonDemo) {
    try {
      await supabase.auth.admin.deleteUser(user.id);
      console.log(`Deleted auth user ${user.email}`);
    } catch (e) {
      console.warn(`Failed to delete auth user ${user.email}:`, e);
    }
    const { error: delErr } = await supabase.from("profiles").delete().eq("id", user.id);
    if (delErr) console.warn(`Failed to delete profile ${user.email}:`, delErr);
    else console.log(`Deleted profile ${user.email}`);
  }

  // Ensure demo accounts exist (create if missing)
  console.log("Ensuring demo accounts exist...");
  for (const demo of demoAccounts) {
    // Check if profile exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", demo.email)
      .maybeSingle();

    if (!existing) {
      // Create auth user first
      const { data: authRes, error: authErr } = await supabase.auth.admin.createUser({
        email: demo.email,
        password: "Password@123",
        email_confirm: true,
        user_metadata: { full_name: demo.email.split("@")[0], role: demo.role },
      });
      if (authErr) {
        console.error(`Failed to create auth user for ${demo.email}:`, authErr);
        continue;
      }
      const userId = authRes?.user?.id;
      if (userId) {
        const { error: profErr } = await supabase.from("profiles").upsert({
          id: userId,
          email: demo.email,
          full_name: demo.email.split("@")[0],
          role: demo.role,
        });
        if (profErr) console.error(`Failed to upsert profile for ${demo.email}:`, profErr);
        else console.log(`Created demo account ${demo.email}`);
      }
    } else {
      console.log(`Demo account ${demo.email} already present`);
    }
  }

  console.log("Cleanup complete.");
}

purgeAndEnsure()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error during cleanup:", err);
    process.exit(1);
  });

