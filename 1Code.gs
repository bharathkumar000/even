// src/lib/googleSheet.gs (Google Apps Script for ViceVerse Registration & QR Check‑In)

/**
 * ============================================================================
 * VICEVERSE EVENT REGISTRATION & QR CHECK‑IN PLATFORM - BACKEND API & SCANNER
 * ============================================================================
 * Connected Registration Portal: https://vice-verse-ivc.vercel.app/
 *
 * Complete 31-Column Structure (Columns A through AE):
 * Col A  (1)  - Registration ID
 * Col B  (2)  - Team Name
 * Col C  (3)  - College
 * Col D  (4)  - Team Leader
 * Col E  (5)  - Member 2
 * Col F  (6)  - Member 3
 * Col G  (7)  - Team Leader USN
 * Col H  (8)  - Member 2 USN
 * Col I  (9)  - Member 3 USN
 * Col J  (10) - member 1 branch                     (Team Leader Branch)
 * Col K  (11) - member 2 branch
 * Col L  (12) - member 3 branch
 * Col M  (13) - Contact Number
 * Col N  (14) - Email
 * Col O  (15) - Selected Domain                     (Chosen Track / Mission)
 * Col P  (16) - Transaction Id                      (Payment Reference / UTR)
 * Col Q  (17) - Team ID                             <--- Target 1
 * Col R  (18) - QR Token                            <--- Target 2
 * Col S  (19) - QR URL                              <--- Target 3
 * Col T  (20) - QR Code Formula                     <--- Target 4
 * Col U  (21) - Morning Registration                (Check‑In: "Checked")
 * Col V  (22) - Goodies                             (Check‑In: "Checked")
 * Col W  (23) - Lunch Team Leader                   (Untouched)
 * Col X  (24) - Lunch Member 2                      (Untouched)
 * Col Y  (25) - Lunch Member 3                      (Untouched)
 * Col Z  (26) - Snacks Team Leader                  (Untouched)
 * Col AA (27) - Snacks Member 1                     (Untouched)
 * Col AB (28) - Snacks Member 2                     (Untouched)
 * Col AC (29) - LINKDIN                             (Social / Profile)
 * Col AD (30) - INSTAGRAM                           (Social / Profile)
 * Col AE (31) - FEEDBACK                            (Feedback / Comments)
 * ===========================================================================
 */

// 1. Central Configuration
var CONFIG = {
  SHEET_NAME: "REGESTRATION VICEVERSE",
  HEADER_ROW: 1,
  DATA_START_ROW: 2,
  TOTAL_COLUMNS: 35,

  HEADERS: {
    COL_A: "Registration ID",
    COL_B: "Team Name",
    COL_C: "College",
    COL_D: "Team Leader",
    COL_E: "Member 2",
    COL_F: "Member 3",
    COL_G: "Team Leader USN",
    COL_H: "Member 2 USN",
    COL_I: "Member 3 USN",
    COL_J: "member 1 branch",
    COL_K: "member 2 branch",
    COL_L: "member 3 branch",
    COL_M: "Contact Number",
    COL_N: "Email",
    COL_O: "Selected Domain",
    COL_P: "Transaction Id",
    COL_Q: "Payment Status",
    COL_R: "Team ID",
    COL_S: "QR Token",
    COL_T: "QR URL",
    COL_U: "QR Code",
    COL_V: "Morning Registration",
    COL_W: "Goodies",
    COL_X: "Lunch Team Leader",
    COL_Y: "Lunch Member 2",
    COL_Z: "Lunch Member 3",
    COL_AA: "Snacks Team Leader",
    COL_AB: "Snacks Member 1",
    COL_AC: "Snacks Member 2",
    COL_AD: "LINKDIN",
    COL_AE: "INSTAGRAM",
    COL_AF: "FEEDBACK",
    COL_AG: "Receipt URL",
    COL_AH: "Login Username",
    COL_AI: "Login Password"
  },

  FALLBACK_COLUMNS: {
    REGISTRATION_ID: 1,     // A
    TEAM_NAME: 2,           // B
    COLLEGE: 3,             // C
    TEAM_LEADER: 4,         // D
    MEMBER_2: 5,            // E
    MEMBER_3: 6,            // F
    TEAM_LEADER_USN: 7,     // G
    MEMBER_2_USN: 8,        // H
    MEMBER_3_USN: 9,        // I
    TEAM_LEADER_BRANCH: 10, // J ("member 1 branch")
    MEMBER_2_BRANCH: 11,    // K ("member 2 branch")
    MEMBER_3_BRANCH: 12,    // L ("member 3 branch")
    CONTACT_NUMBER: 13,     // M
    EMAIL: 14,              // N
    SELECTED_DOMAIN: 15,    // O ("Selected Domain")
    TRANSACTION_ID: 16,     // P ("Transaction Id")
    PAYMENT_STATUS: 17,     // Q (Dropdown: Waiting, Yes, No)
    TEAM_ID: 18,            // R
    QR_TOKEN: 19,           // S
    QR_URL: 20,             // T
    QR_CODE: 21,            // U
    MORNING_REG: 22,        // V
    GOODIES: 23,           // W
    LUNCH_TL: 24,           // X
    LUNCH_M2: 25,           // Y
    LUNCH_M3: 26,           // Z
    SNACKS_TL: 27,          // AA
    SNACKS_M1: 28,          // AB
    SNACKS_M2: 29,          // AC
    LINKDIN: 30,            // AD
    INSTAGRAM: 31,          // AE
    FEEDBACK: 32,           // AF
    RECEIPT_URL: 33,        // AG
    LOGIN_USERNAME: 34,     // AH
    LOGIN_PASSWORD: 35      // AI
  },

  PAYMENT_STATUS: {
    DEFAULT: "Waiting",
    OPTIONS: ["Waiting", "Yes", "No"]
  },

  TEAM_ID: {
    PREFIX: "IVC-VV-",
    PADDING_LENGTH: 3
  },

  QR_TOKEN: {
    PREFIX: "vvt_",
    TOTAL_HEX_LENGTH: 48
  },

  QR_SETTINGS: {
    REGISTRATION_PORTAL_URL: "https://vice-verse-ivc.vercel.app/",
    BASE_CHECKIN_URL: "https://vice-verse-ivc.vercel.app/checkin",
    QR_SIZE: 250,
    DEFAULT_ROW_HEIGHT: 70
  },

  RECEIPTS_DRIVE_FOLDER_ID: "1TurV3Q6kSOn3GtxXSrVZEzg2JjlhtdGV"
};

// 2. Utility Functions
// Helper to extract a folder ID from a full Google Drive URL or a plain ID
function extractFolderId(input) {
  if (!input) return '';
  // Extract ID from a folder URL like https://drive.google.com/drive/folders/<ID>
  var folderMatch = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  // Extract ID from a file URL like https://drive.google.com/file/d/<ID>/view
  var fileMatch = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) return fileMatch[1];
  // Assume the input itself is the ID
  return input.trim();
}
var Utils = {
  getTargetSheet: function(spreadsheet) {
    var ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("Unable to access active spreadsheet. Please open via Google Sheets Extensions > Apps Script.");
    }

    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      var availableSheets = ss.getSheets().map(function(s) {
        return '"' + s.getName() + '"';
      }).join(", ");
      throw new Error(
        'Sheet tab "' + CONFIG.SHEET_NAME + '" was not found! Available sheet tabs are: [' + availableSheets + ']. ' +
        'Please ensure the sheet tab name is spelled exactly as "' + CONFIG.SHEET_NAME + '".'
      );
    }

    return sheet;
  },

  getColumnMapping: function(sheet) {
    var lastCol = Math.max(sheet.getLastColumn(), CONFIG.TOTAL_COLUMNS);
    var lastRow = sheet.getLastRow();
    if (lastCol === 0) {
      throw new Error('Sheet "' + CONFIG.SHEET_NAME + '" has no columns or headers.');
    }

    // Inspect Row 1 and Row 2 to locate headers regardless of whether they are on Row 1 or Row 2
    var scanRowCount = Math.min(Math.max(lastRow, 1), 2);
    var headerRows = sheet.getRange(1, 1, scanRowCount, lastCol).getValues();

    var mapping = {
      indices: {},
      colNumbers: {},
      rawHeaders: headerRows[0] || []
    };

    for (var r = 0; r < headerRows.length; r++) {
      var currentRow = headerRows[r];
      for (var colIdx = 0; colIdx < currentRow.length; colIdx++) {
        var cleanHeader = String(currentRow[colIdx] || "").trim().toLowerCase();
        if (cleanHeader) {
          mapping.indices[cleanHeader] = colIdx;
          mapping.colNumbers[cleanHeader] = colIdx + 1;
        }
      }
    }

    function resolve(keyName, fallbackColNumber, aliases) {
      aliases = aliases || [];
      var primaryName = CONFIG.HEADERS[keyName] || "";
      var candidates = [primaryName].concat(aliases);

      for (var c = 0; c < candidates.length; c++) {
        var targetLower = String(candidates[c]).trim().toLowerCase();
        if (mapping.colNumbers[targetLower] !== undefined) {
          var idx = mapping.indices[targetLower];
          var detected = (headerRows[1] && headerRows[1][idx]) || headerRows[0][idx] || candidates[c];
          return { index0: idx, colNum: idx + 1, detectedName: detected };
        }
      }

      return { index0: fallbackColNumber - 1, colNum: fallbackColNumber, detectedName: "Fallback Col " + fallbackColNumber };
    }

    return {
      registrationId: resolve("COL_A", CONFIG.FALLBACK_COLUMNS.REGISTRATION_ID),
      teamName: resolve("COL_B", CONFIG.FALLBACK_COLUMNS.TEAM_NAME),
      college: resolve("COL_C", CONFIG.FALLBACK_COLUMNS.COLLEGE),
      teamLeader: resolve("COL_D", CONFIG.FALLBACK_COLUMNS.TEAM_LEADER),
      member2: resolve("COL_E", CONFIG.FALLBACK_COLUMNS.MEMBER_2),
      member3: resolve("COL_F", CONFIG.FALLBACK_COLUMNS.MEMBER_3),
      teamLeaderUsn: resolve("COL_G", CONFIG.FALLBACK_COLUMNS.TEAM_LEADER_USN),
      member2Usn: resolve("COL_H", CONFIG.FALLBACK_COLUMNS.MEMBER_2_USN),
      member3Usn: resolve("COL_I", CONFIG.FALLBACK_COLUMNS.MEMBER_3_USN),
      teamLeaderBranch: resolve("COL_J", CONFIG.FALLBACK_COLUMNS.TEAM_LEADER_BRANCH, ["member 1 branch", "Team Leader Branch", "Leader Branch", "TL Branch", "Branch Team Leader", "Leader's Branch"]),
      member2Branch: resolve("COL_K", CONFIG.FALLBACK_COLUMNS.MEMBER_2_BRANCH, ["member 2 branch", "Member 2 Branch", "Member2 Branch", "M2 Branch"]),
      member3Branch: resolve("COL_L", CONFIG.FALLBACK_COLUMNS.MEMBER_3_BRANCH, ["member 3 branch", "Member 3 Branch", "Member3 Branch", "M3 Branch"]),
      contactNumber: resolve("COL_M", CONFIG.FALLBACK_COLUMNS.CONTACT_NUMBER, ["Contact Number", "Phone", "Mobile", "Contact", "Phone Number"]),
      email: resolve("COL_N", CONFIG.FALLBACK_COLUMNS.EMAIL, ["Email", "Email ID", "Mail", "Email Address"]),
      selectedDomain: resolve("COL_O", CONFIG.FALLBACK_COLUMNS.SELECTED_DOMAIN, ["Selected Domain", "Domain", "Target Mission", "Mission Domain", "Chosen Domain", "Track"]),
      transactionId: resolve("COL_P", CONFIG.FALLBACK_COLUMNS.TRANSACTION_ID, ["Transaction Id", "Transaction ID", "Txn ID", "Transaction", "Txn", "Payment Id", "UTR", "UPI Txn ID", "Transaction_Id"]),
      paymentStatus: resolve("COL_Q", CONFIG.FALLBACK_COLUMNS.PAYMENT_STATUS, ["Payment Status", "Payment", "Payment Verified", "Transaction Status", "Txn Status", "Verified", "Approval", "Payment Approval"]),
      teamId: resolve("COL_R", CONFIG.FALLBACK_COLUMNS.TEAM_ID),
      qrToken: resolve("COL_S", CONFIG.FALLBACK_COLUMNS.QR_TOKEN),
      qrUrl: resolve("COL_T", CONFIG.FALLBACK_COLUMNS.QR_URL),
      qrCode: resolve("COL_U", CONFIG.FALLBACK_COLUMNS.QR_CODE),
      morningReg: resolve("COL_V", CONFIG.FALLBACK_COLUMNS.MORNING_REG, ["Morning Registration Team Leader", "Morning Registration", "Morning Reg"]),
      goodies: resolve("COL_W", CONFIG.FALLBACK_COLUMNS.GOODIES, ["Goodies Team Leader", "Goodles Team Leader", "Goodies", "Goodles"]),
      lunchTL: resolve("COL_X", CONFIG.FALLBACK_COLUMNS.LUNCH_TL, ["Lunch Team Leader", "Lunch TL", "Lunch Leader"]),
      lunchM2: resolve("COL_Y", CONFIG.FALLBACK_COLUMNS.LUNCH_M2, ["Lunch Member 2", "Lunch M2"]),
      lunchM3: resolve("COL_Z", CONFIG.FALLBACK_COLUMNS.LUNCH_M3, ["Lunch Member 3", "Lunch M3"]),
      snacksTL: resolve("COL_AA", CONFIG.FALLBACK_COLUMNS.SNACKS_TL, ["Snacks Team Leader", "Snacks TL", "Snacks Leader"]),
      snacksM1: resolve("COL_AB", CONFIG.FALLBACK_COLUMNS.SNACKS_M1, ["Snacks Member 1", "Snacks M1"]),
      snacksM2: resolve("COL_AC", CONFIG.FALLBACK_COLUMNS.SNACKS_M2, ["Snacks Member 2", "Snacks M2"]),
      linkdin: resolve("COL_AD", CONFIG.FALLBACK_COLUMNS.LINKDIN, ["linkdin", "linkedin", "linked in", "linkedin profile", "linkedin url"]),
      feedback: resolve("COL_AF", CONFIG.FALLBACK_COLUMNS.FEEDBACK, ["feedback","comment"]),
      receiptUrl: resolve("COL_AG", CONFIG.FALLBACK_COLUMNS.RECEIPT_URL, ["receipt url", "receiptlink", "receipt link"]),
      loginUsername: resolve("COL_AH", CONFIG.FALLBACK_COLUMNS.LOGIN_USERNAME),
      loginPassword: resolve("COL_AI", CONFIG.FALLBACK_COLUMNS.LOGIN_PASSWORD),
      allHeaders: headerRows[0] || []
    };
  },

  generateCryptographicToken: function(existingTokens) {
    var token = "";
    var attempts = 0;
    var maxAttempts = 100;
    do {
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error("Failed to generate unique QR Token after multiple attempts.");
      }

      var rawEntropy = [
        Utilities.getUuid(),
        new Date().getTime().toString(36),
        Math.random().toString(36).substring(2),
        Utilities.getUuid()
      ].join("-");

      var digest = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        rawEntropy,
        Utilities.Charset.UTF_8
      );

      var hexString = "";
      for (var i = 0; i < digest.length; i++) {
        var byteVal = digest[i] < 0 ? digest[i] + 256 : digest[i];
        var hexPart = byteVal.toString(16);
        if (hexPart.length === 1) hexPart = "0" + hexPart;
        hexString += hexPart;
      }
      token = CONFIG.QR_TOKEN.PREFIX + hexString.substring(0, CONFIG.QR_TOKEN.TOTAL_HEX_LENGTH);
    } while (existingTokens && existingTokens.has(token));

    if (existingTokens) {
      existingTokens.add(token);
    }
    return token;
  },

  getHighestTeamIdNumber: function(existingTeamIds) {
    var maxNumber = 0;
    var prefix = CONFIG.TEAM_ID.PREFIX;
    for (var i = 0; i < existingTeamIds.length; i++) {
      var rawId = existingTeamIds[i];
      if (!rawId) continue;
      var strId = String(rawId).trim();
      if (strId.indexOf(prefix) === 0) {
        var numPart = strId.substring(prefix.length);
        var parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed > maxNumber) {
          maxNumber = parsed;
        }
      }
    }
    return maxNumber;
  },

  formatTeamId: function(seqNumber) {
    var numStr = String(seqNumber);
    while (numStr.length < CONFIG.TEAM_ID.PADDING_LENGTH) {
      numStr = "0" + numStr;
    }
    return CONFIG.TEAM_ID.PREFIX + numStr;
  },

  buildQrUrl: function(token, teamId) {
    var base = CONFIG.QR_SETTINGS.BASE_CHECKIN_URL;
    if (!base || base.trim() === "") {
      try {
        base = ScriptApp.getService().getUrl();
      } catch (e) {
        base = "https://vice-verse-ivc.vercel.app/checkin";
      }
    }
    if (!base) base = "https://vice-verse-ivc.vercel.app/checkin";
    return base + "?token=" + encodeURIComponent(token) + "&teamId=" + encodeURIComponent(teamId);
  },

  buildQrFormula: function(rowNumber, qrUrlColLetter) {
    qrUrlColLetter = qrUrlColLetter || "N";
    var size = CONFIG.QR_SETTINGS.QR_SIZE;
    return '=IMAGE("https://quickchart.io/qr?size=' + size + '&text=" & ENCODEURL(' + qrUrlColLetter + rowNumber + '))';
  },

  colNumberToLetter: function(colNum) {
    var temp;
    var letter = "";
    while (colNum > 0) {
      temp = (colNum - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      colNum = Math.floor((colNum - temp - 1) / 26);
    }
    return letter;
  },

  safeLog: function(message) {
    Logger.log("[ViceVerse Automation] " + message);
  }
};

// 3. Core Sheet Scanner & Registration Processor
var RegistrationService = {
  processRegistrations: function(options) {
    options = options || {};
    var isDryRun = options.dryRun === true;
    var sheet = Utils.getTargetSheet();
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    Utils.safeLog('Starting registration check on tab "' + sheet.getName() + '". (DryRun: ' + isDryRun + ')');

    if (lastRow <= CONFIG.HEADER_ROW) {
      return { status: "EMPTY_SHEET", message: "Sheet contains only column headers. Ready for registrations." };
    }

    var colMap = Utils.getColumnMapping(sheet);
    var numDataRows = lastRow - CONFIG.HEADER_ROW;

    var dataRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, numDataRows, Math.max(lastCol, CONFIG.TOTAL_COLUMNS));
    var values = dataRange.getValues();
    var formulas = dataRange.getFormulas();

    // 1. Collect existing tokens ONLY from rows with active registration data
    var existingTokens = new Set();
    for (var i = 0; i < values.length; i++) {
      var checkRow = values[i];
      var hasData = false;
      for (var c = 0; c < Math.min(16, checkRow.length); c++) {
        if (String(checkRow[c] || "").trim() !== "") { hasData = true; break; }
      }
      if (hasData) {
        var currentToken = String(checkRow[colMap.qrToken.index0] || "").trim();
        if (currentToken) existingTokens.add(currentToken);
      }
    }

    // 2. Prepare batch updates for Columns Q (Payment Status) and R, S, T, U (QR data)
    var paymentStatusUpdates = [];
    var teamIdUpdates = [];
    var qrTokenUpdates = [];
    var qrUrlUpdates = [];
    var qrFormulaUpdates = [];

    var validTeamsCount = 0, newlyGeneratedTeamIds = 0, newlyGeneratedTokens = 0, newlyGeneratedUrls = 0, newlyGeneratedCodes = 0, clearedTeamsCount = 0, rowsToUpdate = false;

    var qrUrlColLetter = Utils.colNumberToLetter(colMap.qrUrl.colNum); // Usually "T"
    var teamCounter = CONFIG.TEAM_ID.START_NUMBER || 1;

    for (var j = 0; j < values.length; j++) {
      var row = values[j];
      var rowFormulas = formulas[j];
      var rowNumber = CONFIG.DATA_START_ROW + j;

      // Skip row if it is a secondary header row (e.g., Row 2 holding column headers)
      var firstColText = String(row[0] || "").trim().toLowerCase();
      var colAdText = colMap.linkdin ? String(row[colMap.linkdin.index0] || "").trim().toLowerCase() : "";
      if (firstColText === "registration id" || firstColText === "team id" || colAdText === "linkdin" || colAdText === "linkedin") {
        paymentStatusUpdates.push([row[colMap.paymentStatus.index0] || ""]);
        teamIdUpdates.push([row[colMap.teamId.index0] || ""]);
        qrTokenUpdates.push([row[colMap.qrToken.index0] || ""]);
        qrUrlUpdates.push([row[colMap.qrUrl.index0] || ""]);
        qrFormulaUpdates.push([rowFormulas[colMap.qrCode.index0] || ""]);
        continue;
      }

      // Check if row has registration info in columns A-P (indices 0 to 15)
      var regId = String(row[colMap.registrationId.index0] || "").trim();
      var teamName = String(row[colMap.teamName.index0] || "").trim();
      var teamLeader = String(row[colMap.teamLeader.index0] || "").trim();
      var hasRegistrationData = regId !== "" || teamName !== "" || teamLeader !== "";

      if (!hasRegistrationData) {
        for (var c = 0; c < Math.min(16, row.length); c++) {
          if (String(row[c] || "").trim() !== "") { hasRegistrationData = true; break; }
        }
      }

      var currentPaymentStatus = String(row[colMap.paymentStatus.index0] || "").trim();
      var currentTeamId = String(row[colMap.teamId.index0] || "").trim();
      var currentTokenVal = String(row[colMap.qrToken.index0] || "").trim();
      var currentUrl = String(row[colMap.qrUrl.index0] || "").trim();
      var currentFormula = String(rowFormulas[colMap.qrCode.index0] || "").trim();

      // IF BLANK / DELETED ROW (no registration data in Columns A-P):
      // Automatically DELETE Payment Status and QR columns
      if (!hasRegistrationData) {
        if (currentPaymentStatus !== "" || currentTeamId !== "" || currentTokenVal !== "" || currentUrl !== "" || currentFormula !== "") {
          rowsToUpdate = true;
          clearedTeamsCount++;
        }
        paymentStatusUpdates.push([""]);
        teamIdUpdates.push([""]);
        qrTokenUpdates.push([""]);
        qrUrlUpdates.push([""]);
        qrFormulaUpdates.push([""]);
        continue;
      }

      validTeamsCount++;

      // Strict continuous sequential Team ID for this row
      var expectedTeamId = Utils.formatTeamId(teamCounter);
      teamCounter++;

      var rowNeedsUpdate = false;

      // Payment Status (Column Q): Default to "Waiting" if empty
      var expectedPaymentStatus = currentPaymentStatus;
      if (!expectedPaymentStatus) {
        expectedPaymentStatus = (CONFIG.PAYMENT_STATUS && CONFIG.PAYMENT_STATUS.DEFAULT) || "Waiting";
        rowNeedsUpdate = true;
      }

      // Target 1: Column R (Team ID)
      if (currentTeamId !== expectedTeamId) {
        currentTeamId = expectedTeamId;
        newlyGeneratedTeamIds++;
        rowNeedsUpdate = true;
      }

      // Target 2: Column S (QR Token)
      if (!currentTokenVal || currentTokenVal.indexOf(CONFIG.QR_TOKEN.PREFIX) !== 0) {
        currentTokenVal = Utils.generateCryptographicToken(existingTokens);
        existingTokens.add(currentTokenVal);
        newlyGeneratedTokens++;
        rowNeedsUpdate = true;
      }

      // Target 3: Column T (QR URL)
      var expectedUrl = Utils.buildQrUrl(currentTokenVal, currentTeamId);
      if (currentUrl !== expectedUrl) {
        currentUrl = expectedUrl;
        newlyGeneratedUrls++;
        rowNeedsUpdate = true;
      }

      // Target 4: Column U (QR Code Formula)
      var expectedFormula = Utils.buildQrFormula(rowNumber, qrUrlColLetter);
      var hasValidFormula = currentFormula.indexOf("=") === 0 && currentFormula.indexOf("IMAGE") !== -1;
      if (!hasValidFormula || currentFormula !== expectedFormula) {
        currentFormula = expectedFormula;
        newlyGeneratedCodes++;
        rowNeedsUpdate = true;
      }

      if (rowNeedsUpdate) rowsToUpdate = true;

      paymentStatusUpdates.push([expectedPaymentStatus]);
      teamIdUpdates.push([currentTeamId]);
      qrTokenUpdates.push([currentTokenVal]);
      qrUrlUpdates.push([currentUrl]);
      qrFormulaUpdates.push([currentFormula]);
    }

    // 3. Write updates safely to Google Sheets (Columns Q, R, S, T, U)
    if (!isDryRun && rowsToUpdate && numDataRows > 0) {
      // Column Q: Payment Status dropdown values & validation
      sheet.getRange(CONFIG.DATA_START_ROW, colMap.paymentStatus.colNum, numDataRows, 1).setValues(paymentStatusUpdates);
      var options = (CONFIG.PAYMENT_STATUS && CONFIG.PAYMENT_STATUS.OPTIONS) || ["Waiting", "Yes", "No"];
      var dropdownRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(options, true)
        .setAllowInvalid(true)
        .build();
      sheet.getRange(CONFIG.DATA_START_ROW, colMap.paymentStatus.colNum, numDataRows, 1).setDataValidation(dropdownRule);

      // Columns R, S, T, U: QR Data
      sheet.getRange(CONFIG.DATA_START_ROW, colMap.teamId.colNum, numDataRows, 1).setValues(teamIdUpdates);
      sheet.getRange(CONFIG.DATA_START_ROW, colMap.qrToken.colNum, numDataRows, 1).setValues(qrTokenUpdates);
      sheet.getRange(CONFIG.DATA_START_ROW, colMap.qrUrl.colNum, numDataRows, 1).setValues(qrUrlUpdates);
      sheet.getRange(CONFIG.DATA_START_ROW, colMap.qrCode.colNum, numDataRows, 1).setFormulas(qrFormulaUpdates);

      // Adjust row heights: 70 for active QR codes, reset to standard 21 for cleared rows
      for (var r = 0; r < numDataRows; r++) {
        var rowNum = CONFIG.DATA_START_ROW + r;
        if (qrFormulaUpdates[r][0] !== "") {
          if (sheet.getRowHeight(rowNum) < CONFIG.QR_SETTINGS.DEFAULT_ROW_HEIGHT) {
            sheet.setRowHeight(rowNum, CONFIG.QR_SETTINGS.DEFAULT_ROW_HEIGHT);
          }
        } else {
          if (sheet.getRowHeight(rowNum) >= CONFIG.QR_SETTINGS.DEFAULT_ROW_HEIGHT) {
            sheet.setRowHeight(rowNum, 21);
          }
        }
      }

      SpreadsheetApp.flush();
    }

    var summary = {
      status: "SUCCESS",
      totalRowsScanned: numDataRows,
      validTeamsFound: validTeamsCount,
      teamIdsGenerated: newlyGeneratedTeamIds,
      qrTokensGenerated: newlyGeneratedTokens,
      qrUrlsGenerated: newlyGeneratedUrls,
      qrCodesGenerated: newlyGeneratedCodes,
      clearedTeamsCount: clearedTeamsCount,
      dryRun: isDryRun,
      message: isDryRun
        ? "[DRY RUN] Would generate " + newlyGeneratedTeamIds + " Team IDs, " + newlyGeneratedTokens + " QR Tokens, and delete " + clearedTeamsCount + " orphaned QR rows."
        : "Successfully processed " + validTeamsCount + " teams: verified Column Q (Payment Status), generated " + newlyGeneratedTeamIds + " Team IDs (Col R), " + newlyGeneratedTokens + " QR Tokens (Col S), " + newlyGeneratedUrls + " QR URLs (Col T), and " + newlyGeneratedCodes + " QR Codes (Col U). Deleted " + clearedTeamsCount + " orphaned QR rows."
    };

    Utils.safeLog(summary.message);
    return summary;
  }
};

// 4. REST API Controller for Standalone Website & Mobile Check‑In
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action;

  if (action === "ping") {
    return jsonResponse({
      status: "SUCCESS",
      message: "ViceVerse Google Sheet Database API is online and healthy.",
      registrationPortal: CONFIG.QR_SETTINGS.REGISTRATION_PORTAL_URL
    });
  }

  if (action === "getTeam") {
    var query = params.query || params.token;
    return jsonResponse(apiGetTeam(query));
  }
  if (action === "getLogin") {
    var query = params.query || params.token || params.teamId;
    return jsonResponse(apiGetLoginCredentials(query));
  }

  if (action === "checkIn") {
    var token = params.token || params.teamId || params.query;
    var type = params.type;
    var value = params.value;
    return jsonResponse(apiCheckIn(token, type, value));
  }

  return jsonResponse({ status: "SUCCESS", message: "ViceVerse Backend API is active. Connected to registration database." });
}

function doPost(e) {
  try {
    var postData = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : (e ? e.parameter : {});

    // 1. QR Check‑in scanner
    if (postData.action === "checkIn") {
      return jsonResponse(apiCheckIn(postData.token || postData.teamId || postData.query, postData.type, postData.value));
    }
    // 2. Save login credentials
    if (postData.action === "saveLogin") {
      var saveResult = apiSaveLoginCredentials(postData.teamId || postData.query || postData.token, postData.username, postData.password);
      return jsonResponse(saveResult);
    }

    // 2. Append new registration row from website
    var teamName = postData.team_name || postData.teamName || postData.crew_name;
    if (teamName) {
      var sheet = Utils.getTargetSheet();
      var colMap = Utils.getColumnMapping(sheet);
      var lastRow = sheet.getLastRow();
      var nextRegId = Math.max(1, lastRow - CONFIG.HEADER_ROW + 1);

      // Handle Google Drive file upload for receipt screenshot
      var receiptUrl = postData.receipt_url || "";
      if (postData.receipt_base64) {
        try {
          var rawFolderId = postData.drive_folder_id || CONFIG.RECEIPTS_DRIVE_FOLDER_ID || "1TurV3Q6kSOn3GtxXSrVZEzg2JjlhtdGV";
          var folderId = extractFolderId(rawFolderId);
          var folder = DriveApp.getFolderById(folderId);
          var safeTeam = String(teamName).replace(/[^a-zA-Z0-9_-]/g, "_");
          var safeTxn = String(postData.transaction_id || "TXN").replace(/[^a-zA-Z0-9_-]/g, "_");
          var ext = (postData.receipt_mime === "application/pdf" || (postData.receipt_name && postData.receipt_name.toLowerCase().endsWith(".pdf"))) ? ".pdf" : ".png";
          var fileName = safeTeam + "_" + safeTxn + ext;
          var base64Data = postData.receipt_base64;
          if (base64Data.indexOf(",") !== -1) base64Data = base64Data.split(",")[1];
          var bytes = Utilities.base64Decode(base64Data);
          var blob = Utilities.newBlob(bytes, postData.receipt_mime || "image/png", fileName);
          var driveFile = folder.createFile(blob);
          driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          receiptUrl = driveFile.getUrl();
        } catch (driveErr) {
          Logger.log("Drive upload error: " + driveErr.toString());
          if (!receiptUrl || receiptUrl.indexOf("http") !== 0) {
            receiptUrl = "Drive Upload Warning: " + driveErr.message;
          }
        }
      }

      var newRow = new Array(CONFIG.TOTAL_COLUMNS);
      for (var k = 0; k < CONFIG.TOTAL_COLUMNS; k++) newRow[k] = "";

      newRow[colMap.registrationId.index0] = postData.registration_id || nextRegId;
      newRow[colMap.teamName.index0] = teamName;
      newRow[colMap.college.index0] = postData.college || "VVCE";
      newRow[colMap.teamLeader.index0] = postData.team_leader || postData.teamLeader || "";
      newRow[colMap.member2.index0] = postData.member_2 || postData.member2 || "";
      newRow[colMap.member3.index0] = postData.member_3 || postData.member3 || "";
      newRow[colMap.teamLeaderUsn.index0] = postData.team_leader_usn || postData.teamLeaderUsn || "";
      newRow[colMap.member2Usn.index0] = postData.member_2_usn || postData.member2Usn || "";
      newRow[colMap.member3Usn.index0] = postData.member_3_usn || postData.member3Usn || "";
      newRow[colMap.teamLeaderBranch.index0] = postData.member_1_branch || postData.teamLeaderBranch || "";
      newRow[colMap.member2Branch.index0] = postData.member_2_branch || postData.member2Branch || "";
      newRow[colMap.member3Branch.index0] = postData.member_3_branch || postData.member3Branch || "";
      newRow[colMap.contactNumber.index0] = postData.contact_number || postData.contactNumber || "";
      newRow[colMap.email.index0] = postData.email || "";
      newRow[colMap.selectedDomain.index0] = postData.selected_domain || postData.selectedDomain || "";
      newRow[colMap.transactionId.index0] = postData.transaction_id || postData.transactionId || "N/A";
      newRow[colMap.paymentStatus.index0] = "Waiting";
      if (colMap.receiptUrl && colMap.receiptUrl.index0 !== undefined) newRow[colMap.receiptUrl.index0] = receiptUrl;
      if (colMap.feedback && colMap.feedback.index0 !== undefined) newRow[colMap.feedback.index0] = postData.feedback || "";

      // Find first empty registration row (A-P columns) to insert new registration. If none, append at end.
      var targetRow = null;
      var dataStartRow = CONFIG.DATA_START_ROW;
      var numRows = sheet.getLastRow() - CONFIG.HEADER_ROW;
      if (numRows > 0) {
        var searchRange = sheet.getRange(dataStartRow, 1, numRows, Math.max(sheet.getLastColumn(), CONFIG.TOTAL_COLUMNS));
        var searchValues = searchRange.getValues();
        for (var i = 0; i < searchValues.length; i++) {
          var rowVals = searchValues[i];
          if (!rowVals[0] && !rowVals[1] && !rowVals[2]) { targetRow = dataStartRow + i; break; }
        }
      }
      if (targetRow) {
        sheet.getRange(targetRow, 1, 1, CONFIG.TOTAL_COLUMNS).setValues([newRow]);
      } else {
        sheet.appendRow(newRow);
      }
      SpreadsheetApp.flush();
    }

    // 3. Process registrations: assign sequential Team ID, QR Token, QR URL, and QR Code
    var summary = RegistrationService.processRegistrations({ dryRun: false });
    return jsonResponse({ status: "SUCCESS", message: "Registration processed.", summary: summary });
  } catch (err) {
    return jsonResponse({ status: "ERROR", message: "Failed to process POST request: " + (err.message || String(err)) });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function apiGetTeam(tokenOrQuery) {
  if (!tokenOrQuery) return { status: "ERROR", message: "Token or query parameter is required." };
  var query = String(tokenOrQuery).trim().toLowerCase();
  var sheet = Utils.getTargetSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= CONFIG.HEADER_ROW) return { status: "ERROR", message: "No registration records found in sheet." };
  var colMap = Utils.getColumnMapping(sheet);
  var numRows = lastRow - CONFIG.HEADER_ROW;
  var data = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, Math.max(sheet.getLastColumn(), CONFIG.TOTAL_COLUMNS)).getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var firstColText = String(row[0] || "").trim().toLowerCase();
    var colAcText = colMap.linkdin ? String(row[colMap.linkdin.index0] || "").trim().toLowerCase() : "";
    if (firstColText === "registration id" || firstColText === "team id" || colAcText === "linkdin" || colAcText === "linkedin") continue;
    var teamId = String(row[colMap.teamId.index0] || "").trim().toLowerCase();
    var token = String(row[colMap.qrToken.index0] || "").trim().toLowerCase();
    var regId = String(row[colMap.registrationId.index0] || "").trim().toLowerCase();
    var teamName = String(row[colMap.teamName.index0] || "").trim().toLowerCase();
    if (token === query || teamId === query || regId === query || (teamName && teamName.indexOf(query) !== -1)) {
      return { status: "SUCCESS", data: {
        rowNumber: CONFIG.DATA_START_ROW + i,
        registrationId: row[colMap.registrationId.index0] || "",
        teamName: row[colMap.teamName.index0] || "",
        college: row[colMap.college.index0] || "",
        teamLeader: row[colMap.teamLeader.index0] || "",
        member2: row[colMap.member2.index0] || "",
        member3: row[colMap.member3.index0] || "",
        teamLeaderUsn: row[colMap.teamLeaderUsn.index0] || "",
        member2Usn: row[colMap.member2Usn.index0] || "",
        member3Usn: row[colMap.member3Usn.index0] || "",
        teamLeaderBranch: (colMap.teamLeaderBranch && colMap.teamLeaderBranch.index0 !== undefined && row[colMap.teamLeaderBranch.index0]) || "",
        member2Branch: (colMap.member2Branch && colMap.member2Branch.index0 !== undefined && row[colMap.member2Branch.index0]) || "",
        member3Branch: (colMap.member3Branch && colMap.member3Branch.index0 !== undefined && row[colMap.member3Branch.index0]) || "",
        contactNumber: row[colMap.contactNumber.index0] || "",
        email: row[colMap.email.index0] || "",
        teamId: row[colMap.teamId.index0] || "",
        token: row[colMap.qrToken.index0] || "",
        qrUrl: row[colMap.qrUrl.index0] || "",
        morningReg: row[colMap.morningReg.index0] || "",
        goodies: row[colMap.goodies.index0] || "",
        lunchTL: row[colMap.lunchTL.index0] || "",
        lunchM2: row[colMap.lunchM2.index0] || "",
        lunchM3: row[colMap.lunchM3.index0] || "",
        snacksTL: row[colMap.snacksTL.index0] || "",
        snacksM1: row[colMap.snacksM1.index0] || "",
        snacksM2: row[colMap.snacksM2.index0] || "",
        linkdin: colMap.linkdin && colMap.linkdin.index0 !== undefined ? (row[colMap.linkdin.index0] || "") : "",
        linkedin: colMap.linkdin && colMap.linkdin.index0 !== undefined ? (row[colMap.linkdin.index0] || "") : "",
        instagram: colMap.instagram && colMap.instagram.index0 !== undefined ? (row[colMap.instagram.index0] || "") : "",
        feedback: colMap.feedback && colMap.feedback.index0 !== undefined ? (row[colMap.feedback.index0] || "") : "",
        selectedDomain: (colMap.selectedDomain && colMap.selectedDomain.index0 !== undefined && row[colMap.selectedDomain.index0]) || "",
        domain: (colMap.selectedDomain && colMap.selectedDomain.index0 !== undefined && row[colMap.selectedDomain.index0]) || "",
        transactionId: colMap.transactionId && colMap.transactionId.index0 !== undefined ? (row[colMap.transactionId.index0] || "") : "",
        paymentStatus: colMap.paymentStatus && colMap.paymentStatus.index0 !== undefined ? (row[colMap.paymentStatus.index0] || "Waiting") : "Waiting"
      } };
    }
  }
  return { status: "ERROR", message: 'No team found matching "' + tokenOrQuery + '".' };
}

function apiGetLoginCredentials(teamIdOrQuery) {
  if (!teamIdOrQuery) {
    return { status: "ERROR", message: "Team identifier is required." };
  }
  var query = String(teamIdOrQuery).trim().toLowerCase();
  var sheet = Utils.getTargetSheet();
  var colMap = Utils.getColumnMapping(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= CONFIG.HEADER_ROW) {
    return { status: "ERROR", message: "No records found in sheet." };
  }
  var numRows = lastRow - CONFIG.HEADER_ROW;
  var data = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, Math.max(sheet.getLastColumn(), CONFIG.TOTAL_COLUMNS)).getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var firstColText = String(row[0] || "").trim().toLowerCase();
    var colAcText = colMap.linkdin ? String(row[colMap.linkdin.index0] || "").trim().toLowerCase() : "";
    if (firstColText === "registration id" || firstColText === "team id" || colAcText === "linkdin" || colAcText === "linkedin") continue;
    var teamId = String(row[colMap.teamId.index0] || "").trim().toLowerCase();
    var regId = String(row[colMap.registrationId.index0] || "").trim().toLowerCase();
    var token = String(row[colMap.qrToken.index0] || "").trim().toLowerCase();
    if (teamId === query || regId === query || token === query) {
      var username = colMap.loginUsername && colMap.loginUsername.index0 !== undefined ? (row[colMap.loginUsername.index0] || "") : "";
      var password = colMap.loginPassword && colMap.loginPassword.index0 !== undefined ? (row[colMap.loginPassword.index0] || "") : "";
      return {
        status: "SUCCESS",
        data: {
          teamId: row[colMap.teamId.index0] || "",
          loginUsername: username,
          loginPassword: password
        }
      };
    }
  }
  return { status: "ERROR", message: "No login credentials found for \"" + teamIdOrQuery + "\"." };
}


  function apiCheckIn(tokenOrId, actionType, customValue) {
  // Original check‑in logic
  if (!tokenOrId) return { status: "ERROR", message: "Token or Team ID is required." };
  var query = String(tokenOrId).trim().toLowerCase();
  var sheet = Utils.getTargetSheet();
  var lastRow = sheet.getLastRow();
  var colMap = Utils.getColumnMapping(sheet);
  var numRows = lastRow - CONFIG.HEADER_ROW;
  var data = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, Math.max(sheet.getLastColumn(), CONFIG.TOTAL_COLUMNS)).getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowToken = String(row[colMap.qrToken.index0] || "").trim().toLowerCase();
    var rowTeamId = String(row[colMap.teamId.index0] || "").trim().toLowerCase();
    var rowRegId = String(row[colMap.registrationId.index0] || "").trim().toLowerCase();
    if (rowToken === query || rowTeamId === query || rowRegId === query) {
      var targetRow = CONFIG.DATA_START_ROW + i;
      var valToWrite = customValue !== undefined && customValue !== null ? String(customValue) : "Checked";
      var actionKey = String(actionType).trim().toLowerCase().replace(/[\s_-]/g, "");

      if (actionKey === "lunchall") {
        sheet.getRange(targetRow, colMap.lunchTL.colNum).setValue(valToWrite);
        sheet.getRange(targetRow, colMap.lunchM2.colNum).setValue(valToWrite);
        if (row[colMap.member3.index0] && String(row[colMap.member3.index0]).trim() !== "") sheet.getRange(targetRow, colMap.lunchM3.colNum).setValue(valToWrite);
        SpreadsheetApp.flush();
        return { status: "SUCCESS", actionType: "lunchAll", value: valToWrite, teamId: row[colMap.teamId.index0] || "", message: 'All lunch coupons marked "' + valToWrite + '" for ' + row[colMap.teamId.index0] + '.' };
      }

      if (actionKey === "snacksall") {
        sheet.getRange(targetRow, colMap.snacksTL.colNum).setValue(valToWrite);
        sheet.getRange(targetRow, colMap.snacksM1.colNum).setValue(valToWrite);
        if (row[colMap.member3.index0] && String(row[colMap.member3.index0]).trim() !== "") sheet.getRange(targetRow, colMap.snacksM2.colNum).setValue(valToWrite);
        SpreadsheetApp.flush();
        return { status: "SUCCESS", actionType: "snacksAll", value: valToWrite, teamId: row[colMap.teamId.index0] || "", message: 'All snacks marked "' + valToWrite + '" for ' + row[colMap.teamId.index0] + '.' };
      }

      var targetColNum;
      var colName = actionType;

      if (actionKey === "registration" || actionKey === "morningreg" || actionKey === "morning") { targetColNum = colMap.morningReg.colNum; colName = "Morning Registration"; }
      else if (actionKey === "goodies" || actionKey === "goody" || actionKey === "goodles") { targetColNum = colMap.goodies.colNum; colName = "Goodies Kit"; }
      else if (actionKey === "linkdin" || actionKey === "linkedin" || actionKey === "colad") { targetColNum = (colMap.linkdin && colMap.linkdin.colNum) ? colMap.linkdin.colNum : CONFIG.FALLBACK_COLUMNS.LINKDIN; colName = "LinkedIn"; }
      else if (actionKey === "instagram" || actionKey === "insta" || actionKey === "ig" || actionKey === "colae") { targetColNum = (colMap.instagram && colMap.instagram.colNum) ? colMap.instagram.colNum : CONFIG.FALLBACK_COLUMNS.INSTAGRAM; colName = "Instagram"; }
      else if (actionKey === "feedback" || actionKey === "feed_back" || actionKey === "feed" || actionKey === "colaf") { targetColNum = (colMap.feedback && colMap.feedback.colNum) ? colMap.feedback.colNum : CONFIG.FALLBACK_COLUMNS.FEEDBACK; colName = "Feedback"; }
      else if (actionKey === "lunchtl" || actionKey === "lunchteamleader" || actionKey === "lunchleader") { targetColNum = colMap.lunchTL.colNum; colName = "Lunch Team Leader"; }
      else if (actionKey === "lunchm2" || actionKey === "lunchmember2") { targetColNum = colMap.lunchM2.colNum; colName = "Lunch Member 2"; }
      else if (actionKey === "lunchm3" || actionKey === "lunchmember3") { targetColNum = colMap.lunchM3.colNum; colName = "Lunch Member 3"; }
      else if (actionKey === "snackstl" || actionKey === "snacksteamleader" || actionKey === "snacksleader") { targetColNum = colMap.snacksTL.colNum; colName = "Snacks Team Leader"; }
      else if (actionKey === "snacksm1" || actionKey === "snacksmember1") { targetColNum = colMap.snacksM1.colNum; colName = "Snacks Member 1"; }
      else if (actionKey === "snacksm2" || actionKey === "snacksmember2") { targetColNum = colMap.snacksM2.colNum; colName = "Snacks Member 2"; }
      else if (actionKey === "paymentstatus" || actionKey === "payment" || actionKey === "colq" || actionKey === "approval") { targetColNum = (colMap.paymentStatus && colMap.paymentStatus.colNum) ? colMap.paymentStatus.colNum : CONFIG.FALLBACK_COLUMNS.PAYMENT_STATUS; colName = "Payment Status"; }
      else if (actionKey === "transactionid" || actionKey === "txnid" || actionKey === "transaction" || actionKey === "colp") { targetColNum = (colMap.transactionId && colMap.transactionId.colNum) ? colMap.transactionId.colNum : CONFIG.FALLBACK_COLUMNS.TRANSACTION_ID; colName = "Transaction ID"; }
      else if (actionKey === "selecteddomain" || actionKey === "domain" || actionKey === "track" || actionKey === "colo") { targetColNum = (colMap.selectedDomain && colMap.selectedDomain.colNum) ? colMap.selectedDomain.colNum : CONFIG.FALLBACK_COLUMNS.SELECTED_DOMAIN; colName = "Selected Domain"; }
      else { return { status: "ERROR", message: "Invalid action type: " + actionType }; }

      sheet.getRange(targetRow, targetColNum).setValue(valToWrite);
      SpreadsheetApp.flush();
      return { status: "SUCCESS", actionType: actionType, value: valToWrite, teamId: row[colMap.teamId.index0] || "", message: 'Successfully marked "' + colName + '" as "' + valToWrite + '" in Column ' + Utils.colNumberToLetter(targetColNum) + '.' };
    }
  }
  return { status: "ERROR", message: "Team record not found for query: " + tokenOrId };
}

// 5. User‑Facing Entry Points, Menu & Auto‑Sync Triggers
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu("ViceVerse Admin");
  menu.addItem("1. Process Registrations (Sequential IDs & QRs)", "processNewRegistrations");
  menu.addItem("2. Resequence All Team IDs (IVC-VV-001, IVC-VV-002...)", "resequenceAllTeams");
  menu.addItem("3. Clean Up Orphaned QRs & Resequence", "processNewRegistrations");
  menu.addItem("4. Run Safe Diagnostics (Dry Run)", "runSafeDiagnostics");
  menu.addSeparator();
  menu.addItem("Enable Auto‑Processing (Runs on new registrations)", "enableAutoProcessing");
  menu.addItem("Disable Auto‑Processing", "disableAutoProcessing");
  menu.addToUi();
}

/**
 * Simple trigger that runs automatically whenever any cell is edited or deleted in Google Sheets.
 * If team details in Columns A-P are cleared, automatically wipes out Columns Q, R, S, T, U.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var range = e.range;
    var sheet = range.getSheet();
    if (sheet.getName() !== CONFIG.SHEET_NAME) return;

    var startRow = range.getRow();
    var numRows = range.getNumRows();
    var lastRow = sheet.getLastRow();

    // If edit was only on header row, ignore
    if (startRow + numRows - 1 < CONFIG.DATA_START_ROW) return;

    var checkStartRow = Math.max(startRow, CONFIG.DATA_START_ROW);
    var checkEndRow = Math.min(startRow + numRows - 1, Math.max(lastRow, checkStartRow));

    var colMap = Utils.getColumnMapping(sheet);
    var rowsToInspect = checkEndRow - checkStartRow + 1;
    var data = sheet.getRange(checkStartRow, 1, rowsToInspect, Math.max(sheet.getLastColumn(), CONFIG.TOTAL_COLUMNS)).getValues();

    var shouldReprocess = false;

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var actualRowNum = checkStartRow + i;

      // Check if registration columns A-P (indices 0 to 15) are empty
      var hasInfo = false;
      for (var c = 0; c < Math.min(16, row.length); c++) { if (String(row[c] || "").trim() !== "") { hasInfo = true; break; } }

      // Check if Payment Status or QR data exists in Col Q, R, S, T, U
      var hasPaymentOrQr = String(row[colMap.paymentStatus.index0] || "").trim() !== "" ||
                           String(row[colMap.teamId.index0] || "").trim() !== "" ||
                           String(row[colMap.qrToken.index0] || "").trim() !== "" ||
                           String(row[colMap.qrUrl.index0] || "").trim() !== "" ||
                           String(row[colMap.qrCode.index0] || "").trim() !== "";

      if (!hasInfo && hasPaymentOrQr) {
        // Automatically delete Payment Status and QR columns immediately on that row (Cols Q through U, 5 columns)
        sheet.getRange(actualRowNum, colMap.paymentStatus.colNum, 1, 5).clearContent();
        if (sheet.getRowHeight(actualRowNum) >= CONFIG.QR_SETTINGS.DEFAULT_ROW_HEIGHT) {
          sheet.setRowHeight(actualRowNum, 21);
        }
        shouldReprocess = true;
      } else if (hasInfo && !hasPaymentOrQr) {
        // New team added, needs generation
        shouldReprocess = true;
      }
    }

    if (shouldReprocess) {
      RegistrationService.processRegistrations({ dryRun: false });
    }
  } catch (err) {
    // Silent
  }
}

function resequenceAllTeams() {
  var result = RegistrationService.processRegistrations({ dryRun: false });
  try { SpreadsheetApp.getActiveSpreadsheet().toast("All teams verified and assigned in continuous order (IVC‑VV‑001, IVC‑VV‑002...).", "ViceVerse Admin", 6); } catch (e) {}
  return result;
}

function processNewRegistrations() {
  var result = RegistrationService.processRegistrations({ dryRun: false });
  try { SpreadsheetApp.getActiveSpreadsheet().toast(result.message, "ViceVerse Platform", 6); } catch (e) {}
  return result;
}

function runSafeDiagnostics() {
  var result = RegistrationService.processRegistrations({ dryRun: true });
  try { SpreadsheetApp.getActiveSpreadsheet().toast(result.message, "ViceVerse Diagnostics", 6); } catch (e) {}
  return result;
}

function enableAutoProcessing() {
  disableAutoProcessing();

  ScriptApp.newTrigger("processNewRegistrations").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("processNewRegistrations").forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onChange().create();

  SpreadsheetApp.getActiveSpreadsheet().toast("Auto‑Processing Enabled! New registrations will receive Team IDs and QR codes automatically.", "ViceVerse Admin", 8);
}

function disableAutoProcessing() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processNewRegistrations") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("Auto‑Processing Disabled.", "ViceVerse Admin", 5);
}

/**
 * Diagnostic test to verify direct Google Drive folder upload permissions.
 * Run this function in the Apps Script editor to authorize Google Drive access.
 */
function testDriveUpload() {
  var folderId = CONFIG.RECEIPTS_DRIVE_FOLDER_ID || "1TurV3Q6kSOn3GtxXSrVZEzg2JjlhtdGV";
  var folder = DriveApp.getFolderById(folderId);
  var file = folder.createFile("ViceVerse_Drive_Verification.txt", "Verified Google Drive access for ViceVerse at " + new Date().toString());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  Logger.log("Successfully verified Drive upload! File URL: " + file.getUrl());
  return file.getUrl();
}
