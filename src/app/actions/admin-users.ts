"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type AllowedUserRole = "admin" | "judge" | "staff" | "participant" | "leader";

export interface UserProfileItem {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AllowedUserRole;
  created_at: string;
  team_name?: string | null;
  team_role?: string | null;
}

export interface MemberHierarchyItem {
  id: string;
  user_id: string;
  role: "leader" | "member";
  name: string | null;
  full_name?: string | null;
  email: string | null;
  created_at?: string;
}

export interface TeamHierarchyItem {
  id: string;
  name: string;
  code?: string | null;
  track?: string | null;
  leader_name?: string | null;
  leader?: MemberHierarchyItem | null;
  members: MemberHierarchyItem[];
  totalMembersCount: number;
}

export async function getTeamsHierarchyData(): Promise<TeamHierarchyItem[]> {
  try {
    await requireAdmin();
  } catch (e) {
    console.warn("getTeamsHierarchyData auth check skipped or failed:", e);
    return [];
  }

  const fetchTeams = async (): Promise<TeamHierarchyItem[]> => {
    // 1. Fetch teams
    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from("teams")
      .select("id, name, code, track, leader_name")
      .order("name", { ascending: true });

    if (teamsErr || !teams) {
      console.error("Failed to fetch teams:", teamsErr?.message);
      return [];
    }

    // 2. Fetch team members with profile details
    const { data: rawMembers, error: membersErr } = await supabaseAdmin
      .from("team_members")
      .select(`
        id,
        team_id,
        user_id,
        role,
        name,
        email,
        joined_at,
        profiles (
          id,
          full_name,
          email
        )
      `);

    if (membersErr) {
      console.warn("Notice when fetching team members:", membersErr.message);
    }

    // Group members by team_id
    const teamMembersMap = new Map<string, MemberHierarchyItem[]>();

    ((rawMembers as any[]) || []).forEach((rm) => {
      const profile = Array.isArray(rm.profiles) ? rm.profiles[0] : rm.profiles;
      const nameVal = profile?.full_name || rm.name || "Unknown Member";
      const memberItem: MemberHierarchyItem = {
        id: rm.id,
        user_id: rm.user_id,
        role: rm.role === "leader" ? "leader" : "member",
        name: nameVal,
        full_name: nameVal,
        email: profile?.email || rm.email || null,
        created_at: rm.joined_at,
      };

      if (!teamMembersMap.has(rm.team_id)) {
        teamMembersMap.set(rm.team_id, []);
      }
      teamMembersMap.get(rm.team_id)!.push(memberItem);
    });

    return teams.map((team) => {
      const allMembers = teamMembersMap.get(team.id) || [];
      const leader =
        allMembers.find((m) => m.role === "leader") ||
        (team.leader_name
          ? {
              id: `leader-${team.id}`,
              user_id: "",
              role: "leader" as const,
              name: team.leader_name,
              full_name: team.leader_name,
              email: null,
            }
          : null);

      const otherMembers = allMembers.filter((m) => m !== leader);

      return {
        id: team.id,
        name: team.name,
        code: team.code,
        track: team.track,
        leader_name: team.leader_name,
        leader,
        members: otherMembers,
        totalMembersCount: (leader ? 1 : 0) + otherMembers.length,
      };
    });
  };

  const timeoutPromise = new Promise<TeamHierarchyItem[]>((resolve) =>
    setTimeout(() => resolve([]), 3000)
  );

  return Promise.race([fetchTeams(), timeoutPromise]);
}

export async function getUsersList(params?: {
  role?: string;
  search?: string;
}): Promise<UserProfileItem[]> {
  try {
    await requireAdmin();
  } catch (e) {
    console.warn("getUsersList auth check skipped or failed:", e);
    return [];
  }

  const fetchUsers = async (): Promise<UserProfileItem[]> => {
    let query = supabaseAdmin
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        role,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (params?.role && params.role !== "all") {
      query = query.eq("role", params.role);
    }

    if (params?.search && params.search.trim() !== "") {
      const s = `%${params.search.trim()}%`;
      query = query.or(`full_name.ilike.${s},email.ilike.${s}`);
    }

    const { data: profiles, error } = await query;

    if (error) {
      console.error(`Failed to fetch profiles: ${error.message}`);
      return [];
    }

    if (!profiles || profiles.length === 0) {
      return [];
    }

    // Fetch team memberships for team name display
    const userIds = profiles.map((p) => p.id);
  const { data: teamMembers } = await supabaseAdmin
    .from("team_members")
    .select(`
      user_id,
      role,
      teams (
        name,
        code
      )
    `)
    .in("user_id", userIds);

  const teamMap = new Map<string, { team_name: string; team_role: string }>();
  if (teamMembers) {
    (
      teamMembers as unknown as Array<{
        user_id: string;
        role?: string | null;
        teams?:
          | { name?: string | null; code?: string | null }
          | Array<{ name?: string | null; code?: string | null }>
          | null;
      }>
    ).forEach((tm) => {
      const teamObj = Array.isArray(tm.teams) ? tm.teams[0] : tm.teams;
      teamMap.set(tm.user_id, {
        team_name: teamObj?.name || teamObj?.code || "",
        team_role: tm.role || "",
      });
    });
  }

    return profiles.map((p) => {
      const tm = teamMap.get(p.id);
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role as AllowedUserRole,
        created_at: p.created_at,
        team_name: tm?.team_name || null,
        team_role: tm?.team_role || null,
      };
    });
  };

  const timeoutPromise = new Promise<UserProfileItem[]>((resolve) =>
    setTimeout(() => {
      console.warn("getUsersList timed out after 3000ms. Returning fallback empty list.");
      resolve([]);
    }, 3000)
  );

  return Promise.race([fetchUsers(), timeoutPromise]);
}

export async function updateUserRole(data: {
  userId: string;
  newRole: AllowedUserRole;
}) {
  const { user } = await requireAdmin();

  if (user.id === data.userId && data.newRole !== "admin") {
    throw new Error("Security Alert: You cannot demote your own active admin account.");
  }

  // 1. Fetch current profile to capture previous role for audit logs
  const { data: currentProfile, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", data.userId)
    .single();

  if (fetchErr || !currentProfile) {
    throw new Error("User profile not found.");
  }

  const previousRole = currentProfile.role;

  // 2. Update role in public.profiles table
  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({ role: data.newRole })
    .eq("id", data.userId);

  if (updateErr) {
    throw new Error(`Failed to update role in profiles: ${updateErr.message}`);
  }

  // 3. Keep auth.users metadata in sync
  try {
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      user_metadata: {
        role: data.newRole,
      },
    });
  } catch (err) {
    console.warn("Could not update auth metadata:", err);
  }

  // 4. Record entry in audit_logs (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "UPDATE_USER_ROLE",
      entity_type: "profile",
      entity_id: data.userId,
      admin_id: user.id,
      details: {
        target_email: currentProfile.email,
        target_name: currentProfile.full_name,
        previous_role: previousRole,
        new_role: data.newRole,
      },
    },
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/users");

  return { success: true, message: `Role updated to ${data.newRole}` };
}

export async function createUser(data: {
  email: string;
  password: string;
  fullName: string;
  role: AllowedUserRole;
}) {
  const { user } = await requireAdmin();

  if (!data.email || !data.password || !data.fullName) {
    throw new Error("Missing required user fields (email, password, full name).");
  }

  if (data.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  // 1. Create account via Supabase Admin API
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.fullName,
      role: data.role,
    },
  });

  if (createError || !newUser?.user) {
    throw new Error(`Failed to create user: ${createError?.message || "Unknown error"}`);
  }

  const newUserId = newUser.user.id;

  // 2. Ensure role in profiles is assigned the intended role
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: newUserId,
      email: data.email,
      full_name: data.fullName,
      role: data.role,
    });

  if (profileError) {
    throw new Error(`User created in auth, but failed to update profile: ${profileError.message}`);
  }

  // 3. Record in audit_logs (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "CREATE_USER",
      entity_type: "user",
      entity_id: newUserId,
      admin_id: user.id,
      details: {
        email: data.email,
        full_name: data.fullName,
        assigned_role: data.role,
      },
    },
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/users");

  return { success: true, user: newUser.user };
}

export async function deleteUser(userId: string) {
  const { user } = await requireAdmin();

  if (user.id === userId) {
    throw new Error("Security Alert: You cannot delete your own admin account.");
  }

  // 1. Fetch user info for audit logging
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", userId)
    .single();

  // 2. Delete user from auth.users (cascades to public.profiles)
  const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteAuthError) {
    // If not found in auth.users, remove from public.profiles directly
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
  } else {
    // Explicit cleanup guarantee
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
  }

  // 3. Record in audit_logs (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "DELETE_USER",
      entity_type: "user",
      entity_id: userId,
      admin_id: user.id,
      details: {
        deleted_email: profile?.email || null,
        deleted_name: profile?.full_name || null,
        deleted_role: profile?.role || null,
      },
    },
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/users");

  return { success: true };
}


export interface BulkImportUserRecord {
  full_name: string;
  email: string;
  role: AllowedUserRole;
  password?: string;
  team_name?: string;
  team_code?: string;
  track?: string;
}

export async function bulkImportUsers(records: BulkImportUserRecord[]) {
  const { user } = await requireAdmin();

  if (!records || records.length === 0) {
    throw new Error("No records provided for import.");
  }

  const results = {
    total: records.length,
    created: 0,
    updated: 0,
    errors: [] as string[],
  };

  const DEFAULT_PASSWORD = "123";

  for (const item of records) {
    const email = item.email?.trim().toLowerCase();
    const fullName = item.full_name?.trim();
    let rawRole = item.role?.toLowerCase();
    // Security fencing: Nobody can be assigned as admin through CSV import
    if (rawRole === "admin") {
      rawRole = "participant";
    }
    const role: AllowedUserRole = (rawRole as AllowedUserRole) || "participant";
    const password = item.password?.trim() || DEFAULT_PASSWORD;

    if (!email || !fullName) {
      results.errors.push(`Row skipped: missing email or full name (${JSON.stringify(item)})`);
      continue;
    }

    try {
      // 1. Check if user already exists in auth or profiles
      let userId: string | null = null;
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, role")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        userId = existingProfile.id;
        // Update profile
        await supabaseAdmin
          .from("profiles")
          .update({
            full_name: fullName,
            role: role,
          })
          .eq("id", userId);

        if (userId) {
          try {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              user_metadata: { full_name: fullName, role },
            });
          } catch {
            // Ignore metadata sync error
          }
        }

        results.updated++;
      } else {
        // Try creating in auth
        try {
          const { data: newUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role },
          });

          if (createAuthErr) throw createAuthErr;
          userId = newUser.user?.id || null;
        } catch {
          // If auth user already exists in auth.users
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
          const match = authUsers?.users?.find((u) => u.email?.toLowerCase() === email);
          userId = match?.id || null;
        }

        if (userId) {
          await supabaseAdmin.from("profiles").upsert({
            id: userId,
            email,
            full_name: fullName,
            role,
          });
          results.created++;
        }
      }

      // If team information is provided, link them
      if (userId && item.team_name) {
        const teamName = item.team_name.trim();
        let teamId: string | null = null;

        const { data: existingTeam } = await supabaseAdmin
          .from("teams")
          .select("id")
          .eq("name", teamName)
          .maybeSingle();

        if (existingTeam) {
          teamId = existingTeam.id;
        } else {
          const { data: newTeam } = await supabaseAdmin
            .from("teams")
            .insert([
              {
                name: teamName,
                code: item.team_code || null,
                track: item.track || null,
                leader_name: role === "leader" ? fullName : null,
                status: "active",
              },
            ])
            .select("id")
            .single();

          if (newTeam) teamId = newTeam.id;
        }

        if (teamId) {
          await supabaseAdmin.from("team_members").upsert(
            {
              team_id: teamId,
              user_id: userId,
              role: role === "leader" ? "leader" : "member",
              name: fullName,
              email: email,
            },
            { onConflict: "team_id,user_id" }
          );
        }
      }
    } catch (err: unknown) {
      results.errors.push(`Error for ${email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Audit log
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "BULK_IMPORT_USERS",
      entity_type: "user",
      admin_id: user.id,
      details: {
        total: results.total,
        created: results.created,
        updated: results.updated,
        error_count: results.errors.length,
      },
    },
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/users");

  return results;
}

