import "server-only";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const DEFAULT_URL = undefined; // Must be provided via env
  const DEFAULT_SERVICE_ROLE_KEY = undefined; // Must be provided via env

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL. Set it in your .env file.");
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY. Set it in your .env file.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabaseAdmin = getAdminClient();
