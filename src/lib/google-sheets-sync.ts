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
          "One Member Contact Info (Driver 2)"
        ]);
        sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#d9ead3");
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
        memberContact
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
      data.whatsappGroup || "https://chat.whatsapp.com/Baq9uEcVFQs9loSZxJTspB",
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
    var whatsappUrl = (whatsappCol !== -1 && row[whatsappCol]) ? String(row[whatsappCol]) : "https://chat.whatsapp.com/Baq9uEcVFQs9loSZxJTspB";
    var dispatchStatus = statusCol !== -1 ? String(row[statusCol] || "") : "";
    
    // Skip if already sent or missing credentials
    if (dispatchStatus && dispatchStatus.indexOf("SENT") === 0) continue;
    if (!email || !password) continue;
    
    var subject = "[IVC Relaython 2026] Official Team Credentials & WhatsApp Group - " + teamName;
    var body = "Dear " + leaderName + ",\\n\\n" +
      "Congratulations! Your team registration and payment for IVC Relaython 2026 have been successfully verified.\\n\\n" +
      "Here are your official team credentials:\\n\\n" +
      "=========================================\\n" +
      "TEAM ACCESS CREDENTIALS\\n" +
      "=========================================\\n" +
      "Team Name / Username: " + teamName + "\\n" +
      "Team Code: " + teamCode + "\\n" +
      "Login Email: " + email + "\\n" +
      "Generated Password: " + password + "\\n" +
      "=========================================\\n\\n" +
      "IMPORTANT - JOIN OFFICIAL PARTICIPANTS WHATSAPP GROUP:\\n" +
      "Join the official event WhatsApp group immediately to receive live schedule updates, announcements, and round briefings:\\n" +
      "👉 " + whatsappUrl + "\\n\\n" +
      "For any queries or assistance, contact the student coordinators:\\n" +
      "• Moksh: +91 831 035 3103\\n" +
      "• Parinitha: +91 63614 55193\\n" +
      "• Monish: +91 95917 55995\\n\\n" +
      "Best regards,\\n" +
      "Innovators & Visionaries Club (IVC)";
      
    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: body,
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 Eventra Dispatch")
    .addItem("📧 Send All Credentials Emails", "sendCredentialsToAllApprovedTeams")
    .addToUi();
}
`.trim();
