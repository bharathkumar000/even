import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes HTML content to prevent XSS
 * Only allows safe HTML tags and attributes
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "ol", "ul", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "blockquote", "code", "pre", "a", "span", "div"
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "id"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes plain text input (removes HTML tags)
 */
export function sanitizeText(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
}

/**
 * Sanitizes a string for safe use in SQL (basic protection)
 * Note: Always use parameterized queries instead
 */
export function sanitizeForSql(input: string): string {
  return input.replace(/['";]/g, "").trim();
}

/**
 * Validates and sanitizes a URL
 */
export function sanitizeUrl(input: string): string {
  try {
    const url = new URL(input);
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Sanitizes file name to prevent path traversal
 */
export function sanitizeFileName(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .substring(0, 255);
}

/**
 * Zod schema for sanitized text input
 */
export const SanitizedTextSchema = z.string().transform((val) => sanitizeText(val));

/**
 * Zod schema for sanitized HTML input
 */
export const SanitizedHtmlSchema = z.string().transform((val) => sanitizeHtml(val));

/**
 * Zod schema for safe URL input
 */
export const SafeUrlSchema = z.string().transform((val) => sanitizeUrl(val)).refine(
  (val) => val === "" || val.startsWith("http"),
  { message: "Invalid URL format" }
);

/**
 * Creates a sanitized version of a zod schema
 */
export function createSanitizedSchema(schema: z.ZodString) {
  return schema.transform((val) => sanitizeText(val));
}

/**
 * Validates email format strictly
 */
export const StrictEmailSchema = z.string().email().max(254).toLowerCase();

/**
 * Validates UUID format
 */
export const UuidSchema = z.string().uuid();

/**
 * Validates a positive integer
 */
export const PositiveIntSchema = z.number().int().positive();

/**
 * Validates a non-negative integer
 */
export const NonNegativeIntSchema = z.number().int().nonnegative();

/**
 * Sanitizes an object's string properties recursively
 */
export function sanitizeObject<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T;
  }
  if (!obj || typeof obj !== "object") return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === "string") {
      result[key] = sanitizeText(value);
    } else if (value && typeof value === "object") {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Maximum length limits for common fields
 */
export const FIELD_LIMITS = {
  name: 100,
  email: 254,
  password: 128,
  description: 5000,
  title: 200,
  summary: 1000,
  url: 2048,
  fileName: 255,
  role: 50,
  department: 100,
  phone: 20,
  notes: 2000,
} as const;

/**
 * Creates a length-limited string schema
 */
export function limitedString(maxLength: number, fieldName = "Field") {
  return z.string().max(maxLength, `${fieldName} must be ${maxLength} characters or less`);
}

/**
 * Creates a required length-limited string schema
 */
export function requiredLimitedString(maxLength: number, fieldName = "Field") {
  return z.string().min(1, `${fieldName} is required`).max(maxLength, `${fieldName} must be ${maxLength} characters or less`);
}