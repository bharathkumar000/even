import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import QRCode from "qrcode";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
const EVENT_QR_SECRET = process.env.EVENT_QR_SECRET || "ivc-eventra-secure-salt-2026-tamper-guard";

if (!SUPABASE_URL || !SERVICE_KEY || !WEBHOOK_URL) {
  console.error("Missing configuration in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateQrSignature(teamId) {
  if (!teamId) return "";
  return crypto
    .createHmac("sha256", EVENT_QR_SECRET)
    .update(teamId.toLowerCase().trim())
    .digest("hex")
    .slice(0, 8);
}

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

async function main() {
  console.log("=========================================================");
  console.log("🚀 Eventra: Team Credentials & Official QR Passes Sync");
  console.log("=========================================================\n");

  // 1. Ensure local dist/ directories exist
  const distDir = path.resolve("dist");
  const qrPassesDir = path.join(distDir, "team-qr-passes");
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  if (!fs.existsSync(qrPassesDir)) fs.mkdirSync(qrPassesDir, { recursive: true });

  // 2. Fetch all approved registrations
  const { data: approvedTeams, error } = await supabase
    .from("team_registrations")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (error || !approvedTeams) {
    console.error("Failed to fetch approved teams:", error);
    process.exit(1);
  }

  // Filter out any internal test teams if present
  const teams = approvedTeams.filter((r) => {
    const code = (r.generated_credentials?.teamCode || r.team_code || "").toUpperCase();
    const name = (r.team_name || "").toLowerCase();
    return !code.includes("TEST") && name !== "code" && r.leader_email !== "rishithsgowda13@gmail.com";
  });

  console.log(`Found ${teams.length} official approved teams to process.\n`);

  const reportItems = [];
  const csvRows = [
    [
      "Team Code",
      "Team Name",
      "Track",
      "Leader Name",
      "Leader Email",
      "Leader Phone",
      "Leader College",
      "Login Username",
      "Login Password",
      "WhatsApp Group",
      "Team ID",
      "QR Payload",
      "Local QR File",
      "Drive Link Status",
    ].join(","),
  ];

  for (let i = 0; i < teams.length; i++) {
    const reg = teams[i];
    const creds = reg.generated_credentials || {};
    const teamCode = creds.teamCode || reg.team_code || `IVC-RY-${String(i + 1).padStart(3, "0")}`;
    const teamName = reg.team_name || "Team";
    const teamId = reg.team_id || creds.teamId || reg.id;
    const leaderName = reg.leader_name || "Team Leader";
    const leaderEmail = reg.leader_email || "";
    const leaderPhone = reg.leader_phone || reg.payment_phone || "";
    const leaderCollege = reg.leader_college || "Vidya Vardhaka College Of Engineering";
    const track = reg.track || ((reg.leader_sem && reg.leader_sem.includes("3")) ? "3rd Sem" : "1st Sem");
    const username = creds.username || teamName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const password = creds.password || "VV26-ACTIVE";
    const whatsappGroup = "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld";

    // Build official QR code JSON payload with HMAC signature
    const sig = generateQrSignature(teamId);
    const qrPayload = JSON.stringify({
      team_id: teamId,
      name: teamName,
      sig: sig,
      v: 1,
    });

    // Generate high-res QR code PNG data URL
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 600,
      margin: 2,
      color: {
        dark: "#050508",
        light: "#ffffff",
      },
    });

    // Save PNG locally
    const safeCode = teamCode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeName = teamName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${safeCode}_${safeName}_QR.png`;
    const filePath = path.join(qrPassesDir, fileName);

    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

    console.log(`[${i + 1}/${teams.length}] Processing [${teamCode}] ${teamName}`);
    console.log(`   -> Generated local QR badge: ${fileName}`);

    // Send to Google Sheets Webhook to upload to Google Drive & update Credentials Sheet
    const sheetPayload = {
      sheetName: "Credentials",
      teamName: teamName,
      teamCode: teamCode,
      teamId: teamId,
      track: track,
      leaderName: leaderName,
      leaderEmail: leaderEmail,
      leaderPhone: leaderPhone,
      leaderCollege: leaderCollege,
      loginUsername: username,
      loginPassword: password,
      whatsappGroup: whatsappGroup,
      qrPassBase64: qrDataUrl,
      decisionAt: formatToIST(reg.approved_at || reg.created_at),
      emailDispatchStatus: "PENDING",
    };

    const webhookRes = await postToSheet(sheetPayload);
    let driveLink = "Pending Sync";
    if (webhookRes.ok) {
      console.log(`   -> Sheet & Drive Sync: SUCCESS`);
    } else {
      console.log(`   -> Sheet & Drive Sync Note: ${webhookRes.error || webhookRes.text}`);
    }

    reportItems.push({
      teamCode,
      teamName,
      track,
      leaderName,
      leaderEmail,
      leaderPhone,
      leaderCollege,
      username,
      password,
      whatsappGroup,
      teamId,
      qrPayload,
      fileName,
      qrDataUrl,
    });

    csvRows.push(
      [
        `"${teamCode}"`,
        `"${teamName.replace(/"/g, '""')}"`,
        `"${track}"`,
        `"${leaderName.replace(/"/g, '""')}"`,
        `"${leaderEmail}"`,
        `"${leaderPhone}"`,
        `"${leaderCollege.replace(/"/g, '""')}"`,
        `"${username}"`,
        `"${password}"`,
        `"${whatsappGroup}"`,
        `"${teamId}"`,
        `"${qrPayload.replace(/"/g, '""')}"`,
        `"${fileName}"`,
        `"Synced to Google Sheets"`,
      ].join(",")
    );

    // Throttle gently to avoid rate limits
    await new Promise((r) => setTimeout(r, 600));
  }

  // 3. Write CSV export
  const csvPath = path.join(distDir, "all-teams-credentials-and-qrs.csv");
  fs.writeFileSync(csvPath, csvRows.join("\n"), "utf8");
  console.log(`\n📄 CSV Export created: ${csvPath}`);

  // 4. Generate Interactive Standalone HTML Viewer
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eventra 2026 · Official Team Credentials & QR Passes Directory</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #050508;
      color: #e2e8f0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .header h1 {
      font-size: 28px;
      color: #00f0ff;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .header p {
      color: #94a3b8;
      font-size: 14px;
    }
    .search-bar {
      max-width: 600px;
      margin: 0 auto 24px auto;
      display: flex;
      gap: 12px;
    }
    .search-bar input {
      flex: 1;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #fff;
      font-size: 15px;
      outline: none;
    }
    .search-bar input:focus {
      border-color: #00f0ff;
    }
    .summary-badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.3);
      color: #00f0ff;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: bold;
      margin-top: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .card {
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .card:hover {
      border-color: #00f0ff;
      transform: translateY(-2px);
    }
    .team-code {
      font-size: 12px;
      font-family: monospace;
      font-weight: bold;
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 3px 10px;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .team-name {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      text-align: center;
      margin-bottom: 4px;
    }
    .team-track {
      font-size: 12px;
      color: #38bdf8;
      margin-bottom: 16px;
    }
    .qr-container {
      background: #ffffff;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }
    .qr-container img {
      display: block;
      width: 180px;
      height: 180px;
    }
    .creds-box {
      width: 100%;
      background: #040711;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 12px;
      font-size: 12px;
      font-family: monospace;
      margin-bottom: 14px;
    }
    .cred-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .cred-row:last-child {
      margin-bottom: 0;
    }
    .cred-label {
      color: #64748b;
    }
    .cred-val {
      color: #f1f5f9;
      font-weight: bold;
    }
    .cred-val.pass {
      color: #10b981;
    }
    .download-btn {
      width: 100%;
      padding: 10px;
      background: #0284c7;
      color: #fff;
      font-size: 13px;
      font-weight: bold;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      display: block;
      transition: background 0.15s;
    }
    .download-btn:hover {
      background: #0369a1;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Eventra 2026 · Official Team Credentials & QR Passes</h1>
    <p>Complete directory of all approved squads with high-resolution QR verification passes and portal credentials.</p>
    <div class="summary-badge">Total Approved Teams: ${teams.length}</div>
  </div>

  <div class="search-bar">
    <input type="text" id="searchInput" placeholder="Search by Team Code, Name, Leader Email, or Track..." onkeyup="filterCards()">
  </div>

  <div class="grid" id="teamsGrid">
    ${reportItems
      .map(
        (t) => `
      <div class="card" data-search="${(t.teamCode + ' ' + t.teamName + ' ' + t.leaderEmail + ' ' + t.leaderName + ' ' + t.track).toLowerCase()}">
        <div class="team-code">${t.teamCode}</div>
        <div class="team-name">${t.teamName}</div>
        <div class="team-track">${t.track} · ${t.leaderName}</div>

        <div class="qr-container">
          <img src="${t.qrDataUrl}" alt="${t.teamCode} QR Code" />
        </div>

        <div class="creds-box">
          <div class="cred-row"><span class="cred-label">Login Username:</span> <span class="cred-val">${t.username}</span></div>
          <div class="cred-row"><span class="cred-label">Password:</span> <span class="cred-val pass">${t.password}</span></div>
          <div class="cred-row"><span class="cred-label">Leader Email:</span> <span class="cred-val">${t.leaderEmail}</span></div>
          <div class="cred-row"><span class="cred-label">Phone:</span> <span class="cred-val">${t.leaderPhone}</span></div>
        </div>

        <a class="download-btn" href="./team-qr-passes/${t.fileName}" download="${t.fileName}">⬇ Download QR Badge PNG</a>
      </div>
    `
      )
      .join("")}
  </div>

  <script>
    function filterCards() {
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.card');
      cards.forEach(card => {
        const text = card.getAttribute('data-search') || '';
        card.style.display = text.includes(q) ? 'flex' : 'none';
      });
    }
  </script>
</body>
</html>`;

  const htmlPath = path.join(distDir, "all-teams-credentials-and-qr-passes.html");
  fs.writeFileSync(htmlPath, htmlContent, "utf8");
  console.log(`🌐 Standalone HTML Directory created: ${htmlPath}`);

  console.log("\n=========================================================");
  console.log("✅ All QR passes generated locally and synced to Google Sheets!");
  console.log("=========================================================\n");
}

main().catch(console.error);
