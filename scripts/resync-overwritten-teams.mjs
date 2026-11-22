import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

if (!SUPABASE_URL || !SERVICE_KEY || !WEBHOOK_URL) {
  console.error("Missing configuration in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function formatToIST(raw) {
  if (!raw) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(new Date());
  }
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

async function postToSheet(payload) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function syncTeamRecord(reg) {
  const creds = reg.generated_credentials || {};
  const teamCode = creds.teamCode || "";
  const members = Array.isArray(reg.members) ? reg.members : [];
  const d2 = members[0] || {};
  const d3 = members[1] || {};
  const d4 = members[2] || {};
  const track = reg.track || ((reg.leader_sem && reg.leader_sem.includes("3")) ? "3rd Sem" : "1st Sem");
  const isApproved = (reg.status || "").toLowerCase() === "approved";
  const password = creds.password || "";
  const decisionTime = formatToIST(reg.created_at);

  console.log(`\n======================================================`);
  console.log(`Syncing Team: [${teamCode}] ${reg.team_name}`);
  console.log(`Leader: ${reg.leader_name} (${reg.leader_email})`);
  console.log(`Track: ${track} | Status: ${reg.status}`);
  console.log(`======================================================`);

  // 1. Sync to "Registrations" sheet
  const regPayload = {
    sheetName: "Registrations",
    teamName: reg.team_name,
    teamCode: teamCode,
    track: track,
    status: isApproved ? "Approved" : "Pending",
    decisionAt: decisionTime,
    rejectionReason: "",

    leaderName: reg.leader_name || "",
    leaderEmail: reg.leader_email || "",
    leaderPhone: reg.leader_phone || reg.payment_phone || "",
    leaderCollege: reg.leader_college || "Vidya Vardhaka College Of Engineering",
    leaderUsn: reg.leader_usn || "N/A",
    leaderBranch: reg.leader_branch || "",
    leaderSem: reg.leader_sem || "",

    driver2Name: d2.name || "",
    driver2Email: d2.email || "",
    driver2Phone: d2.phone || "",
    driver2College: d2.college || "Vidya Vardhaka College Of Engineering",
    driver2Usn: d2.usn || "N/A",
    driver2Branch: d2.branch || "",
    driver2Sem: d2.sem || "",

    driver3Name: d3.name || "",
    driver3Email: d3.email || "",
    driver3Phone: d3.phone || "",
    driver3College: d3.college || "Vidya Vardhaka College Of Engineering",
    driver3Usn: d3.usn || "N/A",
    driver3Branch: d3.branch || "",
    driver3Sem: d3.sem || "",

    driver4Name: d4.name || "",
    driver4Email: d4.email || "",
    driver4Phone: d4.phone || "",
    driver4College: d4.college || "Vidya Vardhaka College Of Engineering",
    driver4Usn: d4.usn || "N/A",
    driver4Branch: d4.branch || "",
    driver4Sem: d4.sem || "",

    transactionId: reg.payment_utr || "",
    paymentProofUrl: reg.payment_proof_url || "",
    loginPassword: password,
    portalUrl: "",
    whatsappGroup: "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld",
    emailDispatchStatus: isApproved ? "PENDING" : "PENDING_APPROVAL",
  };

  const resReg = await postToSheet(regPayload);
  console.log(`   -> Tab 'Registrations': ${resReg.ok ? "SUCCESS" : "FAIL"} | Response: ${resReg.text}`);

  // If approved, also sync to "Approved" and "Credentials"
  if (isApproved) {
    const apprPayload = { ...regPayload, sheetName: "Approved" };
    const resAppr = await postToSheet(apprPayload);
    console.log(`   -> Tab 'Approved': ${resAppr.ok ? "SUCCESS" : "FAIL"} | Response: ${resAppr.text}`);

    const credPayload = {
      sheetName: "Credentials",
      decisionAt: decisionTime,
      status: "Approved",
      teamName: reg.team_name,
      teamCode: teamCode,
      track: track,
      leaderName: reg.leader_name || "",
      leaderEmail: reg.leader_email || "",
      leaderPhone: reg.leader_phone || reg.payment_phone || "",
      leaderCollege: reg.leader_college || "Vidya Vardhaka College Of Engineering",
      driver2Name: d2.name || "",
      driver2Phone: d2.phone || "",
      loginPassword: password,
      whatsappGroup: "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld",
      emailDispatchStatus: "PENDING",
    };
    const resCred = await postToSheet(credPayload);
    console.log(`   -> Tab 'Credentials': ${resCred.ok ? "SUCCESS" : "FAIL"} | Response: ${resCred.text}`);
  }
}

async function run() {
  console.log("Fetching the 4 duplicate-named teams from Supabase...");
  const targetEmails = [
    "vvce25cse0207@vvce.ac.in",  // IVC-RY-030 (Phoenix, 3rd Sem)
    "dkgowridk@gmail.com",       // IVC-RY-049 (Phoenix, 1st Sem)
    "26vvceec0145@vvce.ac.in",   // IVC-RY-050 (CODE BLOODED, 1st Sem)
    "mohammedamees82@gmail.com"  // IVC-RY-053 (Code Blooded, 1st Sem)
  ];

  const { data: teams, error } = await supabase
    .from("team_registrations")
    .select("*")
    .in("leader_email", targetEmails)
    .order("created_at", { ascending: true });

  if (error || !teams || teams.length === 0) {
    console.error("Could not fetch target teams:", error);
    process.exit(1);
  }

  console.log(`Fetched ${teams.length} teams to restore.`);

  for (const team of teams) {
    await syncTeamRecord(team);
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log("\n✅ Done restoring overwritten teams to Google Sheets!");
}

run();
