module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/dynamic-access-async-storage.external.js [external] (next/dist/server/app-render/dynamic-access-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/dynamic-access-async-storage.external.js", () => require("next/dist/server/app-render/dynamic-access-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[project]/src/components/DataContext.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DataContext",
    ()=>DataContext,
    "DataProvider",
    ()=>DataProvider
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const DataContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])({});
const DataProvider = ({ children })=>{
    const [isClient, setIsClient] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [teams, setTeams] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [judges, setJudges] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [schedule, setSchedule] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setIsClient(true);
        const savedTeams = localStorage.getItem('ideathon_teams_v2');
        if (savedTeams) setTeams(JSON.parse(savedTeams));
        const savedJudges = localStorage.getItem('ideathon_judges_v2');
        if (savedJudges) setJudges(JSON.parse(savedJudges));
        const savedSchedule = localStorage.getItem('ideathon_schedule_v3');
        if (savedSchedule) setSchedule(JSON.parse(savedSchedule));
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isClient) localStorage.setItem('ideathon_teams_v2', JSON.stringify(teams));
    }, [
        teams,
        isClient
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isClient) localStorage.setItem('ideathon_judges_v2', JSON.stringify(judges));
    }, [
        judges,
        isClient
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isClient) localStorage.setItem('ideathon_schedule_v3', JSON.stringify(schedule));
    }, [
        schedule,
        isClient
    ]);
    // Judge Actions
    const addJudge = (judge)=>{
        setJudges((prev)=>[
                ...prev,
                {
                    id: `J${Date.now()}`,
                    name: judge.name || "",
                    email: judge.email || "",
                    initials: judge.initials || (judge.name ? judge.name.slice(0, 2).toUpperCase() : "JD"),
                    specialization: judge.specialization || judge.expertise || "",
                    theme: judge.theme || "",
                    expertise: judge.expertise
                }
            ]);
    };
    const editJudge = (id, updated)=>setJudges((prev)=>prev.map((j)=>j.id === id ? {
                    ...j,
                    ...updated
                } : j));
    const deleteJudge = (id)=>{
        setJudges((prev)=>prev.filter((j)=>j.id !== id));
        setTeams((prev)=>prev.map((t)=>t.judgeId === id ? {
                    ...t,
                    judgeId: null
                } : t));
    };
    // Team Actions
    const assignJudgeToTeam = (teamId, judgeId)=>{
        setTeams((prev)=>prev.map((t)=>t.id === teamId ? {
                    ...t,
                    judgeId: judgeId === "" ? null : judgeId
                } : t));
    };
    const addTeam = (team)=>{
        setTeams((prev)=>[
                ...prev,
                {
                    id: `T${Date.now()}`,
                    name: team.name || "",
                    theme: team.theme || "",
                    members: team.members || [],
                    judgeId: null,
                    disqualified: false,
                    disqualifyReason: "",
                    leadName: team.leadName,
                    email: team.email,
                    college: team.college,
                    track: team.track
                }
            ]);
    };
    const editTeam = (id, updated)=>{
        setTeams((prev)=>prev.map((t)=>t.id === id ? {
                    ...t,
                    ...updated
                } : t));
    };
    const deleteTeam = (id)=>{
        setTeams((prev)=>prev.filter((t)=>t.id !== id));
    };
    const disqualifyTeam = (id, reason)=>{
        setTeams((prev)=>prev.map((t)=>t.id === id ? {
                    ...t,
                    disqualified: true,
                    disqualifyReason: reason
                } : t));
    };
    // Schedule Actions
    const addScheduleItem = (item)=>setSchedule((prev)=>[
                ...prev,
                {
                    title: "",
                    time: "",
                    description: "",
                    status: "",
                    ...item,
                    id: `S${Date.now()}`
                }
            ]);
    const editScheduleItem = (id, updated)=>setSchedule((prev)=>prev.map((s)=>s.id === id ? {
                    ...s,
                    ...updated
                } : s));
    const deleteScheduleItem = (id)=>setSchedule((prev)=>prev.filter((s)=>s.id !== id));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DataContext.Provider, {
        value: {
            teams,
            judges,
            schedule,
            addJudge,
            editJudge,
            deleteJudge,
            assignJudgeToTeam,
            addTeam,
            editTeam,
            deleteTeam,
            disqualifyTeam,
            addScheduleItem,
            editScheduleItem,
            deleteScheduleItem
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/DataContext.tsx",
        lineNumber: 151,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__061saoh3hg8fe._.js.map