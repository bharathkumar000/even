import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/csrf-constants";

/**
 * Client-side helper to get CSRF token from cookie
 * Note: This only works if the cookie is not HttpOnly
 * For HttpOnly cookies, the token must be passed via a meta tag or header
 */
export function getClientCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

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
 * Note: This requires the token to be available in a non-HttpOnly cookie
 * For production with HttpOnly cookies, use a server action to get the token
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