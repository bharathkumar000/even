import { createClient } from "@/lib/supabase/client";
import { getAuthorizedPortalUrl } from "@/lib/auth/portal-route";
import type { User } from "@supabase/supabase-js";

type ProfileQueryResult = {
  data: { id: string; role: string } | null;
  error: { code?: string; message: string; details?: string } | null;
  role: string | null;
};

/**
 * Resolves the appropriate portal redirect URL based on user role and team membership.
 * The profiles table is the canonical source of truth for user roles.
 * Never trust client-side auth metadata (user_metadata/app_metadata) for authorization.
 *
 * @param userOrId - The authenticated Supabase User object or their UUID string.
 * @param supabase - Optional pre-authenticated Supabase client (reuses existing session).
 *                   If omitted, a new browser client is created.
 */
export async function getRoleRedirectUrl(
  userOrId: User | string,
  supabase?: ReturnType<typeof createClient>
): Promise<string> {
  let userId: string;
  let userEmail: string | undefined;

  if (typeof userOrId === "object" && userOrId !== null) {
    userId = userOrId.id;
    userEmail = userOrId.email;
  } else {
    userId = userOrId;
  }

  // DIAGNOSTIC LOGGING (temporary)
  console.log("[AUTH] getRoleRedirectUrl start:", {
    userId,
    user_email: userEmail,
    hasProvidedClient: !!supabase,
  });

  // Use the provided client if available (reuses authenticated session),
  // otherwise create a new browser client.
  const sb = supabase ?? createClient();

  // Verify the authenticated user via getUser (server-side secure method).
  // Never trust session.user from getSession() as proof of identity.
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized: Authentication required");
  }

  // Use the verified user's ID for subsequent lookups.
  userId = user.id;
  userEmail = user.email;

  // 1. Query public.profiles with the authenticated user's UUID.
  let fetchedRole: string | null = null;
  let profileQueryResult: ProfileQueryResult | null = null;
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle() as unknown as {
      data: { id: string; role: string } | null;
      error: { code?: string; message: string; details?: string } | null;
    };

    profileQueryResult = {
      data,
      error,
      role: data?.role ?? null,
    };
    fetchedRole = data?.role ?? null;

    // DIAGNOSTIC LOGGING (temporary)
    console.log("[AUTH] Profile query result:", {
      userId,
      profile_id: data?.id ?? null,
      profile_role: data?.role ?? null,
      fetchedRole,
      error_code: error?.code ?? null,
      error_message: error?.message ?? null,
      error_details: (error as { details?: string })?.details ?? null,
    });
  } catch (err: unknown) {
    profileQueryResult = {
      data: null,
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
      role: null,
    };

    // DIAGNOSTIC LOGGING (temporary)
    console.log("[AUTH] Profile query exception:", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Distinguish failure modes:
  //    - Database/query error → throw with actual error details
  //    - Profile not found (no row) → throw "Profile not found"
  //    - Unsupported role → throw with role details
  if (profileQueryResult?.error) {
    throw new Error(
      `Profile query failed: ${profileQueryResult.error.message}`
    );
  }

  if (!fetchedRole) {
    throw new Error(
      "Profile not found. Your account may not have a profile record. Please contact support."
    );
  }

  // 3. Resolve portal using the fetched role via getAuthorizedPortalUrl.
  // This is the single source of truth for role-to-portal routing.
  // Roles are not inferred from team membership.
  let redirectUrl: string;
  try {
    redirectUrl = getAuthorizedPortalUrl(fetchedRole);
  } catch (err) {
    throw new Error(
      `Unsupported role "${fetchedRole}". Please contact support.`
    );
  }

  // DIAGNOSTIC LOGGING (temporary)
  console.log("[AUTH] Role resolution complete:", {
    userId,
    user_email: userEmail,
    profile_role: fetchedRole,
    redirectUrl,
  });

  return redirectUrl;
}
