import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Backward-compatible check-in endpoint.
 *
 * Old QR codes may contain URLs like:
 *   /checkin?teamId=IVC-VV-100&token=<SECRET_TOKEN>
 *
 * This route validates the token server-side, then redirects to the new
 * clean public route:
 *   /check-in/qr/<PUBLIC_ID>
 *
 * The secret token is never echoed back in HTML, headers, or the redirect
 * target URL.
 */
export default async function CheckinPublicPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const teamId =
    typeof searchParams.teamId === "string" ? searchParams.teamId : "";
  const token =
    typeof searchParams.token === "string" ? searchParams.token : "";

  if (!teamId || !token) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Missing parameters</h2>
        <p className="text-text-secondary">
          Please provide both teamId and token query parameters.
        </p>
      </div>
    );
  }

  // Fetch QR record for the supplied team code (server-side only)
  const { data: qrRecord, error } = await supabaseAdmin
    .from("team_checkin_qrs")
    .select("qr_token, public_id")
    .eq("team_code", teamId)
    .maybeSingle();

  if (error || !qrRecord) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-status-warning">
          QR not found
        </h2>
        <p className="text-text-secondary">
          No QR record exists for team {teamId}.
        </p>
      </div>
    );
  }

  // Constant-time-ish comparison: just verify equality server-side.
  // The token is never logged or returned to the client.
  if (qrRecord.qr_token !== token) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-status-warning">
          Invalid token
        </h2>
        <p className="text-text-secondary">
          The supplied token does not match the stored QR token for this team.
        </p>
      </div>
    );
  }

  // Redirect to the new clean public route. The token is not in the target URL.
  redirect(`/check-in/qr/${encodeURIComponent(qrRecord.public_id)}`);
}
