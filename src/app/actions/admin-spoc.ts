"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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
  assigned_spoc_id?: string | null;
  assigned_spoc_name?: string | null;
}

export interface SpocPortalData {
  spocs: SpocItem[];
  teams: SpocTeamOption[];
}

// 1. Fetch SPOCs and Teams data
export async function getSpocPortalData(): Promise<SpocPortalData> {
  try {
    await requireAdmin();
  } catch (err) {
    console.warn("getSpocPortalData auth notice:", err);
    return { spocs: [], teams: [] };
  }

  const fetchData = async (): Promise<SpocPortalData> => {
    const [spocsRes, teamsRes, assignmentsRes] = await Promise.all([
      supabaseAdmin
        .from("spocs")
        .select("*")
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("teams")
        .select("id, name, code, track")
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("team_spoc_assignments")
        .select("spoc_id, team_id"),
    ]);

    const spocsList = spocsRes.data || [];
    const teamsList = teamsRes.data || [];
    const assignments = assignmentsRes.data || [];

    // Map spoc_id -> team_id[]
    const spocToTeams = new Map<string, string[]>();
    // Map team_id -> spoc_id
    const teamToSpoc = new Map<string, string>();

    for (const a of assignments) {
      if (!spocToTeams.has(a.spoc_id)) spocToTeams.set(a.spoc_id, []);
      spocToTeams.get(a.spoc_id)!.push(a.team_id);
      teamToSpoc.set(a.team_id, a.spoc_id);
    }

    const spocNameMap = new Map<string, string>();
    spocsList.forEach((s) => {
      spocNameMap.set(s.id, s.name);
    });

    const spocs: SpocItem[] = spocsList.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      department: s.department,
      notes: s.notes,
      avatar_url: s.avatar_url || null,
      created_at: s.created_at,
      assigned_team_ids: spocToTeams.get(s.id) || [],
    }));

    const teams: SpocTeamOption[] = teamsList.map((t) => {
      const assignedSpocId = teamToSpoc.get(t.id) || null;
      return {
        id: t.id,
        name: t.name,
        code: t.code,
        track: t.track,
        assigned_spoc_id: assignedSpocId,
        assigned_spoc_name: assignedSpocId ? spocNameMap.get(assignedSpocId) || "SPOC" : null,
      };
    });

    return { spocs, teams };
  };

  const timeoutPromise = new Promise<SpocPortalData>((resolve) =>
    setTimeout(() => resolve({ spocs: [], teams: [] }), 3000)
  );

  return Promise.race([fetchData(), timeoutPromise]);
}

// 2. Create SPOC
export async function createSpoc(data: {
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  notes?: string;
  avatar_url?: string;
}) {
  const { user } = await requireAdmin();

  if (!data.name || data.name.trim() === "") {
    throw new Error("SPOC name is required.");
  }

  const { data: newSpoc, error } = await supabaseAdmin
    .from("spocs")
    .insert([
      {
        name: data.name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        department: data.department?.trim() || null,
        notes: data.notes?.trim() || null,
        avatar_url: data.avatar_url?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create SPOC: ${error.message}`);
  }

  // Audit log (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "CREATE_SPOC",
      entity_type: "spoc",
      entity_id: newSpoc.id,
      admin_id: user.id,
      details: { name: newSpoc.name, email: newSpoc.email, department: newSpoc.department },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/spoc");
  revalidatePath("/team");
  return newSpoc;
}

// 3. Update SPOC Details
export async function updateSpoc(data: {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  notes?: string;
  avatar_url?: string;
}) {
  const { user } = await requireAdmin();

  const updatePayload: Record<string, any> = {
    name: data.name.trim(),
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    department: data.department?.trim() || null,
    notes: data.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (data.avatar_url !== undefined) {
    updatePayload.avatar_url = data.avatar_url ? data.avatar_url.trim() : null;
  }

  const { data: updatedSpoc, error } = await supabaseAdmin
    .from("spocs")
    .update(updatePayload)
    .eq("id", data.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update SPOC: ${error.message}`);
  }

  // Audit log (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "UPDATE_SPOC",
      entity_type: "spoc",
      entity_id: data.id,
      admin_id: user.id,
      details: data,
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/spoc");
  revalidatePath("/team");
  return updatedSpoc;
}

// 3b. Upload SPOC Avatar Image
export async function uploadSpocAvatar(formData: FormData) {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file) {
    throw new Error("No image file provided for upload");
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
  if (file.type && !allowedTypes.includes(file.type)) {
    throw new Error("Only image files (JPG, PNG, WebP, GIF, SVG) are allowed.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Avatar image must not exceed 5MB.");
  }

  const bucketName = "spoc-avatars";
  const { data: bucketData, error: bucketError } = await supabaseAdmin.storage.getBucket(bucketName);
  if (bucketError || !bucketData) {
    await supabaseAdmin.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10485760,
    });
  }

  const cleanFileName = (file.name || "avatar.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `avatars/${Date.now()}_${cleanFileName}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    const base64 = buffer.toString("base64");
    const mime = file.type || "image/jpeg";
    return { avatarUrl: `data:${mime};base64,${base64}` };
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return { avatarUrl: publicUrlData.publicUrl };
}

// 4. Delete SPOC
export async function deleteSpoc(spocId: string) {
  const { user } = await requireAdmin();

  // 1. Fetch info for audit log
  const { data: spoc } = await supabaseAdmin
    .from("spocs")
    .select("name, email")
    .eq("id", spocId)
    .maybeSingle();

  // 2. Delete SPOC (team_spoc_assignments cascade delete)
  const { error } = await supabaseAdmin
    .from("spocs")
    .delete()
    .eq("id", spocId);

  if (error) {
    throw new Error(`Failed to delete SPOC: ${error.message}`);
  }

  // Audit log (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "DELETE_SPOC",
      entity_type: "spoc",
      entity_id: spocId,
      admin_id: user.id,
      details: { name: spoc?.name, email: spoc?.email },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/spoc");
  return { success: true };
}

// 5. Update SPOC Team Allotments
export async function updateSpocTeams(data: {
  spocId: string;
  teamIds: string[];
}) {
  const { user } = await requireAdmin();

  // 1. Delete all existing allotments for this SPOC
  const { error: deleteError } = await supabaseAdmin
    .from("team_spoc_assignments")
    .delete()
    .eq("spoc_id", data.spocId);

  if (deleteError) {
    throw new Error(`Failed to reset existing SPOC allotments: ${deleteError.message}`);
  }

  // 2. If assigning new teams, delete any prior allotments for these specific teams (exclusive allotment)
  if (data.teamIds.length > 0) {
    await supabaseAdmin
      .from("team_spoc_assignments")
      .delete()
      .in("team_id", data.teamIds);

    const rows = data.teamIds.map((tId) => ({
      spoc_id: data.spocId,
      team_id: tId,
      allotted_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseAdmin
      .from("team_spoc_assignments")
      .insert(rows);

    if (insertError) {
      throw new Error(`Failed to save SPOC team allotments: ${insertError.message}`);
    }
  }

  // Audit log (non-blocking)
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "UPDATE_SPOC_ASSIGNMENTS",
      entity_type: "team_spoc_assignments",
      entity_id: data.spocId,
      admin_id: user.id,
      details: {
        spoc_id: data.spocId,
        allotted_team_ids: data.teamIds,
        count: data.teamIds.length,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/spoc");
  return { success: true };
}

/**
 * Smart Auto-Allotment Algorithm for SPOCs
 * Distributes teams evenly across active SPOCs using 1-to-1 exclusive team mapping.
 */
export async function autoBalanceSpocAssignments(options: {
  clearExisting?: boolean;
} = {}) {
  const { user } = await requireAdmin();

  const [spocsRes, teamsRes] = await Promise.all([
    supabaseAdmin.from("spocs").select("id, name").order("name", { ascending: true }),
    supabaseAdmin.from("teams").select("id, name, track").order("name", { ascending: true }),
  ]);

  const spocs = spocsRes.data || [];
  const teams = teamsRes.data || [];

  if (spocs.length === 0) {
    throw new Error("No SPOCs found to allocate. Please create SPOCs first.");
  }
  if (teams.length === 0) {
    throw new Error("No teams found to allocate.");
  }

  // Clear existing if requested
  if (options.clearExisting) {
    await supabaseAdmin.from("team_spoc_assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  } else {
    // Only allocate unassigned teams
    const { data: existing } = await supabaseAdmin.from("team_spoc_assignments").select("team_id");
    const assignedTeamIds = new Set((existing || []).map((e) => e.team_id));
    const unassignedTeams = teams.filter((t) => !assignedTeamIds.has(t.id));

    if (unassignedTeams.length === 0) {
      return { success: true, message: "All teams are already assigned to SPOCs.", count: 0 };
    }
  }

  // Fetch current load per SPOC
  const { data: currentAssignments } = await supabaseAdmin
    .from("team_spoc_assignments")
    .select("spoc_id");

  const spocLoads = new Map<string, number>();
  spocs.forEach((s) => spocLoads.set(s.id, 0));
  (currentAssignments || []).forEach((a) => {
    spocLoads.set(a.spoc_id, (spocLoads.get(a.spoc_id) || 0) + 1);
  });

  const { data: alreadyAssigned } = await supabaseAdmin.from("team_spoc_assignments").select("team_id");
  const assignedSet = new Set((alreadyAssigned || []).map((e) => e.team_id));
  const teamsToAssign = teams.filter((t) => !assignedSet.has(t.id));

  const newRows: Array<{ spoc_id: string; team_id: string; allotted_at: string }> = [];

  for (const team of teamsToAssign) {
    // Pick SPOC with lowest current load
    const targetSpoc = [...spocs].sort((a, b) => (spocLoads.get(a.id) || 0) - (spocLoads.get(b.id) || 0))[0];
    newRows.push({
      spoc_id: targetSpoc.id,
      team_id: team.id,
      allotted_at: new Date().toISOString(),
    });
    spocLoads.set(targetSpoc.id, (spocLoads.get(targetSpoc.id) || 0) + 1);
  }

  if (newRows.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("team_spoc_assignments")
      .upsert(newRows, { onConflict: "team_id" });

    if (insertError) {
      throw new Error(`Failed to save auto-balanced SPOC allotments: ${insertError.message}`);
    }
  }

  // Audit log
  void supabaseAdmin.from("audit_logs").insert([
    {
      action: "AUTO_BALANCE_SPOC_ASSIGNMENTS",
      entity_type: "team_spoc_assignments",
      admin_id: user.id,
      details: {
        spocs_count: spocs.length,
        allocated_teams_count: newRows.length,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  revalidatePath("/admin/spoc");
  revalidatePath("/ops");

  return {
    success: true,
    spocsCount: spocs.length,
    allocatedTeamsCount: newRows.length,
  };
}

