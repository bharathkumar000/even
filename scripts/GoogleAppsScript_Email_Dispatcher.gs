/**
 * ==============================================================================
 * GRAND PRIX RELAYTHON'2026 - Official Google Apps Script Automation
 * Innovators and Visionaries Club (IVC) | Vidya Vardhaka College of Engineering
 * ==============================================================================
 * Features:
 *  1. Custom menu in Google Sheets: "Eventra Dispatch"
 *  2. 1-Click Bulk Email Dispatcher with Responsive F1-Themed HTML Email
 *  3. Dynamic Track Detection:
 *     - "1st year" for 1st Semester teams
 *     - "2nd yr" for 3rd Semester teams
 *  4. Official WhatsApp Group Link & Coordinator Contacts
 *  5. Webhook listener (doPost) for live form submissions and Drive screenshot upload
 * ==============================================================================
 */

/**
 * Automatically creates custom menu upon opening Google Spreadsheet.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Eventra Dispatch")
    .addItem("🧪 Send Test Email to Myself (Safe Preview)", "sendTestConfirmationEmail")
    .addSeparator()
    .addItem("🚀 Send All Credentials Emails (Approved Teams)", "sendCredentialsToAllApprovedTeams")
    .addSeparator()
    .addItem("⚠️ Clear Test Data (Registrations / Approved)", "clearAllTestData")
    .addToUi();
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
    ui.alert("✅ Test email successfully sent to: " + targetEmail + "\nCheck your inbox to inspect the exact layout, colors, and banner image!");
  } catch (err) {
    ui.alert("❌ Error sending test email: " + err.toString());
  }
}

/**
 * Generates the responsive HTML confirmation email template for Grand Prix Relaython 2026.
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
    var leaderName = leaderNameRaw.replace(/\s*\([^)]*\)/g, "").trim() || "Team Leader";
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
    
    var body = "Dear " + leaderName + ",\n\n" +
      "Congratulations! Your team \"" + teamName + "\" has been successfully verified and approved for GRAND PRIX RELAYTHON’2026, organized by the Innovators and Visionaries Club (IVC).\n\n" +
      "Your registration is confirmed! Below are your official Team Code and Portal Login Credentials:\n\n" +
      "=========================================\n" +
      "TEAM ACCESS CREDENTIALS & SQUAD DETAILS\n" +
      "=========================================\n" +
      "Team Name: " + teamName + "\n" +
      "Team Code: " + teamCode + "\n" +
      "Track: " + trackName + "\n" +
      "Login Email: " + email + "\n" +
      "Portal Password: " + password + "\n" +
      "=========================================\\n\n" +
      "IMPORTANT - JOIN OFFICIAL PARTICIPANTS WHATSAPP GROUP:\n" +
      "All race schedules, slot timings, track rules and live announcements will be shared exclusively through the official WhatsApp group:\n" +
      "👉 " + whatsappUrl + "\n\n" +
      "EVENT DAY CHECK-IN:\n" +
      "Venue: Vidya Vardhaka College of Engineering (VVCE), Mysuru\n" +
      "Arrive at the registration desk with all 4 squad members at least 30 minutes before your allotted slot with your Team Code (" + teamCode + ") and College ID cards.\n\n" +
      "For queries regarding credentials or schedules, contact student coordinators:\n" +
      "• Preksha Dixit: +91 9945867010\n" +
      "• Parinitha K: +91 6361455193\n\n" +
      "Best regards,\n" +
      "TEAM IVC\n" +
      "Innovators and Visionaries Club\n" +
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

/**
 * Webhook Listener (doPost) for real-time registration sync from Next.js.
 */
function doPost(e) {
  try {
    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var sheetName = data.sheetName || "Registrations";
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        "Timestamp",
        "Status",
        "Team Name",
        "Team Code",
        "Track",
        "Rejection Reason",
        // Leader
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
    
    // Upload payment proof screenshot directly to Google Drive
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
        
        var folders = DriveApp.getFoldersByName("Eventra Payment Proofs");
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Eventra Payment Proofs");
        var driveFile = folder.createFile(fileBlob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        proofLink = driveFile.getUrl();
      } catch (uploadErr) {
        proofLink = "Upload error: " + uploadErr.toString();
      }
    }
    
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
 * Helper to clear test data.
 */
function clearAllTestData() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    "⚠️ CONFIRM TEST DATA RESET",
    "Are you sure you want to clear test data from 'Registrations' and 'Approved' sheets?",
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ["Registrations", "Approved", "Credentials"].forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 1) {
      sh.deleteRows(2, sh.getLastRow() - 1);
    }
  });
  ui.alert("Done! Test rows cleared while preserving headers.");
}
