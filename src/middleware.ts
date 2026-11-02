import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthorizedPortalUrl, normalizeRole } from "@/lib/auth/portal-route";

const PROTECTED_PREFIXES = [
  "/admin",
  "/judge",
  "/team",
  "/ops",
];
const AUTH_COOKIE_PREFIXES = ["-auth-token", "sb-"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host") || "";
  const port = request.nextUrl.port || host.split(":")[1] || "";

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Ensure CSRF token cookie is present for all sessions and API/Action calls
  if (!request.cookies.has("csrf_token")) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const csrfToken = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
    response.cookies.set("csrf_token", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  // Determine if this is a protected portal path
  const isProtectedPortal = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // Only initialize Supabase client for protected routes or auth-related paths
  let supabase: ReturnType<typeof createServerClient> | null = null;
  let userRole: string | null = null;
  let hasAuthCookie = false;

  if (isProtectedPortal || pathname === "/" || pathname === "/login") {
    supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
            });
          });
        },
      },
    });

    const allCookies = request.cookies.getAll();
    hasAuthCookie = allCookies.some(
      (c) => c.name.includes("-auth-token") || c.name.startsWith("sb-")
    );

    // Resolve the authenticated user's role from Supabase for portal authorization.
    // profiles.role is the canonical source of truth.
    // JWT metadata (user_metadata.role, app_metadata.role) is NOT authoritative
    // and must not be used for authorization decisions.
    if (hasAuthCookie) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user && !error) {
          // 1. Canonical: Query profiles table by user UUID (not email)
          let profileRole: string | null = null;
          let profileQueryError: { code?: string; message?: string; details?: string; hint?: string } | null = null;
          let profileQueryData: { role?: string } | null = null;
          try {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();

            if (profileError) {
              profileQueryError = {
                code: (profileError as { code?: string })?.code,
                message: profileError.message,
                details: (profileError as { details?: string })?.details,
                hint: (profileError as { hint?: string })?.hint,
              };
            } else {
              profileQueryData = profile as { role?: string } | null;
              profileRole = (profile as { role?: string } | null)?.role || null;
            }
          } catch (err: unknown) {
            profileQueryError = {
              message: err instanceof Error ? err.message : String(err),
            };
          }

          // DIAGNOSTIC LOGGING (temporary) — capture actual Supabase error
          console.log("[AUTH] Profile query debug:", {
            userId: user.id,
            user_email: user.email,
            hasData: !!profileQueryData,
            data: profileQueryData,
            error_code: profileQueryError?.code ?? null,
            error_message: profileQueryError?.message ?? null,
            error_details: profileQueryError?.details ?? null,
            error_hint: profileQueryError?.hint ?? null,
          });

          // Use profiles.role exclusively; do not fall back to metadata.
          if (profileRole) {
            userRole = normalizeRole(profileRole);
          } else {
            userRole = null;
          }

          // DIAGNOSTIC LOGGING (temporary)
          console.log("[AUTH] Middleware role resolution:", {
            userId: user.id,
            user_email: user.email,
            profileRole,
            normalizedRole: userRole,
            pathname,
          });
        }
      } catch {
        // Role stays null; authorization will deny access below
      }
    }
  }

  // Handle direct /ops root path navigation cleanly
  if (pathname === "/ops") {
    return NextResponse.redirect(new URL("/ops/scanner", request.url));
  }

  // Port-specific isolation and auto-routing
  const isJudgePort = port === "3001" || port === "4001" || port === "3011";
  const isTeamPort = port === "3002" || port === "4002" || port === "3012";
  const isOpsPort = port === "3003" || port === "4003" || port === "3013";

  // Protect portal paths: unauthenticated users cannot access them directly
  if (isProtectedPortal && !hasAuthCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If authenticated but role cannot be determined, deny access
  if (isProtectedPortal && hasAuthCookie && !userRole) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isJudgePort) {
    if (pathname === "/") {
      if (!hasAuthCookie) return NextResponse.redirect(new URL("/login", request.url));
      if (userRole) {
        try {
          return NextResponse.redirect(new URL(getAuthorizedPortalUrl(userRole), request.url));
        } catch {
          return NextResponse.redirect(new URL("/login", request.url));
        }
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/team") || pathname.startsWith("/ops")) {
      if (userRole) {
        try {
          return NextResponse.redirect(new URL(getAuthorizedPortalUrl(userRole), request.url));
        } catch {
          return NextResponse.redirect(new URL("/login", request.url));
        }
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } else if (isTeamPort) {
    if (pathname === "/") {
      if (!hasAuthCookie) return NextResponse.redirect(new URL("/login", request.url));
      if (userRole) {
        try {
          return NextResponse.redirect(new URL(getAuthorizedPortalUrl(userRole), request.url));
        } catch {
          return NextResponse.redirect(new URL("/login", request.url));
        }
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/judge") || pathname.startsWith("/ops")) {
      if (userRole) {
        try {
          return NextResponse.redirect(new URL(getAuthorizedPortalUrl(userRole), request.url));
        } catch {
          return NextResponse.redirect(new URL("/login", request.url));
        }
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } else if (isOpsPort) {
    if (pathname === "/") {
      if (!hasAuthCookie) return NextResponse.redirect(new URL("/login", request.url));
      if (userRole) {
        try {
          return NextResponse.redirect(new URL(getAuthorizedPortalUrl(userRole), request.url));
        } catch {
          return NextResponse.redirect(new URL("/login", request.url));
        }
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/judge") || pathname.startsWith("/team")) {
      if (userRole) {
        try {
          return NextResponse.redirect(new URL(getAuthorizedPortalUrl(userRole), request.url));
        } catch {
          return NextResponse.redirect(new URL("/login", request.url));
        }
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } else if (pathname === "/" || pathname === "/login") {
    // Both / and /login directly serve the unified authentication portal
  }

  // Apply strict HTTP security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Prevent indexing of private, dashboard, and administrative portals
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/judge") ||
    pathname.startsWith("/team") ||
    pathname.startsWith("/ops") ||
    pathname.startsWith("/participants") ||
    pathname.startsWith("/judges") ||
    pathname.startsWith("/event-details") ||
    pathname === "/login" ||
    pathname === "/signup"
  ) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  // Ensure CSRF token cookie is present
  if (!request.cookies.has("csrf_token")) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const csrfToken = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
    response.cookies.set("csrf_token", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images and assets (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
