"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkServerActionRateLimit, SERVER_ACTION_RATE_LIMITS } from "@/lib/rate-limit";
import { getAuthorizedPortalUrl } from "@/lib/auth/portal-route";

/**
 * Resolves a username to its registered authentication email.
 * Performed server-side so the Supabase service-role key never reaches the client.
 * Returns the email if exactly one match is found, otherwise null.
 * Generic errors avoid revealing whether a username exists.
 */
export async function resolveUsernameToEmail(username: string): Promise<string | null> {
  // Rate limit by IP to prevent username enumeration via repeated lookups.
  // Disabled in local development (NODE_ENV === "development" or localhost).
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const host = headersList.get("host");

  const rateLimit = checkServerActionRateLimit(
    clientIp,
    "usernameLookup",
    SERVER_ACTION_RATE_LIMITS.adminPasscode.maxRequests,
    SERVER_ACTION_RATE_LIMITS.adminPasscode.windowMs,
    host
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

/**
 * Unified sign-in action: accepts either an email or a username.
 * - Email: normalizes (trim/lowercase) and authenticates directly with Supabase Auth.
 * - Username: resolves to email server-side via RPC (email never returned to browser),
 *   then authenticates with the resolved email.
 * Returns { success: true, redirectUrl } on success, or { error } on failure.
 * All failures return a generic message to prevent username enumeration.
 */
export async function signInWithCredentials(identifier: string, password: string) {
  // Rate limit by IP to prevent brute-force and username enumeration.
  // Disabled in local development (NODE_ENV === "development" or localhost).
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const host = headersList.get("host");

  const rateLimit = checkServerActionRateLimit(
    clientIp,
    "login",
    SERVER_ACTION_RATE_LIMITS.login.maxRequests,
    SERVER_ACTION_RATE_LIMITS.login.windowMs,
    host
  );
  if (!rateLimit.success) {
    return { error: "Too many login attempts. Please try again later." };
  }

  if (!password || password.trim() === "") {
    return { error: "Invalid email or username or password." };
  }

  const normalized = identifier.trim().toLowerCase();
  const supabase = await createClient();

  let email: string;

  if (normalized.includes("@")) {
    // Direct email login — input is already known to the client, no new info revealed.
    email = normalized;
  } else {
    // Username login — resolve server-side. The resolved email never leaves the server.
    const resolvedEmail = await resolveUsernameToEmail(normalized);
    if (!resolvedEmail) {
      // Generic failure — indistinguishable from wrong password.
      return { error: "Invalid email or username or password." };
    }
    email = resolvedEmail;
  }

  // Authenticate with Supabase Auth using the server client (sets auth cookies in response).
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.user) {
    return { error: "Invalid email or username or password." };
  }

  // Resolve role from profiles (canonical source of truth, not JWT metadata).
  let role: string | null = null;
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    role = profile?.role ?? null;
  } catch {
    return { error: "Authentication failed. Please contact support." };
  }

  if (!role) {
    return { error: "Authentication failed. Please contact support." };
  }

  // Compute the authorized portal redirect URL.
  let redirectUrl: string;
  try {
    redirectUrl = getAuthorizedPortalUrl(role);
  } catch {
    return { error: "Authentication failed. Please contact support." };
  }

  return { success: true, redirectUrl };
}
