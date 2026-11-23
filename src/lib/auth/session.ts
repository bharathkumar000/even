"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateUuid } from "@/lib/auth/uuid";

/**
 * Result of an authenticated session lookup.
 * Contains both the Supabase Auth user and their database profile.
 */
export interface AuthSession {
  user: {
    id: string;
    email: string | null;
    user_metadata: Record<string, any>;
    app_metadata: Record<string, any>;
  } | null;
  profile: {
    role: string;
    full_name: string | null;
  } | null;
  isAuthenticated: boolean;
}

/**
 * Performs a single Supabase getUser() call and fetches the caller's profile
 * from the public.profiles table. This is the canonical server-side identity
 * verification helper. All layouts, pages, and Server Actions that need to
 * know the current user should call this instead of invoking
 * supabase.auth.getUser() directly.
 *
 * Role is always resolved from profiles.role (the database source of truth),
 * never from auth metadata which can be stale or tampered with.
 */
export async function getAuthenticatedUser(): Promise<AuthSession> {
  const session: AuthSession = {
    user: null,
    profile: null,
    isAuthenticated: false,
  };

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return session;
  }

  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch {
    return session;
  }

  if (!user) {
    return session;
  }

  session.user = {
    id: user.id,
    email: user.email ?? null,
    user_metadata: user.user_metadata ?? {},
    app_metadata: user.app_metadata ?? {},
  };
  session.isAuthenticated = true;

  // Fetch profile from the database — canonical source of truth for roles.
  try {
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profileData) {
      session.profile = {
        role: profileData.role,
        full_name: profileData.full_name ?? null,
      };
    }
  } catch {
    // Profile lookup failure does not clear authentication;
    // callers should handle missing profile separately.
  }

  return session;
}

/**
 * Validates that the current user is authenticated and has one of the allowed
 * roles. Throws a descriptive error otherwise.
 */
export async function requireAuthenticatedUser(allowedRoles?: string[]): Promise<AuthSession> {
  const session = await getAuthenticatedUser();

  if (!session.isAuthenticated || !session.user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const role = session.profile?.role;
    if (!role || !allowedRoles.includes(role)) {
      throw new Error(`FORBIDDEN: One of roles [${allowedRoles.join(", ")}] required`);
    }
  }

  return session;
}

/**
 * Validates that the current user's profile role matches the expected role.
 * Never trusts user_metadata or app_metadata for authorization.
 */
export async function requireRole(expectedRole: string): Promise<AuthSession> {
  return requireAuthenticatedUser([expectedRole]);
}

/**
 * Validates that the current user is an admin.
 */
export async function requireAdminUser(): Promise<AuthSession> {
  return requireRole("admin");
}

/**
 * Validates that the current user is a judge or admin.
 */
export async function requireJudgeOrAdminUser(): Promise<AuthSession> {
  return requireAuthenticatedUser(["judge", "admin"]);
}

/**
 * Validates that the current user is a judge, admin, or staff/organizer.
 */
export async function requireOperationsUser(): Promise<AuthSession> {
  return requireAuthenticatedUser(["admin", "staff", "organizer", "spoc"]);
}

/**
 * Validates that the current user is a team leader, participant, or admin.
 */
export async function requireTeamUser(): Promise<AuthSession> {
  return requireAuthenticatedUser(["admin", "leader", "participant"]);
}
