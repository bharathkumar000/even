"use server";

import { requireOperationsRole } from "@/lib/auth/operations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ActionType } from "@/lib/validations/operations";

export type ActivityResult = "success" | "failure" | "rejected" | "already_completed" | "all";
export type ActivityMethod = "qr" | "manual" | "all";

export interface ActivityFilters {
  search?: string | null;
  actionType?: ActionType | "all" | null;
  method?: ActivityMethod | null;
  result?: ActivityResult | null;
  from?: string | null; // ISO date
  to?: string | null; // ISO date
}

export interface ActivityPageInput {
  filters: ActivityFilters;
  page?: number;
  pageSize?: number;
}

export interface ActivityLogRow {
  id: string;
  team_id: string | null;
  team_name: string;
  team_track: string | null;
  team_code: string | null;
  participant_id: string | null;
  participant_name: string;
  participant_role: string;
  event_id: string | null;
  method: string | null;
  action_type: string;
  result: string | null;
  reason: string | null;
  previous_status: string | null;
  new_status: string | null;
  item_name: string | null;
  correlation_id: string | null;
  reference_id: string | null;
  scanned_by: string | null;
  operator_id: string | null;
  operator_name: string | null;
  operator_role: string | null;
  created_at: string | null;
}

export interface ActivitySummary {
  total: number;
  success: number;
  failed: number;
  checkIns: number;
  distributions: number;
}

export interface ActivityPageResult {
  logs: ActivityLogRow[];
  summary: ActivitySummary;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const DISTRIBUTION_ACTIONS = new Set(["goodies", "lunch", "snacks", "certificates"]);
const CHECKIN_ACTIONS = new Set(["registration"]);

function isDistribution(action: string) {
  return DISTRIBUTION_ACTIONS.has(action);
}
function isCheckin(action: string) {
  return CHECKIN_ACTIONS.has(action);
}

/**
 * Fetches a paginated page of scanner activity with filtering, plus summary counts
 * that reflect the applied filters. Enforces operations-role authorization server-side.
 */
export async function getActivityPage(input: ActivityPageInput): Promise<ActivityPageResult> {
  await requireOperationsRole();

  const { filters, page = 1, pageSize = 25 } = input;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("event_activity_logs")
    .select(
      "id, team_id, participant_id, event_id, method, action_type, result, reason, " +
      "previous_status, new_status, item_name, correlation_id, reference_id, " +
      "scanned_by, operator_id, operator_name, operator_role, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  // Filters
  if (filters.actionType && filters.actionType !== "all") {
    query = query.eq("action_type", filters.actionType);
  }
  if (filters.method && filters.method !== "all") {
    query = query.eq("method", filters.method);
  }
  if (filters.result && filters.result !== "all") {
    query = query.eq("result", filters.result);
  }
  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("created_at", filters.to);
  }

  const { data: rawLogs, error, count } = (await query.range(from, to)) as {
    data: any[];
    error: any;
    count: number | null;
  };

  if (error || !rawLogs) {
    console.error("Failed to fetch activity page:", error?.message);
    return {
      logs: [],
      summary: { total: 0, success: 0, failed: 0, checkIns: 0, distributions: 0 },
      total: 0,
      page,
      pageSize,
      hasMore: false,
    };
  }

  const total = count ?? 0;

  // Enrich with team, operator, participant names
  const teamIds = Array.from(new Set(rawLogs.map((l) => l.team_id).filter(Boolean)));
  const scannedByIds = Array.from(new Set(rawLogs.map((l) => l.scanned_by).filter(Boolean)));
  const participantIds = Array.from(new Set(rawLogs.map((l) => l.participant_id).filter(Boolean)));
  const operatorIds = Array.from(new Set(rawLogs.map((l) => l.operator_id).filter(Boolean)));
  const profileIds = Array.from(new Set([...scannedByIds, ...participantIds, ...operatorIds]));

  let teamsMap: Record<string, { name: string; track?: string | null; code?: string | null }> = {};
  if (teamIds.length > 0) {
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, track, code")
      .in("id", teamIds);
    if (teams) {
      teamsMap = Object.fromEntries(teams.map((t) => [t.id, { name: t.name, track: t.track, code: t.code }]));
    }
  }

  let profilesMap: Record<string, { full_name: string; email: string }> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds);
    if (profiles) {
      profilesMap = Object.fromEntries(
        profiles.map((p) => [p.id, { full_name: p.full_name || "User", email: p.email || "" }])
      );
    }
  }

  const rolesMap: Record<string, string> = {};
  if (participantIds.length > 0) {
    const { data: tMembers } = await supabaseAdmin
      .from("team_members")
      .select("user_id, role, team_id")
      .in("user_id", participantIds);
    if (tMembers) {
      // Build a map keyed by user_id; if a user is in multiple teams, keep the first match
      // that corresponds to the log's team where possible.
      for (const tm of tMembers) {
        if (!rolesMap[tm.user_id]) rolesMap[tm.user_id] = tm.role || "Member";
      }
    }
  }

  const logs: ActivityLogRow[] = rawLogs.map((l) => {
    const team = teamsMap[l.team_id || ""];
    const participant = profilesMap[l.participant_id || ""];
    const scannedBy = l.scanned_by ? profilesMap[l.scanned_by] : null;
    const operator = l.operator_id ? profilesMap[l.operator_id] : null;

    return {
      id: l.id,
      team_id: l.team_id,
      operator_id: l.operator_id,
      team_name: team?.name || "Unknown Team",
      team_track: team?.track || null,
      team_code: team?.code || null,
      participant_id: l.participant_id,
      participant_name: participant?.full_name || "Participant",
      participant_role:
        l.participant_id && l.team_id
          ? rolesMap[l.participant_id] || "Member"
          : "Member",
      event_id: l.event_id,
      method: l.method,
      action_type: l.action_type,
      result: l.result,
      reason: l.reason,
      previous_status: l.previous_status,
      new_status: l.new_status,
      item_name: l.item_name,
      correlation_id: l.correlation_id,
      reference_id: l.reference_id,
      scanned_by: l.scanned_by || "",
      operator_name:
        l.operator_name ||
        (operator?.full_name || scannedBy?.full_name || "Operations"),
      operator_role: l.operator_role || "staff",
      created_at: l.created_at,
    };
  });

  // Apply search filter in-memory (covers team name, operator, participant).
  let filteredLogs = logs;
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase();
    filteredLogs = logs.filter((l) => {
      const haystack = [
        l.team_name,
        l.team_code,
        l.team_track,
        l.participant_name,
        l.participant_role,
        l.operator_name,
        l.operator_role,
        l.action_type,
        l.item_name,
        l.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  // Recompute summary over the filtered set.
  const summary: ActivitySummary = {
    total: filteredLogs.length,
    success: filteredLogs.filter((l) => l.result === "success").length,
    failed: filteredLogs.filter(
      (l) => l.result === "failure" || l.result === "rejected"
    ).length,
    checkIns: filteredLogs.filter((l) => l.result === "success" && isCheckin(l.action_type)).length,
    distributions: filteredLogs.filter(
      (l) => l.result === "success" && isDistribution(l.action_type)
    ).length,
  };

  const hasMore = filteredLogs.length > pageSize;
  const pageLogs = filteredLogs.slice(0, pageSize);

  return {
    logs: pageLogs,
    summary,
    total,
    page,
    pageSize,
    hasMore,
  };
}
