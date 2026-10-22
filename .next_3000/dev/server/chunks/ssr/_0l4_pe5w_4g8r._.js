(()=>{"use strict";module.exports = [
"[project]/.next-internal/server/app/admin/(dashboard)/spoc/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/admin-spoc.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "00268d031143a062330cb72afb6761b79524b635a9",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSpocPortalData"],
    "40675179abf7196b41442b5b1e2fad1dd53cd3112b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateSpocTeams"],
    "406b4357c58f4cd65461264018f40b14e22bfb6a70",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSpoc"],
    "406c03b29e3e9d6e14f41b08fd224af5836f32a5fa",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateSpoc"],
    "407128e917b2f6cec0cd0316ff86e8966a3b0c6429",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteSpoc"],
    "40c076700071a1d891bd77705a05c7cb490d835e32",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["autoBalanceSpocAssignments"],
    "40f0df58f0e0ff570934d248c7e34bcc782609cfa6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["uploadSpocAvatar"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f28$dashboard$292f$spoc$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/(dashboard)/spoc/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/admin-spoc.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/admin-spoc.ts [app-rsc] (ecmascript)");
}),
"[project]/.next-internal/server/app/admin/(dashboard)/spoc/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/admin-spoc.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$admin$2d$spoc$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/admin-spoc.ts [app-rsc] (ecmascript)");
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
;
;
;
;
}),
"[project]/src/app/actions/admin-spoc.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"00268d031143a062330cb72afb6761b79524b635a9":{"name":"getSpocPortalData"},"40675179abf7196b41442b5b1e2fad1dd53cd3112b":{"name":"updateSpocTeams"},"406b4357c58f4cd65461264018f40b14e22bfb6a70":{"name":"createSpoc"},"406c03b29e3e9d6e14f41b08fd224af5836f32a5fa":{"name":"updateSpoc"},"407128e917b2f6cec0cd0316ff86e8966a3b0c6429":{"name":"deleteSpoc"},"40c076700071a1d891bd77705a05c7cb490d835e32":{"name":"autoBalanceSpocAssignments"},"40f0df58f0e0ff570934d248c7e34bcc782609cfa6":{"name":"uploadSpocAvatar"}},"src/app/actions/admin-spoc.ts",""] */ __turbopack_context__.s([
    "autoBalanceSpocAssignments",
    ()=>autoBalanceSpocAssignments,
    "createSpoc",
    ()=>createSpoc,
    "deleteSpoc",
    ()=>deleteSpoc,
    "getSpocPortalData",
    ()=>getSpocPortalData,
    "updateSpoc",
    ()=>updateSpoc,
    "updateSpocTeams",
    ()=>updateSpocTeams,
    "uploadSpocAvatar",
    ()=>uploadSpocAvatar
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
async function getSpocPortalData() {
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    } catch (err) {
        console.warn("getSpocPortalData auth notice:", err);
        return {
            spocs: [],
            teams: []
        };
    }
    const fetchData = async ()=>{
        const [spocsRes, teamsRes, assignmentsRes] = await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("spocs").select("*").order("name", {
                ascending: true
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("teams").select("id, name, code, track").order("name", {
                ascending: true
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_spoc_assignments").select("spoc_id, team_id")
        ]);
        const spocsList = spocsRes.data || [];
        const teamsList = teamsRes.data || [];
        const assignments = assignmentsRes.data || [];
        // Map spoc_id -> team_id[]
        const spocToTeams = new Map();
        // Map team_id -> spoc_id
        const teamToSpoc = new Map();
        for (const a of assignments){
            if (!spocToTeams.has(a.spoc_id)) spocToTeams.set(a.spoc_id, []);
            spocToTeams.get(a.spoc_id).push(a.team_id);
            teamToSpoc.set(a.team_id, a.spoc_id);
        }
        const spocNameMap = new Map();
        spocsList.forEach((s)=>{
            spocNameMap.set(s.id, s.name);
        });
        const spocs = spocsList.map((s)=>({
                id: s.id,
                name: s.name,
                email: s.email,
                phone: s.phone,
                department: s.department,
                notes: s.notes,
                avatar_url: s.avatar_url || null,
                created_at: s.created_at,
                assigned_team_ids: spocToTeams.get(s.id) || []
            }));
        const teams = teamsList.map((t)=>{
            const assignedSpocId = teamToSpoc.get(t.id) || null;
            return {
                id: t.id,
                name: t.name,
                code: t.code,
                track: t.track,
                assigned_spoc_id: assignedSpocId,
                assigned_spoc_name: assignedSpocId ? spocNameMap.get(assignedSpocId) || "SPOC" : null
            };
        });
        return {
            spocs,
            teams
        };
    };
    const timeoutPromise = new Promise((resolve)=>setTimeout(()=>resolve({
                spocs: [],
                teams: []
            }), 3000));
    return Promise.race([
        fetchData(),
        timeoutPromise
    ]);
}
async function createSpoc(data) {
    const { user } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    if (!data.name || data.name.trim() === "") {
        throw new Error("SPOC name is required.");
    }
    const { data: newSpoc, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("spocs").insert([
        {
            name: data.name.trim(),
            email: data.email?.trim() || null,
            phone: data.phone?.trim() || null,
            department: data.department?.trim() || null,
            notes: data.notes?.trim() || null,
            avatar_url: data.avatar_url?.trim() || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ]).select().single();
    if (error) {
        throw new Error(`Failed to create SPOC: ${error.message}`);
    }
    // Audit log (non-blocking)
    void __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("audit_logs").insert([
        {
            action: "CREATE_SPOC",
            entity_type: "spoc",
            entity_id: newSpoc.id,
            admin_id: user.id,
            details: {
                name: newSpoc.name,
                email: newSpoc.email,
                department: newSpoc.department
            },
            created_at: new Date().toISOString()
        }
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin/spoc");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/team");
    return newSpoc;
}
async function updateSpoc(data) {
    const { user } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    const updatePayload = {
        name: data.name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        department: data.department?.trim() || null,
        notes: data.notes?.trim() || null,
        updated_at: new Date().toISOString()
    };
    if (data.avatar_url !== undefined) {
        updatePayload.avatar_url = data.avatar_url ? data.avatar_url.trim() : null;
    }
    const { data: updatedSpoc, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("spocs").update(updatePayload).eq("id", data.id).select().single();
    if (error) {
        throw new Error(`Failed to update SPOC: ${error.message}`);
    }
    // Audit log (non-blocking)
    void __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("audit_logs").insert([
        {
            action: "UPDATE_SPOC",
            entity_type: "spoc",
            entity_id: data.id,
            admin_id: user.id,
            details: data,
            created_at: new Date().toISOString()
        }
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin/spoc");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/team");
    return updatedSpoc;
}
async function uploadSpocAvatar(formData) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    const file = formData.get("file");
    if (!file) {
        throw new Error("No image file provided for upload");
    }
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml"
    ];
    if (file.type && !allowedTypes.includes(file.type)) {
        throw new Error("Only image files (JPG, PNG, WebP, GIF, SVG) are allowed.");
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Avatar image must not exceed 5MB.");
    }
    const bucketName = "spoc-avatars";
    const { data: bucketData, error: bucketError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].storage.getBucket(bucketName);
    if (bucketError || !bucketData) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760
        });
    }
    const cleanFileName = (file.name || "avatar.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `avatars/${Date.now()}_${cleanFileName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { error: uploadError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].storage.from(bucketName).upload(filePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true
    });
    if (uploadError) {
        const base64 = buffer.toString("base64");
        const mime = file.type || "image/jpeg";
        return {
            avatarUrl: `data:${mime};base64,${base64}`
        };
    }
    const { data: publicUrlData } = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].storage.from(bucketName).getPublicUrl(filePath);
    return {
        avatarUrl: publicUrlData.publicUrl
    };
}
async function deleteSpoc(spocId) {
    const { user } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    // 1. Fetch info for audit log
    const { data: spoc } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("spocs").select("name, email").eq("id", spocId).maybeSingle();
    // 2. Delete SPOC (team_spoc_assignments cascade delete)
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("spocs").delete().eq("id", spocId);
    if (error) {
        throw new Error(`Failed to delete SPOC: ${error.message}`);
    }
    // Audit log (non-blocking)
    void __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("audit_logs").insert([
        {
            action: "DELETE_SPOC",
            entity_type: "spoc",
            entity_id: spocId,
            admin_id: user.id,
            details: {
                name: spoc?.name,
                email: spoc?.email
            },
            created_at: new Date().toISOString()
        }
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin/spoc");
    return {
        success: true
    };
}
async function updateSpocTeams(data) {
    const { user } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    // 1. Delete all existing allotments for this SPOC
    const { error: deleteError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_spoc_assignments").delete().eq("spoc_id", data.spocId);
    if (deleteError) {
        throw new Error(`Failed to reset existing SPOC allotments: ${deleteError.message}`);
    }
    // 2. If assigning new teams, delete any prior allotments for these specific teams (exclusive allotment)
    if (data.teamIds.length > 0) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_spoc_assignments").delete().in("team_id", data.teamIds);
        const rows = data.teamIds.map((tId)=>({
                spoc_id: data.spocId,
                team_id: tId,
                allotted_at: new Date().toISOString()
            }));
        const { error: insertError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_spoc_assignments").insert(rows);
        if (insertError) {
            throw new Error(`Failed to save SPOC team allotments: ${insertError.message}`);
        }
    }
    // Audit log (non-blocking)
    void __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("audit_logs").insert([
        {
            action: "UPDATE_SPOC_ASSIGNMENTS",
            entity_type: "team_spoc_assignments",
            entity_id: data.spocId,
            admin_id: user.id,
            details: {
                spoc_id: data.spocId,
                allotted_team_ids: data.teamIds,
                count: data.teamIds.length
            },
            created_at: new Date().toISOString()
        }
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin/spoc");
    return {
        success: true
    };
}
async function autoBalanceSpocAssignments(options = {}) {
    const { user } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireAdmin"])();
    const [spocsRes, teamsRes] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("spocs").select("id, name").order("name", {
            ascending: true
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("teams").select("id, name, track").order("name", {
            ascending: true
        })
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
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_spoc_assignments").delete();
    } else {
        // Only allocate unassigned teams
        const { data: existing } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_spoc_assignments").select("team_id");
        const assignedTeamIds = new Set((existing || []).map((e)=>e.team_id));
        const unassignedTeams = teams.filter((t)=>!assignedTeamIds.has(t.id));
        if (unassignedTeams.length === 0) {
            return {
                success: true,
                message: "All teams are already assigned to SPOCs.",
                count: 0
            };
        }
    }
    // Fetch current load per SPOC
    const { data: currentAssignments } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_spoc_assignments").select("spoc_id");
    const spocLoads = new Map();
    spocs.forEach((s)=>spocLoads.set(s.id, 0));
    (currentAssignments || []).forEach((a)=>{
        spocLoads.set(a.spoc_id, (spocLoads.get(a.spoc_id) || 0) + 1);
    });
    const { data: alreadyAssigned } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_spoc_assignments").select("team_id");
    const assignedSet = new Set((alreadyAssigned || []).map((e)=>e.team_id));
    const teamsToAssign = teams.filter((t)=>!assignedSet.has(t.id));
    const newRows = [];
    for (const team of teamsToAssign){
        // Pick SPOC with lowest current load
        const targetSpoc = [
            ...spocs
        ].sort((a, b)=>(spocLoads.get(a.id) || 0) - (spocLoads.get(b.id) || 0))[0];
        newRows.push({
            spoc_id: targetSpoc.id,
            team_id: team.id,
            allotted_at: new Date().toISOString()
        });
        spocLoads.set(targetSpoc.id, (spocLoads.get(targetSpoc.id) || 0) + 1);
    }
    if (newRows.length > 0) {
        const { error: insertError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("team_spoc_assignments").upsert(newRows, {
            onConflict: "team_id"
        });
        if (insertError) {
            throw new Error(`Failed to save auto-balanced SPOC allotments: ${insertError.message}`);
        }
    }
    // Audit log
    void __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("audit_logs").insert([
        {
            action: "AUTO_BALANCE_SPOC_ASSIGNMENTS",
            entity_type: "team_spoc_assignments",
            admin_id: user.id,
            details: {
                spocs_count: spocs.length,
                allocated_teams_count: newRows.length
            },
            created_at: new Date().toISOString()
        }
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin/spoc");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/ops");
    return {
        success: true,
        spocsCount: spocs.length,
        allocatedTeamsCount: newRows.length
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getSpocPortalData,
    createSpoc,
    updateSpoc,
    uploadSpocAvatar,
    deleteSpoc,
    updateSpocTeams,
    autoBalanceSpocAssignments
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getSpocPortalData, "00268d031143a062330cb72afb6761b79524b635a9", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createSpoc, "406b4357c58f4cd65461264018f40b14e22bfb6a70", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateSpoc, "406c03b29e3e9d6e14f41b08fd224af5836f32a5fa", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(uploadSpocAvatar, "40f0df58f0e0ff570934d248c7e34bcc782609cfa6", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteSpoc, "407128e917b2f6cec0cd0316ff86e8966a3b0c6429", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateSpocTeams, "40675179abf7196b41442b5b1e2fad1dd53cd3112b", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(autoBalanceSpocAssignments, "40c076700071a1d891bd77705a05c7cb490d835e32", null);
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

//# sourceMappingURL=_0l4_pe5w_4g8r._.js.map