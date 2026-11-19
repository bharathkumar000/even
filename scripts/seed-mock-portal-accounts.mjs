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

const MOCK_ACCOUNTS = [
  {
    email: "admin@demo.com",
    password: "Password@123",
    role: "admin",
    fullName: "Demo Admin",
    portal: "/admin",
    portalName: "Admin HQ",
  },
  {
    email: "judge@demo.com",
    password: "Password@123",
    role: "judge",
    fullName: "Demo Judge",
    portal: "/judge",
    portalName: "Judge Portal",
  },
  {
    email: "ops@demo.com",
    password: "Password@123",
    role: "staff",
    fullName: "Demo Staff (Club Member)",
    portal: "/ops/scanner",
    portalName: "Operations & Scanner",
  },
  {
    email: "leader@demo.com",
    password: "Password@123",
    role: "leader",
    fullName: "Demo Team Leader",
    portal: "/team",
    portalName: "Team Leader Portal",
  },
];

async function seedPortalAccounts() {
  console.log("Setting up mock accounts for all Eventra portals...\n");

  // Ensure mock team exists for leader
  let teamId = null;
  const { data: existingTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("name", "Demo Grand Prix Squad")
    .maybeSingle();

  if (existingTeam) {
    teamId = existingTeam.id;
  } else {
    const { data: newTeam, error: teamErr } = await supabase
      .from("teams")
      .insert({
        name: "Demo Grand Prix Squad",
        code: "IVC-DEMO-01",
        track: "GRAND PRIX",
        leader_name: "Demo Team Leader",
        status: "active",
        qr_token: "SEC-DEMO-MOCK-001",
        dietary_preference: "standard",
      })
      .select("id")
      .single();

    if (teamErr) {
      console.warn("Could not create new mock team, checking existing teams:", teamErr.message);
      const { data: fallbackTeam } = await supabase.from("teams").select("id").limit(1).maybeSingle();
      teamId = fallbackTeam?.id;
    } else {
      teamId = newTeam.id;
    }
  }

  for (const acc of MOCK_ACCOUNTS) {
    console.log(`Processing [${acc.portalName}] -> ${acc.email} (${acc.role})`);

    // Check if user exists in auth.users
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existingAuthUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === acc.email.toLowerCase()
    );

    let userId = null;
    if (existingAuthUser) {
      userId = existingAuthUser.id;
      // Update password and metadata
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          full_name: acc.fullName,
          role: acc.role,
        },
      });
      if (updErr) {
        console.error(`  Error updating auth user ${acc.email}:`, updErr.message);
      } else {
        console.log(`  Updated password & metadata for ${acc.email}`);
      }
    } else {
      // Create user
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          full_name: acc.fullName,
          role: acc.role,
        },
      });
      if (createErr) {
        console.error(`  Error creating auth user ${acc.email}:`, createErr.message);
        continue;
      }
      userId = createData.user.id;
      console.log(`  Created new auth user for ${acc.email}`);
    }

    if (!userId) continue;

    // Upsert into profiles table
    const { error: profErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email: acc.email,
        full_name: acc.fullName,
        role: acc.role,
      });

    if (profErr) {
      console.error(`  Error updating profile for ${acc.email}:`, profErr.message);
    } else {
      console.log(`  Profile upserted: role='${acc.role}'`);
    }

    // If leader, link to team_members
    if (acc.role === "leader" && teamId) {
      const { error: tmErr } = await supabase
        .from("team_members")
        .upsert(
          {
            team_id: teamId,
            user_id: userId,
            role: "leader",
            name: acc.fullName,
            email: acc.email,
          },
          { onConflict: "user_id" }
        );

      if (tmErr) {
        // Try simple insert if conflict clause varies
        try {
          await supabase
            .from("team_members")
            .insert({
              team_id: teamId,
              user_id: userId,
              role: "leader",
              name: acc.fullName,
              email: acc.email,
            });
        } catch {
          // ignore duplicate
        }
      }
      console.log(`  Linked leader to team '${teamId}'`);
    }
  }

  console.log("\nAll mock portal accounts successfully verified and configured!");
}

seedPortalAccounts();
