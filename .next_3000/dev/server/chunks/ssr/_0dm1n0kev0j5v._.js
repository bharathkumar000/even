(()=>{"use strict";module.exports = [
"[project]/.next-internal/server/app/admin/(dashboard)/users/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/admin-users.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "000d7046ecc0d93d7d4ab4fad7a5a85036223c964c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$users$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getTeamsHierarchyData"],
    "400a75881b4a0f6e8b449a3ed8ec178ffb8fbee9ba",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$users$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["bulkImportUsers"],
    "402474090dc071f97d2003903d07e12dec6665e762",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$users$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createUser"],
    "407a978042a2ca1d1a569f6a4e81cd1e1823472329",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$users$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateUserRole"],
    "4082ac2566fc43333db2fee35a26998cc46f85b9bb",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$users$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteUser"],
    "40aece768c4bd3c435dc4556daddcbd6be4c8e34f8",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$users$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getUsersList"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f28$dashboard$292f$users$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$users$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/(dashboard)/users/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/admin-users.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$users$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/admin-users.ts [app-rsc] (ecmascript)");
}),
"[project]/.next-internal/server/app/admin/(dashboard)/users/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/admin-users.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$users$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/admin-users.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
}),
"[project]/src/app/actions/admin-users.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"000d7046ecc0d93d7d4ab4fad7a5a85036223c964c":{"name":"getTeamsHierarchyData"},"400a75881b4a0f6e8b449a3ed8ec178ffb8fbee9ba":{"name":"bulkImportUsers"},"402474090dc071f97d2003903d07e12dec6665e762":{"name":"createUser"},"407a978042a2ca1d1a569f6a4e81cd1e1823472329":{"name":"updateUserRole"},"4082ac2566fc43333db2fee35a26998cc46f85b9bb":{"name":"deleteUser"},"40aece768c4bd3c435dc4556daddcbd6be4c8e34f8":{"name":"getUsersList"}},"src/app/actions/admin-users.ts",""] */ __turbopack_context__.s([
    "bulkImportUsers",
    ()=>bulkImportUsers,
    "createUser",
    ()=>createUser,
    "deleteUser",
    ()=>deleteUser,
    "getTeamsHierarchyData",
    ()=>getTeamsHierarchyData,
    "getUsersList",
    ()=>getUsersList,
    "updateUserRole",
    ()=>updateUserRole
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth/admin.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/admin.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
async function getTeamsHierarchyData() {
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    } catch (e) {
        console.warn("getTeamsHierarchyData auth check skipped or failed:", e);
        return [];
    }
    const fetchTeams = async ()=>{
        // 1. Fetch teams
        const { data: teams, error: teamsErr } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("teams").select("id, name, code, track, leader_name").order("name", {
            ascending: true
        });
        if (teamsErr || !teams) {
            console.error("Failed to fetch teams:", teamsErr?.message);
            return [];
        }
        // 2. Fetch team members with profile details
        const { data: rawMembers, error: membersErr } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_members").select(`
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
        const teamMembersMap = new Map();
        (rawMembers || []).forEach((rm)=>{
            const profile = Array.isArray(rm.profiles) ? rm.profiles[0] : rm.profiles;
            const nameVal = profile?.full_name || rm.name || "Unknown Member";
            const memberItem = {
                id: rm.id,
                user_id: rm.user_id,
                role: rm.role === "leader" ? "leader" : "member",
                name: nameVal,
                full_name: nameVal,
                email: profile?.email || rm.email || null,
                created_at: rm.joined_at
            };
            if (!teamMembersMap.has(rm.team_id)) {
                teamMembersMap.set(rm.team_id, []);
            }
            teamMembersMap.get(rm.team_id).push(memberItem);
        });
        return teams.map((team)=>{
            const allMembers = teamMembersMap.get(team.id) || [];
            const leader = allMembers.find((m)=>m.role === "leader") || (team.leader_name ? {
                id: `leader-${team.id}`,
                user_id: "",
                role: "leader",
                name: team.leader_name,
                full_name: team.leader_name,
                email: null
            } : null);
            const otherMembers = allMembers.filter((m)=>m !== leader);
            return {
                id: team.id,
                name: team.name,
                code: team.code,
                track: team.track,
                leader_name: team.leader_name,
                leader,
                members: otherMembers,
                totalMembersCount: (leader ? 1 : 0) + otherMembers.length
            };
        });
    };
    const timeoutPromise = new Promise((resolve)=>setTimeout(()=>resolve([]), 3000));
    return Promise.race([
        fetchTeams(),
        timeoutPromise
    ]);
}
async function getUsersList(params) {
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    } catch (e) {
        console.warn("getUsersList auth check skipped or failed:", e);
        return [];
    }
    const fetchUsers = async ()=>{
        let query = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").select(`
        id,
        email,
        full_name,
        role,
        created_at
      `).order("created_at", {
            ascending: false
        }).limit(200);
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
        const userIds = profiles.map((p)=>p.id);
        const { data: teamMembers } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_members").select(`
      user_id,
      role,
      teams (
        name,
        code
      )
    `).in("user_id", userIds);
        const teamMap = new Map();
        if (teamMembers) {
            teamMembers.forEach((tm)=>{
                const teamObj = Array.isArray(tm.teams) ? tm.teams[0] : tm.teams;
                teamMap.set(tm.user_id, {
                    team_name: teamObj?.name || teamObj?.code || "",
                    team_role: tm.role || ""
                });
            });
        }
        return profiles.map((p)=>{
            const tm = teamMap.get(p.id);
            return {
                id: p.id,
                email: p.email,
                full_name: p.full_name,
                role: p.role,
                created_at: p.created_at,
                team_name: tm?.team_name || null,
                team_role: tm?.team_role || null
            };
        });
    };
    const timeoutPromise = new Promise((resolve)=>setTimeout(()=>{
            console.warn("getUsersList timed out after 3000ms. Returning fallback empty list.");
            resolve([]);
        }, 3000));
    return Promise.race([
        fetchUsers(),
        timeoutPromise
    ]);
}
async function updateUserRole(data) {
    const { user } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    if (user.id === data.userId && data.newRole !== "admin") {
        throw new Error("Security Alert: You cannot demote your own active admin account.");
    }
    // 1. Fetch current profile to capture previous role for audit logs
    const { data: currentProfile, error: fetchErr } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").select("role, email, full_name").eq("id", data.userId).single();
    if (fetchErr || !currentProfile) {
        throw new Error("User profile not found.");
    }
    const previousRole = currentProfile.role;
    // 2. Update role in public.profiles table
    const { error: updateErr } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").update({
        role: data.newRole
    }).eq("id", data.userId);
    if (updateErr) {
        throw new Error(`Failed to update role in profiles: ${updateErr.message}`);
    }
    // 3. Keep auth.users metadata in sync
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.updateUserById(data.userId, {
            user_metadata: {
                role: data.newRole
            }
        });
    } catch (err) {
        console.warn("Could not update auth metadata:", err);
    }
    // 4. Record entry in audit_logs (non-blocking)
    void __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("audit_logs").insert([
        {
            action: "UPDATE_USER_ROLE",
            entity_type: "profile",
            entity_id: data.userId,
            admin_id: user.id,
            details: {
                target_email: currentProfile.email,
                target_name: currentProfile.full_name,
                previous_role: previousRole,
                new_role: data.newRole
            }
        }
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin/users");
    return {
        success: true,
        message: `Role updated to ${data.newRole}`
    };
}
async function createUser(data) {
    const { user } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    if (!data.email || !data.password || !data.fullName) {
        throw new Error("Missing required user fields (email, password, full name).");
    }
    if (data.password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
    }
    // 1. Create account via Supabase Admin API
    const { data: newUser, error: createError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
            full_name: data.fullName,
            role: data.role
        }
    });
    if (createError || !newUser?.user) {
        throw new Error(`Failed to create user: ${createError?.message || "Unknown error"}`);
    }
    const newUserId = newUser.user.id;
    // 2. Ensure role in profiles is assigned the intended role
    const { error: profileError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").upsert({
        id: newUserId,
        email: data.email,
        full_name: data.fullName,
        role: data.role
    });
    if (profileError) {
        throw new Error(`User created in auth, but failed to update profile: ${profileError.message}`);
    }
    // 3. Record in audit_logs (non-blocking)
    void __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("audit_logs").insert([
        {
            action: "CREATE_USER",
            entity_type: "user",
            entity_id: newUserId,
            admin_id: user.id,
            details: {
                email: data.email,
                full_name: data.fullName,
                assigned_role: data.role
            }
        }
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin/users");
    return {
        success: true,
        user: newUser.user
    };
}
async function deleteUser(userId) {
    const { user } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    if (user.id === userId) {
        throw new Error("Security Alert: You cannot delete your own admin account.");
    }
    // 1. Fetch user info for audit logging
    const { data: profile } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").select("email, full_name, role").eq("id", userId).single();
    // 2. Delete user from auth.users (cascades to public.profiles)
    const { error: deleteAuthError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.deleteUser(userId);
    if (deleteAuthError) {
        // If not found in auth.users, remove from public.profiles directly
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").delete().eq("id", userId);
    } else {
        // Explicit cleanup guarantee
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").delete().eq("id", userId);
    }
    // 3. Record in audit_logs (non-blocking)
    void __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("audit_logs").insert([
        {
            action: "DELETE_USER",
            entity_type: "user",
            entity_id: userId,
            admin_id: user.id,
            details: {
                deleted_email: profile?.email || null,
                deleted_name: profile?.full_name || null,
                deleted_role: profile?.role || null
            }
        }
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin/users");
    return {
        success: true
    };
}
async function bulkImportUsers(records) {
    const { user } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    if (!records || records.length === 0) {
        throw new Error("No records provided for import.");
    }
    const results = {
        total: records.length,
        created: 0,
        updated: 0,
        errors: []
    };
    const DEFAULT_PASSWORD = "123";
    for (const item of records){
        const email = item.email?.trim().toLowerCase();
        const fullName = item.full_name?.trim();
        let rawRole = item.role?.toLowerCase();
        // Security fencing: Nobody can be assigned as admin through CSV import
        if (rawRole === "admin") {
            rawRole = "participant";
        }
        const role = rawRole || "participant";
        const password = item.password?.trim() || DEFAULT_PASSWORD;
        if (!email || !fullName) {
            results.errors.push(`Row skipped: missing email or full name (${JSON.stringify(item)})`);
            continue;
        }
        try {
            // 1. Check if user already exists in auth or profiles
            let userId = null;
            const { data: existingProfile } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").select("id, role").eq("email", email).maybeSingle();
            if (existingProfile) {
                userId = existingProfile.id;
                // Update profile
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").update({
                    full_name: fullName,
                    role: role
                }).eq("id", userId);
                if (userId) {
                    try {
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.updateUserById(userId, {
                            user_metadata: {
                                full_name: fullName,
                                role
                            }
                        });
                    } catch  {
                    // Ignore metadata sync error
                    }
                }
                results.updated++;
            } else {
                // Try creating in auth
                try {
                    const { data: newUser, error: createAuthErr } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.createUser({
                        email,
                        password,
                        email_confirm: true,
                        user_metadata: {
                            full_name: fullName,
                            role
                        }
                    });
                    if (createAuthErr) throw createAuthErr;
                    userId = newUser.user?.id || null;
                } catch  {
                    // If auth user already exists in auth.users
                    const { data: authUsers } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].auth.admin.listUsers();
                    const match = authUsers?.users?.find((u)=>u.email?.toLowerCase() === email);
                    userId = match?.id || null;
                }
                if (userId) {
                    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").upsert({
                        id: userId,
                        email,
                        full_name: fullName,
                        role
                    });
                    results.created++;
                }
            }
            // If team information is provided, link them
            if (userId && item.team_name) {
                const teamName = item.team_name.trim();
                let teamId = null;
                const { data: existingTeam } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("teams").select("id").eq("name", teamName).maybeSingle();
                if (existingTeam) {
                    teamId = existingTeam.id;
                } else {
                    const { data: newTeam } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("teams").insert([
                        {
                            name: teamName,
                            code: item.team_code || null,
                            track: item.track || null,
                            leader_name: role === "leader" ? fullName : null,
                            status: "active"
                        }
                    ]).select("id").single();
                    if (newTeam) teamId = newTeam.id;
                }
                if (teamId) {
                    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_members").upsert({
                        team_id: teamId,
                        user_id: userId,
                        role: role === "leader" ? "leader" : "member",
                        name: fullName,
                        email: email
                    }, {
                        onConflict: "team_id,user_id"
                    });
                }
            }
        } catch (err) {
            results.errors.push(`Error for ${email}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // Audit log
    void __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("audit_logs").insert([
        {
            action: "BULK_IMPORT_USERS",
            entity_type: "user",
            admin_id: user.id,
            details: {
                total: results.total,
                created: results.created,
                updated: results.updated,
                error_count: results.errors.length
            }
        }
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin/users");
    return results;
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getTeamsHierarchyData,
    getUsersList,
    updateUserRole,
    createUser,
    deleteUser,
    bulkImportUsers
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getTeamsHierarchyData, "000d7046ecc0d93d7d4ab4fad7a5a85036223c964c", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getUsersList, "40aece768c4bd3c435dc4556daddcbd6be4c8e34f8", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateUserRole, "407a978042a2ca1d1a569f6a4e81cd1e1823472329", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createUser, "402474090dc071f97d2003903d07e12dec6665e762", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteUser, "4082ac2566fc43333db2fee35a26998cc46f85b9bb", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(bulkImportUsers, "400a75881b4a0f6e8b449a3ed8ec178ffb8fbee9ba", null);
}),
"[project]/src/lib/auth/admin.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "requireAdmin",
    ()=>requireAdmin
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/admin.ts [app-rsc] (ecmascript)");
;
;
;
async function requireAdmin() {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    // Fast-path: Check local decrypted session JWT without remote network trip
    const { data: sessionData } = await supabase.auth.getSession();
    let user = sessionData?.session?.user;
    // Fallback to getUser() only if session is missing
    if (!user) {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError || !userData?.user) {
            throw new Error("Unauthorized: Authentication required");
        }
        user = userData.user;
    }
    // Fast-path: Check user metadata first to avoid blocking DB query
    const metaRole = user.user_metadata?.role || user.app_metadata?.role;
    if (metaRole === "admin") {
        return {
            user,
            profile: {
                role: "admin"
            }
        };
    }
    // Fallback: Fetch profile with strict 1.5s timeout
    let profile = null;
    try {
        const fetchProfile = async ()=>{
            const { data } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("profiles").select("role").eq("id", user.id).maybeSingle();
            return data;
        };
        const timeout = new Promise((resolve)=>setTimeout(()=>resolve(null), 1500));
        profile = await Promise.race([
            fetchProfile(),
            timeout
        ]);
    } catch  {}
    const isAdmin = profile?.role === "admin" || metaRole === "admin";
    if (!isAdmin) {
        throw new Error("Forbidden: Admin privileges required");
    }
    // Verify admin session checkpoint cookie (TEMPORARILY BYPASS FOR TESTING - passcode lock disabled)
    // const cookieStore = await cookies();
    // const isPasscodeVerified = cookieStore.get("admin_session_verified")?.value === "true";
    // if (!isPasscodeVerified) {
    //   throw new Error("CheckpointRequired: Admin passcode verification required");
    // }
    return {
        user,
        profile
    };
}
}),
];})()

//# sourceMappingURL=_0dm1n0kev0j5v._.js.map