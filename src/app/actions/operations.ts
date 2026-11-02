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

  // 3. Fetch activity logs for this team with scanner identity
  const { data: rawLogs, error: logsError } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id, participant_id, action_type, created_at, scanned_by")
    .eq("team_id", teamId);

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
     // registration/goodies/certificates allow one claim.
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

  // 3. Fetch activity logs for this team with scanner identity
  const { data: rawLogs, error: logsError } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id, participant_id, action_type, created_at, scanned_by")
    .eq("team_id", teamId);

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
    .eq("team_id", teamId);

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
