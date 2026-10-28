import "server-only";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireOperationsRole() {
  const supabase = await createClient();

  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData?.session?.user;

  if (!user) {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      throw new Error("Unauthorized: Authentication required");
    }
    user = userData.user;
  }

  // Fast-path: Check metadata first
  const metaRole =
    (user.user_metadata?.role as string | undefined) ||
    (user.app_metadata?.role as string | undefined);

  if (metaRole && ["admin", "staff", "organizer", "spoc"].includes(metaRole)) {
    return { user, profile: { role: metaRole } };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || metaRole;
  if (!role || !["admin", "staff", "organizer", "spoc"].includes(role)) {
    throw new Error("Forbidden: Operational staff privileges required");
  }

  return { user, profile };
}
