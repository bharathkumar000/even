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

async function cleanup() {
  console.log("=== CLEANUP MOCK TEAM LEADERS, TEAMS & REGISTRATION FORMS ===\n");

  // 1. Delete mock registration forms from team_registrations
  const { data: regsDeleted, error: errRegs } = await supabase
    .from("team_registrations")
    .delete()
    .or("team_name.ilike.MOCK_%,leader_email.ilike.mock_%,team_name.ilike.Demo Grand Prix Squad,leader_email.eq.leader@demo.com")
    .select("id, team_name, leader_email");

  console.log(`1. Deleted from team_registrations: ${regsDeleted?.length || 0} forms.`);
  if (errRegs) console.error("   Error deleting team_registrations:", errRegs.message);

  // 2. Identify mock leader profiles & auth users
  const { data: mockProfiles, error: errProfQuery } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .or("email.ilike.mock_%,email.eq.leader@demo.com");

  if (errProfQuery) console.error("   Error querying mock profiles:", errProfQuery.message);
  console.log(`2. Identified ${mockProfiles?.length || 0} mock leader profiles to delete:`);
  mockProfiles?.forEach((p) => console.log(`   - ${p.email} (${p.full_name}, ${p.id})`));

  // 3. Delete mock team members
  const mockUserIds = mockProfiles?.map((p) => p.id) || [];
  if (mockUserIds.length > 0) {
    const { data: membersDeleted, error: errMembers } = await supabase
      .from("team_members")
      .delete()
      .in("user_id", mockUserIds)
      .select("id, name, email");
    console.log(`3. Deleted ${membersDeleted?.length || 0} records from team_members.`);
    if (errMembers) console.error("   Error deleting team_members:", errMembers.message);
  }

  // 4. Delete mock teams from teams table
  const { data: teamsDeleted, error: errTeams } = await supabase
    .from("teams")
    .delete()
    .or("name.ilike.MOCK_%,name.eq.Demo Grand Prix Squad,code.eq.IVC-DEMO-01")
    .select("id, name");

  console.log(`4. Deleted from teams table: ${teamsDeleted?.length || 0} teams.`);
  if (errTeams) console.error("   Error deleting teams:", errTeams.message);

  // 5. Delete profiles from public.profiles
  if (mockUserIds.length > 0) {
    const { data: profsDeleted, error: errProfDel } = await supabase
      .from("profiles")
      .delete()
      .in("id", mockUserIds)
      .select("id, email");
    console.log(`5. Deleted ${profsDeleted?.length || 0} profiles from public.profiles.`);
    if (errProfDel) console.error("   Error deleting profiles:", errProfDel.message);
  }

  // 6. Delete users from Supabase Auth (auth.users)
  const { data: authList, error: errAuthList } = await supabase.auth.admin.listUsers();
  if (errAuthList) {
    console.error("   Error listing auth users:", errAuthList.message);
  } else {
    const mockAuthUsers = authList?.users?.filter(
      (u) => u.email?.toLowerCase().startsWith("mock_") || u.email?.toLowerCase() === "leader@demo.com"
    ) || [];

    console.log(`6. Deleting ${mockAuthUsers.length} mock leader users from Supabase Auth:`);
    for (const u of mockAuthUsers) {
      const { error: errDelUser } = await supabase.auth.admin.deleteUser(u.id);
      if (errDelUser) {
        console.error(`   - Failed to delete auth user ${u.email}:`, errDelUser.message);
      } else {
        console.log(`   - Deleted auth user: ${u.email} (${u.id})`);
      }
    }
  }

  console.log("\n=== VERIFYING FINAL REMAINING DATA ===");
  const { data: remainingRegs } = await supabase.from("team_registrations").select("team_name, leader_email");
  console.log("Remaining team_registrations:", remainingRegs);

  const { data: remainingLeaderProfiles } = await supabase.from("profiles").select("email, full_name, role").eq("role", "leader");
  console.log("Remaining leader profiles:", remainingLeaderProfiles);

  const { data: remainingTeams } = await supabase.from("teams").select("name, code");
  console.log("Remaining teams:", remainingTeams);

  console.log("\nCleanup successfully completed!");
}

cleanup();
