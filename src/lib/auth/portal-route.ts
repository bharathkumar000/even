/**
 * Maps a user's role to their authorized portal URL.
 * Single source of truth for role-to-portal routing.
 */
export function getAuthorizedPortalUrl(role: string | null | undefined): string {
  switch (role?.toLowerCase()) {
    case "admin":
      return "/admin";
    case "judge":
      return "/judge";
    case "staff":
    case "organizer":
    case "spoc":
      return "/ops/scanner";
    case "leader":
    case "participant":
    default:
      return "/team";
  }
}

/**
 * Checks whether a role is authorized to access a given portal path.
 */
export function isAuthorizedForPortal(portalPath: string, role: string | null | undefined): boolean {
  const r = role?.toLowerCase();
  if (portalPath.startsWith("/admin")) return r === "admin";
  if (portalPath.startsWith("/judge")) return r === "judge" || r === "admin";
  if (portalPath.startsWith("/ops")) return r === "staff" || r === "organizer" || r === "spoc" || r === "admin";
  if (portalPath.startsWith("/team")) return r === "leader" || r === "participant" || r === "admin";
  return false;
}
