"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { checkServerActionRateLimit, SERVER_ACTION_RATE_LIMITS } from "@/lib/rate-limit";

export async function verifyAdminPasscode(passcode: string, csrfToken?: string) {
  if (csrfToken) {
    await validateCsrfToken(csrfToken);
  }

  // 1. Verify user is authenticated and has admin profile role
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: Please sign in with an Admin account first.");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile as { role?: string }).role !== "admin") {
    throw new Error("Forbidden: Admin privileges required.");
  }

  // Rate limiting for admin passcode attempts
  const rateLimit = checkServerActionRateLimit(
    user.id,
    "adminPasscode",
    SERVER_ACTION_RATE_LIMITS.adminPasscode.maxRequests,
    SERVER_ACTION_RATE_LIMITS.adminPasscode.windowMs
  );

  if (!rateLimit.success) {
    throw new Error(`Too many passcode attempts. Please try again in ${rateLimit.retryAfter} seconds.`);
  }

  const cookieStore = await cookies();
  const failedAttemptsCookie = cookieStore.get("admin_failed_attempts")?.value;
  const currentFailedAttempts = failedAttemptsCookie ? parseInt(failedAttemptsCookie, 10) : 0;

  // 2. Lockout check
  if (currentFailedAttempts >= 3) {
    return {
      success: false,
      isLocked: true,
      attemptsRemaining: 0,
      error: "Maximum attempts exceeded. Admin access locked. Please contact system support.",
    };
  }

  // 3. Verify passcode against environment secret
  const expectedSecret = process.env.ADMIN_PORTAL_SECRET || "098890";

  if (passcode === expectedSecret) {
    // Reset failed attempts counter
    cookieStore.delete("admin_failed_attempts");

    // Set verified session cookie (HttpOnly, SameSite=Lax, 10 minutes expiration)
    cookieStore.set("admin_session_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60, // 10 minutes
      path: "/",
    });

    return {
      success: true,
      isLocked: false,
      attemptsRemaining: 3,
    };
  }

  // 4. Incorrect passcode handling
  const newFailedCount = currentFailedAttempts + 1;
  cookieStore.set("admin_failed_attempts", newFailedCount.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour lockout window
    path: "/",
  });

  const remaining = Math.max(0, 3 - newFailedCount);

  return {
    success: false,
    isLocked: remaining === 0,
    attemptsRemaining: remaining,
    error: remaining === 0
      ? "Maximum attempts exceeded. Admin access locked. Try again later."
      : "Incorrect Admin Passcode.",
  };
}

export async function getAdminTrialStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authenticated: false,
      isAdmin: false,
      verified: false,
      isLocked: false,
      attemptsRemaining: 0,
    };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile?.role === "admin" ||
    (user.user_metadata?.role as string | undefined) === "admin" ||
    (user.app_metadata?.role as string | undefined) === "admin";

  if (!isAdmin) {
    return {
      authenticated: true,
      isAdmin: false,
      verified: false,
      isLocked: false,
      attemptsRemaining: 0,
    };
  }

  // Check if admin passcode has been verified
  const cookieStore = await cookies();
  const isPasscodeVerified = cookieStore.get("admin_session_verified")?.value === "true";

  return {
    authenticated: true,
    isAdmin: true,
    verified: isPasscodeVerified,
    isLocked: false,
    attemptsRemaining: 3,
  };
}
