"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type LoginResult =
  | { success: true; redirectUrl: string }
  | { success: false; error: string };

function redirectForRole(role: string | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "judge") return "/judge";
  if (role === "staff" || role === "organizer") return "/ops/scanner";
  return "/team";
}

/**
 * Signs in with either a portal username or an email address.
 * Username-to-email resolution stays server-side; the email is never returned
 * to the browser. The actual sign-in uses the cookie-aware SSR client.
 */
export async function signInToPortal(
  identifier: string,
  password: string,
): Promise<LoginResult> {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized || !password) {
    return { success: false, error: "Enter your username and password." };
  }
  if (password.length > 256 || normalized.length > 256) {
    return { success: false, error: "Invalid username or password." };
  }

  let email = normalized;
  // 1. First check portal_account_links by username, team code, or login_email
  const { data: link, error: lookupError } = await supabaseAdmin
    .from("portal_account_links")
    .select("login_email, account_status")
    .or(`username.eq.${normalized},registration_team_id.ilike.${normalized},login_email.eq.${normalized}`)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("Portal username lookup failed:", lookupError.message);
  }

  if (link) {
    if (link.account_status !== "active") {
      return { success: false, error: "This portal account is not active. Contact the event team." };
    }
    email = String(link.login_email).trim().toLowerCase();
  } else if (normalized.includes("@")) {
    // 2. Check if the provided email is a registered team email in Google Sheets
    try {
      const { getTeamRegistrationByEmail } = await import("@/lib/googleSheet");
      const reg = await getTeamRegistrationByEmail(normalized);
      if (reg) {
        const teamCode = (reg["Team ID"] || reg["Team Code"] || "").trim();
        if (teamCode) {
          const { data: codeLink } = await supabaseAdmin
            .from("portal_account_links")
            .select("login_email, account_status")
            .ilike("registration_team_id", teamCode)
            .limit(1)
            .maybeSingle();
          if (codeLink) {
            email = String(codeLink.login_email).trim().toLowerCase();
          }
        }
      }
    } catch (sheetErr) {
      console.warn("Google Sheet login lookup error:", sheetErr);
    }
  } else {
    // Preserve compatibility with older/demo accounts that use synthetic emails.
    email = `${normalized}@ivc.pulse`;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { success: false, error: "Invalid username or password." };
  }

  // Prefer the database role over user-editable metadata for portal routing.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = typeof profile?.role === "string"
    ? profile.role
    : String(data.user.app_metadata?.role || data.user.user_metadata?.role || "");

  return { success: true, redirectUrl: redirectForRole(role) };
}
