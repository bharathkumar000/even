"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface TeamMemberInput {
  name: string;
  email: string;
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

/**
 * Public Server Action: Submit a team registration with 4 members and payment proof.
 */
export async function submitTeamRegistration(
  formData: FormData
): Promise<{ success: boolean; message: string; registrationId?: string }> {
  try {
    const teamName = String(formData.get("teamName") || "").trim();
    const track = String(formData.get("track") || "").trim();

    // Leader info
    const leaderName = String(formData.get("leaderName") || "").trim();
    const leaderEmail = String(formData.get("leaderEmail") || "").trim().toLowerCase();
    const leaderPhone = String(formData.get("leaderPhone") || "").trim();
    const leaderCollege = String(formData.get("leaderCollege") || "").trim();
    const leaderUsn = String(formData.get("leaderUsn") || "").trim().toUpperCase();
    const leaderBranch = String(formData.get("leaderBranch") || "").trim();
    const leaderSem = String(formData.get("leaderSem") || "").trim();

    // Payment info
    const paymentUtr = String(formData.get("paymentUtr") || "").trim();
    const paymentPhone = String(formData.get("paymentPhone") || "").trim();
    const paymentFile = formData.get("paymentProof") as File | null;

    if (!teamName || !track || !leaderName || !leaderEmail || !leaderPhone || !paymentUtr) {
      return { success: false, message: "Please fill in all required team and payment fields." };
    }

    if (!paymentFile || paymentFile.size === 0) {
      return { success: false, message: "Payment proof screenshot is required." };
    }

    // Parse the other 3 members from form data
    const membersRaw = String(formData.get("membersJson") || "[]");
    let members: TeamMemberInput[] = [];
    try {
      members = JSON.parse(membersRaw);
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

    // 1. Upload payment proof screenshot to Supabase Storage
    const fileExt = paymentFile.name.split(".").pop() || "jpg";
    const sanitizedTeamSlug = teamName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const filePath = `payments/${Date.now()}-${sanitizedTeamSlug}.${fileExt}`;

    const fileBuffer = Buffer.from(await paymentFile.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from("payment-proofs")
      .upload(filePath, fileBuffer, {
        contentType: paymentFile.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Payment proof upload failed:", uploadError);
      return { success: false, message: `Failed to upload payment proof: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("payment-proofs")
      .getPublicUrl(filePath);

    const paymentProofUrl = publicUrlData.publicUrl;

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
      payment_utr: paymentUtr,
      payment_phone: paymentPhone,
      payment_proof_url: paymentProofUrl,
      status: "pending",
    };

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("team_registrations")
      .insert(registrationPayload)
      .select("id")
      .single();

    if (insertError) {
      console.error("Database registration insertion error:", insertError);
      // Fallback: If table does not exist, insert into teams with status pending_verification
      if (insertError.message.includes("Could not find the table") || insertError.code === "PGRST204") {
        const fallbackTeamPayload = {
          name: teamName,
          track: track,
          leader_name: leaderName,
          status: "pending_verification",
          table_number: paymentUtr,
          lab_room: paymentPhone,
          dietary_preference: JSON.stringify({
            leaderEmail,
            leaderCollege,
            leaderUsn,
            leaderBranch,
            leaderSem,
            members,
            paymentProofUrl,
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

        return {
          success: true,
          message: "Registration submitted successfully! Payment verification in progress.",
          registrationId: fallbackTeam.id,
        };
      }

      return { success: false, message: `Failed to record registration: ${insertError.message}` };
    }

    return {
      success: true,
      message: "Registration submitted successfully! Your payment is under verification by IVC admins.",
      registrationId: insertData.id,
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

    // 7. Generate official QR Code pass payload (compatible with /ops/scanner)
    const qrPayload = JSON.stringify({
      team_id: teamId,
      name: teamName,
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
 */
export async function rejectRegistration(
  registrationId: string,
  reason: string = "Payment proof verification failed."
): Promise<{ success: boolean; message: string }> {
  await requireAdminUser();

  try {
    const { error } = await supabaseAdmin
      .from("team_registrations")
      .update({
        status: "rejected",
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", registrationId);

    if (error) {
      // Fallback check
      await supabaseAdmin
        .from("teams")
        .update({ status: "rejected" })
        .eq("id", registrationId);
    }

    revalidatePath("/admin/registrations");
    return { success: true, message: "Registration marked as rejected." };
  } catch (err: any) {
    console.error("rejectRegistration error:", err);
    return { success: false, message: `Failed to reject: ${err.message}` };
  }
}

