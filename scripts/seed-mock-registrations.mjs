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

async function seed() {
  console.log("Preparing to seed mock teams for 1st Semester and 2nd/3rd Semester...");

  // First, remove existing mock teams to avoid duplicates
  await supabase.from("team_registrations").delete().ilike("team_name", "MOCK_%");

  // Query remaining non-mock registrations
  const { data: existing, error: qErr } = await supabase
    .from("team_registrations")
    .select("id, leader_sem");

  if (qErr) {
    console.error("Error querying existing registrations:", qErr.message);
    return;
  }

  let realSem1 = 0;
  let realSem3 = 0;
  for (const r of existing || []) {
    const s = String(r.leader_sem || "").toLowerCase();
    if (s.includes("1st") || s === "1") realSem1++;
    else if (s.includes("3rd") || s === "3" || s.includes("2nd") || s === "2") realSem3++;
  }

  const TARGET_PER_SEM = 39;
  const needSem1 = Math.max(0, TARGET_PER_SEM - realSem1);
  const needSem3 = Math.max(0, TARGET_PER_SEM - realSem3);

  console.log(`Existing real teams -> 1st Sem: ${realSem1}, 2nd/3rd Sem: ${realSem3}`);
  console.log(`Need to seed -> 1st Sem: ${needSem1} mock teams, 2nd/3rd Sem: ${needSem3} mock teams (to hit exactly ${TARGET_PER_SEM} each)`);

  const rows = [];

  // Seed 1st Semester mock teams
  for (let i = 1; i <= needSem1; i++) {
    const padded = String(i).padStart(2, "0");
    rows.push({
      team_name: `MOCK_SEM1_TEAM_${padded}`,
      track: "AI / ML Track",
      leader_name: `Mock Pilot Sem1_${padded}`,
      leader_email: `mock_sem1_${padded}@vvce.ac.in`,
      leader_phone: `990001${padded.padStart(4, "0")}`,
      leader_college: "Vidya Vardhaka College Of Engineering",
      leader_usn: `4VV24CS${padded}`,
      leader_branch: "Computer Science & Engg (CSE)",
      leader_sem: "1st Semester",
      payment_utr: `MOCK_UTR_S1_${padded}`,
      payment_phone: `990001${padded.padStart(4, "0")}`,
      payment_proof_url: "https://placehold.co/400x600/png?text=Mock+Sem1+Proof",
      status: "pending",
      members: [],
    });
  }

  // Seed 3rd Semester (2nd Year) mock teams
  for (let i = 1; i <= needSem3; i++) {
    const padded = String(i).padStart(2, "0");
    rows.push({
      team_name: `MOCK_SEM3_TEAM_${padded}`,
      track: "GRAND PRIX",
      leader_name: `Mock Pilot Sem3_${padded}`,
      leader_email: `mock_sem3_${padded}@vvce.ac.in`,
      leader_phone: `990003${padded.padStart(4, "0")}`,
      leader_college: "Vidya Vardhaka College Of Engineering",
      leader_usn: `4VV23CS${padded}`,
      leader_branch: "Information Science & Engg (ISE)",
      leader_sem: "3rd Semester",
      payment_utr: `MOCK_UTR_S3_${padded}`,
      payment_phone: `990003${padded.padStart(4, "0")}`,
      payment_proof_url: "https://placehold.co/400x600/png?text=Mock+Sem3+Proof",
      status: "pending",
      members: [],
    });
  }

  if (rows.length > 0) {
    const { data, error } = await supabase.from("team_registrations").insert(rows).select("id");
    if (error) {
      console.error("Error inserting mock teams:", error.message);
      return;
    }
    console.log(`Successfully seeded ${data.length} total mock teams!`);
  }

  // Final check of counts
  const { data: allTeams } = await supabase.from("team_registrations").select("leader_sem");
  let finalSem1 = 0;
  let finalSem3 = 0;
  for (const r of allTeams || []) {
    const s = String(r.leader_sem || "").toLowerCase();
    if (s.includes("1st") || s === "1") finalSem1++;
    else if (s.includes("3rd") || s === "3" || s.includes("2nd") || s === "2") finalSem3++;
  }

  console.log(`\nFinal Registration Counts:`);
  console.log(`- 1st Semester: ${finalSem1} / 40 confirmed (Remaining slots: ${40 - finalSem1})`);
  console.log(`- 2nd/3rd Semester: ${finalSem3} / 40 confirmed (Remaining slots: ${40 - finalSem3})`);
}

seed();
