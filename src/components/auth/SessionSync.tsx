"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * SessionSync monitors cross-tab authentication changes.
 *
 * Supabase Auth uses httpOnly cookies shared across all tabs on the same origin.
 * When a user logs in or out on one tab, the cookies are updated for all tabs,
 * but the client-side Supabase instance in other tabs may not detect the change
 * until the next network request or page interaction.
 *
 * This component listens for storage events (fired when another tab modifies
 * localStorage/sessionStorage) and visibility changes. When a session change
 * is detected, it forces a page refresh to clear stale profile, role, and
 * authorization state.
 */
export default function SessionSync() {
  useEffect(() => {
    const supabase = createClient();
    let lastSessionUser: string | null = null;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const currentUser = data?.session?.user?.id ?? null;
        if (lastSessionUser === null) {
          lastSessionUser = currentUser;
          return;
        }
        if (lastSessionUser !== currentUser) {
          // Session changed across tabs — force full page reload to clear stale state
          lastSessionUser = currentUser;
          window.location.reload();
        }
      } catch {
        // Ignore transient errors
      }
    };

    const handleStorage = () => {
      void checkSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    };

    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initialize baseline
    void checkSession();

    return () => {
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
export { SessionSync };
