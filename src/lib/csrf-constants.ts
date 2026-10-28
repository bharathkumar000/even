export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_TOKEN_LENGTH = 32;

export const CSRF_CONSTANTS = {
  COOKIE_NAME: CSRF_COOKIE_NAME,
  HEADER_NAME: CSRF_HEADER_NAME,
  TOKEN_LENGTH: CSRF_TOKEN_LENGTH,
} as const;