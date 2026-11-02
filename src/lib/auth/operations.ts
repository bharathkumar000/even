import "server-only";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireOperationsRole() {
  const supabase = await createClient();

  // Use getUser() for secure server-side identity verification.
  // Never trust session.user from getSession() as proof of identity.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized: Authentication required");
  }

  // profiles.role is the canonical source of truth for user roles.
  // Never trust user_metadata.role or app_metadata.role for authorization.
  let profile: { role?: string } | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  } catch {
    // Profile lookup failed; deny access
  }

  const role = profile?.role;
  if (!role || !["admin", "staff", "organizer", "spoc"].includes(role)) {
    throw new Error("Forbidden: Operational staff privileges required");
  }

  return { user, profile };
}
