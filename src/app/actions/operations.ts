"use server";

import { requireOperationsRole } from "@/lib/auth/operations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ScanActionSchema,
  type ScanActionInput,
  type ActionType,
} from "@/lib/validations/operations";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

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

/**
 * Record a single scan action (Registration, Goodies, Lunch, Snacks) for a participant.
 * Prevents duplicates, tracks scanner identity, and auto-rotates the team's QR token.
 */
export async function recordMemberAction(data: ScanActionInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }) {
  const { user } = await requireOperationsRole();
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);
  const validated = ScanActionSchema.parse(data);

  // 1. Duplicate check in event_activity_logs with scanner attribution
  // Updated to allow up to 3 claims for lunch and snacks per participant.
  const { data: existingRecords, error: checkError } = await supabaseAdmin
    .from("event_activity_logs")
    .select("id, created_at, scanned_by")
    .eq("participant_id", validated.participant_id)
    .eq("action_type", validated.action_type);

  if (checkError) {
    console.warn("Activity check query notice:", checkError.message);
  }

  const existingCount = (existingRecords || []).length;

  if (validated.action_type === "lunch" || validated.action_type === "snacks") {
    // Allow up to three claims per participant for lunch or snacks.
    if (existingCount >= 3) {
      throw new Error(
        `Maximum ${validated.action_type} claims (3) reached for this participant.`
      );
    }
  } else {
    // For other actions (registration, goodies) only one claim is allowed.
    if (existingCount > 0) {
      let prevScannerName = "another club member";
      const existingRecord = existingRecords?.[0];
      if (existingRecord && existingRecord.scanned_by) {
        const { data: prevScanner } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", existingRecord.scanned_by)
          .maybeSingle();
        if (prevScanner?.full_name) {
          prevScannerName = prevScanner.full_name;
        }
      }

      const timeStr = new Date(existingRecord?.created_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      throw new Error(
        `FRAUD BLOCKED: "${validated.action_type.toUpperCase()}" already claimed at ${timeStr} from ${prevScannerName}. Duplicate claim strictly prohibited.`
      );
    }
  }


  // 2. Fetch current scanner profile
  const { data: currentScanner } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const scannerName = currentScanner?.full_name || user.email || "Club Member";
  const scannerEmail = currentScanner?.email || user.email || "";

  // 3. Insert activity log
  const nowIso = new Date().toISOString();
  const { data: record, error: insertError } = await supabaseAdmin
    .from("event_activity_logs")
    .insert([
      {
        team_id: validated.team_id,
        participant_id: validated.participant_id,
        action_type: validated.action_type,
        scanned_by: user.id,
        created_at: nowIso,
      },
    ])
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to record scan action: ${insertError.message}`);
  }

  // 4. Auto-update team QR token & timestamp to prevent fraud
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

  return {
    success: true,
    record: {
      ...record,
      scanner_name: scannerName,
      scanner_email: scannerEmail,
    },
    qr_token: nextToken,
  };
}

/**
 * Record an action for all eligible members of a team in one click (e.g., Team Kit/Goodies distribution)
 */
export async function recordTeamBulkAction(teamId: string, actionType: ActionType, csrfToken?: string) {
  const { user } = await requireOperationsRole();
  await validateCsrfToken(csrfToken || null);

  if (!teamId) {
    throw new Error("A valid Team ID is required for bulk claim");
  }

  // Fetch team members
  const { data: members, error: membersError } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, role")
    .eq("team_id", teamId);

  if (membersError || !members || members.length === 0) {
    throw new Error("No team members found for bulk distribution");
  }

  // Fetch existing logs for this action
  const { data: existingLogs } = await supabaseAdmin
    .from("event_activity_logs")
    .select("participant_id")
    .eq("team_id", teamId)
    .eq("action_type", actionType);

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
    scanned_by: user.id,
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
