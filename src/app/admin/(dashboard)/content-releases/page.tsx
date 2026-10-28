import { Suspense } from "react";
import { getContentHubData } from "@/app/actions/admin-content-hub";
import ContentHubClientView from "./content-releases-client";
import { Loader2, FolderKanban } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminContentReleasesPage() {
  const data = await getContentHubData();

  return (
    <div className="space-y-8 animate-fade-in font-tech">
      <div className="border-b border-border-color pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent-secondary animate-pulse" />
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold m-0">
              Administration // Content Operations
            </p>
          </div>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
            <FolderKanban className="w-8 h-8 md:w-10 md:h-10 text-accent-secondary" />
            Content &amp; Activity Hub
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-3xl m-0">
            Create release activities, draft and preview content, attach files,
            publish to teams, and keep a complete publication history.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="min-h-[400px] flex flex-col items-center justify-center border border-border-color bg-surface-color/50 rounded p-8">
            <Loader2 className="w-8 h-8 text-accent-secondary animate-spin mb-3" />
            <p className="font-tech text-text-secondary text-sm uppercase tracking-wider">
              Loading content activities and releases…
            </p>
          </div>
        }
      >
        <ContentHubClientView
          initialActivities={data.activities}
          initialItems={data.items}
          initialError={data.error}
        />
      </Suspense>
    </div>
  );
}
