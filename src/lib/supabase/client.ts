import { createBrowserClient } from "@supabase/ssr";

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL. Set it in your .env file.");
  }
  if (!supabaseAnonKey) {
    throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY. Set it in your .env file.");
  }

  clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
    },
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  });
  return clientInstance;
}
