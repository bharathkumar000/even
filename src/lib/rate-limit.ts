import { NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Checks and increments rate limit for a given key
 * @returns { success: boolean, remaining: number, resetTime: number, retryAfter?: number }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { success: boolean; remaining: number; resetTime: number; retryAfter?: number } {
  const now = Date.now();
  const key = `${config.keyPrefix}:${identifier}`;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // First request or window expired
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Increment count
  entry.count++;
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Creates rate limit headers for response
 */
export function createRateLimitHeaders(
  result: ReturnType<typeof checkRateLimit>
): Record<string, string> {
  return {
    "X-RateLimit-Limit": "100", // Will be overridden by config
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
    ...(result.retryAfter && { "Retry-After": result.retryAfter.toString() }),
  };
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Strict limits for authentication endpoints
  auth: {
    login: { windowMs: 15 * 60 * 1000, maxRequests: 5, keyPrefix: "auth:login" }, // 5 per 15 min
    signup: { windowMs: 60 * 60 * 1000, maxRequests: 3, keyPrefix: "auth:signup" }, // 3 per hour
    passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 2, keyPrefix: "auth:pwd-reset" }, // 2 per hour
    adminPasscode: { windowMs: 60 * 60 * 1000, maxRequests: 3, keyPrefix: "auth:admin-passcode" }, // 3 per hour
  },

  // Moderate limits for API endpoints
  api: {
    standard: { windowMs: 60 * 1000, maxRequests: 60, keyPrefix: "api:standard" }, // 60 per minute
    write: { windowMs: 60 * 1000, maxRequests: 20, keyPrefix: "api:write" }, // 20 per minute
    bulk: { windowMs: 60 * 60 * 1000, maxRequests: 5, keyPrefix: "api:bulk" }, // 5 per hour
  },

  // File upload limits
  upload: { windowMs: 60 * 60 * 1000, maxRequests: 10, keyPrefix: "upload" }, // 10 per hour
} as const;

/**
 * Gets client identifier from request (IP + User Agent for better uniqueness)
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return `${ip}:${userAgent.substring(0, 50)}`;
}

/**
 * Middleware wrapper for API routes with rate limiting
 */
export function withRateLimit<T extends (request: Request, ...args: any[]) => Promise<NextResponse>>(
  handler: T,
  config: RateLimitConfig
): T {
  return (async (request: Request, ...args: any[]) => {
    const identifier = getClientIdentifier(request);
    const result = checkRateLimit(identifier, config);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: createRateLimitHeaders(result),
        }
      );
    }

    const response = await handler(request, ...args);

    // Add rate limit headers to successful responses
    Object.entries(createRateLimitHeaders(result)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }) as T;
}

/**
 * Server action rate limiting (uses user ID instead of IP)
 */
const serverActionRateLimitStore = new Map<string, RateLimitEntry>();

export function checkServerActionRateLimit(
  userId: string,
  actionType: string,
  maxRequests: number,
  windowMs: number
): { success: boolean; remaining: number; resetTime: number; retryAfter?: number } {
  const now = Date.now();
  const key = `server-action:${actionType}:${userId}`;
  const entry = serverActionRateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    const resetTime = now + windowMs;
    serverActionRateLimitStore.set(key, { count: 1, resetTime });
    return { success: true, remaining: maxRequests - 1, resetTime };
  }

  if (entry.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

/**
 * Rate limit configurations for server actions
 */
export const SERVER_ACTION_RATE_LIMITS = {
  adminPasscode: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  userRoleChange: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  bulkOperations: { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  fileUpload: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  problemStatementSelect: { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  teamSubmission: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  evaluationSubmit: { maxRequests: 30, windowMs: 60 * 60 * 1000 }, // 30 per hour
} as const;