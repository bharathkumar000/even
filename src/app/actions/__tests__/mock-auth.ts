/**
 * Mock auth module for Relaython scanner tests.
 */

export type MockSession = {
  isAuthenticated: boolean;
  user: { id: string; email: string } | null;
  profile: { role: string; full_name?: string | null } | null;
};

let currentSession: MockSession | null = {
  isAuthenticated: true,
  user: { id: "spoc-user-001", email: "spoc@eventra.example" },
  profile: { role: "spoc", full_name: "Test SPOC Operator" },
};

export function setSession(session: MockSession | null) {
  currentSession = session;
}

export function clearSession() {
  currentSession = null;
}

export async function requireOperationsRole() {
  if (!currentSession?.isAuthenticated || !currentSession.user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }
  const role = currentSession.profile?.role;
  if (!role || !["admin", "staff", "organizer", "spoc"].includes(role)) {
    throw new Error("FORBIDDEN: Operational staff privileges required");
  }
  return { user: currentSession.user, profile: currentSession.profile };
}
