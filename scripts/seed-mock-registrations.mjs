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

async function seed(count = 39, semester = "1st Sem") {
  console.log(`Seeding ${count} mock teams into team_registrations as ${semester}...`);
  const rows = [];
  for (let i = 1; i <= count; i++) {
    const padded = String(i).padStart(2, "0");
    rows.push({
      team_name: `MOCK_TEST_TEAM_${padded}`,
      track: "AI / ML Track",
      leader_name: `Mock Pilot ${padded}`,
      leader_email: `mock_${padded}@vvce.ac.in`,
      leader_phone: `99000000${padded}`,
      leader_college: "Vidya Vardhaka College Of Engineering",
      leader_usn: `4VV23CS${padded}`,
      leader_branch: "Computer Science & Engg (CSE)",
      leader_sem: semester,
      payment_utr: `MOCK_UTR_${padded}_TEST`,
      payment_phone: `99000000${padded}`,
      payment_proof_url: "https://placehold.co/400x600/png?text=Mock+Payment+Proof",
      status: "pending",
      members: [],
    });
  }

  const { data, error } = await supabase.from("team_registrations").insert(rows).select("id");
  if (error) {
    console.error("Error seeding mock teams:", error.message);
  } else {
    console.log(`Successfully seeded ${data.length} mock teams into team_registrations!`);
  }
}

seed();
