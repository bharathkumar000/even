import { getActivityPage, type ActivityPageResult } from "@/app/actions/live-activity";
import { getAuditLogsData, type AuditLogItem } from "@/app/actions/admin-audit-logs";
import AuditLogsClientView from "./audit-logs-client";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  let initialActivity: ActivityPageResult = {
    logs: [],
    summary: { total: 0, success: 0, failed: 0, checkIns: 0, distributions: 0 },
    total: 0,
    page: 1,
    pageSize: 25,
    hasMore: false,
  };

  let initialAdminLogs: AuditLogItem[] = [];

  try {
    const [activityResult, adminLogsResult] = await Promise.allSettled([
      getActivityPage({
        filters: { actionType: "all", method: "all", result: "all" },
        page: 1,
        pageSize: 25,
      }),
      getAuditLogsData(),
    ]);

    if (activityResult.status === "fulfilled") {
      initialActivity = activityResult.value;
    }
    if (adminLogsResult.status === "fulfilled") {
      initialAdminLogs = adminLogsResult.value;
    }
  } catch (err) {
    console.error("Failed to load admin audit logs initial data:", err);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border-color pb-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-status-success animate-pulse" />
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold m-0">
            Administration // Security, Operations & Scanner Audit
          </p>
        </div>
        <h1 className="text-2xl md:text-4xl font-heading text-text-primary tracking-wider uppercase m-0 mt-1">
          Live Audit Logs & Operations Stream
        </h1>
        <p className="font-tech text-text-secondary text-xs sm:text-sm mt-1 max-w-3xl m-0">
          Real-time chronological record of scanner activities, badge check-ins, food & goodies distributions, verifications, and administrative system overrides.
        </p>
      </div>

      <AuditLogsClientView
        initialActivity={initialActivity}
        initialAdminLogs={initialAdminLogs}
      />
    </div>
  );
}
