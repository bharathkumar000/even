/**
 * Google Sheets Integration & Synchronization Module
 * Handles exporting and pushing verified team registrations directly into Google Sheets.
 */

export interface GoogleSheetRegistrationRecord {
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  leaderCollege: string;
  leaderSem: string;
  leaderBranch: string;
  transactionId: string;
  paymentProofUrl: string;
  status: string;
  timestamp?: string;
  teamCode?: string;
  usn?: string;
}

/**
 * Push a single registration record to a Google Sheets Apps Script Webhook.
 * Follows HTTP 302 redirects automatically (required by script.googleusercontent.com).
 */
export async function syncRegistrationToGoogleSheets(
  record: GoogleSheetRegistrationRecord
): Promise<{ success: boolean; message: string }> {
  const webhookUrl =
    process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
    process.env.GOOGLE_SHEET_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL;

  const payload = {
    timestamp: record.timestamp || new Date().toISOString(),
    teamName: record.teamName,
    leaderName: record.leaderName,
    leaderEmail: record.leaderEmail,
    leaderPhone: record.leaderPhone,
    leaderCollege: record.leaderCollege,
    leaderSem: record.leaderSem,
    leaderBranch: record.leaderBranch,
    transactionId: record.transactionId,
    paymentProofUrl: record.paymentProofUrl,
    status: record.status || "Verified",
    teamCode: record.teamCode || "",
    usn: record.usn || "",
  };

  if (!webhookUrl) {
    console.info(
      "[Google Sheets Sync] Record prepared. Set GOOGLE_SHEETS_WEBHOOK_URL in .env.local to stream rows to Google Sheets in real time:",
      payload.teamName,
      payload.transactionId
    );
    return {
      success: true,
      message: "Record verified locally. Configure GOOGLE_SHEETS_WEBHOOK_URL to stream automatically.",
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      return {
        success: true,
        message: `Successfully synced ${record.teamName} to Google Sheets.`,
      };
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(`[Google Sheets Sync] Webhook responded with status ${res.status}: ${errText}`);
      return {
        success: false,
        message: `Google Sheets Webhook returned HTTP ${res.status}`,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Google Sheets Sync Error]:", errorMsg);
    return {
      success: false,
      message: `Failed to push to Google Sheets: ${errorMsg}`,
    };
  }
}

/**
 * Generate a complete, formatted CSV string representing registrations
 * Ready for one-click download and instant import into Google Sheets.
 */
export function generateRegistrationsCsv(records: GoogleSheetRegistrationRecord[]): string {
  const headers = [
    "Timestamp",
    "Team Name",
    "Team Code",
    "Leader Name",
    "Leader Email",
    "Leader Phone",
    "College / Institution",
    "Semester",
    "Branch",
    "Transaction ID (UTR)",
    "Payment Proof URL",
    "Verification Status",
  ];

  const escapeCsv = (val: string | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map((r) => [
    escapeCsv(r.timestamp),
    escapeCsv(r.teamName),
    escapeCsv(r.teamCode),
    escapeCsv(r.leaderName),
    escapeCsv(r.leaderEmail),
    escapeCsv(r.leaderPhone),
    escapeCsv(r.leaderCollege),
    escapeCsv(r.leaderSem),
    escapeCsv(r.leaderBranch),
    escapeCsv(r.transactionId),
    escapeCsv(r.paymentProofUrl),
    escapeCsv(r.status),
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
}

/**
 * Clean Google Apps Script Template code for the user/admin to paste
 * into their Google Sheet's script editor.
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Auto-create header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Team Name",
        "Team Code",
        "Leader Name",
        "Leader Email",
        "Leader Phone",
        "College",
        "Semester",
        "Branch",
        "Transaction ID (UTR)",
        "Payment Proof URL",
        "Status"
      ]);
      sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#f3f3f3");
    }
    
    var data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.teamName || "",
      data.teamCode || "",
      data.leaderName || "",
      data.leaderEmail || "",
      data.leaderPhone || "",
      data.leaderCollege || "",
      data.leaderSem || "",
      data.leaderBranch || "",
      data.transactionId || "",
      data.paymentProofUrl || "",
      data.status || "Verified"
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Row added successfully" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`.trim();
