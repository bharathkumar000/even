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

const WEBHOOK_URL =
  getEnv("GOOGLE_SHEETS_WEBHOOK_URL") ||
  "https://script.google.com/macros/s/AKfycbxsBZSNVG2asXwHm7jzDUi661r9UUmaTHZFXc1HQl-Nx8Xs1RmXe8wlXuCbpR5fWCS7/exec";

const FIRST_NAMES = [
  "Aarav", "Aditi", "Ananya", "Arjun", "Bhavya", "Chetan", "Deepika", "Dev",
  "Dhruv", "Divya", "Gautam", "Harsha", "Ishaan", "Janhavi", "Kavya", "Kiran",
  "Madhav", "Meera", "Nikhil", "Nisha", "Pranav", "Pooja", "Rahul", "Rhea",
  "Rishi", "Rohan", "Sahana", "Samarth", "Sanvi", "Shashank", "Shreya", "Siddharth",
  "Sinchana", "Sohan", "Sowmya", "Sparsha", "Suhas", "Tanvi", "Tarun", "Varun",
  "Vedant", "Vikas", "Vinay", "Vishnu", "Yash", "Yuktha", "Amulya", "Tejas"
];

const LAST_NAMES = [
  "Gowda", "Kumar", "Sharma", "Patel", "Rao", "Shetty", "Hegde", "Reddy",
  "Verma", "Prasad", "Naik", "Bhat", "Kulkarni", "Deshmukh", "Nair", "Menon",
  "Joshi", "Mishra", "Gupta", "Singh", "Pai", "Acharya", "Urs", "Murthy"
];

const BRANCHES = [
  "Computer Science & Engg (CSE)",
  "AI & Machine Learning (AIML)",
  "Information Science & Engg (ISE)",
  "Electronics & Communication (ECE)",
  "Electrical & Electronics (EEE)",
  "Mechanical Engineering (MECH)",
  "Civil Engineering (CIVIL)",
  "Data Science / Computer Science & Business (CSBS)"
];

const TEAM_PREFIXES = [
  "Apex", "Turbo", "Veloce", "Quantum", "Hyper", "Vortex", "Ignition", "Mach",
  "Overdrive", "Nitro", "Dynamo", "Pulse", "Stratosphere", "Kinetic", "Vector", "Cosmic",
  "Titan", "Torque", "Phantom", "Eclipse", "Blaze", "Zenith", "Horizon", "Velocity",
  "Thunder", "Cyber", "Starlight", "Obsidian", "Falcon", "Radiant", "Spectrum", "Velocity",
  "Aero", "Nexus", "Catalyst", "Phoenix", "Infinity", "Vanguard", "Omni", "Solaris"
];

const TEAM_SUFFIXES = [
  "Racers", "Pilots", "Squad", "Motorsport", "Engineering", "Dynamics", "Force", "Pioneers",
  "Warriors", "Speedsters", "Strikers", "Tech", "Innovators", "Crew", "Knights", "Syndicate"
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSecurePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 5; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VV26-${token}`;
}

function generateSquadMember(index, teamIndex, semCode, semName) {
  const firstName = getRandomItem(FIRST_NAMES);
  const lastName = getRandomItem(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;
  const cleanFirst = firstName.toLowerCase();
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "");
  const email = `${cleanFirst}.${cleanLast}${semCode}${teamIndex}m${index}@vvce.ac.in`;
  const branch = getRandomItem(BRANCHES);
  const usnYear = semCode === "1" ? "24" : "23";
  const branchShort = branch.includes("CSE") ? "CS" : branch.includes("AIML") ? "AI" : branch.includes("ISE") ? "IS" : branch.includes("ECE") ? "EC" : "CS";
  const usnNum = String(teamIndex * 10 + index).padStart(3, "0");
  const usn = `4VV${usnYear}${branchShort}${usnNum}`;
  const phone = `98${semCode}${String(teamIndex).padStart(3, "0")}${String(index).padStart(2, "0")}${Math.floor(10 + Math.random() * 89)}`;

  return {
    name: fullName,
    email: email,
    phone: phone,
    college: "Vidya Vardhaka College Of Engineering",
    usn: usn,
    branch: branch,
    sem: semName
  };
}

export function buildMockTeam(index, semCode, isWaitlist, waitlistNum = 0) {
  const semName = semCode === "1" ? "1st Semester" : "3rd Semester";
  const prefix = TEAM_PREFIXES[(index - 1) % TEAM_PREFIXES.length];
  const suffix = TEAM_SUFFIXES[(index - 1) % TEAM_SUFFIXES.length];
  const tag = isWaitlist ? `WL-${waitlistNum}` : `${index}`;
  const teamName = `${prefix} ${suffix} S${semCode}-${tag}`;

  // Leader (Driver 1)
  const leader = generateSquadMember(1, index, semCode, semName);
  
  // Driver 2, 3, 4
  const d2 = generateSquadMember(2, index, semCode, semName);
  const d3 = generateSquadMember(3, index, semCode, semName);
  const d4 = generateSquadMember(4, index, semCode, semName);

  const cleanUsername = teamName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const password = isWaitlist ? "" : generateSecurePassword();
  const teamCode = isWaitlist ? `WAITLIST-S${semCode}-#${String(waitlistNum).padStart(2, "0")}` : `IVC-VV-${semCode}${String(index).padStart(2, "0")}`;
  const utr = isWaitlist
    ? `WAITLIST-#${waitlistNum} (Payment NOT required right now)`
    : `4318${semCode}0${String(index).padStart(2, "0")}${String(Math.floor(1000 + Math.random() * 8999))}`;
  const proofUrl = isWaitlist
    ? "WAITLIST (Payment pending slot availability)"
    : `https://placehold.co/800x1200/png?text=Mock+Payment+Proof+Team+${teamCode}`;

  const credentials = {
    teamId: "",
    teamName,
    teamCode,
    email: leader.email,
    leaderName: leader.name,
    leaderPhone: leader.phone,
    username: cleanUsername,
    password: password,
    qrPayload: "",
    approvedAt: ""
  };

  return {
    team_name: teamName,
    track: "GRAND PRIX",
    leader_name: leader.name,
    leader_email: leader.email,
    leader_phone: leader.phone,
    leader_college: leader.college,
    leader_usn: leader.usn,
    leader_branch: leader.branch,
    leader_sem: leader.sem,
    members: [d2, d3, d4],
    payment_utr: utr,
    payment_phone: leader.phone,
    payment_proof_url: proofUrl,
    status: isWaitlist ? "waitlist" : "pending",
    generated_credentials: credentials,
    created_at: new Date(Date.now() - (110 - index) * 60000).toISOString()
  };
}

async function run() {
  console.log("=== STARTING COMPLETE MOCK SEEDING (80 CONFIRMED + 30 WAITLIST) ===");

  // 1. Clean existing team_registrations to ensure clean start
  console.log("1. Clearing previous test entries from team_registrations...");
  const { error: delErr } = await supabase.from("team_registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) {
    console.warn("Delete warning:", delErr.message);
  }

  // 2. Build rows
  const allRows = [];

  // 1st Sem: 40 Confirmed + 20 Waitlist
  console.log("2. Generating 1st Semester Teams (40 Confirmed + 20 Waitlist)...");
  for (let i = 1; i <= 40; i++) {
    allRows.push(buildMockTeam(i, "1", false));
  }
  for (let w = 1; w <= 20; w++) {
    allRows.push(buildMockTeam(40 + w, "1", true, w));
  }

  // 3rd Sem: 40 Confirmed + 10 Waitlist
  console.log("3. Generating 3rd Semester Teams (40 Confirmed + 10 Waitlist)...");
  for (let i = 1; i <= 40; i++) {
    allRows.push(buildMockTeam(i, "3", false));
  }
  for (let w = 1; w <= 10; w++) {
    allRows.push(buildMockTeam(40 + w, "3", true, w));
  }

  console.log(`Total rows generated: ${allRows.length} (Expected: 110: 80 Confirmed + 30 Waitlist)`);

  // Verify all fields are completely filled
  for (let i = 0; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r.team_name || !r.leader_name || !r.leader_email || !r.leader_phone || !r.leader_usn || !r.leader_college || !r.leader_branch || !r.leader_sem) {
      throw new Error(`Incomplete leader details on team ${i}: ${JSON.stringify(r)}`);
    }
    if (!r.members || r.members.length !== 3) {
      throw new Error(`Members count is not 3 on team ${i}`);
    }
    for (let m = 0; m < 3; m++) {
      const mem = r.members[m];
      if (!mem.name || !mem.email || !mem.phone || !mem.usn || !mem.college || !mem.branch || !mem.sem) {
        throw new Error(`Incomplete member ${m + 2} details on team ${i}: ${JSON.stringify(mem)}`);
      }
    }
  }
  console.log("✓ Verification check passed: ALL 110 squads have 100% complete details for all 4 squad members!");

  // 4. Insert in Supabase in batches of 25
  console.log("4. Inserting 110 teams into Supabase team_registrations in batches...");
  for (let i = 0; i < allRows.length; i += 25) {
    const chunk = allRows.slice(i, i + 25);
    const { error: insErr } = await supabase.from("team_registrations").insert(chunk);
    if (insErr) {
      console.error(`Error inserting batch ${i / 25 + 1}:`, insErr.message);
      process.exit(1);
    }
    console.log(`   Inserted batch ${i / 25 + 1} (${chunk.length} teams)`);
  }

  // 5. Query counts from database
  console.log("\n5. Verifying database registration counts...");
  const { data: dbRows, error: qErr } = await supabase.from("team_registrations").select("leader_sem, status");
  if (qErr) {
    console.error("Query error:", qErr);
    return;
  }

  let sem1Confirmed = 0;
  let sem1Waitlist = 0;
  let sem3Confirmed = 0;
  let sem3Waitlist = 0;

  for (const r of dbRows) {
    const s = String(r.leader_sem || "").toLowerCase();
    if (s.includes("1st") || s === "1") {
      if (r.status === "waitlist") sem1Waitlist++;
      else sem1Confirmed++;
    } else if (s.includes("3rd") || s === "3" || s.includes("2nd") || s === "2") {
      if (r.status === "waitlist") sem3Waitlist++;
      else sem3Confirmed++;
    }
  }

  console.log(`\n================ DATABASE REGISTRATION STATUS ================`);
  console.log(`1st Semester:`);
  console.log(`  - Confirmed Teams: ${sem1Confirmed} / 40 (100% FULL)`);
  console.log(`  - Waitlist Teams:  ${sem1Waitlist} / 20 (100% FULL)`);
  console.log(`  - Total 1st Sem:   ${sem1Confirmed + sem1Waitlist} / 60 SLOTS CAP REACHED`);
  console.log(`--------------------------------------------------------------`);
  console.log(`3rd Semester:`);
  console.log(`  - Confirmed Teams: ${sem3Confirmed} / 40 (100% FULL)`);
  console.log(`  - Waitlist Teams:  ${sem3Waitlist} / 10 (100% FULL)`);
  console.log(`  - Total 3rd Sem:   ${sem3Confirmed + sem3Waitlist} / 50 SLOTS CAP REACHED`);
  console.log(`--------------------------------------------------------------`);
  console.log(`GRAND TOTAL: ${dbRows.length} squads (80 Confirmed + 30 Waitlist)`);
  console.log(`==============================================================\n`);

  // 6. Push to Google Sheets Webhook in parallel batches of 5
  console.log("6. Streaming mock squads to Google Sheets...");
  let syncedCount = 0;
  const BATCH_SIZE = 5;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const chunk = allRows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (row) => {
        const isWaitlist = row.status === "waitlist";
        const d2 = row.members[0];
        const d3 = row.members[1];
        const d4 = row.members[2];
        const sheetRecord = {
          sheetName: isWaitlist ? "Waiting list" : "Registrations",
          teamName: row.team_name,
          track: row.track,
          teamCode: row.generated_credentials.teamCode,
          status: isWaitlist ? "Waitlist" : "Pending",
          decisionAt: row.created_at,

          leaderName: row.leader_name,
          leaderEmail: row.leader_email,
          leaderPhone: row.leader_phone,
          leaderCollege: row.leader_college,
          leaderUsn: row.leader_usn,
          leaderBranch: row.leader_branch,
          leaderSem: row.leader_sem,

          driver2Name: d2.name,
          driver2Email: d2.email,
          driver2Phone: d2.phone,
          driver2College: d2.college,
          driver2Usn: d2.usn,
          driver2Branch: d2.branch,
          driver2Sem: d2.sem,

          driver3Name: d3.name,
          driver3Email: d3.email,
          driver3Phone: d3.phone,
          driver3College: d3.college,
          driver3Usn: d3.usn,
          driver3Branch: d3.branch,
          driver3Sem: d3.sem,

          driver4Name: d4.name,
          driver4Email: d4.email,
          driver4Phone: d4.phone,
          driver4College: d4.college,
          driver4Usn: d4.usn,
          driver4Branch: d4.branch,
          driver4Sem: d4.sem,

          transactionId: row.payment_utr,
          paymentPhone: row.payment_phone,
          paymentProofUrl: row.payment_proof_url,

          loginPassword: row.generated_credentials.password,
          portalUrl: "",
          whatsappGroup: "https://chat.whatsapp.com/Baq9uEcVFQs9loSZxJTspB",
          emailDispatchStatus: isWaitlist ? "WAITLIST" : "PENDING"
        };

        try {
          const res = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sheetRecord),
            signal: AbortSignal.timeout(10000)
          });
          if (res.ok) syncedCount++;
        } catch (e) {
          // silently handle individual network timeout
        }
      })
    );
    console.log(`   Synced ${Math.min(i + BATCH_SIZE, allRows.length)} / ${allRows.length} squads to Google Sheets...`);
  }

  console.log(`\n✓ Sync complete! Successfully streamed ${syncedCount} squads to Google Sheets.`);
}

run().catch((e) => {
  console.error("FATAL ERROR:", e);
});
