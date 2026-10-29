import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, CSRF_TOKEN_LENGTH } from "@/lib/csrf-constants";

/**
 * Client-side helper to get CSRF token from meta tag or cookie
 * Priority: meta tag (set by server) > cookie (for backward compatibility)
 */
export function getClientCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  // First try to get from meta tag (injected by server layout)
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag && metaTag.getAttribute("content")) {
    return metaTag.getAttribute("content");
  }

  // Fallback: try to read from cookie (if not HttpOnly)
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Client-side helper to add CSRF token to fetch headers
 */
export function addCsrfToHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const token = getClientCsrfToken();
  if (token) {
    headers[CSRF_HEADER_NAME] = token;
  }
  return headers;
}

/**
 * Creates a CSRF-protected FormData object for client-side use
 */
export function createClientCsrfFormData(): FormData {
  const token = getClientCsrfToken();
  const formData = new FormData();
  if (token) {
    formData.append(CSRF_HEADER_NAME, token);
  }
  return formData;
}

/**
 * Adds CSRF token to an existing FormData object (client-side)
 */
export function addCsrfToFormData(formData: FormData): FormData {
  const token = getClientCsrfToken();
  if (token) {
    formData.append(CSRF_HEADER_NAME, token);
  }
  return formData;
}

/**
 * Helper to add CSRF token to server action arguments
 * Usage: const data = { spocId, teamIds, ...withCsrfToken() };
 */
export function withCsrfToken(): Record<string, string> {
  const token = getClientCsrfToken();
  if (token) {
    return { [CSRF_HEADER_NAME]: token };
  }
  return {};
}

// Re-export constants for convenience
export { CSRF_HEADER_NAME, CSRF_COOKIE_NAME, CSRF_TOKEN_LENGTH };