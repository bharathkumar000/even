"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateQrSignature } from "@/lib/qr-signature";
import {
  syncRegistrationToGoogleSheets,
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
  username: string;
  password: string;
  qrPayload: string;
  approvedAt: string;
}

/** Helper: Generate a unique random alphanumeric password (e.g., VV26-9X4M) */
function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 5; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
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

const MAX_CONFIRMED_PER_SEM = 40;
const MAX_WAITLIST_PER_SEM = 10;

/**
 * Public Server Action: Fetch total submitted teams count per semester
 * irrespective of admin approval/rejection status.
 */
export async function getSemesterRegistrationCounts(): Promise<{
  firstSemCount: number;
  thirdSemCount: number;
  maxLimit: number;
  waitlistLimit: number;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .select("leader_sem");

    let firstSemCount = 0;
    let thirdSemCount = 0;

    if (error) {
      // Fallback: if team_registrations table is not created yet, count from teams.dietary_preference
      if (error.message?.includes("Could not find the table") || error.code === "PGRST205") {
        const { data: teamsData } = await supabaseAdmin
          .from("teams")
          .select("dietary_preference");

        for (const t of teamsData || []) {
          if (!t.dietary_preference) continue;
          try {
            const parsed = JSON.parse(t.dietary_preference);
            const sem = String(parsed.leaderSem || "").toLowerCase();
            if (sem.includes("1st") || sem === "1") {
              firstSemCount++;
            } else if (sem.includes("3rd") || sem === "3") {
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
        waitlistLimit: MAX_WAITLIST_PER_SEM,
      };
    }

    for (const row of data || []) {
      const sem = String(row.leader_sem || "").toLowerCase();
      if (sem.includes("1st") || sem === "1") {
        firstSemCount++;
      } else if (sem.includes("3rd") || sem === "3") {
        thirdSemCount++;
      }
    }

    return {
      firstSemCount,
      thirdSemCount,
      maxLimit: MAX_CONFIRMED_PER_SEM,
      waitlistLimit: MAX_WAITLIST_PER_SEM,
    };
  } catch (err) {
    console.error("getSemesterRegistrationCounts error:", err);
    return {
      firstSemCount: 0,
      thirdSemCount: 0,
      maxLimit: MAX_CONFIRMED_PER_SEM,
      waitlistLimit: MAX_WAITLIST_PER_SEM,
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
    const track = String(formData.get("track") || "").trim();

    // Leader info (Vidya Vardhaka College Of Engineering exclusive)
    const leaderName = String(formData.get("leaderName") || "").trim();
    const leaderEmail = String(formData.get("leaderEmail") || "").trim().toLowerCase();
    const leaderPhone = String(formData.get("leaderPhone") || "").trim();
    const leaderCollege = "Vidya Vardhaka College Of Engineering";
    const leaderUsn = String(formData.get("leaderUsn") || "").trim().toUpperCase();
    const leaderBranch = String(formData.get("leaderBranch") || "").trim();
    const leaderSem = String(formData.get("leaderSem") || "").trim();

    // Payment info
    const paymentUtr = String(formData.get("paymentUtr") || "").trim();
    const paymentPhone = String(formData.get("paymentPhone") || "").trim() || leaderPhone;
    const paymentFile = formData.get("paymentProof") as File | null;

    if (!teamName || !track || !leaderName || !leaderEmail || !leaderPhone) {
      return { success: false, message: "Please fill in all required team and leader fields." };
    }

    // Parse the other 3 members from form data
    const membersRaw = String(formData.get("membersJson") || "[]");
    let members: TeamMemberInput[] = [];
    try {
      members = JSON.parse(membersRaw);
      if (Array.isArray(members)) {
        members = members.map((m) => ({ ...m, college: "Vidya Vardhaka College Of Engineering" }));
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

    // Check semester counts: 40 confirmed + 10 waiting list max (50 total per semester)
    const { firstSemCount, thirdSemCount, maxLimit, waitlistLimit } = await getSemesterRegistrationCounts();
    const maxTotalPerSem = maxLimit + waitlistLimit;
    const semLower = leaderSem.toLowerCase();
    const isFirstSem = semLower.includes("1st") || semLower === "1";
    const isThirdSem = semLower.includes("3rd") || semLower === "3";
    const currentSemCount = isFirstSem ? firstSemCount : isThirdSem ? thirdSemCount : 0;

    if (currentSemCount >= maxTotalPerSem) {
      return {
        success: false,
        message: `${leaderSem} registration is COMPLETELY LOCKED. All ${maxLimit} confirmed slots and ${waitlistLimit} waiting list slots are full.`,
      };
    }

    const isWaitlist = currentSemCount >= maxLimit;

    // Require payment proof & UTR only for confirmed slots (< 40)
    if (!isWaitlist) {
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
    }

    // 1. Encode payment proof to base64 for confirmed slots (Zero Supabase Storage usage)
    let paymentProofUrl = "WAITLIST (Payment Pending Contact)";
    let finalPaymentUtr = paymentUtr;

    if (isWaitlist) {
      const waitlistNum = currentSemCount - maxLimit + 1;
      finalPaymentUtr = `WAITLIST-#${waitlistNum}`;
    } else if (paymentFile) {
      const fileBuffer = Buffer.from(await paymentFile.arrayBuffer());
      paymentProofUrl = `data:${paymentFile.type || "image/jpeg"};base64,${fileBuffer.toString("base64")}`;
    }

    // 2. Insert into team_registrations table
    const registrationPayload = {
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
    };

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("team_registrations")
      .insert(registrationPayload)
      .select("id")
      .single();

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
            isWaitlist,
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
      insertedRegId = insertData.id;
    }

    // 3. Automatically stream registration to Sheet 1 ("Registrations") irrespective of approval status
    const d2 = members[0] || {};
    const d3 = members[1] || {};
    const d4 = members[2] || {};
    const isBase64Proof = paymentProofUrl.startsWith("data:");

    const initialSheetRecord: ComprehensiveTeamRecord = {
      sheetName: "Registrations",
      teamName: teamName,
      track: track,
      status: isWaitlist ? "Waitlist" : "Pending",
      decisionAt: new Date().toISOString(),

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
    };

    // Non-blocking background sync to Sheet 1 ("Registrations")
    syncRegistrationToGoogleSheets(initialSheetRecord).then(async (res) => {
      if (res.proofUrl && insertedRegId && isBase64Proof) {
        try {
          if (!isFallback) {
            await supabaseAdmin
              .from("team_registrations")
              .update({ payment_proof_url: res.proofUrl })
              .eq("id", insertedRegId);
          }
        } catch {
          // ignore background update error
        }
      }
    }).catch((e) => {
      console.error("[submitTeamRegistration] Background Google Sheets sync error:", e);
    });

    return {
      success: true,
      isWaitlist,
      message: isWaitlist
        ? "Team added to the Waiting List! If a confirmed slot becomes available, we will contact you for payment."
        : "Registration submitted successfully! Your payment is under verification by IVC admins.",
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
export async function getRegistrations(statusFilter?: "all" | "pending" | "approved" | "rejected") {
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

    return { success: true, registrations: data || [], tableFallback: false };
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

    // 2. Generate unique password and team code
    const generatedPassword = generateSecurePassword();

    // Generate readable team code (e.g. IVC-VV-042)
    const { count: teamCount } = await supabaseAdmin
      .from("teams")
      .select("*", { count: "exact", head: true });

    const teamCode = `IVC-VV-${String((teamCount || 0) + 1).padStart(3, "0")}`;

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
      },
    });

    if (authError) {
      // If user already exists in auth, find existing user
      if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const existing = userList?.users?.find(
          (u) => u.email?.toLowerCase() === leaderEmail
        );
        if (existing) {
          authUserId = existing.id;
          // Update password for existing user so they can login
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password: generatedPassword,
          });
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

    // 4. Upsert Leader in `profiles` table
    await supabaseAdmin.from("profiles").upsert({
      id: authUserId,
      email: leaderEmail,
      full_name: leaderName,
      role: "participant",
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

    // 6. Insert all 4 members into `team_members`
    // First, remove any existing members for this team to avoid duplicates
    await supabaseAdmin.from("team_members").delete().eq("team_id", teamId);

    // Leader record
    await supabaseAdmin.from("team_members").insert({
      team_id: teamId,
      user_id: authUserId,
      role: "leader",
      name: leaderName,
      email: leaderEmail,
    });

    // The other 3 members
    for (const m of members) {
      if (m.name && m.email) {
        await supabaseAdmin.from("team_members").insert({
          team_id: teamId,
          user_id: authUserId, // linked to team account
          role: "member",
          name: m.name,
          email: m.email.toLowerCase(),
        });
      }
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
      username: teamName,
      password: generatedPassword,
      qrPayload,
      approvedAt: nowIso,
    };

    // 8. Update team_registrations status to 'approved'
    await supabaseAdmin
      .from("team_registrations")
      .update({
        status: "approved",
        team_id: teamId,
        approved_at: nowIso,
        approved_by: adminUser.id,
        generated_credentials: credentials,
      })
      .eq("id", registrationId);

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
      decisionAt: nowIso,
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
    };

    // Trigger Google Sheets sync (non-blocking, routes to Sheet 1)
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
        track: reg.track || "GRAND PRIX",
        status: "Rejected",
        decisionAt: nowIso,
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

    if (!approvedList || approvedList.length === 0) {
      return { success: true, message: "No approved registrations to sync.", count: 0 };
    }

    let syncedCount = 0;
    for (const reg of approvedList) {
      const membersList: any[] = Array.isArray(reg.members) ? reg.members : [];
      const d2 = membersList[0] || {};
      const d3 = membersList[1] || {};
      const d4 = membersList[2] || {};
      const isBase64 = typeof reg.payment_proof_url === "string" && reg.payment_proof_url.startsWith("data:");

      const record: GoogleSheetRegistrationRecord = {
        sheetName: "Approved",
        teamName: reg.team_name,
        track: reg.track || "GRAND PRIX",
        teamCode: reg.generated_credentials?.teamCode || "",
        status: "Approved",
        decisionAt: reg.approved_at || reg.created_at,

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
      };

      const res = await syncRegistrationToGoogleSheets(record);
      if (res.success) syncedCount++;
    }

    return {
      success: true,
      message: `Synced ${syncedCount}/${approvedList.length} verified teams to Google Sheet 2 ("Approved").`,
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
  filterStatus?: "all" | "approved" | "pending" | "rejected"
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
        track: r.track || "GRAND PRIX",
        teamCode: r.generated_credentials?.teamCode || "",
        status: r.status === "approved" ? "Approved" : "Rejected",
        decisionAt: r.approved_at || r.updated_at || r.created_at,
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
      };
    });

    const csv = generateRegistrationsCsv(records);
    return { success: true, csv };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Export failed: ${errorMsg}` };
  }
}

