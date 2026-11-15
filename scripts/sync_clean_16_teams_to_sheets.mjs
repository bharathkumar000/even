import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://koluhnkobgagsfvokkbz.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbHVobmtvYmdhZ3Nmdm9ra2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIxNTE2NCwiZXhwIjoyMTA2NzkxMTY0fQ._9xDTVPPHr0D-ZsPRx2ial9qvGK1YfErp2T8YT7umVw";
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxsBZSNVG2asXwHm7jzDUi661r9UUmaTHZFXc1HQl-Nx8Xs1RmXe8wlXuCbpR5fWCS7/exec";

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

async function run() {
  console.log("Fetching all registrations from Supabase...");
  const { data: regs, error } = await supabase
    .from("team_registrations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !regs) {
    console.error("Failed to fetch registrations:", error);
    process.exit(1);
  }

  const { data: teams } = await supabase.from("teams").select("id, name, code, track");
  const codeMap = {};
  (teams || []).forEach((t) => {
    codeMap[t.id] = t.code;
    codeMap[t.name.trim().toLowerCase()] = t.code;
  });

  // Sort strictly by code IVC-RY-001 to 016
  const sortedRegs = [...regs].sort((a, b) => {
    const codeA = a.generated_credentials?.teamCode || codeMap[a.team_id] || "";
    const codeB = b.generated_credentials?.teamCode || codeMap[b.team_id] || "";
    return codeA.localeCompare(codeB);
  });

  console.log(`Found ${sortedRegs.length} teams. Preparing clean sync payload to Google Sheets...`);

  for (let i = 0; i < sortedRegs.length; i++) {
    const reg = sortedRegs[i];
    const creds = reg.generated_credentials || {};
    const teamCode = creds.teamCode || codeMap[reg.team_id] || `IVC-RY-${String(i + 1).padStart(3, "0")}`;
    const members = Array.isArray(reg.members) ? reg.members : [];
    const d2 = members[0] || {};
    const d3 = members[1] || {};
    const d4 = members[2] || {};
    const track = reg.track || ((reg.leader_sem && reg.leader_sem.includes("3")) ? "3rd Sem" : "1st Sem");
    const password = creds.password || "VV26-TEST1";
    const decisionTime = formatToIST(reg.approved_at || reg.created_at);

    console.log(`\n[${i + 1}/${sortedRegs.length}] Syncing Team: ${teamCode} - ${reg.team_name}`);

    // 1. Sync to "Approved" sheet
    const approvedPayload = {
      sheetName: "Approved",
      teamName: reg.team_name,
      teamCode: teamCode,
      track: track,
      status: "Approved",
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
      emailDispatchStatus: "PENDING",
    };

    const resAppr = await postToSheet(approvedPayload);
    console.log(`   -> Tab 'Approved': ${resAppr.ok ? "SUCCESS" : "FAIL"}`);

    // 2. Sync to "Registrations" sheet
    const regPayload = { ...approvedPayload, sheetName: "Registrations" };
    const resReg = await postToSheet(regPayload);
    console.log(`   -> Tab 'Registrations': ${resReg.ok ? "SUCCESS" : "FAIL"}`);

    // 3. Sync to "Credentials" sheet
    const leadContact = `${reg.leader_name} (${reg.leader_phone || reg.payment_phone || ""})`;
    const memberContact = d2.name ? `${d2.name} (${d2.phone || d2.email || ""})` : "";
    const credPayload = {
      sheetName: "Credentials",
      decisionAt: decisionTime,
      teamName: reg.team_name,
      loginEmail: reg.leader_email,
      loginPassword: password,
      teamId: reg.team_id || "",
      teamCode: teamCode,
      leaderName: leadContact,
      driver2Name: memberContact,
      emailDispatchStatus: "PENDING",
    };
    const resCred = await postToSheet(credPayload);
    console.log(`   -> Tab 'Credentials': ${resCred.ok ? "SUCCESS" : "FAIL"}`);

    // Gentle 800ms throttle between teams
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log("\n=======================================================");
  console.log("✅ All 16 teams successfully pushed to Google Sheets!");
  console.log("=======================================================");
}

run();
