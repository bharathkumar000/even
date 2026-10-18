import "server-only";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const DEFAULT_URL = "https://koluhnkobgagsfvokkbz.supabase.co";
  const DEFAULT_SERVICE_ROLE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbHVobmtvYmdhZ3Nmdm9ra2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIxNTE2NCwiZXhwIjoyMTA2NzkxMTY0fQ._9xDTVPPHr0D-ZsPRx2ial9qvGK1YfErp2T8YT7umVw";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabaseAdmin = getAdminClient();
