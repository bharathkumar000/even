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

function buildTeamConfirmationEmailHtml(leaderName, teamName, teamCode, trackName, email, password, whatsappUrl) {
  const groupLink = whatsappUrl || "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld";
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GRAND PRIX RELAYTHON’2026 – Team Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#222222;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);">

  <tr><td style="padding:0;font-size:0;line-height:0;background:#111;text-align:center;">
    <div style="background:linear-gradient(135deg, #111 0%, #1f0505 50%, #e10600 100%);padding:28px 20px;color:#fff;text-align:center;">
      <div style="font-size:12px;letter-spacing:3px;font-weight:bold;color:#ffd400;text-transform:uppercase;margin-bottom:6px;">IVC PRESENTS</div>
      <div style="font-size:26px;font-weight:900;letter-spacing:1px;color:#ffffff;text-transform:uppercase;">GRAND PRIX RELAYTHON’2026</div>
      <div style="font-size:13px;letter-spacing:2px;color:#cccccc;margin-top:6px;">THE ULTIMATE RELAY HACKATHON · VVCE MYSURU</div>
    </div>
  </td></tr>
  <tr><td style="height:5px;background:#e10600;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr><td style="padding:28px 30px 6px;font-size:15px;line-height:24px;">
    <p style="margin:0 0 14px;">Dear <strong>${leaderName}</strong>,</p>
    <p style="margin:0 0 14px;font-size:18px;font-weight:bold;color:#e10600;">🏁 YOUR TEAM IS OFFICIALLY ON THE GRID!</p>
    <p style="margin:0 0 14px;">Congratulations! Your team <strong>“${teamName}”</strong> has been successfully verified and approved for <strong>GRAND PRIX RELAYTHON’2026</strong>, organized by the <strong>Innovators and Visionaries Club (IVC)</strong>.</p>
    <p style="margin:0 0 14px;">Your registration is confirmed! Below are your official Team Code and Portal Login Credentials. Please keep these credentials confidential and secure with your squad.</p>
  </td></tr>

  <tr><td style="padding:6px 30px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;border-radius:6px;border-left:5px solid #e10600;">
      <tr><td style="padding:18px 22px 6px;font-size:14px;font-weight:bold;letter-spacing:2px;color:#e10600;">🏎️ TEAM CREDENTIALS &amp; SQUAD DETAILS</td></tr>
      <tr><td style="padding:4px 22px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;color:#ffffff;">
          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;width:38%;border-bottom:1px solid #2a2a2a;">Team Name</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;border-bottom:1px solid #2a2a2a;">${teamName}</td></tr>
          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;border-bottom:1px solid #2a2a2a;">Team Code</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;border-bottom:1px solid #2a2a2a;">${teamCode}</td></tr>
          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;border-bottom:1px solid #2a2a2a;">Track</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;border-bottom:1px solid #2a2a2a;">${trackName}</td></tr>
          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;border-bottom:1px solid #2a2a2a;">Login Email</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;border-bottom:1px solid #2a2a2a;word-break:break-all;">${email}</td></tr>
          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;">Portal Password</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;">${password}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 22px 16px;font-size:12px;font-style:italic;color:#bbbbbb;">Keep your login credentials safe. Do not share your password with unauthorized individuals.</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 30px 4px;">
    <div style="font-size:14px;font-weight:bold;letter-spacing:2px;color:#111111;border-bottom:3px solid #ffd400;padding-bottom:8px;">🏁 MANDATORY NEXT STEPS</div>
  </td></tr>
  <tr><td style="padding:14px 30px 4px;font-size:15px;line-height:24px;">

    <p style="margin:0 0 6px;font-weight:bold;color:#e10600;">🚦 01. JOIN THE OFFICIAL WHATSAPP GROUP</p>
    <p style="margin:0 0 12px;">All race schedules, slot timings, track rules and live announcements will be shared exclusively through the official WhatsApp group. The Team Leader must join the group.</p>
    <p style="margin:0 0 22px;text-align:center;"><a href="${groupLink}" target="_blank" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 26px;border-radius:6px;">👉 JOIN OFFICIAL WHATSAPP GROUP</a></p>

    <p style="margin:0 0 6px;font-weight:bold;color:#e10600;">📍 02. EVENT DAY CHECK-IN</p>
    <p style="margin:0 0 6px;"><strong>Venue:</strong> Vidya Vardhaka College of Engineering (VVCE), Mysuru</p>
    <ul style="margin:0 0 22px;padding-left:20px;">
      <li style="margin-bottom:4px;">Arrive at the registration desk with all 4 squad members at least 30 minutes before your allotted slot.</li>
      <li>Keep your Team Code (<strong>${teamCode}</strong>) and College ID cards ready for on-spot verification.</li>
    </ul>

    <p style="margin:0 0 6px;font-weight:bold;color:#e10600;">🏎️ 03. SQUAD INTEGRITY</p>
    <ul style="margin:0 0 10px;padding-left:20px;">
      <li style="margin-bottom:4px;">All 4 registered drivers must be physically present.</li>
      <li>No last-minute substitutions will be entertained unless approved by the chief event coordinators.</li>
    </ul>
  </td></tr>

  <tr><td style="padding:14px 30px 6px;">
    <div style="font-size:14px;font-weight:bold;letter-spacing:2px;color:#111111;border-bottom:3px solid #ffd400;padding-bottom:8px;">📞 NEED HELP OR HAVE QUESTIONS?</div>
  </td></tr>
  <tr><td style="padding:12px 30px 18px;font-size:15px;line-height:24px;">
    <p style="margin:0 0 8px;">For queries regarding credentials or schedules, contact our student coordinators:</p>
    <p style="margin:0;"><strong>Preksha Dixit:</strong> <a href="tel:+919945867010" style="color:#111111;text-decoration:none;">9945867010</a><br><strong>Parinitha K:</strong> <a href="tel:+916361455193" style="color:#111111;text-decoration:none;">6361455193</a></p>
  </td></tr>

  <tr><td style="background:#111111;padding:24px 30px;text-align:center;">
    <div style="font-size:15px;font-weight:bold;color:#ffd400;line-height:22px;margin-bottom:14px;">REV YOUR ENGINES. PLAN YOUR RELAY STRATEGY. GET READY FOR THE ULTIMATE SHOWDOWN! 🏎️</div>
    <div style="font-size:13px;color:#ffffff;line-height:20px;">Best Regards,<br><strong>TEAM IVC</strong><br>Innovators and Visionaries Club<br>GRAND PRIX RELAYTHON’2026</div>
    <div style="font-size:12px;font-style:italic;color:#bbbbbb;margin-top:12px;">Fuelled by innovation. Driven by teamwork.</div>
  </td></tr>
  <tr><td style="height:6px;background:#e10600;font-size:0;line-height:0;">&nbsp;</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function generateViewer() {
  console.log("Fetching registrations from Supabase...");
  const { data: regs, error } = await supabase
    .from("team_registrations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !regs) {
    console.error("Failed to fetch registrations:", error);
    process.exit(1);
  }

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
      email === "rishithsgowda13@gmail.com"
    );
  });

  console.log(`Found ${realTeams.length} confirmed teams.`);

  const teamDataList = realTeams.map((r, i) => {
    const creds = r.generated_credentials || {};
    const code = creds.teamCode || r.team_code || `IVC-RY-${String(i + 1).padStart(3, "0")}`;
    const rawSem = r.leader_sem || "";
    const is3rd = String(rawSem).includes("3") || String(r.track || "").includes("3");
    const trackName = is3rd ? "3rd Sem" : "1st Sem";
    const email = creds.email || r.leader_email;
    const pwd = creds.password || "";
    const leaderName = r.leader_name;
    const teamName = r.team_name;
    const whatsapp = "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld";
    const subject = `[GRAND PRIX RELAYTHON’2026] Official Team Confirmation & Credentials - ${teamName} (${code})`;
    const htmlEmail = buildTeamConfirmationEmailHtml(leaderName, teamName, code, trackName, email, pwd, whatsapp);

    return {
      num: i + 1,
      id: r.id,
      teamCode: code,
      teamName: teamName,
      track: trackName,
      leaderName: leaderName,
      leaderEmail: email,
      leaderPhone: r.leader_phone,
      leaderCollege: r.leader_college,
      leaderUsn: r.leader_usn,
      leaderBranch: r.leader_branch,
      leaderSem: r.leader_sem,
      members: r.members || [],
      password: pwd,
      utr: r.payment_utr,
      proofUrl: r.payment_proof_url,
      subject: subject,
      htmlEmail: htmlEmail,
    };
  });

  const viewerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Official Email Dispatch Pre-Check & Manual Verification | GRAND PRIX RELAYTHON’2026</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #0f1117;
    color: #e2e8f0;
    display: flex;
    height: 100vh;
    overflow: hidden;
  }
  /* Sidebar */
  #sidebar {
    width: 360px;
    background: #161b26;
    border-right: 1px solid #2d3748;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .sidebar-header {
    padding: 18px 20px;
    background: #111520;
    border-bottom: 1px solid #2d3748;
  }
  .sidebar-header h1 {
    font-size: 16px;
    font-weight: 800;
    color: #f7fafc;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .sidebar-header p {
    font-size: 12px;
    color: #a0aec0;
    margin-top: 4px;
  }
  .search-box {
    margin-top: 12px;
    padding: 8px 12px;
    background: #0f1117;
    border: 1px solid #2d3748;
    border-radius: 6px;
    color: #fff;
    width: 100%;
    font-size: 13px;
  }
  .search-box:focus {
    outline: none;
    border-color: #e10600;
  }
  .team-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  .team-item {
    padding: 12px 14px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 6px;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }
  .team-item:hover {
    background: #1f2737;
  }
  .team-item.active {
    background: #25161b;
    border-color: #e10600;
  }
  .team-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .team-code {
    font-family: monospace;
    font-weight: 700;
    color: #ffd400;
    font-size: 12px;
  }
  .team-track {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .track-1st {
    background: rgba(0, 245, 255, 0.15);
    color: #00f5ff;
    border: 1px solid rgba(0, 245, 255, 0.3);
  }
  .track-3rd {
    background: rgba(255, 212, 0, 0.15);
    color: #ffd400;
    border: 1px solid rgba(255, 212, 0, 0.3);
  }
  .team-name {
    font-weight: 600;
    font-size: 14px;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .team-leader {
    font-size: 12px;
    color: #a0aec0;
    margin-top: 2px;
  }

  /* Main View Area */
  #main {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #0f1117;
  }
  .top-bar {
    padding: 16px 24px;
    background: #161b26;
    border-bottom: 1px solid #2d3748;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .dispatch-info {
    font-size: 13px;
    color: #cbd5e0;
    line-height: 1.5;
  }
  .dispatch-info strong {
    color: #fff;
  }
  .badge-verified {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 12px;
  }
  .content-split {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  /* Left Info Panel */
  .meta-panel {
    width: 380px;
    background: #131722;
    border-right: 1px solid #2d3748;
    overflow-y: auto;
    padding: 20px;
  }
  .meta-card {
    background: #1a202c;
    border: 1px solid #2d3748;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 16px;
  }
  .meta-card h3 {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #e10600;
    margin-bottom: 10px;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #2d3748;
    font-size: 13px;
  }
  .meta-row:last-child {
    border-bottom: none;
  }
  .meta-label {
    color: #a0aec0;
  }
  .meta-val {
    color: #fff;
    font-weight: 600;
    text-align: right;
    word-break: break-all;
    max-width: 60%;
  }
  .pwd-tag {
    background: #e10600;
    color: #fff;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: monospace;
    font-weight: 700;
  }

  /* Right Email Render Area */
  .email-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #20242e;
    overflow: hidden;
  }
  .email-header-bar {
    background: #1a202c;
    padding: 12px 20px;
    border-bottom: 1px solid #2d3748;
    font-size: 13px;
  }
  .email-header-row {
    margin-bottom: 4px;
  }
  .email-header-row span {
    color: #a0aec0;
    margin-right: 8px;
  }
  .email-header-row strong {
    color: #ffd400;
  }
  .iframe-container {
    flex: 1;
    background: #f2f2f2;
    overflow: hidden;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
</head>
<body>

<div id="sidebar">
  <div class="sidebar-header">
    <h1>Manual Email Pre-Check</h1>
    <p>30 Approved Teams · GRAND PRIX RELAYTHON'26</p>
    <input type="text" id="searchInput" class="search-box" placeholder="Search team, code, leader, email...">
  </div>
  <div class="team-list" id="teamList"></div>
</div>

<div id="main">
  <div class="top-bar">
    <div class="dispatch-info">
      Currently Previewing: <strong id="currentTeamTitle">Select a team</strong>
      <div style="font-size:11px;color:#a0aec0;margin-top:2px;">This preview renders the EXACT email template dispatched by Google Sheets MailApp.</div>
    </div>
    <div>
      <span class="badge-verified">✓ Verified for Dispatch</span>
    </div>
  </div>

  <div class="content-split">
    <!-- Meta Panel -->
    <div class="meta-panel">
      <div class="meta-card">
        <h3>🏎️ Team & Track</h3>
        <div class="meta-row">
          <span class="meta-label">Team Code:</span>
          <span class="meta-val" id="metaCode">-</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Team Name:</span>
          <span class="meta-val" id="metaName">-</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Track:</span>
          <span class="meta-val" id="metaTrack">-</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Portal Password:</span>
          <span class="meta-val"><span class="pwd-tag" id="metaPassword">-</span></span>
        </div>
      </div>

      <div class="meta-card">
        <h3>👤 Team Leader (Driver 1)</h3>
        <div class="meta-row">
          <span class="meta-label">Name:</span>
          <span class="meta-val" id="metaLeader">-</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Recipient Email:</span>
          <span class="meta-val" id="metaEmail">-</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Phone:</span>
          <span class="meta-val" id="metaPhone">-</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">USN:</span>
          <span class="meta-val" id="metaUsn">-</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Branch & Sem:</span>
          <span class="meta-val" id="metaBranchSem">-</span>
        </div>
      </div>

      <div class="meta-card">
        <h3>👥 Squad Drivers (2, 3, 4)</h3>
        <div id="metaMembers" style="font-size:12px;color:#cbd5e0;line-height:1.6;"></div>
      </div>

      <div class="meta-card">
        <h3>💳 Payment & Verification</h3>
        <div class="meta-row">
          <span class="meta-label">UTR:</span>
          <span class="meta-val" id="metaUtr">-</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Proof Screenshot:</span>
          <span class="meta-val"><a id="metaProofLink" href="#" target="_blank" style="color:#00f5ff;text-decoration:none;">Open Drive Link ↗</a></span>
        </div>
      </div>
    </div>

    <!-- Email Render Panel -->
    <div class="email-panel">
      <div class="email-header-bar">
        <div class="email-header-row"><span>To:</span> <strong id="emailHeaderTo">-</strong></div>
        <div class="email-header-row"><span>Subject:</span> <strong id="emailHeaderSubject" style="color:#fff;">-</strong></div>
        <div class="email-header-row"><span>Sender:</span> <span style="color:#cbd5e0;">Innovators &amp; Visionaries Club (IVC) &lt;ivcofficial@vvce.ac.in&gt;</span></div>
      </div>
      <div class="iframe-container">
        <iframe id="emailFrame" src="about:blank"></iframe>
      </div>
    </div>
  </div>
</div>

<script>
  const teams = ${JSON.stringify(teamDataList)};

  let activeIndex = 0;

  function renderList(filter = "") {
    const listEl = document.getElementById("teamList");
    listEl.innerHTML = "";
    const term = filter.toLowerCase().trim();

    teams.forEach((t, idx) => {
      const match = !term ||
        t.teamName.toLowerCase().includes(term) ||
        t.teamCode.toLowerCase().includes(term) ||
        t.leaderName.toLowerCase().includes(term) ||
        t.leaderEmail.toLowerCase().includes(term);

      if (!match) return;

      const div = document.createElement("div");
      div.className = "team-item " + (idx === activeIndex ? "active" : "");
      div.onclick = () => selectTeam(idx);
      div.innerHTML = \`
        <div class="team-item-header">
          <span class="team-code">\${t.teamCode}</span>
          <span class="team-track \${t.track.includes("3") ? "track-3rd" : "track-1st"}">\${t.track}</span>
        </div>
        <div class="team-name">\${t.teamName}</div>
        <div class="team-leader">\${t.leaderName} · \${t.leaderEmail}</div>
      \`;
      listEl.appendChild(div);
    });
  }

  function selectTeam(index) {
    activeIndex = index;
    renderList(document.getElementById("searchInput").value);
    const t = teams[index];
    if (!t) return;

    document.getElementById("currentTeamTitle").innerText = \`[\${t.teamCode}] \${t.teamName}\`;
    document.getElementById("metaCode").innerText = t.teamCode;
    document.getElementById("metaName").innerText = t.teamName;
    document.getElementById("metaTrack").innerText = t.track;
    document.getElementById("metaPassword").innerText = t.password;

    document.getElementById("metaLeader").innerText = t.leaderName;
    document.getElementById("metaEmail").innerText = t.leaderEmail;
    document.getElementById("metaPhone").innerText = t.leaderPhone;
    document.getElementById("metaUsn").innerText = t.leaderUsn || "N/A";
    document.getElementById("metaBranchSem").innerText = \`\${t.leaderBranch || ""} (\${t.leaderSem || ""})\`;

    const membersEl = document.getElementById("metaMembers");
    if (t.members && t.members.length > 0) {
      membersEl.innerHTML = t.members.map((m, i) => \`
        <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #2d3748;">
          <strong>Driver \${i + 2}:</strong> \${m.name || "N/A"}<br>
          <span style="color:#a0aec0;">\${m.email || ""} · \${m.phone || ""} · \${m.usn || ""}</span>
        </div>
      \`).join("");
    } else {
      membersEl.innerHTML = "<span style='color:#a0aec0;'>No additional driver details</span>";
    }

    document.getElementById("metaUtr").innerText = t.utr || "N/A";
    const proofLink = document.getElementById("metaProofLink");
    if (t.proofUrl && t.proofUrl.startsWith("http")) {
      proofLink.href = t.proofUrl;
      proofLink.style.display = "inline";
    } else {
      proofLink.style.display = "none";
    }

    document.getElementById("emailHeaderTo").innerText = \`\${t.leaderName} <\${t.leaderEmail}>\`;
    document.getElementById("emailHeaderSubject").innerText = t.subject;

    // Render iframe content
    const frame = document.getElementById("emailFrame");
    frame.srcdoc = t.htmlEmail;
  }

  document.getElementById("searchInput").addEventListener("input", (e) => {
    renderList(e.target.value);
  });

  // Init
  renderList();
  selectTeam(0);
</script>
</body>
</html>`;

  const outputPath = path.resolve("email_preview.html");
  fs.writeFileSync(outputPath, viewerHtml, "utf8");
  console.log(`\n✓ Successfully created interactive email preview at:\n${outputPath}`);
}

generateViewer().catch(console.error);
