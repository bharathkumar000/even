import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/admin",
  "/judge",
  "/team",
  "/ops",
];

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

  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.includes("-auth-token") || c.name.startsWith("sb-")
  );

  // Immediate 0ms redirect for unauthenticated users accessing protected portals
  if (isProtectedPortal && !hasAuthCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Handle direct /ops root path navigation cleanly
  if (pathname === "/ops") {
    return NextResponse.redirect(new URL("/ops/scanner", request.url));
  }

  // Refresh auth session only when accessing protected portals with session cookies
  if (isProtectedPortal && hasAuthCookie) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
        global: {
          fetch: (url: RequestInfo | URL, options?: RequestInit) => {
            const timeoutSignal = AbortSignal.timeout(2500);
            const signal = options?.signal
              ? AbortSignal.any([options.signal, timeoutSignal])
              : timeoutSignal;
            return fetch(url, { ...options, signal });
          },
        },
      });

      // Quick non-blocking session touch
      await Promise.race([
        supabase.auth.getUser(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), 2500)),
      ]);
    } catch {
      // Non-blocking: page layouts and server components verify authentication directly
    }
  }

  // Port-specific isolation and auto-routing (Local Development only)
  const isJudgePort = port === "3001" || port === "4001" || port === "3011";
  const isTeamPort = port === "3002" || port === "4002" || port === "3012";
  const isOpsPort = port === "3003" || port === "4003" || port === "3013";

  if (isJudgePort) {
    if (pathname === "/") {
      if (!hasAuthCookie) return NextResponse.redirect(new URL("/login", request.url));
      return NextResponse.redirect(new URL("/judge", request.url));
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/team") || pathname.startsWith("/ops")) {
      return NextResponse.redirect(new URL("/judge", request.url));
    }
  } else if (isTeamPort) {
    if (pathname === "/") {
      if (!hasAuthCookie) return NextResponse.redirect(new URL("/login", request.url));
      return NextResponse.redirect(new URL("/team", request.url));
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/judge") || pathname.startsWith("/ops")) {
      return NextResponse.redirect(new URL("/team", request.url));
    }
  } else if (isOpsPort) {
    if (pathname === "/") {
      if (!hasAuthCookie) return NextResponse.redirect(new URL("/login", request.url));
      return NextResponse.redirect(new URL("/ops/scanner", request.url));
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/judge") || pathname.startsWith("/team")) {
      return NextResponse.redirect(new URL("/ops/scanner", request.url));
    }
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
