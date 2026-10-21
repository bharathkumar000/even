import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import TeamQrClientView, { ActionStatus } from "./qr-client";
import QRCode from "qrcode";
import { getTeamScanStatus } from "@/app/actions/operations";

import { getTeamRegistrationByEmail } from "@/lib/googleSheet";

export const dynamic = "force-dynamic";

const CHECKIN_BASE_URL = "https://eventra-ivc.vercel.app";

function generatePublicId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateQrDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(
      url,
      { width: 320, margin: 2 },
      (err: Error | null | undefined, dataUrl: string) => {
        if (err) reject(err);
        else resolve(dataUrl);
      }
    );
  });
}

export default async function TeamQrPage() {
  const { teamId, user } = await requireAuthenticatedTeamUser();
  let team: any = null;

  if (teamId) {
    const { data } = await supabaseAdmin
      .from("teams")
      .select("id, name, track, leader_name, code")
      .eq("id", teamId)
      .maybeSingle();
    if (data) team = data;
  }

  // Fallback to Google Sheet registration if team not yet found
  if (!team && user?.email) {
    try {
      const reg = await getTeamRegistrationByEmail(user.email);
      if (reg) {
        const regCode = reg["Team ID"] || reg["Team Code"] || "";
        const regName = reg["Team Name"] || "";
        if (regCode || regName) {
          const { data: matchedTeam } = await supabaseAdmin
            .from("teams")
            .select("id, name, track, leader_name, code")
            .or(`code.eq.${regCode},name.eq.${regName}`)
            .maybeSingle();
          if (matchedTeam) team = matchedTeam;
        }
        if (!team) {
          team = {
            id: teamId || user.id,
            name: reg["Team Name"] || "Team",
            track: reg["SELECTED DOMAIN"] || "Innovation Track",
            leader_name: reg["Team Leader"] || "Team Leader",
            code: regCode || "IVC-VV-001",
          };
        }
      }
    } catch (e) {
      console.warn("Google Sheet team fallback error:", e);
    }
  }

  // Fallback to first available team in Supabase
  if (!team) {
    const { data: firstTeam } = await supabaseAdmin
      .from("teams")
      .select("id, name, track, leader_name, code")
      .order("code", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstTeam) team = firstTeam;
  }

  if (!team) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <h2 className="text-2xl font-bold mb-4">Team not found</h2>
        <p className="text-text-secondary">Please contact event staff.</p>
      </div>
    );
  }

  const effectiveTeamId = team.id;
  const teamCode = team.code || "IVC-VV-001";

  // Fetch existing QR credential; do NOT overwrite if one already exists
  const { data: qrRecord, error: fetchError } = await supabaseAdmin
    .from("team_checkin_qrs")
    .select("qr_token, qr_url, public_id, updated_at")
    .eq("team_code", teamCode)
    .maybeSingle();

  if (fetchError) {
    console.error(
      `[TeamQR] Failed to fetch QR credential for team_code ${teamCode}:`,
      fetchError.message
    );
    return (
      <div className="p-8 text-center animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-status-error">
          QR lookup failed
        </h2>
        <p className="text-text-secondary">
          Unable to read QR credential from Supabase. Ensure migration
          009_add_public_id_to_team_checkin_qrs.sql has been applied.
        </p>
      </div>
    );
  }

  // Fetch live claim status from Supabase (registration, goodies, lunch, snacks, feedback)
  const scanStatus = await getTeamScanStatus(effectiveTeamId);

  // Also fetch registration row from Google Sheet for team name and sheet-based scans
  let sheetReg: Record<string, string> | null = null;
  try {
    const { getTeamRegistrationByTeamId } = await import("@/lib/googleSheet");
    sheetReg = await getTeamRegistrationByTeamId(teamCode);
    if (sheetReg && sheetReg["Team Name"]) {
      team.name = sheetReg["Team Name"];
    }
  } catch (sheetErr) {
    console.warn("Failed to fetch Google Sheet registration for status:", sheetErr);
  }

  // Calculate Google Sheet check-in counts
  const sheetCounts: Record<string, number> = {
    registration: 0,
    goodies: 0,
    lunch: 0,
    snacks: 0,
    feedback: 0,
  };

  if (sheetReg) {
    const morningReg = (sheetReg["Morning Registration"] || sheetReg["Morning Registration "] || "").trim();
    if (morningReg) sheetCounts.registration = 1;

    const goodies = (sheetReg["Goodies"] || sheetReg["Goodies "] || "").trim();
    if (goodies) sheetCounts.goodies = 1;

    const lunchTL = (sheetReg["Lunch Team Leader"] || "").trim();
    const lunchM2 = (sheetReg["Lunch Member 2"] || "").trim();
    const lunchM3 = (sheetReg["Lunch Member 3"] || "").trim();
    sheetCounts.lunch = (lunchTL ? 1 : 0) + (lunchM2 ? 1 : 0) + (lunchM3 ? 1 : 0);

    const snacksTL = (sheetReg["Snacks Team Leader"] || "").trim();
    const snacksM1 = (sheetReg["Snacks Member 1"] || "").trim();
    const snacksM2 = (sheetReg["Snacks Member 2"] || "").trim();
    sheetCounts.snacks = (snacksTL ? 1 : 0) + (snacksM1 ? 1 : 0) + (snacksM2 ? 1 : 0);

    const feedback = (sheetReg["FEEDBACK"] || "").trim();
    if (feedback) sheetCounts.feedback = 1;
  }

  // User requirement: Lunch and snacks are scanned 3 times as 3 members are there
  const memberQuota = 3;

  const actionEmojis: Record<string, string> = {
    registration: "📝",
    goodies: "🎁",
    lunch: "🍽️",
    snacks: "☕",
    feedback: "💬",
  };

  const actionLabels: Record<string, string> = {
    registration: "Registration Check-In",
    goodies: "Goodies / Kit Distribution",
    lunch: "Lunch Coupon Scan",
    snacks: "Evening Snacks Scan",
    feedback: "Event Feedback Submission",
  };

  const actionStatusList: ActionStatus[] = [
    "registration",
    "goodies",
    "lunch",
    "snacks",
    "feedback",
  ].map((actionType) => {
    const isPerMember = actionType === "lunch" || actionType === "snacks";
    const targetCount = isPerMember ? memberQuota : 1;
    const logsForAction = (scanStatus.logs || []).filter(
      (l) => l.action_type === actionType
    );
    const rawSupabaseCount = Math.max(
      logsForAction.length,
      scanStatus.actionMemberCounts?.[actionType] || 0
    );
    const rawSheetCount = sheetCounts[actionType] || 0;
    const effectiveCount = Math.max(rawSupabaseCount, rawSheetCount);
    const completedCount = Math.min(effectiveCount, targetCount);
    const claimed = completedCount >= targetCount;

    return {
      id: actionType,
      label: actionLabels[actionType] || actionType,
      emoji: actionEmojis[actionType] || "⚪",
      claimed,
      completedCount,
      targetCount,
      isPerMember,
      log: logsForAction[0]
        ? {
            scanner_name: logsForAction[0].scanner_name || "Operations Desk",
            created_at: logsForAction[0].created_at,
          }
        : undefined,
    };
  });

  let publicId: string;
  let qrUrl: string;

  if (qrRecord && qrRecord.public_id && qrRecord.qr_url) {
    publicId = qrRecord.public_id;
    qrUrl = qrRecord.qr_url;
  } else {
    // Create credential securely on the server
    publicId = generatePublicId();
    // Secret token stays server-side only; never in URL or frontend
    const qrToken = crypto
      .getRandomValues(new Uint8Array(16))
      .reduce(
        (acc, b) => acc + b.toString(16).padStart(2, "0"),
        ""
      );
    qrUrl = `${CHECKIN_BASE_URL}/check-in/qr/${encodeURIComponent(publicId)}`;
    const now = new Date().toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("team_checkin_qrs")
      .insert({
        team_code: teamCode,
        qr_token: qrToken,
        qr_url: qrUrl,
        public_id: publicId,
        updated_at: now,
      });

    if (insertError) {
      console.error(
        `[TeamQR] Failed to insert QR credential for team_code ${teamCode}:`,
        insertError.message
      );
      // Concurrent request may have created it first; refetch and reuse
      const { data: refetched, error: refetchError } = await supabaseAdmin
        .from("team_checkin_qrs")
        .select("public_id, qr_url, updated_at")
        .eq("team_code", teamCode)
        .maybeSingle();

      if (refetchError) {
        console.error(
          `[TeamQR] Failed to refetch QR credential for team_code ${teamCode}:`,
          refetchError.message
        );
      }

      if (refetched && refetched.public_id && refetched.qr_url) {
        publicId = refetched.public_id;
        qrUrl = refetched.qr_url;
      } else {
        return (
          <div className="p-8 text-center animate-fade-in">
            <h2 className="text-2xl font-bold mb-4 text-status-error">
              Failed to create QR credential
            </h2>
            <p className="text-text-secondary">
              Supabase insert failed. Check server logs for details.
            </p>
            <p className="text-text-secondary text-xs mt-2">
              Please refresh the page and try again.
            </p>
          </div>
        );
      }
    }
  }

  // Generate QR image on the website (server-side), not in Supabase
  let qrImageDataUrl: string | null = null;
  let qrGenError: string | null = null;

  try {
    qrImageDataUrl = await generateQrDataUrl(qrUrl);
  } catch {
    qrGenError = "Failed to generate QR image";
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto px-4">
      <div className="border-b border-border-color pb-6 text-center">
        <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
          Team Check‑In QR
        </p>
        <h1 className="text-3xl md:text-4xl font-heading text-text-primary tracking-wider uppercase m-0">
          {team.name}
        </h1>
        <p className="font-tech text-text-secondary text-xs mt-2">
          Present this QR badge at event check‑in.
        </p>
      </div>

      <TeamQrClientView
        teamCode={teamCode}
        teamName={team.name || "Team"}
        qrImageDataUrl={qrImageDataUrl}
        qrError={qrGenError}
        actionStatusList={actionStatusList}
        socialLinks={[]}
      />
    </div>
  );
}
