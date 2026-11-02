import "server-only";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireAdmin() {
  const supabase = await createClient();

  // Use getUser() instead of getSession() for secure server-side auth verification
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    throw new Error("Unauthorized: Authentication required");
  }
  const user = userData.user;

  // The profiles table is the canonical source of truth for user roles.
  // Never trust auth metadata (user_metadata.role, app_metadata.role) for
  // authorization decisions, as these can be stale or tampered with.
  let profile: { role?: string } | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  } catch (err) {
    // Profile query error is distinct from authentication failure.
    // Re-throw as a clear error rather than silently denying access.
    throw new Error(
      "Failed to verify admin privileges. Please contact support."
    );
    // Note: Do not default to metadata; missing profile = authorization failure.
  }

  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    throw new Error("Forbidden: Admin privileges required");
  }

  return { user, profile };
}
