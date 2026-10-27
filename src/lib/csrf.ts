// import { cookies } from "next/headers"; // moved inside functions to avoid client-side import errors
import { createClient } from "@/lib/supabase/server";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generates a secure random CSRF token
 */
function generateToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Gets or creates a CSRF token for the current session
 * The token is stored in a secure, HttpOnly cookie
 */
export async function getCsrfToken(): Promise<string> {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  let token = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!token) {
    token = generateToken();
    cookieStore.set(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
  }

  return token;
}

/**
 * Validates a CSRF token from the request headers
 * Throws an error if validation fails
 */
export async function validateCsrfToken(requestToken: string | null): Promise<void> {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!cookieToken) {
    throw new Error("CSRF token missing from session");
  }

  if (!requestToken) {
    throw new Error("CSRF token missing from request");
  }

  // Use constant-time comparison to prevent timing attacks
  if (cookieToken.length !== requestToken.length) {
    throw new Error("Invalid CSRF token");
  }

  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ requestToken.charCodeAt(i);
  }

  if (result !== 0) {
    throw new Error("Invalid CSRF token");
  }
}

/**
 * Extracts CSRF token from request headers
 */
export function extractCsrfToken(headers: Headers): string | null {
  return headers.get(CSRF_HEADER_NAME);
}

/**
 * Middleware helper to add CSRF token to response headers
 */
export async function addCsrfTokenToResponse(response: Response): Promise<Response> {
  const token = await getCsrfToken();
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(CSRF_HEADER_NAME, token);
  return newResponse;
}

/**
 * Server action wrapper that validates CSRF token before executing
 * Usage: export const myAction = withCsrfProtection(async (data) => { ... });
 */
export function withCsrfProtection<T extends (...args: any[]) => Promise<any>>(
  action: T
): T {
  return (async (...args: any[]) => {
    // The last argument should be the FormData or object containing the CSRF token
    const lastArg = args[args.length - 1];
    let requestToken: string | null = null;

    if (lastArg instanceof FormData) {
      requestToken = lastArg.get(CSRF_HEADER_NAME) as string | null;
    } else if (lastArg && typeof lastArg === "object") {
      requestToken = (lastArg as Record<string, any>)[CSRF_HEADER_NAME] || null;
    }

    await validateCsrfToken(requestToken);
    return action(...args);
  }) as T;
}

/**
 * Creates a CSRF-protected form data object for client-side use
 */
export async function createCsrfFormData(): Promise<FormData> {
  const token = await getCsrfToken();
  const formData = new FormData();
  formData.append(CSRF_HEADER_NAME, token);
  return formData;
}

/**
 * Adds CSRF token to an existing FormData object
 */
export async function addCsrfToFormData(formData: FormData): Promise<FormData> {
  const token = await getCsrfToken();
  formData.append(CSRF_HEADER_NAME, token);
  return formData;
}

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

export const CSRF_CONSTANTS = {
  COOKIE_NAME: CSRF_COOKIE_NAME,
  HEADER_NAME: CSRF_HEADER_NAME,
  TOKEN_LENGTH: CSRF_TOKEN_LENGTH,
} as const;