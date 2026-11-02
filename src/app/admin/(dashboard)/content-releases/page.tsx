import { getContentHubData } from "@/app/actions/admin-content-hub";
import { requireAdmin } from "@/lib/auth/admin";
import ContentHubClientView from "./content-releases-client";

export default async function AdminContentReleasesPage() {
  await requireAdmin();

  const { activities, items, error } = await getContentHubData();

  return (
    <ContentHubClientView
      initialActivities={activities}
      initialItems={items}
      initialError={error}
    />
  );
}
