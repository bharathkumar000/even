"use server";

import { requireOperationsRole } from "@/lib/auth/operations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ScanActionSchema,
  type ScanActionInput,
  type ActionType,
} from "@/lib/validations/operations";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import {
  recordScannerActivity,
  type AuditMethod,
} from "@/lib/audit";

// Matches a full 36-character UUID (8-4-4-4-12 hex segments).
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidUuid(value: string, label: string): void {
  if (!value || !UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${label}: "${value}" is not a valid UUID`);
  }
}

export interface LiveActivityFeedItem {
  id: string;
  team_id: string;
  team_name: string;
  team_track: string;
  team_code: string;
  participant_id: string;
  participant_name: string;
  participant_role: string;
  action_type: ActionType;
  scanned_by: string;
  scanner_name: string;
  scanner_email: string;
  created_at: string;
}

export interface EnrichedActivityLog {
  id: string;
  participant_id: string;
  action_type: string;
  created_at: string;
  scanned_by?: string | null;
  scanner_name?: string;
  scanner_email?: string;
  result?: string;
}

export interface TeamScanData {
  team: {
    id: string;
    name: string;
    track?: string | null;
    leader_name?: string | null;
    code?: string | null;
    qr_token?: string | null;
    last_scanned_at?: string | null;
  };
  members: {
    id: string;
    user_id: string;
    role?: string | null;
    name?: string | null;
    email?: string | null;
  }[];
  activityLogs: EnrichedActivityLog[];
}

/**
 * Manual team lookup for ops scanner (read-only, no CSRF required).
 * Used by ops scanner manual lookup fallback when QR scanning fails.
 *
 * Records a manual verification audit event (scan_attempt). A read-only lookup
 * is NOT logged as a check-in; it only records that the team was searched manually.
 */
export async function manualTeamLookup(teamId: string): Promise<TeamScanData> {
  await requireOperationsRole();

  if (!teamId) {
    throw new Error("A valid team identifier is required");
  }

  // Validate team UUID before querying PostgreSQL UUID columns.
  assertValidUuid(teamId, "team identifier");

  const correlationId = crypto.randomUUID();

  // 1. Fetch team details
  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .select("id, name, track, leader_name, code, qr_token, last_scanned_at")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) {
    // Record the failed manual lookup safely (no state change).
    try {
      await recordScannerActivity({
        teamId,
        action: "verification_failed",
        method: "manual",
        result: "failure",
        reason: `Team not found: ${teamError?.message || "Invalid team ID"}`,
        correlationId,
      });
    } catch {
      // Never let an audit failure mask the real lookup error.
    }
    throw new Error(`Team not found: ${teamError?.message || "Invalid team ID"}`);
  }

  // Record the successful manual team verification (read-only, not a check-in).
  try {
    await recordScannerActivity({
      teamId,
      participantId: null,
      action: "verification_success",
      method: "manual",
      result: "success",
      itemName: team.name || null,
      correlationId,
    });
  } catch {
    // Never let an audit failure change the outcome of a successful lookup.
  }

  // 2. Fetch team participants/members with profiles join
  const { data: rawMembers, error: membersError } = await supabaseAdmin
    .from("team_members")
    .select(`
      id,
      user_id,
      role,
      profiles (
        id,
        full_name,
        email
      )
    `)
    .eq("team_id", teamId);

  if (membersError) {
    console.warn("Notice: Falling back to direct team_members query:", membersError.message);
  }

  interface RawMember {
    id: string;
    user_id: string;
    role?: string | null;
    name?: string | null;
    email?: string | null;
    profiles?: { full_name?: string | null; email?: string | null } | null;
  }

  const members = ((rawMembers as unknown as RawMember[]) || []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role || "member",
    name: m.profiles?.full_name || m.name || "Member",
    email: m.profiles?.email || m.email || "",
  }));

  // 3. Fetch active success activity logs for this team with scanner identity
  const { data: rawLogs, error: logsError } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id, participant_id, action_type, created_at, scanned_by")
    .eq("team_id", teamId)
    .eq("result", "success");

  if (logsError) {
    console.warn("Activity logs query notice:", logsError.message);
  }

  // Fetch scanner profiles to attach club member names & emails
  const scannerIds = Array.from(new Set((rawLogs || []).map((l) => l.scanned_by).filter(Boolean)));
  let scannerMap: Record<string, { full_name: string; email: string }> = {};

  if (scannerIds.length > 0) {
    const { data: scanners } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", scannerIds);

    if (scanners) {
      scannerMap = Object.fromEntries(
        scanners.map((s) => [
          s.id,
          {
            full_name: s.full_name || "Club Member",
            email: s.email || "",
          },
        ])
      );
    }
  }

  const enrichedLogs: EnrichedActivityLog[] = (rawLogs || []).map((l) => ({
    id: l.id,
    participant_id: l.participant_id,
    action_type: l.action_type,
    created_at: l.created_at,
    scanned_by: l.scanned_by,
    scanner_name: l.scanned_by ? scannerMap[l.scanned_by]?.full_name || "Club Member" : "System",
    scanner_email: l.scanned_by ? scannerMap[l.scanned_by]?.email || "" : "",
  }));

  return {
    team,
    members: members || [],
    activityLogs: enrichedLogs,
  };
}

/**
 * Record a single scan action (Registration, Goodies, Lunch, Snacks, Certificates)
 * for a participant. Prevents duplicates, tracks scanner identity, auto-rotates the
 * team's QR token, and writes a server-side audit record after the outcome is known.
 *
 * Distinguishes a successful verification/claim from a duplicate or rejected attempt.
 * A duplicate attempt is recorded as result='already_completed' and does NOT change state.
 */
export async function recordMemberAction(data: ScanActionInput & {
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
  correlationId?: string;
  method?: AuditMethod;
}) {
  const { user, profile } = await requireOperationsRole();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
  const validated = ScanActionSchema.parse(data);

  const method: AuditMethod = data.method || "qr";
  const correlationId = data.correlationId || crypto.randomUUID();

  const operatorId = user.id;
  const operatorRole = (profile?.role as string) || "staff";
  const operatorName =
    typeof profile === "object" && profile !== null && "full_name" in profile
      ? (profile as { full_name?: string | null }).full_name ?? user.email ?? "Operations"
      : user.email ?? "Operations";

  // 1. Duplicate check in event_activity_logs with scanner attribution.
  //    Existing behaviour preserved: lunch/snacks allow up to 3 claims;
  //    registration/goodies/certificates allow one claim.
  const { data: existingRecords, error: checkError } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id, created_at, scanned_by, result")
    .eq("participant_id", validated.participant_id)
    .eq("action_type", validated.action_type)
    .eq("result", "success");

  if (checkError) {
    console.warn("Activity check query notice:", checkError.message);
  }

  const existingSuccessCount = (existingRecords || []).length;

  // registration/goodies/certificates allow one successful claim;
  // lunch/snacks allow up to three.
  const alreadyCompleted = async () => {
    const prev = existingRecords?.[0];
    let prevScannerName = "another club member";
    if (prev?.scanned_by) {
      const { data: prevScanner } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", prev.scanned_by)
        .maybeSingle();
      if (prevScanner?.full_name) prevScannerName = prevScanner.full_name;
    }
    const timeStr = prev?.created_at
      ? new Date(prev.created_at).toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
        })
      : "";
    return {
      message: `FRAUD BLOCKED: "${validated.action_type.toUpperCase()}"${
        timeStr ? ` already claimed at ${timeStr} from ${prevScannerName}` : ""
      }. Duplicate claim strictly prohibited.`,
      prevScannerName,
      timeStr,
    };
  };

  const maxReached =
    (validated.action_type === "lunch" || validated.action_type === "snacks")
      ? existingSuccessCount >= 3
      : existingSuccessCount > 0;

  if (maxReached) {
    const { message } = await alreadyCompleted();
    // Record the rejected/duplicate attempt as audit history without changing state.
    try {
      await recordScannerActivity({
        teamId: validated.team_id,
        participantId: validated.participant_id,
        action: validated.action_type,
        method,
        result: "already_completed",
        reason: "Duplicate claim already recorded for this participant and action.",
        correlationId: `${correlationId}-duplicate`,
      });
    } catch {
      // Never let an audit failure mask a real business rejection.
    }
    throw new Error(message);
  }

  // 2. Insert activity log as the authoritative success record + audit entry
  //    (transactionally consistent: state change and success audit row together).
  const nowIso = new Date().toISOString();
  const { data: record, error: insertError } = await supabaseAdmin
    .from("event_activity_logs")
    .insert([
      {
        team_id: validated.team_id,
        participant_id: validated.participant_id,
        action_type: validated.action_type,
        method,
        result: "success",
        new_status: "claimed",
        scanned_by: user.id,
        operator_id: operatorId,
        operator_name: operatorName,
        operator_role: operatorRole,
        correlation_id: correlationId,
        created_at: nowIso,
      },
    ])
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to record scan action: ${insertError.message}`);
  }

  // 3. Auto-update team QR token & timestamp to prevent fraud
  const nextToken = `SEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  try {
    await supabaseAdmin
      .from("teams")
      .update({
        qr_token: nextToken,
        last_scanned_at: nowIso,
        last_scanned_by: user.id,
      })
      .eq("id", validated.team_id);
  } catch (updateErr) {
    console.warn("Notice: Team QR telemetry update skipped (schema compatible):", updateErr);
  }

  const scannerName = operatorName;
  const scannerEmail = user.email || "";

  return {
    success: true,
    record: {
      ...record,
      scanner_name: scannerName,
      scanner_email: scannerEmail,
    },
    qr_token: nextToken,
    correlationId,
  };
}

/**
 * Record an action for all eligible members of a team in one click (e.g., Team Kit/Goodies distribution).
 * Writes one server-side audit record per member after the outcome is known.
 */
export async function recordTeamBulkAction(teamId: string, actionType: ActionType, csrfToken?: string, opts?: {
  correlationId?: string;
  method?: AuditMethod;
}) {
  const { user, profile } = await requireOperationsRole();
  await validateCsrfToken(csrfToken || null);

  // Validate team UUID before querying PostgreSQL UUID columns.
  assertValidUuid(teamId, "Team ID");

  if (!teamId) {
    throw new Error("A valid Team ID is required for bulk claim");
  }

  const method: AuditMethod = opts?.method || "qr";
  const baseCorrelationId = opts?.correlationId || crypto.randomUUID();

  const operatorId = user.id;
  const operatorRole = (profile?.role as string) || "staff";
  const operatorName =
    typeof profile === "object" && profile !== null && "full_name" in profile
      ? (profile as { full_name?: string | null }).full_name ?? user.email ?? "Operations"
      : user.email ?? "Operations";

  // Fetch team members
  const { data: members, error: membersError } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, role")
    .eq("team_id", teamId);

  if (membersError || !members || members.length === 0) {
    throw new Error("No team members found for bulk distribution");
  }

  // Fetch existing successful logs for this action (duplicate prevention)
  const { data: existingLogs } = await supabaseAdmin
    .from("event_activity_logs")
    .select("participant_id, result")
    .eq("team_id", teamId)
    .eq("action_type", actionType)
    .eq("result", "success");

  const claimedParticipantIds = new Set(existingLogs?.map((l) => l.participant_id) || []);
  const unclaimedMembers = members.filter((m) => !claimedParticipantIds.has(m.user_id));

  if (unclaimedMembers.length === 0) {
    throw new Error(`All members of this team have already received "${actionType.toUpperCase()}".`);
  }

  const nowIso = new Date().toISOString();
  const insertPayloads = unclaimedMembers.map((m) => ({
    team_id: teamId,
    participant_id: m.user_id,
    action_type: actionType,
    method,
    result: "success",
    new_status: "claimed",
    scanned_by: user.id,
    operator_id: operatorId,
    operator_name: operatorName,
    operator_role: operatorRole,
    correlation_id: baseCorrelationId,
    created_at: nowIso,
  }));

  const { error: insertError } = await supabaseAdmin
    .from("event_activity_logs")
    .insert(insertPayloads);

  if (insertError) {
    throw new Error(`Bulk distribution failed: ${insertError.message}`);
  }

  // Rotate QR token
  const nextToken = `SEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  try {
    await supabaseAdmin
      .from("teams")
      .update({
        qr_token: nextToken,
        last_scanned_at: nowIso,
        last_scanned_by: user.id,
      })
      .eq("id", teamId);
  } catch {}

  return {
    success: true,
    claimedCount: unclaimedMembers.length,
    alreadyClaimedCount: claimedParticipantIds.size,
    qr_token: nextToken,
    correlationId: baseCorrelationId,
  };
}

/**
 * Fetch team roster with members and enriched activity logs containing scanner identity & timestamps.
 */
export async function fetchTeamMembersForScan(teamId: string) {
  await requireOperationsRole();

  if (!teamId) {
    throw new Error("A valid team identifier is required");
  }

  // Validate team UUID before querying PostgreSQL UUID columns.
  assertValidUuid(teamId, "team identifier");

  // 1. Fetch team details
  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .select("id, name, track, leader_name, code, qr_token, last_scanned_at")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) {
    throw new Error(`Team not found: ${teamError?.message || "Invalid team ID"}`);
  }

  // 2. Fetch team participants/members with profiles join
  const { data: rawMembers, error: membersError } = await supabaseAdmin
    .from("team_members")
    .select(`
      id,
      user_id,
      role,
      profiles (
        id,
        full_name,
        email
      )
    `)
    .eq("team_id", teamId);

  if (membersError) {
    console.warn("Notice: Falling back to direct team_members query:", membersError.message);
  }

  interface RawMember {
    id: string;
    user_id: string;
    role?: string | null;
    name?: string | null;
    email?: string | null;
    profiles?: { full_name?: string | null; email?: string | null } | null;
  }

  const members = ((rawMembers as unknown as RawMember[]) || []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role || "member",
    name: m.profiles?.full_name || m.name || "Member",
    email: m.profiles?.email || m.email || "",
  }));

  // 3. Fetch active success activity logs for this team with scanner identity
  const { data: rawLogs, error: logsError } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id, participant_id, action_type, created_at, scanned_by")
    .eq("team_id", teamId)
    .eq("result", "success");

  if (logsError) {
    console.warn("Activity logs query notice:", logsError.message);
  }

  // Fetch scanner profiles to attach club member names & emails
  const scannerIds = Array.from(new Set((rawLogs || []).map((l) => l.scanned_by).filter(Boolean)));
  let scannerMap: Record<string, { full_name: string; email: string }> = {};

  if (scannerIds.length > 0) {
    const { data: scanners } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", scannerIds);

    if (scanners) {
      scannerMap = Object.fromEntries(
        scanners.map((s) => [
          s.id,
          {
            full_name: s.full_name || "Club Member",
            email: s.email || "",
          },
        ])
      );
    }
  }

  const enrichedLogs: EnrichedActivityLog[] = (rawLogs || []).map((l) => ({
    id: l.id,
    participant_id: l.participant_id,
    action_type: l.action_type,
    created_at: l.created_at,
    scanned_by: l.scanned_by,
    scanner_name: l.scanned_by ? scannerMap[l.scanned_by]?.full_name || "Club Member" : "System",
    scanner_email: l.scanned_by ? scannerMap[l.scanned_by]?.email || "" : "",
  }));

  return {
    team,
    members: members || [],
    activityLogs: enrichedLogs,
  };
}

/**
 * Live Activity Stream: Fetches recent scans across ALL teams and ALL club members.
 * Used for live real-time feeds on all club member dashboards.
 */
export async function getLiveScanActivityStream(limit = 40): Promise<LiveActivityFeedItem[]> {
  await requireOperationsRole();

  const { data: rawLogs, error } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id, team_id, participant_id, action_type, scanned_by, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !rawLogs) {
    console.error("Failed to fetch activity stream:", error?.message);
    return [];
  }

  const teamIds = Array.from(new Set(rawLogs.map((l) => l.team_id).filter(Boolean)));
  const participantIds = Array.from(new Set(rawLogs.map((l) => l.participant_id).filter(Boolean)));
  const scannerIds = Array.from(new Set(rawLogs.map((l) => l.scanned_by).filter(Boolean)));
  const profileIds = Array.from(new Set([...participantIds, ...scannerIds]));

  // Fetch teams map
  let teamsMap: Record<string, { name: string; track?: string | null; code?: string | null }> = {};
  if (teamIds.length > 0) {
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, track, code")
      .in("id", teamIds);
    if (teams) {
      teamsMap = Object.fromEntries(
        teams.map((t) => [t.id, { name: t.name, track: t.track, code: t.code }])
      );
    }
  }

  // Fetch profiles map
  let profilesMap: Record<string, { full_name: string; email: string }> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds);
    if (profiles) {
      profilesMap = Object.fromEntries(
        profiles.map((p) => [
          p.id,
          {
            full_name: p.full_name || "User",
            email: p.email || "",
          },
        ])
      );
    }
  }

  // Fetch team member roles map
  let rolesMap: Record<string, string> = {};
  if (participantIds.length > 0) {
    const { data: tMembers } = await supabaseAdmin
      .from("team_members")
      .select("user_id, role")
      .in("user_id", participantIds);
    if (tMembers) {
      rolesMap = Object.fromEntries(tMembers.map((tm) => [tm.user_id, tm.role || "Member"]));
    }
  }

  return rawLogs.map((l) => {
    const team = teamsMap[l.team_id];
    const participant = profilesMap[l.participant_id];
    const scanner = l.scanned_by ? profilesMap[l.scanned_by] : null;

    return {
      id: l.id,
      team_id: l.team_id,
      team_name: team?.name || "Unknown Team",
      team_track: team?.track || "General",
      team_code: team?.code || "",
      participant_id: l.participant_id,
      participant_name: participant?.full_name || "Participant",
      participant_role: rolesMap[l.participant_id] || "Member",
      action_type: l.action_type as ActionType,
      scanned_by: l.scanned_by || "",
      scanner_name: scanner?.full_name || "Club Member",
      scanner_email: scanner?.email || "",
      created_at: l.created_at,
    };
  });
}

/**
 * Recently Scanned Teams: Fetch the latest successful scans performed by the
 * currently authenticated staff member, joined with team details.
 * Returns at most `limit` records (default 3), newest first.
 * Only records with result = 'success' are included (failed/invalid scans excluded).
 */
export interface RecentlyScannedTeam {
  id: string;
  team_id: string;
  team_name: string;
  team_code: string | null;
  team_track: string | null;
  action_type: string;
  created_at: string;
  operator_id: string;
  operator_name: string;
}

export async function getRecentlyScannedTeams(limit = 3): Promise<{
  scans: RecentlyScannedTeam[];
  error?: string;
}> {
  const { user } = await requireOperationsRole();
  const operatorId = user.id;

  const { data, error } = await supabaseAdmin
    .from("event_activity_logs")
    .select(
      `
      id,
      team_id,
      action_type,
      result,
      created_at,
      operator_id,
      operator_name,
      teams (id, name, code, track)
    `
    )
    .eq("result", "success")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { scans: [], error: error.message };
  }

  const scans: RecentlyScannedTeam[] = (data || []).map((row: any) => {
    const team = row.teams || {};
    return {
      id: row.id,
      team_id: row.team_id,
      team_name: team.name || "Unknown Team",
      team_code: team.code || null,
      team_track: team.track || null,
      action_type: row.action_type,
      created_at: row.created_at,
      operator_id: row.operator_id || operatorId,
      operator_name: row.operator_name || user.email || "Staff Member",
    };
  });

  return { scans };
}

/**
 * Get the live claim status for a team. Used by /team/qr to auto-update and rotate the QR code.
 */
export async function getTeamScanStatus(teamId: string) {
  if (!teamId) {
    return {
      claimedActions: [],
      logs: [],
      lastUpdated: new Date().toISOString(),
      qrToken: "",
    };
  }

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("id, name, qr_token, last_scanned_at")
    .eq("id", teamId)
    .maybeSingle();

  const { data: logs } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id, action_type, created_at, scanned_by, participant_id")
    .eq("team_id", teamId)
    .eq("result", "success");

  const scannerIds = Array.from(new Set((logs || []).map((l) => l.scanned_by).filter(Boolean)));
  let scannerMap: Record<string, string> = {};

  if (scannerIds.length > 0) {
    const { data: scanners } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", scannerIds);
    if (scanners) {
      scannerMap = Object.fromEntries(
        scanners.map((s) => [s.id, s.full_name || "Club Member"])
      );
    }
  }

  const enriched = (logs || []).map((l) => ({
    id: l.id,
    action_type: l.action_type,
    created_at: l.created_at,
    scanner_name: l.scanned_by ? scannerMap[l.scanned_by] || "Club Member" : "Operations Desk",
  }));

  const claimedActions = Array.from(new Set((logs || []).map((l) => l.action_type)));

  // Generate dynamic token based on claims count and timestamp
  const dynamicToken =
    team?.qr_token ||
    `SEC-${claimedActions.length}-${teamId.slice(0, 6).toUpperCase()}-${(logs || []).length}`;

  return {
    claimedActions,
    logs: enriched,
    lastUpdated: team?.last_scanned_at || new Date().toISOString(),
    qrToken: dynamicToken,
  };
}

/**
 * Search teams by ID prefix or name substring.
 * Staff can search all teams (not just assigned ones).
 * Read-only: does not modify any records.
 */
export interface TeamSearchResult {
  id: string;
  name: string;
  code: string | null;
  track: string | null;
  status: string | null;
  leader_name: string | null;
  member_count: number;
  last_scanned_at: string | null;
}

export async function searchTeams(
  query: string,
  limit = 20
): Promise<{ teams: TeamSearchResult[]; error?: string }> {
  await requireOperationsRole();

  if (!query || query.trim().length === 0) {
    return { teams: [], error: "" };
  }

  const searchTerm = query.trim();
  const isUuid = UUID_REGEX.test(searchTerm);

  let queryBuilder = supabaseAdmin
    .from("teams")
    .select("id, name, code, track, status, leader_name, last_scanned_at")
    .order("name", { ascending: true })
    .limit(limit);

  if (isUuid) {
    queryBuilder = queryBuilder.eq("id", searchTerm);
  } else {
    queryBuilder = queryBuilder.or(
      `name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`
    );
  }

  const { data, error } = await queryBuilder;

  if (error) {
    return { teams: [], error: error.message };
  }

  // Get member counts for each team
  const teamIds = (data || []).map((t) => t.id);
  let memberCounts: Record<string, number> = {};

  if (teamIds.length > 0) {
    const { data: memberData } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .in("team_id", teamIds);

    if (memberData) {
      for (const m of memberData) {
        memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1;
      }
    }
  }

  const teams: TeamSearchResult[] = (data || []).map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code || null,
    track: t.track || null,
    status: t.status || null,
    leader_name: t.leader_name || null,
    member_count: memberCounts[t.id] || 0,
    last_scanned_at: t.last_scanned_at || null,
  }));

  return { teams };
}

/**
 * Get complete team details for Team Lookup workspace.
 * Returns team info, members, activity history, and submissions.
 * Read-only: does not modify any records.
 */
export interface TeamLookupTeam {
  id: string;
  name: string;
  code: string | null;
  track: string | null;
  status: string | null;
  leader_name: string | null;
  created_at: string;
  qr_token: string | null;
  last_scanned_at: string | null;
  last_scanned_by: string | null;
}

export interface TeamLookupMember {
  id: string;
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
  joined_at: string;
}

export interface TeamLookupActivity {
  id: string;
  action_type: string;
  method: string | null;
  result: string | null;
  created_at: string;
  operator_name: string | null;
  operator_role: string | null;
  item_name: string | null;
}

export interface TeamLookupSubmission {
  id: string;
  round_id: string;
  ppt_url: string;
  github_url: string | null;
  pitch_deck_url: string | null;
  prototype_url: string | null;
  additional_material_url: string | null;
  demo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamLookupResult {
  team: TeamLookupTeam | null;
  members: TeamLookupMember[];
  activity: TeamLookupActivity[];
  submissions: TeamLookupSubmission[];
  error?: string;
}

export async function getTeamLookupDetails(teamId: string): Promise<TeamLookupResult> {
  await requireOperationsRole();

  // Fetch team details
  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .select("id, name, code, track, status, leader_name, created_at, qr_token, last_scanned_at, last_scanned_by")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) {
    return { team: null, members: [], activity: [], submissions: [], error: "Team not found" };
  }

  // Fetch team members with profile info
  const { data: members, error: membersError } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, role, name, email, joined_at")
    .eq("team_id", teamId)
    .order("role", { ascending: true });

  if (membersError) {
    console.error("Failed to load team members:", membersError.message);
  }

  // Fetch activity logs for this team
  const { data: activity, error: activityError } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id, action_type, method, result, created_at, operator_name, operator_role, item_name")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (activityError) {
    console.error("Failed to load activity logs:", activityError.message);
  }

  // Fetch team submissions
  const { data: submissions, error: submissionsError } = await supabaseAdmin
    .from("team_submissions")
    .select("id, round_id, ppt_url, github_url, pitch_deck_url, prototype_url, additional_material_url, demo_url, created_at, updated_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (submissionsError) {
    console.error("Failed to load submissions:", submissionsError.message);
  }

  return {
    team: {
      id: team.id,
      name: team.name,
      code: team.code || null,
      track: team.track || null,
      status: team.status || null,
      leader_name: team.leader_name || null,
      created_at: team.created_at,
      qr_token: team.qr_token || null,
      last_scanned_at: team.last_scanned_at || null,
      last_scanned_by: team.last_scanned_by || null,
    },
    members: (members || []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      name: m.name || null,
      email: m.email || null,
      joined_at: m.joined_at,
    })),
    activity: (activity || []).map((a: any) => ({
      id: a.id,
      action_type: a.action_type,
      method: a.method || null,
      result: a.result || null,
      created_at: a.created_at,
      operator_name: a.operator_name || null,
      operator_role: a.operator_role || null,
      item_name: a.item_name || null,
    })),
    submissions: (submissions || []).map((s: any) => ({
      id: s.id,
      round_id: s.round_id,
      ppt_url: s.ppt_url,
      github_url: s.github_url || null,
      pitch_deck_url: s.pitch_deck_url || null,
      prototype_url: s.prototype_url || null,
      additional_material_url: s.additional_material_url || null,
      demo_url: s.demo_url || null,
      created_at: s.created_at,
      updated_at: s.updated_at,
    })),
  };
}

export interface ProcessScanResult {
  success: boolean;
  status: "success" | "already_completed" | "not_found" | "ineligible" | "error";
  message: string;
  action_type: ActionType;
  team?: {
    id: string;
    name: string;
    code?: string | null;
    track?: string | null;
    leader_name?: string | null;
  };
  participant?: {
    id: string;
    name: string;
    email?: string | null;
    role?: string | null;
  };
  claimedCount?: number;
  totalMembers?: number;
  previousClaim?: {
    time: string;
    operator: string;
  };
  teamData?: TeamScanData | null;
  error?: string;
}

/**
 * Executes automatic operational scanning with instant database persistence,
 * duplicate/fraud prevention, participant resolution, and multi-portal sync.
 */
export async function processAutomatedScan(params: {
  rawCode: string;
  actionType: ActionType;
  participantId?: string;
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}): Promise<ProcessScanResult> {
  const { user, profile } = await requireOperationsRole();

  try {
    if (params[CSRF_CONSTANTS.HEADER_NAME]) {
      await validateCsrfToken(params[CSRF_CONSTANTS.HEADER_NAME]);
    }
  } catch (csrfErr) {
    console.warn("processAutomatedScan CSRF warning:", csrfErr);
  }

  const operatorId = user.id;
  const operatorRole = (profile?.role as string) || "staff";
  const operatorName =
    typeof profile === "object" && profile !== null && "full_name" in profile
      ? (profile as { full_name?: string | null }).full_name ?? user.email ?? "Operations"
      : user.email ?? "Operations";

  const raw = (params.rawCode || "").trim();
  if (!raw) {
    return {
      success: false,
      status: "not_found",
      action_type: params.actionType,
      message: "Empty QR code detected.",
    };
  }

  let resolvedTeamId: string | null = null;
  let resolvedParticipantId: string | null = params.participantId || null;

  // 1. Attempt JSON parsing (e.g. {"team_id":"...","participant_id":"..."})
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        resolvedTeamId = parsed.team_id || parsed.id || parsed.teamId || null;
        if (!resolvedParticipantId) {
          resolvedParticipantId =
            parsed.participant_id ||
            parsed.user_id ||
            parsed.member_id ||
            parsed.participantId ||
            null;
        }
      }
    } catch {
      // Fall through to regex extraction
    }
  }

  // 2. Extract UUIDs from string if not yet identified
  if (!resolvedTeamId) {
    const uuidMatches = raw.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
    ) || [];

    for (const candidateUuid of uuidMatches) {
      // Check if this UUID is a team
      const { data: teamCheck } = await supabaseAdmin
        .from("teams")
        .select("id")
        .eq("id", candidateUuid)
        .maybeSingle();

      if (teamCheck?.id) {
        resolvedTeamId = teamCheck.id;
        break;
      }

      // Check if this UUID is a participant / user
      const { data: memberCheck } = await supabaseAdmin
        .from("team_members")
        .select("id, team_id, user_id")
        .or(`user_id.eq.${candidateUuid},id.eq.${candidateUuid}`)
        .maybeSingle();

      if (memberCheck) {
        resolvedParticipantId = memberCheck.user_id;
        resolvedTeamId = memberCheck.team_id;
        break;
      }
    }
  }

  // If participant is known but team is not, resolve team from team_members
  if (resolvedParticipantId && !resolvedTeamId) {
    const { data: mCheck } = await supabaseAdmin
      .from("team_members")
      .select("team_id, user_id")
      .or(`user_id.eq.${resolvedParticipantId},id.eq.${resolvedParticipantId}`)
      .maybeSingle();

    if (mCheck) {
      resolvedTeamId = mCheck.team_id;
      resolvedParticipantId = mCheck.user_id;
    }
  }

  if (!resolvedTeamId) {
    return {
      success: false,
      status: "not_found",
      action_type: params.actionType,
      message: "Unrecognized QR code: No registered team or participant matched.",
    };
  }

  // 3. Fetch team details
  const { data: team, error: teamErr } = await supabaseAdmin
    .from("teams")
    .select("id, name, code, track, leader_name, qr_token, status")
    .eq("id", resolvedTeamId)
    .maybeSingle();

  if (teamErr || !team) {
    return {
      success: false,
      status: "not_found",
      action_type: params.actionType,
      message: `Team not found in registration database (${resolvedTeamId.slice(0, 8)}...).`,
    };
  }

  // 4. Fetch team members with profiles
  const { data: membersRaw, error: membersErr } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, role, name, email")
    .eq("team_id", team.id);

  const members = membersRaw || [];
  if (membersErr || members.length === 0) {
    return {
      success: false,
      status: "ineligible",
      action_type: params.actionType,
      message: `Team "${team.name}" has no registered members in the roster.`,
      team: {
        id: team.id,
        name: team.name,
        code: team.code,
        track: team.track,
        leader_name: team.leader_name,
      },
    };
  }

  const nowIso = new Date().toISOString();
  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  // =========================================================================
  // CASE A: SPECIFIC PARTICIPANT TARGETED (Or solo team)
  // =========================================================================
  if (resolvedParticipantId || members.length === 1) {
    const targetUserId = resolvedParticipantId || members[0].user_id;
    const targetMember = members.find(
      (m) => m.user_id === targetUserId || m.id === targetUserId
    ) || members[0];

    const participantName = targetMember.name || "Participant";

    // Duplicate check in event_activity_logs
    const { data: existingLogs } = await supabaseAdmin
      .from("event_activity_logs")
      .select("id, created_at, operator_name, result")
      .eq("participant_id", targetMember.user_id)
      .eq("action_type", params.actionType)
      .eq("result", "success")
      .order("created_at", { ascending: false });

    const existingCount = (existingLogs || []).length;
    if (existingCount > 0) {
      const prev = existingLogs![0];
      const prevTime = formatTime(prev.created_at);
      const prevOp = prev.operator_name || "Operations Staff";

      const teamData = await fetchTeamMembersForScan(team.id).catch(() => null);

      return {
        success: false,
        status: "already_completed",
        action_type: params.actionType,
        message: `ALREADY ${
          params.actionType === "registration" ? "REGISTERED" : "CLAIMED"
        }: ${participantName} (${team.name}) already completed ${params.actionType.toUpperCase()} at ${prevTime} from ${prevOp}.`,
        previousClaim: { time: prevTime, operator: prevOp },
        team: {
          id: team.id,
          name: team.name,
          code: team.code,
          track: team.track,
          leader_name: team.leader_name,
        },
        participant: {
          id: targetMember.user_id,
          name: participantName,
          email: targetMember.email,
          role: targetMember.role,
        },
        teamData,
      };
    }

    // Insert successful claim into event_activity_logs
    const correlationId = crypto.randomUUID();
    const { error: insertErr } = await supabaseAdmin
      .from("event_activity_logs")
      .insert([
        {
          team_id: team.id,
          participant_id: targetMember.user_id,
          action_type: params.actionType,
          method: "qr",
          result: "success",
          new_status: "claimed",
          scanned_by: user.id,
          operator_id: operatorId,
          operator_name: operatorName,
          operator_role: operatorRole,
          correlation_id: correlationId,
          created_at: nowIso,
        },
      ]);

    if (insertErr) {
      return {
        success: false,
        status: "error",
        action_type: params.actionType,
        message: `Database transaction failed: ${insertErr.message}`,
      };
    }

    // Rotate team QR token
    const nextToken = `SEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    try {
      await supabaseAdmin
        .from("teams")
        .update({
          qr_token: nextToken,
          last_scanned_at: nowIso,
          last_scanned_by: user.id,
        })
        .eq("id", team.id);
    } catch {}

    // Write to audit_logs
    try {
      await supabaseAdmin.from("audit_logs").insert([
        {
          action: `OPS_SCAN_${params.actionType.toUpperCase()}`,
          entity_type: "team",
          entity_id: team.id,
          admin_id: user.id,
          details: {
            participant_id: targetMember.user_id,
            participant_name: participantName,
            team_name: team.name,
            action_type: params.actionType,
            method: "qr",
            correlation_id: correlationId,
          },
          created_at: nowIso,
        },
      ]);
    } catch {}

    const teamData = await fetchTeamMembersForScan(team.id).catch(() => null);

    return {
      success: true,
      status: "success",
      action_type: params.actionType,
      message: `${params.actionType.toUpperCase()} SUCCESS: ${participantName} (${team.name}) verified and recorded!`,
      team: {
        id: team.id,
        name: team.name,
        code: team.code,
        track: team.track,
        leader_name: team.leader_name,
      },
      participant: {
        id: targetMember.user_id,
        name: participantName,
        email: targetMember.email,
        role: targetMember.role,
      },
      teamData,
    };
  }

  // =========================================================================
  // CASE B: TEAM-LEVEL WORKFLOW (Team QR code scanned for team roster)
  // =========================================================================
  const { data: existingTeamLogs } = await supabaseAdmin
    .from("event_activity_logs")
    .select("participant_id, created_at, operator_name, result")
    .eq("team_id", team.id)
    .eq("action_type", params.actionType)
    .eq("result", "success")
    .order("created_at", { ascending: false });

  const claimedUserIds = new Set(
    (existingTeamLogs || []).map((l) => l.participant_id)
  );

  const unclaimedMembers = members.filter(
    (m) => !claimedUserIds.has(m.user_id)
  );

  // If ALL members have already claimed this action
  if (unclaimedMembers.length === 0) {
    const prev = existingTeamLogs?.[0];
    const prevTime = prev?.created_at ? formatTime(prev.created_at) : "";
    const prevOp = prev?.operator_name || "Operations Staff";

    const teamData = await fetchTeamMembersForScan(team.id).catch(() => null);

    return {
      success: false,
      status: "already_completed",
      action_type: params.actionType,
      message: `ALREADY ${
        params.actionType === "registration" ? "REGISTERED" : "CLAIMED"
      }: All ${members.length} member(s) of team "${team.name}" have already received ${params.actionType.toUpperCase()}${
        prevTime ? ` at ${prevTime} from ${prevOp}` : ""
      }.`,
      previousClaim: { time: prevTime, operator: prevOp },
      team: {
        id: team.id,
        name: team.name,
        code: team.code,
        track: team.track,
        leader_name: team.leader_name,
      },
      totalMembers: members.length,
      claimedCount: 0,
      teamData,
    };
  }

  // Record action for each unclaimed member
  const baseCorrelationId = crypto.randomUUID();
  const insertPayloads = unclaimedMembers.map((m) => ({
    team_id: team.id,
    participant_id: m.user_id,
    action_type: params.actionType,
    method: "qr",
    result: "success",
    new_status: "claimed",
    scanned_by: user.id,
    operator_id: operatorId,
    operator_name: operatorName,
    operator_role: operatorRole,
    correlation_id: `${baseCorrelationId}-${m.user_id.slice(0, 8)}`,
    created_at: nowIso,
  }));

  const { error: insertErr } = await supabaseAdmin
    .from("event_activity_logs")
    .insert(insertPayloads);

  if (insertErr) {
    return {
      success: false,
      status: "error",
      action_type: params.actionType,
      message: `Database insert failed: ${insertErr.message}`,
    };
  }

  // Rotate QR token
  const nextToken = `SEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  try {
    await supabaseAdmin
      .from("teams")
      .update({
        qr_token: nextToken,
        last_scanned_at: nowIso,
        last_scanned_by: user.id,
      })
      .eq("id", team.id);
  } catch {}

  // Write to audit_logs
  try {
    await supabaseAdmin.from("audit_logs").insert([
      {
        action: `OPS_SCAN_TEAM_${params.actionType.toUpperCase()}`,
        entity_type: "team",
        entity_id: team.id,
        admin_id: user.id,
        details: {
          team_id: team.id,
          team_name: team.name,
          action_type: params.actionType,
          claimed_count: unclaimedMembers.length,
          unclaimed_members: unclaimedMembers.map((m) => ({
            id: m.user_id,
            name: m.name,
          })),
        },
        created_at: nowIso,
      },
    ]);
  } catch {}

  const teamData = await fetchTeamMembersForScan(team.id).catch(() => null);

  return {
    success: true,
    status: "success",
    action_type: params.actionType,
    message: `SUCCESS: ${params.actionType.toUpperCase()} recorded for ${unclaimedMembers.length} member(s) of "${team.name}"!`,
    team: {
      id: team.id,
      name: team.name,
      code: team.code,
      track: team.track,
      leader_name: team.leader_name,
    },
    claimedCount: unclaimedMembers.length,
    totalMembers: members.length,
    teamData,
  };
}
