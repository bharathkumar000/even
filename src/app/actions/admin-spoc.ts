"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

/**
 * Staff / Club Members are the source of truth for SPOC identities.
 * `SpocItem.id` is always the `public.profiles.id` of the staff member.
 * The `public.spocs` table is retained as the assignment record so that
 * existing `team_spoc_assignments` remain valid.
 */
export interface SpocItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  notes: string | null;
  avatar_url?: string | null;
  created_at: string;
  assigned_team_ids: string[];
}

export interface SpocTeamOption {
  id: string;
  name: string;
  code?: string | null;
  track?: string | null;
  /** Staff profile ID of the assigned SPOC. Null when unassigned */
  assigned_spoc_id?: string | null;
  assigned_spoc_name?: string | null;
}

export interface SpocPortalData {
  spocs: SpocItem[];
  teams: SpocTeamOption[];
}

interface StaffProfile {
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

interface SpocRow {
  id: string;
  staff_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface TeamRow {
  id: string;
  name: string;
  code?: string | null;
  track?: string | null;
}

function getDisplayName(profile: {
  full_name?: string | null;
  email?: string | null;
}): string {
  const name = profile.full_name?.trim();
  if (name) return name;

  const email = profile.email?.trim();
  if (email) return email.split("@")[0];

  return "Staff Member";
}

async function getEligibleStaff(staffId: string): Promise<StaffProfile> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name, email, created_at")
    .eq("id", staffId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify staff member: ${error.message}`);
  }

  if (!data) {
    throw new Error("Selected staff member was not found.");
  }

  if (data.role !== "staff") {
    throw new Error("Selected user is not a Staff / Club Member.");
  }

  return data as StaffProfile;
}

async function ensureSpocRowForStaff(
  staff: StaffProfile
): Promise<{ id: string }> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("spocs")
    .select("id")
    .eq("staff_id", staff.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load SPOC record: ${fetchError.message}`);
  }

  if (existing) return existing;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("spocs")
    .insert([
      {
        staff_id: staff.id,
        name: getDisplayName(staff),
        email: staff.email,
      },
    ])
    .select("id")
    .single();

  if (insertError) {
    // A concurrent request may have created the row between the select and insert.
    const { data: retry } = await supabaseAdmin
      .from("spocs")
      .select("id")
      .eq("staff_id", staff.id)
      .maybeSingle();

    if (retry) return retry;

    throw new Error(`Failed to create SPOC record: ${insertError.message}`);
  }

  return inserted;
}

/**
 * Load every eligible Staff / Club Member as an available SPOC, together with
 * their real team assignments.
 */
export async function getSpocPortalData(): Promise<SpocPortalData> {
  try {
    await requireAdmin();
  } catch (err) {
    console.warn("getSpocPortalData auth notice:", err);
    return { spocs: [], teams: [] };
  }

  const fetchData = async (): Promise<SpocPortalData> => {
    const [profilesRes, spocsRes, teamsRes, assignmentsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, role, full_name, email, created_at")
        .eq("role", "staff")
        .order("full_name", { ascending: true }),
      supabaseAdmin
        .from("spocs")
        .select("id, staff_id, name, email, phone, avatar_url, created_at"),
      supabaseAdmin
        .from("teams")
        .select("id, name, code, track")
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("team_spoc_assignments")
        .select("spoc_id, team_id"),
    ]);

    if (profilesRes.error) {
      console.error(
        "Failed to load staff profiles for SPOC management:",
        profilesRes.error.message
      );
      return { spocs: [], teams: [] };
    }

    const staffProfiles = (profilesRes.data || []) as StaffProfile[];
    const spocRows = (spocsRes.data || []) as SpocRow[];
    const teamsList = (teamsRes.data || []) as TeamRow[];
    const assignments = assignmentsRes.data || [];

    const spocByStaffId = new Map<string, SpocRow>();
    const spocIdToStaffId = new Map<string, string>();
    const spocNameById = new Map<string, string>();

    for (const row of spocRows) {
      if (row.staff_id) {
        spocByStaffId.set(row.staff_id, row);
        spocIdToStaffId.set(row.id, row.staff_id);
      }
      if (row.name) {
        spocNameById.set(row.id, row.name);
      }
    }

    const spocToTeams = new Map<string, string[]>();
    const teamToSpoc = new Map<string, string>();

    for (const assignment of assignments) {
      if (!spocToTeams.has(assignment.spoc_id)) {
        spocToTeams.set(assignment.spoc_id, []);
      }
      spocToTeams.get(assignment.spoc_id)!.push(assignment.team_id);
      teamToSpoc.set(assignment.team_id, assignment.spoc_id);
    }

    const staffNameById = new Map<string, string>();

    const spocs: SpocItem[] = staffProfiles.map((profile) => {
      const name = getDisplayName(profile);
      staffNameById.set(profile.id, name);

      const spocRow = spocByStaffId.get(profile.id);

      return {
        id: profile.id,
        name,
        email: profile.email,
        phone: spocRow?.phone || null,
        department: null,
        notes: null,
        avatar_url: spocRow?.avatar_url || null,
        created_at:
          profile.created_at || spocRow?.created_at || new Date().toISOString(),
        assigned_team_ids: spocRow
          ? spocToTeams.get(spocRow.id) || []
          : [],
      };
    });

    const teams: SpocTeamOption[] = teamsList.map((team) => {
      const assignedSpocRowId = teamToSpoc.get(team.id) || null;
      const assignedStaffId = assignedSpocRowId
        ? spocIdToStaffId.get(assignedSpocRowId) || null
        : null;

      return {
        id: team.id,
        name: team.name,
        code: team.code,
        track: team.track,
        assigned_spoc_id: assignedStaffId,
        assigned_spoc_name: assignedStaffId
          ? staffNameById.get(assignedStaffId) ||
            spocNameById.get(assignedSpocRowId!) ||
            "SPOC"
          : null,
      };
    });

    return { spocs, teams };
  };

  const timeoutPromise = new Promise<SpocPortalData>((resolve) =>
    setTimeout(() => resolve({ spocs: [], teams: [] }), 5000)
  );

  return Promise.race([fetchData(), timeoutPromise]);
}

/**
 * Replace the full set of team assignments for a staff SPOC.
 * `data.spocId` is the staff `profiles.id`, not the internal spocs row id.
 */
export async function updateSpocTeams(data: {
  spocId: string;
  teamIds: string[];
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}) {
  const { user } = await requireAdmin();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  const staff = await getEligibleStaff(data.spocId);
  const spocRow = await ensureSpocRowForStaff(staff);

  const uniqueTeamIds = Array.from(
    new Set((data.teamIds || []).filter(Boolean))
  );

  if (uniqueTeamIds.length > 0) {
    const { data: validTeams, error: teamError } = await supabaseAdmin
      .from("teams")
      .select("id")
      .in("id", uniqueTeamIds);

    if (teamError) {
      throw new Error(`Failed to validate selected teams: ${teamError.message}`);
    }

    if ((validTeams || []).length !== uniqueTeamIds.length) {
      throw new Error(
        "One or more selected teams no longer exist. Refresh and try again."
      );
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("team_spoc_assignments")
    .delete()
    .eq("spoc_id", spocRow.id);

  if (deleteError) {
    throw new Error(
      `Failed to reset existing SPOC allotments: ${deleteError.message}`
    );
  }

  if (uniqueTeamIds.length > 0) {
    // Exclusive allocation: a team can belong to only one SPOC.
    const { error: deleteTeamError } = await supabaseAdmin
      .from("team_spoc_assignments")
      .delete()
      .in("team_id", uniqueTeamIds);

    if (deleteTeamError) {
      throw new Error(
        `Failed to release teams from previous SPOCs: ${deleteTeamError.message}`
      );
    }

    const rows = uniqueTeamIds.map((teamId) => ({
      spoc_id: spocRow.id,
      team_id: teamId,
      allotted_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseAdmin
      .from("team_spoc_assignments")
      .insert(rows);

    if (insertError) {
      throw new Error(
        `Failed to save SPOC team allotments: ${insertError.message}`
      );
    }
  }

  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "UPDATE_SPOC_ASSIGNMENTS",
      entity_type: "team_spoc_assignments",
      entity_id: data.spocId,
      admin_id: user.id,
      details: {
        staff_profile_id: staff.id,
        spoc_id: spocRow.id,
        allotted_team_ids: uniqueTeamIds,
        count: uniqueTeamIds.length,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/spoc");
  revalidatePath("/team");
  return { success: true };
}

/**
 * Distribute teams evenly across all eligible Staff / Club Member SPOCs.
 * Teams currently assigned to legacy/unlinked SPOC rows are treated as
 * unassigned so they can be brought under staff-based coordination.
 */
export async function autoBalanceSpocAssignments(
  options: { clearExisting?: boolean; [CSRF_CONSTANTS.HEADER_NAME]?: string } = {}
) {
  const { user } = await requireAdmin();
  await validateCsrfToken(options[CSRF_CONSTANTS.HEADER_NAME] || null);

  const [profilesRes, spocsRes, teamsRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, role, full_name, email, created_at")
      .eq("role", "staff")
      .order("full_name", { ascending: true }),
    supabaseAdmin.from("spocs").select("id, staff_id"),
    supabaseAdmin
      .from("teams")
      .select("id, name, track")
      .order("name", { ascending: true }),
  ]);

  if (profilesRes.error) {
    throw new Error(
      `Failed to load staff members: ${profilesRes.error.message}`
    );
  }

  const staffProfiles = (profilesRes.data || []) as StaffProfile[];
  const spocRows = (spocsRes.data || []) as Array<{
    id: string;
    staff_id: string | null;
  }>;
  const teams = (teamsRes.data || []) as TeamRow[];

  const staffIds = new Set(staffProfiles.map((p) => p.id));
  const spocRowByStaffId = new Map<string, string>();

  for (const row of spocRows) {
    if (row.staff_id && staffIds.has(row.staff_id)) {
      spocRowByStaffId.set(row.staff_id, row.id);
    }
  }

  // Ensure every eligible staff member has an internal SPOC row.
  for (const staff of staffProfiles) {
    if (!spocRowByStaffId.has(staff.id)) {
      const row = await ensureSpocRowForStaff(staff);
      spocRowByStaffId.set(staff.id, row.id);
    }
  }

  if (spocRowByStaffId.size === 0) {
    throw new Error(
      "No eligible Staff / Club Members found. Add staff accounts under User Management first."
    );
  }

  if (teams.length === 0) {
    throw new Error("No teams found to allocate.");
  }

  const eligibleSpocIds = Array.from(spocRowByStaffId.values());
  const eligibleSpocIdSet = new Set(eligibleSpocIds);

  if (options.clearExisting) {
    const { error: clearError } = await supabaseAdmin
      .from("team_spoc_assignments")
      .delete()
      .in("spoc_id", eligibleSpocIds);

    if (clearError) {
      throw new Error(
        `Failed to clear existing SPOC assignments: ${clearError.message}`
      );
    }
  }

  const { data: currentAssignments, error: assignmentsError } =
    await supabaseAdmin
      .from("team_spoc_assignments")
      .select("spoc_id, team_id");

  if (assignmentsError) {
    throw new Error(
      `Failed to load current SPOC assignments: ${assignmentsError.message}`
    );
  }

  const spocLoads = new Map<string, number>();
  eligibleSpocIds.forEach((id) => spocLoads.set(id, 0));

  const eligibleAssignedTeamIds = new Set<string>();

  for (const assignment of currentAssignments || []) {
    if (eligibleSpocIdSet.has(assignment.spoc_id)) {
      eligibleAssignedTeamIds.add(assignment.team_id);
      spocLoads.set(
        assignment.spoc_id,
        (spocLoads.get(assignment.spoc_id) || 0) + 1
      );
    }
  }

  const teamsToAssign = teams.filter(
    (team) => !eligibleAssignedTeamIds.has(team.id)
  );

  if (teamsToAssign.length === 0) {
    revalidatePath("/admin/spoc");
    return {
      success: true,
      message: "All teams are already assigned to eligible Staff SPOCs.",
      spocsCount: eligibleSpocIds.length,
      allocatedTeamsCount: 0,
    };
  }

  const newRows: Array<{
    spoc_id: string;
    team_id: string;
    allotted_at: string;
  }> = [];

  for (const team of teamsToAssign) {
    let targetSpocId = eligibleSpocIds[0];
    let lowestLoad = spocLoads.get(targetSpocId) || 0;

    for (const spocId of eligibleSpocIds) {
      const load = spocLoads.get(spocId) || 0;
      if (load < lowestLoad) {
        lowestLoad = load;
        targetSpocId = spocId;
      }
    }

    newRows.push({
      spoc_id: targetSpocId,
      team_id: team.id,
      allotted_at: new Date().toISOString(),
    });

    spocLoads.set(targetSpocId, lowestLoad + 1);
  }

  const { error: upsertError } = await supabaseAdmin
    .from("team_spoc_assignments")
    .upsert(newRows, { onConflict: "team_id" });

  if (upsertError) {
    throw new Error(
      `Failed to save auto-balanced SPOC allotments: ${upsertError.message}`
    );
  }

  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "AUTO_BALANCE_SPOC_ASSIGNMENTS",
      entity_type: "team_spoc_assignments",
      admin_id: user.id,
      details: {
        staff_spoc_count: eligibleSpocIds.length,
        allocated_teams_count: newRows.length,
        clear_existing: !!options.clearExisting,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/spoc");
  revalidatePath("/ops");

  return {
    success: true,
    spocsCount: eligibleSpocIds.length,
    allocatedTeamsCount: newRows.length,
  };
}
