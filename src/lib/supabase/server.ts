import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://koluhnkobgagsfvokkbz.supabase.co";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbHVobmtvYmdhZ3Nmdm9ra2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMTUxNjQsImV4cCI6MjEwNjc5MTE2NH0.N-xF0mOVy8_MKNm3ywJZj7w1NqM_gOQ8gIYIp6S_2FA";

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Can be ignored if called from a Server Component and middleware is refreshing sessions
        }
      },
    },
  });
}
