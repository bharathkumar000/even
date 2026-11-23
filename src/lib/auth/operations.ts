import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";

export async function requireOperationsRole() {
  // Single authenticated session lookup — getUser + profile in one call.
  const session = await getAuthenticatedUser();
  if (!session.isAuthenticated || !session.user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }

  const user = session.user;
  const profile = session.profile;

  // profiles.role is the canonical source of truth for user roles.
  // Never trust user_metadata.role or app_metadata.role for authorization.
  const role = profile?.role;
  if (!role || !["admin", "staff", "organizer", "spoc"].includes(role)) {
    throw new Error("FORBIDDEN: Operational staff privileges required");
  }

  return { user, profile };
}
