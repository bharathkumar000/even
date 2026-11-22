import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

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

async function main() {
  console.log("Fetching all waitlisted registrations...");
  const { data: regs, error } = await supabase
    .from("team_registrations")
    .select("*")
    .eq("status", "waitlist")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching waitlist:", error);
    process.exit(1);
  }

  console.log(`Found ${regs.length} waitlisted teams.`);

  if (regs.length === 0) {
    console.log("No waitlisted teams found in database.");
    return;
  }

  // 1. Save Full JSON Backup
  const jsonPath = path.resolve("waitlist_teams_backup.json");
  fs.writeFileSync(jsonPath, JSON.stringify(regs, null, 2), "utf8");
  console.log(`JSON backup saved to: ${jsonPath}`);

  // 2. Generate Clean, Comprehensive CSV for the User & Coordinators
  const headers = [
    "Sl. No.",
    "Waitlist Ref Code",
    "Registration ID",
    "Team Name",
    "Track",
    "Registered At (IST)",
    // Driver 1 (Leader)
    "Leader Name",
    "Leader Phone",
    "Leader Email",
    "Leader College",
    "Leader USN",
    "Leader Branch",
    "Leader Semester",
    // Driver 2
    "Driver 2 Name",
    "Driver 2 Phone",
    "Driver 2 Email",
    "Driver 2 College",
    "Driver 2 USN",
    "Driver 2 Branch",
    "Driver 2 Semester",
    // Driver 3
    "Driver 3 Name",
    "Driver 3 Phone",
    "Driver 3 Email",
    "Driver 3 College",
    "Driver 3 USN",
    "Driver 3 Branch",
    "Driver 3 Semester",
    // Driver 4
    "Driver 4 Name",
    "Driver 4 Phone",
    "Driver 4 Email",
    "Driver 4 College",
    "Driver 4 USN",
    "Driver 4 Branch",
    "Driver 4 Semester",
    // Notes
    "Payment Reference",
  ];

  const rows = regs.map((r, index) => {
    const members = Array.isArray(r.members) ? r.members : [];
    const d2 = members[0] || {};
    const d3 = members[1] || {};
    const d4 = members[2] || {};
    const code = r.payment_utr || r.team_code || r.generated_credentials?.teamCode || `WAITLIST-#${index + 1}`;

    return [
      escapeCsv(index + 1),
      escapeCsv(code),
      escapeCsv(r.id),
      escapeCsv(r.team_name),
      escapeCsv(r.track || "1st Sem"),
      escapeCsv(formatToIST(r.created_at)),
      // Driver 1
      escapeCsv(r.leader_name),
      escapeCsv(r.leader_phone),
      escapeCsv(r.leader_email),
      escapeCsv(r.leader_college),
      escapeCsv(r.leader_usn),
      escapeCsv(r.leader_branch),
      escapeCsv(r.leader_sem),
      // Driver 2
      escapeCsv(d2.name),
      escapeCsv(d2.phone),
      escapeCsv(d2.email),
      escapeCsv(d2.college || r.leader_college),
      escapeCsv(d2.usn),
      escapeCsv(d2.branch),
      escapeCsv(d2.sem || r.leader_sem),
      // Driver 3
      escapeCsv(d3.name),
      escapeCsv(d3.phone),
      escapeCsv(d3.email),
      escapeCsv(d3.college || r.leader_college),
      escapeCsv(d3.usn),
      escapeCsv(d3.branch),
      escapeCsv(d3.sem || r.leader_sem),
      // Driver 4
      escapeCsv(d4.name),
      escapeCsv(d4.phone),
      escapeCsv(d4.email),
      escapeCsv(d4.college || r.leader_college),
      escapeCsv(d4.usn),
      escapeCsv(d4.branch),
      escapeCsv(d4.sem || r.leader_sem),
      // Payment Reference
      escapeCsv(r.payment_proof_url || "WAITLIST (Payment pending slot availability)"),
    ];
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
  const csvPath = path.resolve("waitlist_teams_contact_list.csv");
  fs.writeFileSync(csvPath, csvContent, "utf8");
  console.log(`CSV contact list saved to: ${csvPath}`);

  // 3. Delete waitlist entries from team_registrations
  const waitlistIds = regs.map((r) => r.id);
  console.log("\nDeleting waitlist records from team_registrations for IDs:", waitlistIds);
  const { error: delError } = await supabase
    .from("team_registrations")
    .delete()
    .in("id", waitlistIds);

  if (delError) {
    console.error("Failed to delete waitlist records:", delError.message);
    process.exit(1);
  }

  console.log("Successfully deleted all waitlist records from Supabase!");

  // Verify deletion
  const { data: check, error: checkErr } = await supabase
    .from("team_registrations")
    .select("id, team_name, status")
    .eq("status", "waitlist");

  if (!checkErr) {
    console.log(`Remaining waitlist count in DB: ${check.length}`);
  }
}

main();
