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

async function runCleanup() {
  console.log("=== STARTING CONTROLLED DATABASE PURGE ===");

  // 1. Fetch preserved users (Admin and Staff / Club members)
  const { data: preserved, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .in("role", ["admin", "staff"]);

  if (pErr) {
    console.error("Failed to fetch preserved users:", pErr);
    return;
  }

  const preservedIds = new Set(preserved.map((u) => u.id));
  const preservedEmails = new Set(preserved.map((u) => u.email.toLowerCase()));

  console.log(`PRESERVED: Found ${preserved.length} admin/staff accounts. THESE WILL NOT BE TOUCHED.`);
  preserved.forEach((u) => console.log(`  [PRESERVED] ${u.role.toUpperCase()}: ${u.email} (${u.full_name})`));

  // 2. Fetch users to delete (Leaders, Judges, Participants)
  const { data: targets, error: tErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .in("role", ["leader", "judge", "participant"]);

  if (tErr) {
    console.error("Failed to fetch target profiles:", tErr);
    return;
  }

  // Filter out any overlap just in case
  const safeTargets = targets.filter(
    (u) => !preservedIds.has(u.id) && !preservedEmails.has(u.email.toLowerCase())
  );

  console.log(`\nTARGETS TO REMOVE: ${safeTargets.length} total (Leaders, Judges, Participants)`);

  // 3. Clear dependent child tables first
  console.log("\nClearing dependent tables...");

  // Judge assignments
  const { count: jaCount, error: jaErr } = await supabase
    .from("judge_assignments")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Deleted judge_assignments:", jaErr ? jaErr.message : "Done");

  // Evaluations
  const { error: evalErr } = await supabase
    .from("evaluations")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Deleted evaluations:", evalErr ? evalErr.message : "Done");

  // Submissions
  const { error: subErr } = await supabase
    .from("submissions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Deleted submissions:", subErr ? subErr.message : "Done");

  // Team members
  const { error: tmErr } = await supabase
    .from("team_members")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Deleted team_members:", tmErr ? tmErr.message : "Done");

  // Teams
  const { error: teamsErr } = await supabase
    .from("teams")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Deleted teams:", teamsErr ? teamsErr.message : "Done");

  // Team registrations
  const { error: trErr } = await supabase
    .from("team_registrations")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Deleted team_registrations:", trErr ? trErr.message : "Done");

  // 4. Delete Profiles of Leaders & Judges
  const targetIds = safeTargets.map((u) => u.id);
  if (targetIds.length > 0) {
    const { error: pDeleteErr } = await supabase
      .from("profiles")
      .delete()
      .in("id", targetIds);
    console.log("Deleted profiles:", pDeleteErr ? pDeleteErr.message : `Deleted ${targetIds.length} profiles.`);
  }

  // 5. Delete from Supabase Auth (auth.users)
  console.log("\nDeleting from auth.users...");
  let authDeletedCount = 0;
  for (const user of safeTargets) {
    try {
      const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
      if (!authErr) {
        authDeletedCount++;
      } else {
        console.error(`Error deleting auth user ${user.email}:`, authErr.message);
      }
    } catch (e) {
      console.error(`Exception deleting auth user ${user.email}:`, e);
    }
  }
  console.log(`Deleted ${authDeletedCount} auth users.`);

  console.log("\n=== PURGE COMPLETED SUCCESSFULLY ===");
}

runCleanup();

