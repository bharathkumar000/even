(()=>{"use strict";module.exports = [
"[project]/.next-internal/server/app/admin/(dashboard)/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/announcements.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "4032ae8f9296d3ab8e9ae165a6ab6a2c0b0bf1d67a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$announcements$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getActiveAnnouncements"],
    "4093fe0c1f7b5b47bf5b12edd04f663d1d5fde68a0",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$announcements$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createAnnouncement"],
    "60e42cb5ee15e6f2b27b3e0d2eab5a274f92522d90",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$announcements$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toggleAnnouncementActive"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f28$dashboard$292f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$announcements$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/(dashboard)/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/announcements.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$announcements$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/announcements.ts [app-rsc] (ecmascript)");
}),
"[project]/.next-internal/server/app/admin/(dashboard)/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/announcements.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$announcements$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/announcements.ts [app-rsc] (ecmascript)");
;
;
;
;
;
}),
"[project]/src/app/actions/announcements.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"4032ae8f9296d3ab8e9ae165a6ab6a2c0b0bf1d67a":{"name":"getActiveAnnouncements"},"4093fe0c1f7b5b47bf5b12edd04f663d1d5fde68a0":{"name":"createAnnouncement"},"60e42cb5ee15e6f2b27b3e0d2eab5a274f92522d90":{"name":"toggleAnnouncementActive"}},"src/app/actions/announcements.ts",""] */ __turbopack_context__.s([
    "createAnnouncement",
    ()=>createAnnouncement,
    "getActiveAnnouncements",
    ()=>getActiveAnnouncements,
    "toggleAnnouncementActive",
    ()=>toggleAnnouncementActive
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/admin.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function getActiveAnnouncements(audience) {
    try {
        let query = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("announcements").select("*").eq("is_active", true).order("created_at", {
            ascending: false
        }).limit(20);
        if (audience && audience !== "all") {
            query = query.in("target_audience", [
                "all",
                audience
            ]);
        }
        const { data, error } = await query;
        if (error) {
            console.warn("Could not fetch announcements table:", error.message);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn("Failed to load announcements:", err);
        return [];
    }
}
async function createAnnouncement({ title, message, priority = "normal", target_audience = "all" }) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("announcements").insert({
        title: title.trim(),
        message: message.trim(),
        priority,
        target_audience
    }).select().single();
    if (error) {
        throw new Error(`Failed to create announcement: ${error.message}`);
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/team");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/judge");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/ops");
    return {
        success: true,
        announcement: data
    };
}
async function toggleAnnouncementActive(id, isActive) {
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$admin$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabaseAdmin"].from("announcements").update({
        is_active: isActive
    }).eq("id", id);
    if (error) {
        throw new Error(`Failed to update announcement: ${error.message}`);
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/admin");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/team");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/judge");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/ops");
    return {
        success: true
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getActiveAnnouncements,
    createAnnouncement,
    toggleAnnouncementActive
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getActiveAnnouncements, "4032ae8f9296d3ab8e9ae165a6ab6a2c0b0bf1d67a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createAnnouncement, "4093fe0c1f7b5b47bf5b12edd04f663d1d5fde68a0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(toggleAnnouncementActive, "60e42cb5ee15e6f2b27b3e0d2eab5a274f92522d90", null);
}),
];})()

//# sourceMappingURL=_0da2nxhy46hr3._.js.map