/**
 * Legacy role alias mapping for backward compatibility.
 * Maps deprecated role values to their canonical application role.
 */
const LEGACY_ROLE_ALIASES: Record<string, string> = {
  ops: "staff",
  team: "leader",
  spoc: "staff",
};

/**
 * Normalizes a role value by resolving legacy aliases to canonical roles.
 */
export function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  const r = role.toLowerCase().trim();
  return LEGACY_ROLE_ALIASES[r] ?? r;
}

/**
 * Maps a user's role to their authorized portal URL.
 * Single source of truth for role-to-portal routing.
 */
export function getAuthorizedPortalUrl(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case "admin":
      return "/admin";
    case "judge":
      return "/judge";
    case "staff":
    case "spoc":
      return "/ops/scanner";
    case "organizer":
      return "/ops/scanner";
    case "leader":
      return "/team";
    case "participant":
      return "/team";
    default:
      throw new Error(`Unknown role "${role}". Cannot determine authorized portal.`);
  }
}

/**
 * Checks whether a role is authorized to access a given portal path.
 */
export function isAuthorizedForPortal(portalPath: string, role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (portalPath.startsWith("/admin")) return r === "admin";
  if (portalPath.startsWith("/judge")) return r === "judge" || r === "admin";
  if (portalPath.startsWith("/ops")) return r === "staff" || r === "organizer" || r === "admin" || r === "spoc";
  if (portalPath.startsWith("/team")) return r === "leader" || r === "participant" || r === "admin";
  return false;
}
