/**
 * Google Sheets & Drive Synchronization Module
 * Automatically streams complete 4-driver registration details and payment proofs
 * into 3 dedicated sheets:
 *   - Sheet 1: "Registrations" (All teams upon registration submission, irrespective of approval status)
 *   - Sheet 2: "Approved" (Teams approved by admin)
 *   - Sheet 3: "Rejected" (Teams rejected by admin)
 */

export interface ComprehensiveTeamRecord {
  sheetName?: "Registrations" | "Approved" | "Rejected";
  teamName: string;
  track?: string;
  teamCode?: string;
  status: "Pending" | "Waitlist" | "Approved" | "Rejected";
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
    "https://script.google.com/macros/s/AKfycbxEnKEASF61Tz5h7GbbOp54Vr2idWXA51THgIb6eWwcnuy395OhHnYs_IRcf8BwSvYOSw/exec";

  const targetTab =
    record.sheetName ||
    (record.status === "Approved" ? "Approved" : record.status === "Rejected" ? "Rejected" : "Registrations");

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
    
    // Determine target sheet: Registrations (Sheet 1), Approved (Sheet 2), Rejected (Sheet 3)
    var sheetName = "Registrations";
    if (data.sheetName) {
      sheetName = data.sheetName;
    } else if (data.status === "Approved") {
      sheetName = "Approved";
    } else if (data.status === "Rejected") {
      sheetName = "Rejected";
    } else {
      sheetName = "Registrations";
    }
    
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
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
        "Payment Proof Drive Link"
      ]);
      sheet.getRange(1, 1, 1, 36).setFontWeight("bold").setBackground("#e0e0e0");
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
      proofLink
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, proofUrl: proofLink, sheet: sheetName }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`.trim();
