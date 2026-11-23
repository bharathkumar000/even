import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";

export async function requireAdmin() {
  // Single authenticated session lookup — getUser + profile in one call.
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }

  const user = session.user;
  const profile = session.profile;

  // The profiles table is the canonical source of truth for user roles.
  // Never trust auth metadata (user_metadata.role, app_metadata.role) for
  // authorization decisions, as these can be stale or tampered with.
  if (!profile || profile.role !== "admin") {
    throw new Error("FORBIDDEN: Admin privileges required");
  }

  return { user, profile };
}
