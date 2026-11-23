/**
 * Validates a UUID string before it is used in a database query.
 * Returns null if the value is missing or invalid, so callers can
 * return a clear application error instead of letting PostgreSQL
 * reject a malformed UUID.
 */
export function validateUuid(value: string | null | undefined, fieldName = "id"): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(trimmed)) {
    return null;
  }
  return trimmed;
}
