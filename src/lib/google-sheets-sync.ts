/**
 * Google Sheets & Drive Synchronization Module
 * Automatically streams complete 4-driver registration details and payment proofs
 * into 3 dedicated sheets:
 *   - Sheet 1: "Registrations" (All teams upon registration submission, irrespective of approval status)
 *   - Sheet 2: "Approved" (Teams approved by admin)
 *   - Sheet 3: "Rejected" (Teams rejected by admin)
 */

export interface ComprehensiveTeamRecord {
  sheetName?: "Registrations" | "Approved" | "Waiting list" | "Rejected" | "Credentials" | string;
  teamName: string;
  track?: string;
  teamCode?: string;
  teamId?: string;
  status: "Pending" | "Waitlist" | "Approved" | "Rejected" | string;
  decisionAt: string;
  decisionBy?: string;
  rejectionReason?: string;

  // Driver 1 (Leader)
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  leaderCollege: string;
  leaderUsn: string;
  leaderBranch: string;
  leaderSem: string;

  // Driver 2
  driver2Name: string;
  driver2Email: string;
  driver2Phone?: string;
  driver2College: string;
  driver2Usn: string;
  driver2Branch: string;
  driver2Sem: string;

  // Driver 3
  driver3Name: string;
  driver3Email: string;
  driver3Phone?: string;
  driver3College: string;
  driver3Usn: string;
  driver3Branch: string;
  driver3Sem: string;

  // Driver 4
  driver4Name: string;
  driver4Email: string;
  driver4Phone?: string;
  driver4College: string;
  driver4Usn: string;
  driver4Branch: string;
  driver4Sem: string;

  // Payment
  transactionId: string;
  paymentPhone?: string;
  paymentProofUrl?: string;
  paymentProofBase64?: string;

  // Credentials for Approved Teams (Bulk Email Dispatch)
  loginPassword?: string;
  loginEmail?: string;
  portalUrl?: string;
  whatsappGroup?: string;
  emailDispatchStatus?: string;
}

/** Backward-compatible alias for existing imports */
export type GoogleSheetRegistrationRecord = ComprehensiveTeamRecord;

/**
 * Push a complete 4-driver registration record to the Google Sheets Webhook.
 * Google Apps Script routes:
 *   - Sheet 1: "Registrations" (Initial registration submissions)
 *   - Sheet 2: "Approved" (Admin-approved registrations)
 *   - Sheet 3: "Rejected" (Admin-rejected registrations)
 * Also saves payment proof directly into Google Drive with zero Supabase storage usage.
 */
export async function syncRegistrationToGoogleSheets(
  record: ComprehensiveTeamRecord
): Promise<{ success: boolean; message: string; proofUrl?: string; sheet?: string }> {
  const webhookUrl =
    process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
    process.env.GOOGLE_SHEET_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL ||
    "https://script.google.com/macros/s/AKfycbxsBZSNVG2asXwHm7jzDUi661r9UUmaTHZFXc1HQl-Nx8Xs1RmXe8wlXuCbpR5fWCS7/exec";

  const targetTab =
    record.sheetName ||
    (record.status === "Approved"
      ? "Approved"
      : record.status === "Waitlist" || record.status === "Waiting list"
      ? "Waiting list"
      : record.status === "Rejected"
      ? "Rejected"
      : "Registrations");

  if (!webhookUrl) {
    console.info(
      `[Google Sheets Sync] Ready for sync: ${record.teamName} -> Sheet "${targetTab}" (${record.status}). Configure GOOGLE_SHEETS_WEBHOOK_URL in .env.local to stream rows to Google Sheets in real time.`
    );
    return {
      success: true,
      message: `Verified locally. Configure GOOGLE_SHEETS_WEBHOOK_URL to stream to Sheet "${targetTab}".`,
      sheet: targetTab,
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...record, sheetName: targetTab }),
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        message: `Successfully synced ${record.teamName} to Google Sheet tab "${targetTab}".`,
        proofUrl: data.proofUrl,
        sheet: targetTab,
      };
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(`[Google Sheets Sync] Webhook responded with status ${res.status}: ${errText}`);
      return {
        success: false,
        message: `Google Sheets Webhook returned HTTP ${res.status}`,
        sheet: targetTab,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Google Sheets Sync Error]:", errorMsg);
    return {
      success: false,
      message: `Failed to push to Google Sheets: ${errorMsg}`,
      sheet: targetTab,
    };
  }
}

export interface TeamCredentialsRecord {
  teamName: string;
  loginEmail: string;
  loginPassword?: string;
  teamId?: string;
  teamCode?: string;
  leaderName: string;
  leaderPhone?: string;
  driver2Name?: string;
  driver2Phone?: string;
  driver2Email?: string;
  decisionAt?: string;
}

/**
 * Sync approved team credentials to the dedicated "Credentials" Google Sheet tab.
 * Contains only: Team Name, Login Email ID, Password, Team ID, Team Code, Team Lead, Member Contact.
 */
export async function syncCredentialsToGoogleSheets(
  record: TeamCredentialsRecord
): Promise<{ success: boolean; message: string; sheet?: string }> {
  return syncRegistrationToGoogleSheets({
    sheetName: "Credentials",
    teamName: record.teamName,
    teamId: record.teamId,
    teamCode: record.teamCode,
    status: "Approved",
    decisionAt: record.decisionAt || new Date().toISOString(),

    loginPassword: record.loginPassword,
    loginEmail: record.loginEmail,

    leaderName: record.leaderName,
    leaderEmail: record.loginEmail,
    leaderPhone: record.leaderPhone || "",
    leaderCollege: "Vidya Vardhaka College Of Engineering",
    leaderUsn: "",
    leaderBranch: "",
    leaderSem: "",

    driver2Name: record.driver2Name || "",
    driver2Email: record.driver2Email || "",
    driver2Phone: record.driver2Phone || "",
    driver2College: "",
    driver2Usn: "",
    driver2Branch: "",
    driver2Sem: "",

    driver3Name: "",
    driver3Email: "",
    driver3College: "",
    driver3Usn: "",
    driver3Branch: "",
    driver3Sem: "",

    driver4Name: "",
    driver4Email: "",
    driver4College: "",
    driver4Usn: "",
    driver4Branch: "",
    driver4Sem: "",

    transactionId: "",
  });
}

/**
 * Generate a complete, formatted CSV string representing registrations
 * Ready for one-click download and instant import into Google Sheets.
 */
export function generateRegistrationsCsv(records: ComprehensiveTeamRecord[]): string {
  const headers = [
    "Decision Time",
    "Status",
    "Team Name",
    "Team Code",
    "Track",
    "Rejection Reason",
    // Driver 1 (Leader)
    "Leader Name",
    "Leader Email",
    "Leader Phone",
    "Leader College",
    "Leader USN",
    "Leader Branch",
    "Leader Semester",
    // Driver 2
    "Driver 2 Name",
    "Driver 2 Email",
    "Driver 2 Phone",
    "Driver 2 College",
    "Driver 2 USN",
    "Driver 2 Branch",
    "Driver 2 Semester",
    // Driver 3
    "Driver 3 Name",
    "Driver 3 Email",
    "Driver 3 Phone",
    "Driver 3 College",
    "Driver 3 USN",
    "Driver 3 Branch",
    "Driver 3 Semester",
    // Driver 4
    "Driver 4 Name",
    "Driver 4 Email",
    "Driver 4 Phone",
    "Driver 4 College",
    "Driver 4 USN",
    "Driver 4 Branch",
    "Driver 4 Semester",
    // Payment
    "Transaction ID (UTR)",
    "Payment Proof Link",
    // Credentials & Dispatch
    "Login Password",
    "Portal URL",
    "WhatsApp Group",
    "Email Dispatch Status",
  ];

  const escapeCsv = (val: string | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map((r) => [
    escapeCsv(r.decisionAt),
    escapeCsv(r.status),
    escapeCsv(r.teamName),
    escapeCsv(r.teamCode),
    escapeCsv(r.track),
    escapeCsv(r.rejectionReason),
    // Leader
    escapeCsv(r.leaderName),
    escapeCsv(r.leaderEmail),
    escapeCsv(r.leaderPhone),
    escapeCsv(r.leaderCollege),
    escapeCsv(r.leaderUsn),
    escapeCsv(r.leaderBranch),
    escapeCsv(r.leaderSem),
    // Driver 2
    escapeCsv(r.driver2Name),
    escapeCsv(r.driver2Email),
    escapeCsv(r.driver2Phone),
    escapeCsv(r.driver2College),
    escapeCsv(r.driver2Usn),
    escapeCsv(r.driver2Branch),
    escapeCsv(r.driver2Sem),
    // Driver 3
    escapeCsv(r.driver3Name),
    escapeCsv(r.driver3Email),
    escapeCsv(r.driver3Phone),
    escapeCsv(r.driver3College),
    escapeCsv(r.driver3Usn),
    escapeCsv(r.driver3Branch),
    escapeCsv(r.driver3Sem),
    // Driver 4
    escapeCsv(r.driver4Name),
    escapeCsv(r.driver4Email),
    escapeCsv(r.driver4Phone),
    escapeCsv(r.driver4College),
    escapeCsv(r.driver4Usn),
    escapeCsv(r.driver4Branch),
    escapeCsv(r.driver4Sem),
    // Payment
    escapeCsv(r.transactionId),
    escapeCsv(r.paymentProofUrl),
    // Credentials & Dispatch
    escapeCsv(r.loginPassword),
    escapeCsv(r.portalUrl),
    escapeCsv(r.whatsappGroup),
    escapeCsv(r.emailDispatchStatus || "PENDING"),
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
}

/**
 * 3-Sheet Google Apps Script Template
 * Handles:
 * 1. Sheet 1: "Registrations" (Stores all participant submissions irrespective of approval status)
 * 2. Sheet 2: "Approved" (Stores approved teams upon admin verification)
 * 3. Sheet 3: "Rejected" (Stores rejected teams upon admin rejection with reason)
 * 4. Uploading payment proofs directly to Google Drive (Zero Supabase storage)
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    
    // Remote clear command for resetting all sheets
    if (data.action === "clear_all_test_data") {
      var sheetsToClear = ["Registrations", "Waiting list", "Credentials", "Approved", "Rejected"];
      var cleared = [];
      sheetsToClear.forEach(function(name) {
        var s = ss.getSheetByName(name);
        if (s && s.getLastRow() > 1) {
          s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).clearContent();
          cleared.push(name);
        }
      });
      return ContentService.createTextOutput(JSON.stringify({ success: true, clearedSheets: cleared }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Auto-rename default 'Sheet1' to 'Registrations' if fresh spreadsheet
    var regSheet = ss.getSheetByName("Registrations");
    if (!regSheet) {
      var defaultSheet = ss.getSheetByName("Sheet1");
      if (defaultSheet && defaultSheet.getLastRow() === 0) {
        defaultSheet.setName("Registrations");
        regSheet = defaultSheet;
      }
    }
    
    // Determine target sheet: Registrations (Sheet 1), Approved (Sheet 2), Waiting list (Sheet 3), Rejected (Sheet 4), Credentials (Sheet 5)
    var sheetName = "Registrations";
    if (data.sheetName) {
      sheetName = data.sheetName;
    } else if (data.status === "Approved") {
      sheetName = "Approved";
    } else if (data.status === "Waitlist" || data.status === "Waiting list") {
      sheetName = "Waiting list";
    } else if (data.status === "Rejected") {
      sheetName = "Rejected";
    } else {
      sheetName = "Registrations";
    }
    
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Dedicated compact layout for "Credentials" Sheet (Approved Teams only)
    if (sheetName === "Credentials") {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "Timestamp",
          "Team Name",
          "Login Email ID",
          "Password",
          "Team ID",
          "Team Code",
          "Team Lead",
          "One Member Contact Info (Driver 2)",
          "Email Dispatch Status"
        ]);
        sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#d9ead3");
      }
      
      var leadContact = data.leaderName || data.teamLead || "";
      var leadPhone = data.leaderPhone || data.teamLeadPhone || "";
      if (leadPhone) leadContact += " (" + leadPhone + ")";
      
      var memberContact = data.driver2Name || data.member2Name || "";
      var memberPhone = data.driver2Phone || data.member2Phone || data.driver2Email || "";
      if (memberPhone) memberContact += " (" + memberPhone + ")";
      
      sheet.appendRow([
        data.decisionAt || new Date().toISOString(),
        data.teamName || "",
        data.loginEmail || data.leaderEmail || "",
        data.loginPassword || data.password || "",
        data.teamId || "",
        data.teamCode || "",
        leadContact,
        memberContact,
        "PENDING"
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, sheet: "Credentials" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Auto-create 36-column Header if sheet is new or empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Status",
        "Team Name",
        "Team Code",
        "Track",
        "Rejection Reason",
        // Driver 1 (Leader)
        "Leader Name",
        "Leader Email",
        "Leader Phone",
        "Leader College",
        "Leader USN",
        "Leader Branch",
        "Leader Semester",
        // Driver 2
        "Driver 2 Name",
        "Driver 2 Email",
        "Driver 2 Phone",
        "Driver 2 College",
        "Driver 2 USN",
        "Driver 2 Branch",
        "Driver 2 Semester",
        // Driver 3
        "Driver 3 Name",
        "Driver 3 Email",
        "Driver 3 Phone",
        "Driver 3 College",
        "Driver 3 USN",
        "Driver 3 Branch",
        "Driver 3 Semester",
        // Driver 4
        "Driver 4 Name",
        "Driver 4 Email",
        "Driver 4 Phone",
        "Driver 4 College",
        "Driver 4 USN",
        "Driver 4 Branch",
        "Driver 4 Semester",
        // Payment
        "Transaction ID (UTR)",
        "Payment Proof Drive Link",
        // Credentials & Bulk Email Dispatch
        "Login Password",
        "Portal URL",
        "WhatsApp Group",
        "Email Dispatch Status"
      ]);
      sheet.getRange(1, 1, 1, 40).setFontWeight("bold").setBackground("#e0e0e0");
    }
    
    // Upload payment proof screenshot directly to Google Drive (Zero Supabase storage)
    var proofLink = data.paymentProofUrl || "";
    if (data.paymentProofBase64 && data.paymentProofBase64.indexOf("data:") === 0) {
      try {
        var parts = data.paymentProofBase64.split(",");
        var mimeMatch = parts[0].match(/:(.*?);/);
        var mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
        var bytes = Utilities.base64Decode(parts[1]);
        var cleanTeamName = (data.teamName || "team").replace(/[^a-zA-Z0-9]/g, "_");
        var fileName = cleanTeamName + "_UTR_" + (data.transactionId || "proof") + ".jpg";
        var fileBlob = Utilities.newBlob(bytes, mime, fileName);
        
        // Find or create 'Eventra Payment Proofs' folder in Google Drive
        var folders = DriveApp.getFoldersByName("Eventra Payment Proofs");
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Eventra Payment Proofs");
        var driveFile = folder.createFile(fileBlob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        proofLink = driveFile.getUrl();
      } catch (uploadErr) {
        proofLink = "Upload error: " + uploadErr.toString();
      }
    }
    
    // Append complete row to target sheet (Registrations, Approved, or Rejected)
    sheet.appendRow([
      data.decisionAt || new Date().toISOString(),
      data.status || "Pending",
      data.teamName || "",
      data.teamCode || "",
      data.track || "GRAND PRIX",
      data.rejectionReason || "",
      // Leader
      data.leaderName || "",
      data.leaderEmail || "",
      data.leaderPhone || "",
      data.leaderCollege || "",
      data.leaderUsn || "",
      data.leaderBranch || "",
      data.leaderSem || "",
      // Driver 2
      data.driver2Name || "",
      data.driver2Email || "",
      data.driver2Phone || "",
      data.driver2College || "",
      data.driver2Usn || "",
      data.driver2Branch || "",
      data.driver2Sem || "",
      // Driver 3
      data.driver3Name || "",
      data.driver3Email || "",
      data.driver3Phone || "",
      data.driver3College || "",
      data.driver3Usn || "",
      data.driver3Branch || "",
      data.driver3Sem || "",
      // Driver 4
      data.driver4Name || "",
      data.driver4Email || "",
      data.driver4Phone || "",
      data.driver4College || "",
      data.driver4Usn || "",
      data.driver4Branch || "",
      data.driver4Sem || "",
      // Payment
      data.transactionId || "",
      proofLink,
      // Credentials & Bulk Dispatch
      data.loginPassword || "",
      data.portalUrl || "",
      data.whatsappGroup || "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld",
      data.emailDispatchStatus || "PENDING"
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, proofUrl: proofLink, sheet: sheetName }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Responsive HTML confirmation email template for Grand Prix Relaython 2026.
 */
function buildTeamConfirmationEmailHtml(leaderName, teamName, teamCode, trackName, email, password, whatsappUrl) {
  var banner = "https://raw.githubusercontent.com/rishithsgowda13/IVC-EVENTRA/main/public/relaython-banner.jpg";
  var groupLink = whatsappUrl || "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld";
  
  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1">' +
'<title>GRAND PRIX RELAYTHON’2026 – Team Confirmation</title>' +
'</head>' +
'<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#222222;">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;">' +
'<tr><td align="center" style="padding:20px 10px;">' +
'<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">' +

'  <tr><td style="padding:0;font-size:0;line-height:0;"><img src="' + banner + '" width="600" alt="RELAYTHON 2026 – A Relay-Style Hackathon" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>' +
'  <tr><td style="height:5px;background:#e10600;font-size:0;line-height:0;">&nbsp;</td></tr>' +

'  <tr><td style="padding:28px 30px 6px;font-size:15px;line-height:24px;">' +
'    <p style="margin:0 0 14px;">Dear <strong>' + leaderName + '</strong>,</p>' +
'    <p style="margin:0 0 14px;font-size:18px;font-weight:bold;color:#e10600;">🏁 YOUR TEAM IS OFFICIALLY ON THE GRID!</p>' +
'    <p style="margin:0 0 14px;">Congratulations! Your team <strong>“' + teamName + '”</strong> has been successfully verified and approved for <strong>GRAND PRIX RELAYTHON’2026</strong>, organized by the <strong>Innovators and Visionaries Club (IVC)</strong>.</p>' +
'    <p style="margin:0 0 14px;">Your registration is confirmed! Below are your official Team Code and Portal Login Credentials. Please keep these credentials confidential and secure with your squad.</p>' +
'  </td></tr>' +

'  <tr><td style="padding:6px 30px 8px;">' +
'    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;border-radius:6px;border-left:5px solid #e10600;">' +
'      <tr><td style="padding:18px 22px 6px;font-size:14px;font-weight:bold;letter-spacing:2px;color:#e10600;">🏎️ TEAM CREDENTIALS &amp; SQUAD DETAILS</td></tr>' +
'      <tr><td style="padding:4px 22px 16px;">' +
'        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;color:#ffffff;">' +
'          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;width:38%;border-bottom:1px solid #2a2a2a;">Team Name</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;border-bottom:1px solid #2a2a2a;">' + teamName + '</td></tr>' +
'          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;border-bottom:1px solid #2a2a2a;">Team Code</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;border-bottom:1px solid #2a2a2a;">' + teamCode + '</td></tr>' +
'          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;border-bottom:1px solid #2a2a2a;">Track</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;border-bottom:1px solid #2a2a2a;">' + trackName + '</td></tr>' +
'          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;border-bottom:1px solid #2a2a2a;">Login Email</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;border-bottom:1px solid #2a2a2a;word-break:break-all;">' + email + '</td></tr>' +
'          <tr><td style="padding:6px 0;color:#e10600;font-weight:bold;">Portal Password</td><td style="padding:6px 0;color:#ffd400;font-weight:bold;">' + password + '</td></tr>' +
'        </table>' +
'      </td></tr>' +
'      <tr><td style="padding:0 22px 16px;font-size:12px;font-style:italic;color:#bbbbbb;">Keep your login credentials safe. Do not share your password with unauthorized individuals.</td></tr>' +
'    </table>' +
'  </td></tr>' +

'  <tr><td style="padding:20px 30px 4px;">' +
'    <div style="font-size:14px;font-weight:bold;letter-spacing:2px;color:#111111;border-bottom:3px solid #ffd400;padding-bottom:8px;">🏁 MANDATORY NEXT STEPS</div>' +
'  </td></tr>' +
'  <tr><td style="padding:14px 30px 4px;font-size:15px;line-height:24px;">' +

'    <p style="margin:0 0 6px;font-weight:bold;color:#e10600;">🚦 01. JOIN THE OFFICIAL WHATSAPP GROUP</p>' +
'    <p style="margin:0 0 12px;">All race schedules, slot timings, track rules and live announcements will be shared exclusively through the official WhatsApp group. The Team Leader must join the group.</p>' +
'    <p style="margin:0 0 22px;text-align:center;"><a href="' + groupLink + '" target="_blank" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 26px;border-radius:6px;">👉 JOIN OFFICIAL WHATSAPP GROUP</a></p>' +

'    <p style="margin:0 0 6px;font-weight:bold;color:#e10600;">📍 02. EVENT DAY CHECK-IN</p>' +
'    <p style="margin:0 0 6px;"><strong>Venue:</strong> Vidya Vardhaka College of Engineering (VVCE), Mysuru</p>' +
'    <ul style="margin:0 0 22px;padding-left:20px;">' +
'      <li style="margin-bottom:4px;">Arrive at the registration desk with all 4 squad members at least 30 minutes before your allotted slot.</li>' +
'      <li>Keep your Team Code (<strong>' + teamCode + '</strong>) and College ID cards ready for on-spot verification.</li>' +
'    </ul>' +

'    <p style="margin:0 0 6px;font-weight:bold;color:#e10600;">🏎️ 03. SQUAD INTEGRITY</p>' +
'    <ul style="margin:0 0 10px;padding-left:20px;">' +
'      <li style="margin-bottom:4px;">All 4 registered drivers must be physically present.</li>' +
'      <li>No last-minute substitutions will be entertained unless approved by the chief event coordinators.</li>' +
'    </ul>' +
'  </td></tr>' +

'  <tr><td style="padding:14px 30px 6px;">' +
'    <div style="font-size:14px;font-weight:bold;letter-spacing:2px;color:#111111;border-bottom:3px solid #ffd400;padding-bottom:8px;">📞 NEED HELP OR HAVE QUESTIONS?</div>' +
'  </td></tr>' +
'  <tr><td style="padding:12px 30px 18px;font-size:15px;line-height:24px;">' +
'    <p style="margin:0 0 8px;">For queries regarding credentials or schedules, contact our student coordinators:</p>' +
'    <p style="margin:0;"><strong>Preksha Dixit:</strong> <a href="tel:+919945867010" style="color:#111111;text-decoration:none;">9945867010</a><br><strong>Parinitha K:</strong> <a href="tel:+916361455193" style="color:#111111;text-decoration:none;">6361455193</a></p>' +
'  </td></tr>' +

'  <tr><td style="background:#111111;padding:24px 30px;text-align:center;">' +
'    <div style="font-size:15px;font-weight:bold;color:#ffd400;line-height:22px;margin-bottom:14px;">REV YOUR ENGINES. PLAN YOUR RELAY STRATEGY. GET READY FOR THE ULTIMATE SHOWDOWN! 🏎️</div>' +
'    <div style="font-size:13px;color:#ffffff;line-height:20px;">Best Regards,<br><strong>TEAM IVC</strong><br>Innovators and Visionaries Club<br>GRAND PRIX RELAYTHON’2026</div>' +
'    <div style="font-size:12px;font-style:italic;color:#bbbbbb;margin-top:12px;">Fuelled by innovation. Driven by teamwork.</div>' +
'  </td></tr>' +
'  <tr><td style="height:6px;background:#e10600;font-size:0;line-height:0;">&nbsp;</td></tr>' +

'</table>' +
'</td></tr>' +
'</table>' +
'</body>' +
'</html>';
}

/**
 * 1-Click Bulk Email Dispatcher
 * Triggered from the Google Sheet top menu: "Eventra Dispatch > Send All Credentials Emails"
 */
function sendCredentialsToAllApprovedTeams() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Support both "Credentials" and "Approved" sheets
  var sheet = ss.getSheetByName("Credentials") || ss.getSheetByName("Approved");
  if (!sheet) {
    SpreadsheetApp.getUi().alert("Sheet 'Credentials' or 'Approved' not found!");
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert("No teams found in sheet: " + sheet.getName());
    return;
  }
  
  var headers = data[0];
  var emailCol = headers.indexOf("Login Email ID") !== -1 ? headers.indexOf("Login Email ID") : headers.indexOf("Leader Email");
  var nameCol = headers.indexOf("Team Lead") !== -1 ? headers.indexOf("Team Lead") : headers.indexOf("Leader Name");
  var teamNameCol = headers.indexOf("Team Name");
  var teamCodeCol = headers.indexOf("Team Code");
  var passwordCol = headers.indexOf("Password") !== -1 ? headers.indexOf("Password") : headers.indexOf("Login Password");
  var whatsappCol = headers.indexOf("WhatsApp Group");
  var statusCol = headers.indexOf("Email Dispatch Status");
  var semCol = headers.indexOf("Leader Semester") !== -1 ? headers.indexOf("Leader Semester") :
               headers.indexOf("Leader Sem") !== -1 ? headers.indexOf("Leader Sem") :
               headers.indexOf("Semester") !== -1 ? headers.indexOf("Semester") :
               headers.indexOf("Sem");
  var trackCol = headers.indexOf("Track") !== -1 ? headers.indexOf("Track") : headers.indexOf("Track Name");
  
  if (emailCol === -1 || passwordCol === -1) {
    SpreadsheetApp.getUi().alert("Required email and password columns not found in sheet: " + sheet.getName());
    return;
  }
  
  // Ensure 'Email Dispatch Status' column exists to track sent emails
  if (statusCol === -1) {
    statusCol = headers.length;
    sheet.getRange(1, statusCol + 1).setValue("Email Dispatch Status").setFontWeight("bold").setBackground("#e0e0e0");
  }
  
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var email = String(row[emailCol] || "").trim();
    var password = String(row[passwordCol] || "").trim();
    var teamName = String(row[teamNameCol] || "Grand Prix Squad").trim();
    var teamCode = teamCodeCol !== -1 ? String(row[teamCodeCol] || "") : "";
    var leaderNameRaw = nameCol !== -1 ? String(row[nameCol] || "") : "Team Leader";
    // Strip phone numbers from "Name (+91...)" if present
    var leaderName = leaderNameRaw.replace(/\\s*\\([^)]*\\)/g, "").trim() || "Team Leader";
    var whatsappUrl = (whatsappCol !== -1 && row[whatsappCol]) ? String(row[whatsappCol]) : "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld";
    var dispatchStatus = statusCol !== -1 ? String(row[statusCol] || "") : "";
    
    // Skip if already sent or missing credentials
    if (dispatchStatus && dispatchStatus.indexOf("SENT") === 0) continue;
    if (!email || !password) continue;
    
    // Determine Track: "1st year" for 1st sem teams and "2nd yr" for 3rd sem teams
    var semVal = (semCol !== -1 ? String(row[semCol] || "") : "").toLowerCase().trim();
    var trackVal = (trackCol !== -1 ? String(row[trackCol] || "") : "").toLowerCase().trim();
    var trackName = "1st year"; // Default
    if (semVal.indexOf("3") !== -1 || semVal.indexOf("2nd") !== -1 || trackVal.indexOf("3") !== -1 || trackVal.indexOf("2nd") !== -1) {
      trackName = "2nd yr";
    } else if (semVal.indexOf("1") !== -1 || trackVal.indexOf("1") !== -1) {
      trackName = "1st year";
    } else if (trackCol !== -1 && row[trackCol]) {
      trackName = String(row[trackCol]).trim();
    }
    
    var subject = "[GRAND PRIX RELAYTHON’2026] Official Team Confirmation & Credentials - " + teamName + " (" + teamCode + ")";
    var htmlContent = buildTeamConfirmationEmailHtml(leaderName, teamName, teamCode, trackName, email, password, whatsappUrl);
    
    var body = "Dear " + leaderName + ",\\n\\n" +
      "Congratulations! Your team \\\"" + teamName + "\\\" has been successfully verified and approved for GRAND PRIX RELAYTHON’2026, organized by the Innovators and Visionaries Club (IVC).\\n\\n" +
      "Your registration is confirmed! Below are your official Team Code and Portal Login Credentials:\\n\\n" +
      "=========================================\\n" +
      "TEAM ACCESS CREDENTIALS & SQUAD DETAILS\\n" +
      "=========================================\\n" +
      "Team Name: " + teamName + "\\n" +
      "Team Code: " + teamCode + "\\n" +
      "Track: " + trackName + "\\n" +
      "Login Email: " + email + "\\n" +
      "Portal Password: " + password + "\\n" +
      "=========================================\\n\\n" +
      "IMPORTANT - JOIN OFFICIAL PARTICIPANTS WHATSAPP GROUP:\\n" +
      "All race schedules, slot timings, track rules and live announcements will be shared exclusively through the official WhatsApp group:\\n" +
      "👉 " + whatsappUrl + "\\n\\n" +
      "EVENT DAY CHECK-IN:\\n" +
      "Venue: Vidya Vardhaka College of Engineering (VVCE), Mysuru\\n" +
      "Arrive at the registration desk with all 4 squad members at least 30 minutes before your allotted slot with your Team Code (" + teamCode + ") and College ID cards.\\n\\n" +
      "For queries regarding credentials or schedules, contact student coordinators:\\n" +
      "• Preksha Dixit: +91 9945867010\\n" +
      "• Parinitha K: +91 6361455193\\n\\n" +
      "Best regards,\\n" +
      "TEAM IVC\\n" +
      "Innovators and Visionaries Club\\n" +
      "GRAND PRIX RELAYTHON’2026";
      
    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: body,
        htmlBody: htmlContent,
        name: "Innovators & Visionaries Club (IVC)",
        replyTo: "ivcofficial@vvce.ac.in"
      });
      sheet.getRange(i + 1, statusCol + 1).setValue("SENT: " + new Date().toLocaleString());
      count++;
    } catch (mailErr) {
      sheet.getRange(i + 1, statusCol + 1).setValue("ERROR: " + mailErr.toString());
    }
  }
  
  SpreadsheetApp.getUi().alert("Successfully sent official credentials to " + count + " teams!");
}

function clearAllTestData() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    "Clear All Test Data",
    "Are you sure you want to delete all participant test rows from Registrations, Waiting list, Credentials, and Approved sheets? (Headers will be kept intact)",
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = ["Registrations", "Waiting list", "Credentials", "Approved", "Rejected"];
  var clearedSheets = [];
  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      clearedSheets.push(name);
    }
  });
  ui.alert("Success: All test data has been cleared from: " + (clearedSheets.join(", ") || "None") + ". Headers are preserved!");
}

/**
 * Safe Test Function: Sends a single sample confirmation email to your personal address
 * without touching any rows or emailing any registered teams.
 */
function sendTestConfirmationEmail() {
  var ui = SpreadsheetApp.getUi();
  var defaultEmail = Session.getActiveUser().getEmail() || "";
  var prompt = ui.prompt(
    "📧 Send Test Confirmation Email",
    "Enter the email address you want to receive the test email at (or leave blank for " + defaultEmail + "):",
    ui.ButtonSet.OK_CANCEL
  );
  
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  var targetEmail = prompt.getResponseText().trim() || defaultEmail;
  if (!targetEmail) {
    ui.alert("No email address provided!");
    return;
  }
  
  var sampleLeader = "Charan C";
  var sampleTeam = "Velocity Racers";
  var sampleCode = "GP26-7842";
  var sampleTrack = "1st year";
  var samplePass = "VV26-9X4M";
  var sampleWhatsapp = "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld";
  
  var subject = "[TEST PREVIEW - GRAND PRIX RELAYTHON’2026] Official Team Confirmation & Credentials - " + sampleTeam + " (" + sampleCode + ")";
  var htmlContent = buildTeamConfirmationEmailHtml(sampleLeader, sampleTeam, sampleCode, sampleTrack, targetEmail, samplePass, sampleWhatsapp);
  
  try {
    MailApp.sendEmail({
      to: targetEmail,
      subject: subject,
      body: "Test confirmation email preview for " + sampleTeam,
      htmlBody: htmlContent,
      name: "Innovators & Visionaries Club (IVC)",
      replyTo: "ivcofficial@vvce.ac.in"
    });
    ui.alert("✅ Test email successfully sent to: " + targetEmail + "\\nCheck your inbox to inspect the exact layout, colors, and banner image!");
  } catch (err) {
    ui.alert("❌ Error sending test email: " + err.toString());
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 Eventra Dispatch")
    .addItem("🧪 Send Test Email to Myself (Safe Preview)", "sendTestConfirmationEmail")
    .addSeparator()
    .addItem("📧 Send All Credentials Emails (Approved Teams)", "sendCredentialsToAllApprovedTeams")
    .addSeparator()
    .addItem("🧹 Clear All Test / Mock Data", "clearAllTestData")
    .addToUi();
}
`.trim();
