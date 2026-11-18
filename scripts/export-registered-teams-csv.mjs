import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function formatToIST(raw) {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return String(raw);
  }
}

const escapeCsv = (val) => {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

async function run() {
  console.log("Fetching registrations from Supabase...");
  const { data: regs, error } = await supabase
    .from("team_registrations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !regs) {
    console.error("Failed to fetch registrations:", error);
    process.exit(1);
  }

  // Filter out test/admin teams
  const realTeams = regs.filter((r) => {
    const name = String(r.team_name || "").toLowerCase().trim();
    const code = String(r.team_code || r.generated_credentials?.teamCode || "").toUpperCase().trim();
    const status = String(r.status || "").toLowerCase().trim();
    const email = String(r.leader_email || "").toLowerCase().trim();
    return !(
      status === "test" ||
      name === "code" ||
      code.includes("TEST") ||
      code.includes("ADMIN") ||
      code.includes("DEV") ||
      name.startsWith("test") ||
      email === "rishithsgowda13@gmail.com"
    );
  });

  console.log(`Found ${realTeams.length} real registered teams.`);

  const headers = [
    "Sl. No.",
    "Team Name",
    "Team Code",
    "Track",
    "Registration Status",
    "Registration Date (IST)",
    // Driver 1 (Captain / Leader)
    "Leader Name",
    "Leader USN",
    "Leader Email",
    "Leader Phone",
    "Leader Branch",
    "Leader Semester",
    "Leader College",
    // Driver 2
    "Driver 2 Name",
    "Driver 2 USN",
    "Driver 2 Email",
    "Driver 2 Phone",
    "Driver 2 Branch",
    "Driver 2 Semester",
    "Driver 2 College",
    // Driver 3
    "Driver 3 Name",
    "Driver 3 USN",
    "Driver 3 Email",
    "Driver 3 Phone",
    "Driver 3 Branch",
    "Driver 3 Semester",
    "Driver 3 College",
    // Driver 4
    "Driver 4 Name",
    "Driver 4 USN",
    "Driver 4 Email",
    "Driver 4 Phone",
    "Driver 4 Branch",
    "Driver 4 Semester",
    "Driver 4 College",
    // Payment Details
    "Transaction UTR",
    "Payment Phone",
    "Payment Proof URL",
  ];

  const rows = realTeams.map((r, index) => {
    const members = Array.isArray(r.members) ? r.members : [];
    const d2 = members[0] || {};
    const d3 = members[1] || {};
    const d4 = members[2] || {};

    const code = r.team_code || r.generated_credentials?.teamCode || `IVC-RY-${String(index + 1).padStart(3, "0")}`;
    const track =
      r.track ||
      ((r.leader_sem && r.leader_sem.includes("3")) ? "3rd Sem" : "1st Sem");

    return [
      escapeCsv(index + 1),
      escapeCsv(r.team_name),
      escapeCsv(code),
      escapeCsv(track),
      escapeCsv(r.status ? r.status.toUpperCase() : "PENDING"),
      escapeCsv(formatToIST(r.created_at)),

      // Driver 1
      escapeCsv(r.leader_name),
      escapeCsv(r.leader_usn),
      escapeCsv(r.leader_email),
      escapeCsv(r.leader_phone || r.payment_phone),
      escapeCsv(r.leader_branch),
      escapeCsv(r.leader_sem),
      escapeCsv(r.leader_college || "Vidyavardhaka College Of Engineering"),

      // Driver 2
      escapeCsv(d2.name),
      escapeCsv(d2.usn),
      escapeCsv(d2.email),
      escapeCsv(d2.phone),
      escapeCsv(d2.branch),
      escapeCsv(d2.sem || r.leader_sem),
      escapeCsv(d2.college || "Vidyavardhaka College Of Engineering"),

      // Driver 3
      escapeCsv(d3.name),
      escapeCsv(d3.usn),
      escapeCsv(d3.email),
      escapeCsv(d3.phone),
      escapeCsv(d3.branch),
      escapeCsv(d3.sem || r.leader_sem),
      escapeCsv(d3.college || "Vidyavardhaka College Of Engineering"),

      // Driver 4
      escapeCsv(d4.name),
      escapeCsv(d4.usn),
      escapeCsv(d4.email),
      escapeCsv(d4.phone),
      escapeCsv(d4.branch),
      escapeCsv(d4.sem || r.leader_sem),
      escapeCsv(d4.college || "Vidyavardhaka College Of Engineering"),

      // Payment
      escapeCsv(r.payment_utr),
      escapeCsv(r.payment_phone),
      escapeCsv(r.payment_proof_url),
    ];
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

  const outputPath = path.resolve("registered_teams.csv");
  fs.writeFileSync(outputPath, csvContent, "utf8");
  console.log(`CSV successfully written to: ${outputPath}`);

  // Summary output
  console.log("\nSummary of teams included in CSV:");
  realTeams.forEach((t, i) => {
    const code = t.team_code || t.generated_credentials?.teamCode || `IVC-RY-${String(i + 1).padStart(3, "0")}`;
    console.log(`${i + 1}. [${t.status.toUpperCase()}] ${t.team_name} | Code: ${code} | Leader: ${t.leader_name} <${t.leader_email}> | Track: ${t.track || t.leader_sem}`);
  });
}

run();
