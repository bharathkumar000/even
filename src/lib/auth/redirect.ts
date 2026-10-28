import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the appropriate portal redirect URL based on user role and team membership.
 * Features instant metadata resolution, timeout protection against stalling queries,
 * and deterministic fallbacks so the authentication flow never hangs.
 */
export async function getRoleRedirectUrl(
  userOrId: User | string,
  fallbackMetadataRole?: string
): Promise<string> {
  let userId: string;
  let metadataRole: string | undefined = fallbackMetadataRole;

  if (typeof userOrId === "object" && userOrId !== null) {
    userId = userOrId.id;
    metadataRole =
      metadataRole ||
      (userOrId.user_metadata?.role as string | undefined) ||
      (userOrId.app_metadata?.role as string | undefined);
  } else {
    userId = userOrId;
  }

  // Check if logging in on a dedicated portal port
  if (typeof window !== "undefined") {
    const activePort = window.location.port;
    if (activePort === "3001" || activePort === "4001" || activePort === "3011") return "/judge";
    if (activePort === "3002" || activePort === "4002" || activePort === "3012") return "/team";
    if (activePort === "3003" || activePort === "4003" || activePort === "3013") return "/ops/scanner";
  }

  // 1. Instant Fast-Path for Known Roles from Auth Metadata
  if (metadataRole === "admin") {
    return "/admin";
  }
  if (metadataRole === "judge") {
    return "/judge";
  }
  if (metadataRole === "staff" || metadataRole === "organizer" || metadataRole === "spoc") {
    return "/ops/scanner";
  }

  const supabase = createClient();

  // 2. Query public.profiles with a strict 1.5-second timeout safety net
  try {
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        if (error) return null;
        return (data as { role?: string } | null)?.role || null;
      } catch {
        return null;
      }
    };

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1500)
    );

    const fetchedRole = await Promise.race([fetchProfile(), timeoutPromise]);
    const effectiveRole = fetchedRole || metadataRole || "participant";

    switch (effectiveRole) {
      case "admin":
        return "/admin";
      case "judge":
        return "/judge";
        case "staff":
        case "organizer":
        case "spoc":
        return "/ops/scanner";
      case "leader":
      case "participant": {
        return "/team";
      }
      default:
        return "/team";
    }
  } catch (err) {
    console.warn("Profile role resolution error, utilizing safe fallback:", err);
    if (metadataRole === "admin") return "/admin";
    if (metadataRole === "judge") return "/judge";
    if (metadataRole === "staff" || metadataRole === "organizer" || metadataRole === "spoc") return "/ops/scanner";
    return "/team/submission";
  }
}
