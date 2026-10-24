try { process.loadEnvFile('.env.local'); } catch {}
try { process.loadEnvFile('.env'); } catch {}
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Please ensure .env.local or .env is properly populated.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const DEMO_USERS = [
  // Core Demo Accounts
  { email: "admin@demo.com", role: "admin", name: "System Administrator", password: "Password@123" },
  { email: "admin@ivc.pulse", role: "admin", name: "Lead Administrator", password: "Password@123" },
  { email: "judge@demo.com", role: "judge", name: "General Judge", password: "Password@123" },
  { email: "judge.arvind@ivc.pulse", role: "judge", name: "Dr. Arvind Raman", password: "Password@123" },
  { email: "ops@demo.com", role: "staff", name: "Operations Lead", password: "Password@123" },
  { email: "staff.aman@ivc.pulse", role: "staff", name: "Aman Verma (Ops)", password: "Password@123" },
  { email: "team@demo.com", role: "leader", name: "Demo Team Leader", password: "Password@123" },
  { email: "lead.team1@ivc.pulse", role: "leader", name: "Aryan Sharma (Hyperion)", password: "Password@123" },
  { email: "member1.team1@ivc.pulse", role: "leader", name: "Ishan Bose", password: "Password@123" },
  { email: "spoc.iyer@ivc.pulse", role: "staff", name: "Dr. Rajesh Iyer (SPOC)", password: "Password@123" },
];

async function seedUsers() {
  console.log("\n=======================================================");
  console.log("   IVC-PULSE Demo & Mock User Account Provisioning     ");
  console.log("=======================================================\n");

  for (const user of DEMO_USERS) {
    // 1. Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("email", user.email)
      .maybeSingle();

    if (existingProfile) {
      console.log(`✔ User exists: ${user.email.padEnd(28)} [${existingProfile.role.toUpperCase()}]`);
      continue;
    }

    // 2. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.name,
        role: user.role,
      },
    });

    if (authError) {
      // If user already exists in Auth, try retrieving ID
      if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
        const { data: listData } = await supabase.auth.admin.listUsers();
        const found = listData?.users?.find(u => u.email?.toLowerCase() === user.email.toLowerCase());
        if (found) {
          await supabase.from("profiles").upsert({
            id: found.id,
            email: user.email,
            full_name: user.name,
            role: user.role,
          });
          console.log(`✔ Synced profile: ${user.email.padEnd(28)} [${user.role.toUpperCase()}]`);
          continue;
        }
      }
      console.error(`✘ Failed creating ${user.email}: ${authError.message}`);
      continue;
    }

    const userId = authData?.user?.id;
    if (userId) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        email: user.email,
        full_name: user.name,
        role: user.role,
      });

      if (profileError) {
        console.error(`✘ Profile error for ${user.email}: ${profileError.message}`);
      } else {
        console.log(`✔ Created user: ${user.email.padEnd(28)} [${user.role.toUpperCase()}]`);
      }
    }
  }

  console.log("\n✅ Demo user accounts are ready!");
  console.log("-------------------------------------------------------");
  console.log("Default Passwords: '123' (or 'Password@123')");
  console.log("Admin Passcode:    '2026VICEVERSE@IVC'");
  console.log("=======================================================\n");
}

seedUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error during user provisioning:", err);
    process.exit(1);
  });
