"use server";

import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkServerActionRateLimit, SERVER_ACTION_RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Resolves a username to its registered authentication email.
 * Performed server-side so the Supabase service-role key never reaches the client.
 * Returns the email if exactly one match is found, otherwise null.
 * Generic errors avoid revealing whether a username exists.
 */
export async function resolveUsernameToEmail(username: string): Promise<string | null> {
  // Rate limit by IP to prevent username enumeration via repeated lookups.
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : "unknown";

  const rateLimit = checkServerActionRateLimit(
    clientIp,
    "usernameLookup",
    SERVER_ACTION_RATE_LIMITS.adminPasscode.maxRequests,
    SERVER_ACTION_RATE_LIMITS.adminPasscode.windowMs
  );
  if (!rateLimit.success) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin.rpc(
      "resolve_username_to_email",
      { p_username: username.trim().toLowerCase() }
    );

    if (error) {
      console.error("Username resolution error:", error.message);
      return null;
    }

    return (data as string | null) || null;
  } catch {
    return null;
  }
}
