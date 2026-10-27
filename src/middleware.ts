import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL. Set it in your .env file.");
  }
  if (!supabaseAnonKey) {
    throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY. Set it in your .env file.");
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
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

  // Refresh auth session only when session cookies exist
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.includes("-auth-token") || c.name.startsWith("sb-")
  );

  if (hasAuthCookie) {
    try {
      await supabase.auth.getUser();
    } catch {
      // Ignore network timeout on invalid or expired token
    }
  }

  const pathname = request.nextUrl.pathname;

  const host = request.headers.get("host") || "";
  const port = request.nextUrl.port || host.split(":")[1] || "";

  // Handle direct /ops root path navigation cleanly
  if (pathname === "/ops") {
    return NextResponse.redirect(new URL("/ops/scanner", request.url));
  }

  // Port-specific isolation and auto-routing
  const isJudgePort = port === "3001" || port === "4001" || port === "3011";
  const isTeamPort = port === "3002" || port === "4002" || port === "3012";
  const isOpsPort = port === "3003" || port === "4003" || port === "3013";

  if (isJudgePort) {
    // Dedicated Judge Portal Port
    if (pathname === "/") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.redirect(new URL("/login", request.url));
      return NextResponse.redirect(new URL("/judge", request.url));
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/team") || pathname.startsWith("/ops")) {
      return NextResponse.redirect(new URL("/judge", request.url));
    }
  } else if (isTeamPort) {
    // Dedicated Team Lead & Participant Portal Port
    if (pathname === "/") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.redirect(new URL("/login", request.url));
      return NextResponse.redirect(new URL("/team", request.url));
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/judge") || pathname.startsWith("/ops")) {
      return NextResponse.redirect(new URL("/team", request.url));
    }
  } else if (isOpsPort) {
    // Dedicated Operations / Scanner Port
    if (pathname === "/") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.redirect(new URL("/login", request.url));
      return NextResponse.redirect(new URL("/ops/scanner", request.url));
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/judge") || pathname.startsWith("/team")) {
      return NextResponse.redirect(new URL("/ops/scanner", request.url));
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
