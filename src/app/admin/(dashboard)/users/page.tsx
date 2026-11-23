import { Suspense } from "react";
import { getUsersList, getTeamsHierarchyData, UserProfileItem, TeamHierarchyItem } from "@/app/actions/admin-users";
import { getCachedAdminUsers } from "@/app/actions/cached-admin";
import UsersClientView from "./users-client";
import { Loader2 } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getAuthenticatedUser();
  const user = session.user;

  let initialUsers: UserProfileItem[] = [];
  let initialTeamsHierarchy: TeamHierarchyItem[] = [];

  try {
    const { data } = await getCachedAdminUsers();
    if (data) {
      initialUsers = data.users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        full_name: u.full_name ?? null,
        role: (u.role as any) ?? "participant",
        created_at: new Date().toISOString(),
        team_name: u.team_name ?? null,
        team_role: null,
        username: null,
        phone: null,
      }));
      initialTeamsHierarchy = data.teams.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code ?? null,
        track: t.track ?? null,
        leader_name: t.leader_name ?? null,
        leader: null,
        members: [],
        totalMembersCount: 0,
      }));
    }
  } catch (err) {
    console.error("Failed to load initial users/teams:", err);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Main Client View with Suspense for URL search params */}
      <Suspense
        fallback={
          <div className="min-h-[400px] flex flex-col items-center justify-center border border-border-color bg-surface-color/50 rounded p-8">
            <Loader2 className="w-8 h-8 text-accent-primary animate-spin mb-3" />
            <p className="font-tech text-text-secondary text-sm uppercase tracking-wider">
              Loading user directory...
            </p>
          </div>
        }
      >
        <UsersClientView
          initialUsers={initialUsers}
          initialTeamsHierarchy={initialTeamsHierarchy}
          currentUserEmail={user?.email ?? undefined}
          currentUserId={user?.id ?? undefined}
        />
      </Suspense>
    </div>
  );
}
