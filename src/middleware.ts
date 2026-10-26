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
          response.cookies.set(name, value, options);
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
  } else if (pathname === "/") {
    // Root path is the public landing and central gateway.
    // Unauthenticated visitors and crawlers receive HTTP 200 with public event details.
    // Authenticated users are not forced away so they can view the central gateway and quick-switch portals.
  } else if (pathname === "/login") {
    // Redirect authenticated users away from /login
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const role = (user.user_metadata?.role as string | undefined) || (user.app_metadata?.role as string | undefined);
      let target = "/team";
      if (role === "admin") target = "/admin";
      else if (role === "judge") target = "/judge";
      else if (role === "staff" || role === "organizer") target = "/ops/scanner";
      else if (role === "participant" || role === "leader") target = "/team";

      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  // Apply strict HTTP security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");

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
