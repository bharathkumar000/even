"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateQrSignature } from "@/lib/qr-signature";
import {
  syncRegistrationToGoogleSheets,
  syncCredentialsToGoogleSheets,
  formatToIST,
  GoogleSheetRegistrationRecord,
  ComprehensiveTeamRecord,
  generateRegistrationsCsv,
} from "@/lib/google-sheets-sync";

export interface TeamMemberInput {
  name: string;
  email: string;
  phone?: string;
  usn: string;
  college: string;
  branch: string;
  sem: string;
}

export interface RegistrationSubmissionData {
  teamName: string;
  track: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  leaderCollege: string;
  leaderUsn: string;
  leaderBranch: string;
  leaderSem: string;
  members: TeamMemberInput[];
  paymentUtr: string;
  paymentPhone: string;
}

export interface GeneratedCredentials {
  teamId: string;
  teamName: string;
  teamCode: string;
  email: string;
  leaderName?: string;
  leaderPhone?: string;
  username: string;
  password: string;
  qrPayload: string;
  approvedAt: string;
}

import crypto from "crypto";

/** Helper: Generate a cryptographically secure random alphanumeric password (e.g., VV26-9X4M) */
function generateSecurePassword(): string {
  // Excluding visually confusing characters (0/O, 1/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 5; i++) {
    const randIndex = crypto.randomInt(0, chars.length);
    token += chars.charAt(randIndex);
  }
  return `VV26-${token}`;
}

/** Helper: Verify admin authorization */
async function requireAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized. Please log in as an administrator.");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const role =
    profile?.role ||
    (user.user_metadata?.role as string | undefined) ||
    (user.app_metadata?.role as string | undefined);

  if (role !== "admin") {
    throw new Error("Forbidden: Administrator privileges required.");
  }

  return { user, profile };
}

const REGISTRATION_DEADLINE_ISO = "2026-11-23T12:00:00+05:30";

function isRegistrationClosed(): boolean {
  return Date.now() >= new Date(REGISTRATION_DEADLINE_ISO).getTime();
}

const MAX_CONFIRMED_PER_SEM = 0;
const FIRST_SEM_WAITLIST_LIMIT = 0;
const THIRD_SEM_WAITLIST_LIMIT = 0;
const MAX_WAITLIST_PER_SEM = 0; // backwards-compatible default

/**
 * Public Server Action: Fetch total submitted teams count per semester
 * irrespective of admin approval/rejection status.
 */
export async function getSemesterRegistrationCounts(): Promise<{
  firstSemCount: number;
  thirdSemCount: number;
  maxLimit: number;
  waitlistLimit: number;
  firstSemWaitlistLimit: number;
  thirdSemWaitlistLimit: number;
  isClosed: boolean;
  deadlineIso: string;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .select("leader_sem, team_name, leader_email, generated_credentials, status");

    let firstSemCount = 0;
    let thirdSemCount = 0;

    if (error) {
      // Fallback: if team_registrations table is not created yet, count from teams.dietary_preference
      if (error.message?.includes("Could not find the table") || error.code === "PGRST205") {
        const { data: teamsData } = await supabaseAdmin
          .from("teams")
          .select("dietary_preference, name, code, status");

        for (const t of teamsData || []) {
          const tName = String(t.name || "").toLowerCase().trim();
          const tCode = String(t.code || "").toUpperCase().trim();
          const tStatus = String(t.status || "").toLowerCase().trim();
          if (
            tName === "code" ||
            tCode.includes("TEST") ||
            tCode.includes("ADMIN") ||
            tCode.includes("DEV") ||
            tStatus === "test" ||
            tName.startsWith("test")
          ) {
            continue;
          }
          if (!t.dietary_preference) continue;
          try {
            const parsed = JSON.parse(t.dietary_preference);
            const sem = String(parsed.leaderSem || "").toLowerCase();
            if (sem.includes("1st") || sem === "1") {
              firstSemCount++;
            } else if (sem.includes("3rd") || sem === "3" || sem.includes("2nd") || sem === "2") {
              thirdSemCount++;
            }
          } catch {
            // ignore non-JSON dietary_preference
          }
        }
      }

      return {
        firstSemCount,
        thirdSemCount,
        maxLimit: MAX_CONFIRMED_PER_SEM,
        waitlistLimit: THIRD_SEM_WAITLIST_LIMIT,
        firstSemWaitlistLimit: FIRST_SEM_WAITLIST_LIMIT,
        thirdSemWaitlistLimit: THIRD_SEM_WAITLIST_LIMIT,
        isClosed: isRegistrationClosed(),
        deadlineIso: REGISTRATION_DEADLINE_ISO,
      };
    }

    for (const row of data || []) {
      const name = String((row as any).team_name || "").toLowerCase().trim();
      const code = String((row as any).generated_credentials?.teamCode || (row as any).team_code || "").toUpperCase().trim();
      const status = String((row as any).status || "").toLowerCase().trim();
      const email = String((row as any).leader_email || "").toLowerCase().trim();
      // Exclude internal test / admin demo teams from consuming official participant & waitlist quotas
      if (
        name === "code" ||
        code.includes("TEST") ||
        code.includes("ADMIN") ||
        code.includes("DEV") ||
        status === "test" ||
        status === "rejected" ||
        name.startsWith("test") ||
        email === "rishithsgowda13@gmail.com"
      ) {
        continue;
      }

      const sem = String(row.leader_sem || "").toLowerCase();
      if (sem.includes("1st") || sem === "1") {
        firstSemCount++;
      } else if (sem.includes("3rd") || sem === "3" || sem.includes("2nd") || sem === "2") {
        thirdSemCount++;
      }
    }

    return {
      firstSemCount,
      thirdSemCount,
      maxLimit: MAX_CONFIRMED_PER_SEM,
      waitlistLimit: THIRD_SEM_WAITLIST_LIMIT,
      firstSemWaitlistLimit: FIRST_SEM_WAITLIST_LIMIT,
      thirdSemWaitlistLimit: THIRD_SEM_WAITLIST_LIMIT,
      isClosed: isRegistrationClosed(),
      deadlineIso: REGISTRATION_DEADLINE_ISO,
    };
  } catch (err) {
    console.error("getSemesterRegistrationCounts error:", err);
    return {
      firstSemCount: 0,
      thirdSemCount: 0,
      maxLimit: MAX_CONFIRMED_PER_SEM,
      waitlistLimit: THIRD_SEM_WAITLIST_LIMIT,
      firstSemWaitlistLimit: FIRST_SEM_WAITLIST_LIMIT,
      thirdSemWaitlistLimit: THIRD_SEM_WAITLIST_LIMIT,
      isClosed: isRegistrationClosed(),
      deadlineIso: REGISTRATION_DEADLINE_ISO,
    };
  }
}

/**
 * Public Server Action: Submit a team registration with 4 members and payment proof (or waitlist entry).
 */
export async function submitTeamRegistration(
  formData: FormData
): Promise<{ success: boolean; message: string; registrationId?: string; isWaitlist?: boolean }> {
  try {
    const teamName = String(formData.get("teamName") || "").trim();

    // Leader info (Open to students from any college)
    const leaderName = String(formData.get("leaderName") || "").trim();
    const leaderEmail = String(formData.get("leaderEmail") || "").trim().toLowerCase();
    const leaderPhone = String(formData.get("leaderPhone") || "").trim();
    const leaderCollege = String(formData.get("leaderCollege") || "").trim();
    const leaderUsn = String(formData.get("leaderUsn") || "").trim().toUpperCase();
    const leaderBranch = String(formData.get("leaderBranch") || "").trim();
    const leaderSem = String(formData.get("leaderSem") || "").trim();
    // Derive track as 1st Sem or 3rd Sem
    const track = leaderSem.includes("3") ? "3rd Sem" : "1st Sem";

    // Payment info
    const paymentUtr = String(formData.get("paymentUtr") || "").trim();
    const paymentPhone = String(formData.get("paymentPhone") || "").trim() || leaderPhone;
    const paymentFile = formData.get("paymentProof") as File | null;

    if (!teamName || !track || !leaderName || !leaderEmail || !leaderPhone || !leaderUsn || !leaderCollege) {
      return { success: false, message: "Please fill in all required team and leader fields, including Leader College and USN." };
    }

    // Parse the other 3 members from form data
    const membersRaw = String(formData.get("membersJson") || "[]");
    let members: TeamMemberInput[] = [];
    try {
      members = JSON.parse(membersRaw);
      if (Array.isArray(members)) {
        members = members.map((m) => ({
          ...m,
          college: String(m.college || "").trim() || leaderCollege,
        }));
      }
    } catch {
      members = [];
    }

    // Validate 3 additional members (total 4 members)
    if (members.length < 3) {
      return {
        success: false,
        message: "Details for all 4 team members (Leader + 3 Members) must be provided.",
      };
    }

    // Validate that all members have required fields including USN and College
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (!member.name?.trim() || !member.email?.trim() || !member.usn?.trim() || !member.college?.trim()) {
        return {
          success: false,
          message: `Please fill in all required fields including College and USN for Member ${i + 2}.`,
        };
      }
    }

    // Strict Semester Integrity: Mixed semester and senior-junior teams are strictly prohibited.
    // 1st Year category must be exclusively 1st Semester; 2nd Year category must be exclusively 3rd Semester.
    const expectedSem = leaderSem.trim().toLowerCase();
    for (let i = 0; i < members.length; i++) {
      const memberSem = (members[i].sem || "").trim().toLowerCase();
      if (memberSem !== expectedSem) {
        return {
          success: false,
          message: "SEMESTER ELIGIBILITY POLICY: All 4 squad members must belong to the exact same semester. Mixed semester and senior-junior teams are strictly prohibited.",
        };
      }
    }

    // Strict Registration Closing Deadline Check: Monday, 23rd November 2026 at 12:00 PM (Noon) IST
    // There is NO CAP on the total number of teams registering before this deadline.
    if (isRegistrationClosed()) {
      return {
        success: false,
        message: "REGISTRATION IS OFFICIALLY CLOSED: Team registration closed on Monday, 23rd November 2026 at 12:00 PM (Noon) IST. No further submissions are being accepted.",
      };
    }

    // Require payment proof & UTR (Entry fee ₹400 for all teams registering before the deadline)
    if (!paymentUtr || paymentUtr.length < 6) {
      return { success: false, message: "Valid 12-digit UPI Reference / UTR Number is required." };
    }
    if (!paymentFile || paymentFile.size === 0) {
      return { success: false, message: "Payment proof screenshot is required." };
    }
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedMimeTypes.includes((paymentFile.type || "").toLowerCase())) {
      return { success: false, message: "Invalid payment proof format. Only PNG, JPG, or JPEG images are allowed." };
    }
    if (paymentFile.size > 10 * 1024 * 1024) {
      return { success: false, message: "Payment proof image must be smaller than 10MB." };
    }

    // Prevent duplicate UTR reuse across registrations (both in team_registrations and teams table)
    const { data: dupRegs } = await supabaseAdmin
      .from("team_registrations")
      .select("id")
      .eq("payment_utr", paymentUtr)
      .limit(1);
    if (dupRegs && dupRegs.length > 0) {
      return { success: false, message: "This UTR / Transaction Reference Number has already been submitted." };
    }

    const { data: dupTeams } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("table_number", paymentUtr)
      .limit(1);
    if (dupTeams && dupTeams.length > 0) {
      return { success: false, message: "This UTR / Transaction Reference Number has already been submitted." };
    }

    // 1. Encode payment proof to base64 for confirmed slots (Zero Supabase Storage usage)
    let paymentProofUrl = "";
    let finalPaymentUtr = paymentUtr;

    if (paymentFile) {
      const fileBuffer = Buffer.from(await paymentFile.arrayBuffer());
      paymentProofUrl = `data:${paymentFile.type || "image/jpeg"};base64,${fileBuffer.toString("base64")}`;
    }

    // 2. Assign clean username and strictly monotonic provisional team code (e.g. IVC-RY-001)
    // NOTE: Official credentials & passwords are ONLY generated upon Admin Verification & Approval!
    const cleanUsername = teamName.toLowerCase().replace(/[^a-z0-9]/g, "");

    let allRegs: any[] = [];
    const { data: regsWithCode, error: regsWithCodeErr } = await supabaseAdmin
      .from("team_registrations")
      .select("generated_credentials, team_code");

    if (regsWithCode && !regsWithCodeErr) {
      allRegs = regsWithCode;
    } else {
      const { data: basicRegs } = await supabaseAdmin
        .from("team_registrations")
        .select("generated_credentials");
      if (basicRegs) {
        allRegs = basicRegs;
      }
    }

    const { data: existingTeams } = await supabaseAdmin
      .from("teams")
      .select("code");

    let maxNum = 0;
    let nonTestCount = 0;
    for (const r of allRegs) {
      const name = String((r as any)?.team_name || "").toLowerCase().trim();
      const code = (r as any)?.team_code || (r.generated_credentials as any)?.teamCode || "";
      if (name === "code" || code.includes("TEST") || code.includes("ADMIN") || code.includes("DEV")) {
        continue;
      }
      nonTestCount++;
      const m = code.match(/IVC-(?:RY|VV)-(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    for (const t of existingTeams || []) {
      const name = String((t as any)?.name || "").toLowerCase().trim();
      const code = String((t as any)?.code || "").toUpperCase();
      if (name === "code" || code.includes("TEST") || code.includes("ADMIN") || code.includes("DEV")) {
        continue;
      }
      const m = code.match(/IVC-(?:RY|VV)-(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }

    const nextNum = Math.max(maxNum + 1, nonTestCount + 1);
    const provisionalTeamCode = `IVC-RY-${String(nextNum).padStart(3, "0")}`;

    // 3. Insert into team_registrations table with pending status and empty password
    let registrationPayload: any = {
      team_name: teamName,
      track: track,
      leader_name: leaderName,
      leader_email: leaderEmail,
      leader_phone: leaderPhone,
      leader_college: leaderCollege,
      leader_usn: leaderUsn,
      leader_branch: leaderBranch,
      leader_sem: leaderSem,
      members: members,
      payment_utr: finalPaymentUtr,
      payment_phone: paymentPhone,
      payment_proof_url: paymentProofUrl,
      status: "pending",
      login_username: cleanUsername,
      login_email: leaderEmail,
      login_password: "",
      team_code: provisionalTeamCode,
      generated_credentials: { teamCode: provisionalTeamCode },
    };

    let { data: insertData, error: insertError } = await supabaseAdmin
      .from("team_registrations")
      .insert(registrationPayload)
      .select("id")
      .single();

    // If new columns are not yet in remote schema cache, retry with base columns only
    if (insertError && (insertError.message.includes("column") || insertError.code === "PGRST204")) {
      const basicPayload = {
        team_name: teamName,
        track: track,
        leader_name: leaderName,
        leader_email: leaderEmail,
        leader_phone: leaderPhone,
        leader_college: leaderCollege,
        leader_usn: leaderUsn,
        leader_branch: leaderBranch,
        leader_sem: leaderSem,
        members: members,
        payment_utr: finalPaymentUtr,
        payment_phone: paymentPhone,
        payment_proof_url: paymentProofUrl,
        status: "pending",
        generated_credentials: { teamCode: provisionalTeamCode },
      };
      const retryResult = await supabaseAdmin
        .from("team_registrations")
        .insert(basicPayload)
        .select("id")
        .single();
      insertData = retryResult.data;
      insertError = retryResult.error;
    }

    let insertedRegId = "";
    let isFallback = false;

    if (insertError) {
      console.error("Database registration insertion error:", insertError);
      // Fallback: If table does not exist, insert into teams with status pending_verification
      if (insertError.message.includes("Could not find the table") || insertError.code === "PGRST205" || insertError.code === "PGRST204") {
        isFallback = true;
        const fallbackTeamPayload = {
          name: teamName,
          track: track,
          leader_name: leaderName,
          status: "pending_verification",
          table_number: finalPaymentUtr,
          lab_room: paymentPhone,
          dietary_preference: JSON.stringify({
            leaderEmail,
            leaderCollege,
            leaderUsn,
            leaderBranch,
            leaderSem,
            members,
            paymentProofUrl,
            loginPassword: "",
            loginUsername: cleanUsername,
            teamCode: provisionalTeamCode,
          }),
        };

        const { data: fallbackTeam, error: fallbackError } = await supabaseAdmin
          .from("teams")
          .insert(fallbackTeamPayload)
          .select("id")
          .single();

        if (fallbackError) {
          return { success: false, message: `Failed to record registration: ${fallbackError.message}` };
        }

        insertedRegId = fallbackTeam.id;
      } else {
        return { success: false, message: `Failed to record registration: ${insertError.message}` };
      }
    } else {
      insertedRegId = insertData?.id || "";
    }

    // 4. Automatically stream registration to Sheet 1 ("Registrations") with generated credentials
    const d2 = members[0] || {};
    const d3 = members[1] || {};
    const d4 = members[2] || {};
    const isBase64Proof = paymentProofUrl.startsWith("data:");

    const initialSheetRecord: ComprehensiveTeamRecord = {
      sheetName: "Registrations",
      teamName: teamName,
      track: track,
      teamCode: provisionalTeamCode,
      status: "Pending",
      decisionAt: formatToIST(new Date()),

      // Driver 1 (Leader)
      leaderName: leaderName,
      leaderEmail: leaderEmail,
      leaderPhone: leaderPhone,
      leaderCollege: leaderCollege,
      leaderUsn: leaderUsn,
      leaderBranch: leaderBranch,
      leaderSem: leaderSem,

      // Driver 2
      driver2Name: d2.name || "",
      driver2Email: d2.email || "",
      driver2Phone: d2.phone || "",
      driver2College: d2.college || "",
      driver2Usn: d2.usn || "",
      driver2Branch: d2.branch || "",
      driver2Sem: d2.sem || "",

      // Driver 3
      driver3Name: d3.name || "",
      driver3Email: d3.email || "",
      driver3Phone: d3.phone || "",
      driver3College: d3.college || "",
      driver3Usn: d3.usn || "",
      driver3Branch: d3.branch || "",
      driver3Sem: d3.sem || "",

      // Driver 4
      driver4Name: d4.name || "",
      driver4Email: d4.email || "",
      driver4Phone: d4.phone || "",
      driver4College: d4.college || "",
      driver4Usn: d4.usn || "",
      driver4Branch: d4.branch || "",
      driver4Sem: d4.sem || "",

      // Payment
      transactionId: finalPaymentUtr,
      paymentPhone: paymentPhone,
      paymentProofUrl: isBase64Proof ? undefined : paymentProofUrl,
      paymentProofBase64: isBase64Proof ? paymentProofUrl : undefined,

      // Credentials: Login Password is NOT generated yet (only generated upon Admin Approval)
      loginPassword: "",
      portalUrl: "",
      whatsappGroup: "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld",
      emailDispatchStatus: "PENDING_APPROVAL",
    };

    // Reliable sync to Sheet 1 ("Registrations") before completing Server Action
    try {
      const sheetRes = await syncRegistrationToGoogleSheets(initialSheetRecord);
      if (sheetRes.proofUrl && insertedRegId && isBase64Proof) {
        if (!isFallback) {
          await supabaseAdmin
            .from("team_registrations")
            .update({ payment_proof_url: sheetRes.proofUrl })
            .eq("id", insertedRegId);
        }
      }
    } catch (e) {
      console.error("[submitTeamRegistration] Google Sheets sync error:", e);
    }

    return {
      success: true,
      isWaitlist: false,
      message: "Registration submitted successfully! Your payment is under verification by IVC admins.",
      registrationId: insertedRegId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("submitTeamRegistration exception:", err);
    return { success: false, message: `Unexpected error during submission: ${errorMsg}` };
  }
}

/**
 * Admin Action: Fetch all registration submissions with optional status filter.
 */
export async function getRegistrations(statusFilter?: "all" | "pending" | "approved" | "rejected" | "waitlist") {
  await requireAdminUser();

  try {
    let query = supabaseAdmin
      .from("team_registrations")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      // Fallback check if team_registrations table isn't created yet
      if (error.message.includes("Could not find the table")) {
        const { data: fallbackTeams } = await supabaseAdmin
          .from("teams")
          .select("*")
          .eq("status", "pending_verification")
          .order("created_at", { ascending: false });

        const mapped = (fallbackTeams || []).map((t: any) => {
          let extra: any = {};
          try {
            extra = JSON.parse(t.dietary_preference || "{}");
          } catch {}
          return {
            id: t.id,
            team_name: t.name,
            track: t.track,
            leader_name: t.leader_name,
            leader_email: extra.leaderEmail || "",
            leader_phone: t.lab_room || "",
            leader_college: extra.leaderCollege || "",
            leader_usn: extra.leaderUsn || "",
            leader_branch: extra.leaderBranch || "",
            leader_sem: extra.leaderSem || "",
            members: extra.members || [],
            payment_utr: t.table_number || "",
            payment_phone: t.lab_room || "",
            payment_proof_url: extra.paymentProofUrl || "",
            status: "pending",
            created_at: t.created_at,
          };
        });

        return { success: true, registrations: mapped, tableFallback: true };
      }
      throw error;
    }

    // Exclude internal test / admin demo teams so they are completely invisible from registered teams list
    const cleanData = (data || []).filter((r: any) => {
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
        name.startsWith("test") ||
        email === "rishithsgowda13@gmail.com"
      );
    });

    if (cleanData && cleanData.length > 0) {
      const sorted = [...cleanData].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const seenCodes = new Set<string>();
      let nextSeq = 1;

      for (const item of sorted) {
        let currentCode = item.team_code || item.generated_credentials?.teamCode || "";
        if (currentCode.startsWith("IVC-VV-")) {
          currentCode = currentCode.replace("IVC-VV-", "IVC-RY-");
        }

        if (item.status === "waitlist" || currentCode.includes("WAITLIST")) continue;

        if (!currentCode || seenCodes.has(currentCode)) {
          while (seenCodes.has(`IVC-RY-${String(nextSeq).padStart(3, "0")}`)) {
            nextSeq++;
          }
          const fixedCode = `IVC-RY-${String(nextSeq).padStart(3, "0")}`;
          nextSeq++;
          seenCodes.add(fixedCode);

          item.team_code = fixedCode;
          if (item.generated_credentials) {
            item.generated_credentials.teamCode = fixedCode;
          } else {
            item.generated_credentials = { teamCode: fixedCode };
          }

          Promise.resolve(
            supabaseAdmin
              .from("team_registrations")
              .update({
                generated_credentials: {
                  ...(item.generated_credentials || {}),
                  teamCode: fixedCode,
                },
              })
              .eq("id", item.id)
          ).catch(() => {});
        } else {
          seenCodes.add(currentCode);
          const m = currentCode.match(/IVC-RY-(\d+)/i);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num >= nextSeq) nextSeq = num + 1;
          }
        }
      }
    }

    return { success: true, registrations: cleanData, tableFallback: false };
  } catch (err: any) {
    console.error("getRegistrations error:", err);
    return { success: false, error: err.message, registrations: [] };
  }
}

/**
 * Admin Action: Verify and approve a registration.
 * - Creates Auth account for leader
 * - Creates/Activates team in `teams` table
 * - Adds all 4 members to `team_members`
 * - Generates official QR code payload
 * - Returns generated credentials
 */
export async function approveRegistration(registrationId: string): Promise<{
  success: boolean;
  message: string;
  credentials?: GeneratedCredentials;
}> {
  const { user: adminUser } = await requireAdminUser();

  try {
    // 1. Fetch registration record
    let reg: any = null;
    const { data: regData } = await supabaseAdmin
      .from("team_registrations")
      .select("*")
      .eq("id", registrationId)
      .maybeSingle();

    reg = regData;

    // Fallback: check teams table if registration table wasn't used
    if (!reg) {
      const { data: fallbackTeam } = await supabaseAdmin
        .from("teams")
        .select("*")
        .eq("id", registrationId)
        .maybeSingle();

      if (fallbackTeam) {
        let extra: any = {};
        try {
          extra = JSON.parse(fallbackTeam.dietary_preference || "{}");
        } catch {}
        reg = {
          id: fallbackTeam.id,
          team_name: fallbackTeam.name,
          track: fallbackTeam.track,
          leader_name: fallbackTeam.leader_name,
          leader_email: extra.leaderEmail,
          leader_phone: fallbackTeam.lab_room,
          leader_college: extra.leaderCollege,
          members: extra.members || [],
        };
      }
    }

    if (!reg) {
      return { success: false, message: "Registration record not found." };
    }

    const teamName = reg.team_name;
    const leaderEmail = reg.leader_email.trim().toLowerCase();
    const leaderName = reg.leader_name;
    const track = reg.track || "Innovation";
    const members: TeamMemberInput[] = Array.isArray(reg.members) ? reg.members : [];

    // 2. Use existing credentials if already generated, or generate fresh secure password
    const generatedPassword =
      reg.login_password ||
      reg.generated_credentials?.password ||
      generateSecurePassword();

    const username =
      reg.login_username ||
      reg.generated_credentials?.username ||
      teamName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Generate readable team code (e.g. IVC-RY-001)
    const { data: matchedTeam } = await supabaseAdmin
      .from("teams")
      .select("id, code")
      .ilike("name", teamName.trim())
      .maybeSingle();

    let teamCode = reg.generated_credentials?.teamCode || matchedTeam?.code || reg.team_code || "";
    if (teamCode.startsWith("IVC-VV-")) {
      teamCode = teamCode.replace("IVC-VV-", "IVC-RY-");
    }

    if (!teamCode) {
      const { data: allTeams } = await supabaseAdmin.from("teams").select("code, name");
      let maxNum = 0;
      for (const t of allTeams || []) {
        const name = String((t as any)?.name || "").toLowerCase().trim();
        const code = String(t.code || "").toUpperCase();
        if (name === "code" || code.includes("TEST") || code.includes("ADMIN") || code.includes("DEV")) {
          continue;
        }
        const m = (t.code || "").match(/IVC-(?:RY|VV)-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
      teamCode = `IVC-RY-${String(maxNum + 1).padStart(3, "0")}`;
    }

    // 3. Create or find User in Supabase Auth
    let authUserId: string | null = null;

    const { data: authCreated, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: leaderEmail,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: leaderName,
        role: "leader",
        team_name: teamName,
        username: username,
      },
    });

    if (authError) {
      // If user already exists in auth, find existing user
      const errMsg = (authError.message || "").toLowerCase();
      if (
        errMsg.includes("already registered") ||
        errMsg.includes("already been registered") ||
        errMsg.includes("already exists") ||
        errMsg.includes("email address has already") ||
        authError.status === 422 ||
        (authError as any).code === "email_exists"
      ) {
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        let existing = userList?.users?.find(
          (u) => u.email?.toLowerCase() === leaderEmail
        );

        if (!existing) {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", leaderEmail)
            .maybeSingle();
          if (prof?.id) {
            existing = { id: prof.id } as any;
          }
        }

        if (existing) {
          authUserId = existing.id;
          // Update password and metadata for existing user so they can login
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password: generatedPassword,
            user_metadata: {
              full_name: leaderName,
              role: "leader",
              team_name: teamName,
              username: username,
            },
          });
        } else {
          return { success: false, message: `Auth user already exists but could not locate user ID for ${leaderEmail}` };
        }
      } else {
        return { success: false, message: `Failed creating Auth user: ${authError.message}` };
      }
    } else {
      authUserId = authCreated?.user?.id ?? null;
    }

    if (!authUserId) {
      return { success: false, message: "Could not resolve or create Supabase user ID." };
    }

    // 4. Upsert Leader in `profiles` table with username and 'leader' role
    await supabaseAdmin.from("profiles").upsert({
      id: authUserId,
      email: leaderEmail,
      full_name: leaderName,
      username: username,
      role: "leader",
    });

    // 5. Create or Update Team in `teams` table
    let teamId: string;
    const { data: existingTeam } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("name", teamName)
      .maybeSingle();

    if (existingTeam) {
      teamId = existingTeam.id;
      await supabaseAdmin
        .from("teams")
        .update({
          code: teamCode,
          track: track,
          leader_name: leaderName,
          status: "active",
        })
        .eq("id", teamId);
    } else {
      const { data: newTeam, error: teamInsertError } = await supabaseAdmin
        .from("teams")
        .insert({
          name: teamName,
          code: teamCode,
          track: track,
          leader_name: leaderName,
          status: "active",
        })
        .select("id")
        .single();

      if (teamInsertError || !newTeam) {
        return { success: false, message: `Failed to create team: ${teamInsertError?.message}` };
      }
      teamId = newTeam.id;
    }

    // 6. Insert Leader into `team_members`
    // First, remove any existing members for this team to avoid duplicates
    await supabaseAdmin.from("team_members").delete().eq("team_id", teamId);

    // Leader record
    const { error: leaderMemberErr } = await supabaseAdmin.from("team_members").insert({
      team_id: teamId,
      user_id: authUserId,
      role: "leader",
      name: leaderName,
      email: leaderEmail,
    });

    if (leaderMemberErr) {
      console.warn("Leader team_members insert notice:", leaderMemberErr.message);
    }

    // 7. Generate official QR Code pass payload (compatible with /ops/scanner, signed with HMAC)
    const qrPayload = JSON.stringify({
      team_id: teamId,
      name: teamName,
      sig: generateQrSignature(teamId),
      v: 1,
    });

    const nowIso = new Date().toISOString();

    const credentials: GeneratedCredentials = {
      teamId,
      teamName,
      teamCode,
      email: leaderEmail,
      leaderName,
      leaderPhone: reg.leader_phone || reg.payment_phone || "",
      username: username,
      password: generatedPassword,
      qrPayload,
      approvedAt: nowIso,
    };

    // 8. Update team_registrations status to 'approved' and persist credentials in generated_credentials JSONB
    const { error: updateRegError } = await supabaseAdmin
      .from("team_registrations")
      .update({
        status: "approved",
        team_id: teamId,
        approved_at: nowIso,
        approved_by: adminUser?.id || null,
        generated_credentials: credentials,
      })
      .eq("id", registrationId);

    if (updateRegError) {
      console.error("[approveRegistration] Failed to update team_registrations:", updateRegError);
      return { success: false, message: `Failed to update registration status: ${updateRegError.message}` };
    }

    // 9. Sync complete 4-driver squad details & payment proof directly to Sheet 2 ("Approved")
    const membersList: any[] = Array.isArray(reg.members) ? reg.members : [];
    const d2 = membersList[0] || {};
    const d3 = membersList[1] || {};
    const d4 = membersList[2] || {};
    const isBase64Proof = typeof reg.payment_proof_url === "string" && reg.payment_proof_url.startsWith("data:");

    const sheetRecord: GoogleSheetRegistrationRecord = {
      sheetName: "Approved",
      teamName: teamName,
      track: track,
      teamCode: teamCode,
      status: "Approved",
      decisionAt: formatToIST(nowIso),
      decisionBy: adminUser.email || adminUser.id,

      // Driver 1 (Leader)
      leaderName: leaderName,
      leaderEmail: leaderEmail,
      leaderPhone: reg.leader_phone || reg.payment_phone || "",
      leaderCollege: reg.leader_college || "",
      leaderUsn: reg.leader_usn || "",
      leaderBranch: reg.leader_branch || "",
      leaderSem: reg.leader_sem || "",

      // Driver 2
      driver2Name: d2.name || "",
      driver2Email: d2.email || "",
      driver2Phone: d2.phone || "",
      driver2College: d2.college || "",
      driver2Usn: d2.usn || "",
      driver2Branch: d2.branch || "",
      driver2Sem: d2.sem || "",

      // Driver 3
      driver3Name: d3.name || "",
      driver3Email: d3.email || "",
      driver3Phone: d3.phone || "",
      driver3College: d3.college || "",
      driver3Usn: d3.usn || "",
      driver3Branch: d3.branch || "",
      driver3Sem: d3.sem || "",

      // Driver 4
      driver4Name: d4.name || "",
      driver4Email: d4.email || "",
      driver4Phone: d4.phone || "",
      driver4College: d4.college || "",
      driver4Usn: d4.usn || "",
      driver4Branch: d4.branch || "",
      driver4Sem: d4.sem || "",

      // Payment
      transactionId: reg.payment_utr || "",
      paymentProofUrl: isBase64Proof ? undefined : reg.payment_proof_url,
      paymentProofBase64: isBase64Proof ? reg.payment_proof_url : undefined,

      // Credentials for Bulk Email Dispatch from Google Sheets (No premature Portal URL)
      loginPassword: generatedPassword,
      portalUrl: "",
      whatsappGroup: "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld",
      emailDispatchStatus: "PENDING",
    };

    // Trigger Google Sheets sync (non-blocking, routes to Sheet 2 "Approved")
    syncRegistrationToGoogleSheets(sheetRecord).then(async (res) => {
      if (res.proofUrl && isBase64Proof) {
        try {
          await supabaseAdmin
            .from("team_registrations")
            .update({ payment_proof_url: res.proofUrl })
            .eq("id", registrationId);
        } catch {
          // ignore background update error
        }
      }
    }).catch((e) =>
      console.error("[approveRegistration] Background Google Sheets sync error:", e)
    );

    // Also update primary "Registrations" sheet with Approved status & official Team Code
    syncRegistrationToGoogleSheets({ ...sheetRecord, sheetName: "Registrations" }).catch((e) =>
      console.error("[approveRegistration] Registrations sheet sync error:", e)
    );

    // Sync approved team credentials to dedicated "Credentials" Sheet tab
    syncCredentialsToGoogleSheets({
      teamName: teamName,
      loginEmail: leaderEmail,
      loginPassword: generatedPassword,
      teamId: teamId,
      teamCode: teamCode,
      leaderName: leaderName,
      leaderPhone: reg.leader_phone || reg.payment_phone || "",
      driver2Name: d2.name || "",
      driver2Phone: d2.phone || d2.email || "",
      decisionAt: formatToIST(nowIso),
    }).catch((e) =>
      console.error("[approveRegistration] Credentials sheet sync error:", e)
    );

    revalidatePath("/admin/registrations");
    revalidatePath("/admin/users");

    return {
      success: true,
      message: `Team "${teamName}" approved successfully! Credentials generated.`,
      credentials,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("approveRegistration error:", err);
    return { success: false, message: `Approval failed: ${errorMsg}` };
  }
}

/**
 * Admin Action: Reject a registration with a mandatory or optional reason.
 * Automatically archives all 4-driver details and payment proof to Sheet 2 ("Rejected Teams").
 */
export async function rejectRegistration(
  registrationId: string,
  reason: string = "Payment proof verification failed."
): Promise<{ success: boolean; message: string }> {
  const { user: adminUser } = await requireAdminUser();

  try {
    const nowIso = new Date().toISOString();

    // 1. Fetch full registration record so every detail can be archived
    const { data: reg } = await supabaseAdmin
      .from("team_registrations")
      .select("*")
      .eq("id", registrationId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("team_registrations")
      .update({
        status: "rejected",
        rejection_reason: reason,
        updated_at: nowIso,
      })
      .eq("id", registrationId);

    if (error) {
      await supabaseAdmin
        .from("teams")
        .update({ status: "rejected" })
        .eq("id", registrationId);
    }

    // 2. Stream all 4 drivers' details to Sheet 2 ("Rejected Teams")
    if (reg) {
      const membersList: any[] = Array.isArray(reg.members) ? reg.members : [];
      const d2 = membersList[0] || {};
      const d3 = membersList[1] || {};
      const d4 = membersList[2] || {};
      const isBase64Proof = typeof reg.payment_proof_url === "string" && reg.payment_proof_url.startsWith("data:");

      const sheetRecord: GoogleSheetRegistrationRecord = {
        sheetName: "Rejected",
        teamName: reg.team_name,
        track: (reg.leader_sem && reg.leader_sem.includes("3")) || (reg.track && reg.track.includes("3")) ? "3rd Sem" : "1st Sem",
        status: "Rejected",
        decisionAt: formatToIST(nowIso),
        decisionBy: adminUser.email || adminUser.id,
        rejectionReason: reason,

        // Driver 1 (Leader)
        leaderName: reg.leader_name,
        leaderEmail: reg.leader_email,
        leaderPhone: reg.leader_phone || reg.payment_phone || "",
        leaderCollege: reg.leader_college || "",
        leaderUsn: reg.leader_usn || "",
        leaderBranch: reg.leader_branch || "",
        leaderSem: reg.leader_sem || "",

        // Driver 2
        driver2Name: d2.name || "",
        driver2Email: d2.email || "",
        driver2Phone: d2.phone || "",
        driver2College: d2.college || "",
        driver2Usn: d2.usn || "",
        driver2Branch: d2.branch || "",
        driver2Sem: d2.sem || "",

        // Driver 3
        driver3Name: d3.name || "",
        driver3Email: d3.email || "",
        driver3Phone: d3.phone || "",
        driver3College: d3.college || "",
        driver3Usn: d3.usn || "",
        driver3Branch: d3.branch || "",
        driver3Sem: d3.sem || "",

        // Driver 4
        driver4Name: d4.name || "",
        driver4Email: d4.email || "",
        driver4Phone: d4.phone || "",
        driver4College: d4.college || "",
        driver4Usn: d4.usn || "",
        driver4Branch: d4.branch || "",
        driver4Sem: d4.sem || "",

        // Payment
        transactionId: reg.payment_utr || "",
        paymentProofUrl: isBase64Proof ? undefined : reg.payment_proof_url,
        paymentProofBase64: isBase64Proof ? reg.payment_proof_url : undefined,
      };

      // Background push to Sheet 2 ("Rejected Teams")
      syncRegistrationToGoogleSheets(sheetRecord).then(async (res) => {
        if (res.proofUrl && isBase64Proof) {
          try {
            await supabaseAdmin
              .from("team_registrations")
              .update({ payment_proof_url: res.proofUrl })
              .eq("id", registrationId);
          } catch {
            // ignore background update error
          }
        }
      }).catch((e) =>
        console.error("[rejectRegistration] Background Google Sheets sync error:", e)
      );
    }

    revalidatePath("/admin/registrations");
    return { success: true, message: "Registration marked as rejected and streamed to Sheet 3 (Rejected)." };
  } catch (err: any) {
    console.error("rejectRegistration error:", err);
    return { success: false, message: `Failed to reject: ${err.message}` };
  }
}

/**
 * Admin Action: Sync all currently approved registrations to Google Sheet 1 ("Approved Teams").
 */
export async function syncAllApprovedRegistrationsAction(): Promise<{
  success: boolean;
  message: string;
  count: number;
}> {
  await requireAdminUser();

  try {
    const { data: approvedList, error } = await supabaseAdmin
      .from("team_registrations")
      .select("*")
      .eq("status", "approved");

    if (error) {
      return { success: false, message: error.message, count: 0 };
    }

    const cleanApprovedList = (approvedList || []).filter((r: any) => {
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
        name.startsWith("test") ||
        email === "rishithsgowda13@gmail.com"
      );
    });

    if (cleanApprovedList.length === 0) {
      return { success: true, message: "No approved registrations to sync.", count: 0 };
    }

    let syncedCount = 0;
    for (const reg of cleanApprovedList) {
      const membersList: any[] = Array.isArray(reg.members) ? reg.members : [];
      const d2 = membersList[0] || {};
      const d3 = membersList[1] || {};
      const d4 = membersList[2] || {};
      const isBase64 = typeof reg.payment_proof_url === "string" && reg.payment_proof_url.startsWith("data:");

      const pass = reg.login_password || reg.generated_credentials?.password || generateSecurePassword();
      let code = reg.team_code || reg.generated_credentials?.teamCode || `IVC-RY-${String(approvedList.indexOf(reg) + 1).padStart(3, "0")}`;
      if (code.startsWith("IVC-VV-")) {
        code = code.replace("IVC-VV-", "IVC-RY-");
      }
      const uname = reg.login_username || reg.generated_credentials?.username || reg.team_name.toLowerCase().replace(/[^a-z0-9]/g, "");

      // If missing password or credentials in Supabase columns, backfill now
      if (!reg.generated_credentials?.password) {
        await supabaseAdmin
          .from("team_registrations")
          .update({
            generated_credentials: {
              ...(reg.generated_credentials || {}),
              username: uname,
              email: reg.leader_email,
              password: pass,
              teamCode: code,
            },
          })
          .eq("id", reg.id);
      }

      const record: GoogleSheetRegistrationRecord = {
        sheetName: "Approved",
        teamName: reg.team_name,
        track: (reg.leader_sem && reg.leader_sem.includes("3")) || (reg.track && reg.track.includes("3")) ? "3rd Sem" : "1st Sem",
        teamCode: code,
        status: "Approved",
        decisionAt: formatToIST(reg.approved_at || reg.created_at),

        // Driver 1 (Leader)
        leaderName: reg.leader_name,
        leaderEmail: reg.leader_email,
        leaderPhone: reg.leader_phone || reg.payment_phone || "",
        leaderCollege: reg.leader_college || "",
        leaderUsn: reg.leader_usn || "",
        leaderBranch: reg.leader_branch || "",
        leaderSem: reg.leader_sem || "",

        // Driver 2
        driver2Name: d2.name || "",
        driver2Email: d2.email || "",
        driver2Phone: d2.phone || "",
        driver2College: d2.college || "",
        driver2Usn: d2.usn || "",
        driver2Branch: d2.branch || "",
        driver2Sem: d2.sem || "",

        // Driver 3
        driver3Name: d3.name || "",
        driver3Email: d3.email || "",
        driver3Phone: d3.phone || "",
        driver3College: d3.college || "",
        driver3Usn: d3.usn || "",
        driver3Branch: d3.branch || "",
        driver3Sem: d3.sem || "",

        // Driver 4
        driver4Name: d4.name || "",
        driver4Email: d4.email || "",
        driver4Phone: d4.phone || "",
        driver4College: d4.college || "",
        driver4Usn: d4.usn || "",
        driver4Branch: d4.branch || "",
        driver4Sem: d4.sem || "",

        // Payment
        transactionId: reg.payment_utr || "",
        paymentProofUrl: isBase64 ? undefined : reg.payment_proof_url,
        paymentProofBase64: isBase64 ? reg.payment_proof_url : undefined,

        // Credentials for Bulk Email Dispatch from Google Sheets (No premature Portal URL)
        loginPassword: pass,
        portalUrl: "",
        whatsappGroup: "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld",
        emailDispatchStatus: "PENDING",
      };

      const res = await syncRegistrationToGoogleSheets(record);
      if (res.success) syncedCount++;

      // Also sync to primary "Registrations" sheet
      await syncRegistrationToGoogleSheets({ ...record, sheetName: "Registrations" }).catch((e) =>
        console.error("[syncAllApprovedRegistrations] Registrations sheet sync error:", e)
      );

      // Also sync to "Credentials" sheet
      await syncCredentialsToGoogleSheets({
        teamName: reg.team_name,
        loginEmail: reg.leader_email,
        loginPassword: pass,
        teamId: reg.team_id || "",
        teamCode: code,
        leaderName: reg.leader_name,
        leaderPhone: reg.leader_phone || reg.payment_phone || "",
        driver2Name: d2.name || "",
        driver2Phone: d2.phone || d2.email || "",
        decisionAt: formatToIST(reg.approved_at || reg.created_at),
      }).catch((e) =>
        console.error("[syncAllApprovedRegistrations] Credentials sheet sync error:", e)
      );
    }

    return {
      success: true,
      message: `Synced ${syncedCount}/${approvedList.length} verified teams across all Google Sheets tabs ("Registrations", "Approved", & "Credentials").`,
      count: syncedCount,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Bulk sync failed: ${errorMsg}`, count: 0 };
  }
}

/**
 * Admin Action: Export registrations as CSV for direct import into Google Sheets.
 */
export async function exportRegistrationsCsvAction(
  filterStatus?: "all" | "approved" | "pending" | "rejected" | "waitlist"
): Promise<{ success: boolean; csv?: string; message?: string }> {
  await requireAdminUser();

  try {
    let query = supabaseAdmin
      .from("team_registrations")
      .select("*")
      .order("created_at", { ascending: false });

    if (filterStatus && filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query;
    if (error) throw error;

    const records: GoogleSheetRegistrationRecord[] = (data || []).map((r) => {
      const membersList: any[] = Array.isArray(r.members) ? r.members : [];
      const d2 = membersList[0] || {};
      const d3 = membersList[1] || {};
      const d4 = membersList[2] || {};

      return {
        teamName: r.team_name,
        track: (r.leader_sem && r.leader_sem.includes("3")) || (r.track && r.track.includes("3")) ? "3rd Sem" : "1st Sem",
        teamCode: r.generated_credentials?.teamCode || "",
        status:
          r.status === "approved"
            ? "Approved"
            : r.status === "waitlist"
            ? "Waitlist"
            : r.status === "pending"
            ? "Pending"
            : "Rejected",
        decisionAt: formatToIST(r.approved_at || r.updated_at || r.created_at),
        rejectionReason: r.rejection_reason || "",

        // Driver 1 (Leader)
        leaderName: r.leader_name,
        leaderEmail: r.leader_email,
        leaderPhone: r.leader_phone || r.payment_phone || "",
        leaderCollege: r.leader_college || "",
        leaderUsn: r.leader_usn || "",
        leaderBranch: r.leader_branch || "",
        leaderSem: r.leader_sem || "",

        // Driver 2
        driver2Name: d2.name || "",
        driver2Email: d2.email || "",
        driver2Phone: d2.phone || "",
        driver2College: d2.college || "",
        driver2Usn: d2.usn || "",
        driver2Branch: d2.branch || "",
        driver2Sem: d2.sem || "",

        // Driver 3
        driver3Name: d3.name || "",
        driver3Email: d3.email || "",
        driver3Phone: d3.phone || "",
        driver3College: d3.college || "",
        driver3Usn: d3.usn || "",
        driver3Branch: d3.branch || "",
        driver3Sem: d3.sem || "",

        // Driver 4
        driver4Name: d4.name || "",
        driver4Email: d4.email || "",
        driver4Phone: d4.phone || "",
        driver4College: d4.college || "",
        driver4Usn: d4.usn || "",
        driver4Branch: d4.branch || "",
        driver4Sem: d4.sem || "",

        // Payment
        transactionId: r.payment_utr || "",
        paymentProofUrl: r.payment_proof_url?.startsWith("data:")
          ? "[Base64 Screenshot Attached]"
          : r.payment_proof_url || "",

        // Credentials for Bulk Email Dispatch from Google Sheets / Mail Merge (No premature portal URL)
        loginPassword: r.login_password || r.generated_credentials?.password || "",
        portalUrl: "",
        whatsappGroup: "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld",
        emailDispatchStatus: "PENDING",
      };
    });

    const csv = generateRegistrationsCsv(records);
    return { success: true, csv };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Export failed: ${errorMsg}` };
  }
}

