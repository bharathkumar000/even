import { SkeletonDashboard } from "@/components/ui/skeleton-loader";

export default function TeamLoadingSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in font-tech">
      <PitchAlertListenerSkeleton />
      <div className="border-b border-border-color pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="h-4 w-40 bg-surface-color/80 rounded animate-pulse" />
            <div className="h-8 md:h-12 w-80 bg-surface-color/60 rounded animate-pulse" />
            <div className="h-4 w-96 max-w-full bg-surface-color/40 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded bg-surface-color shrink-0" />
            <div className="h-10 w-40 rounded bg-surface-color shrink-0" />
          </div>
        </div>
      </div>
      <SkeletonDashboard />
    </div>
  );
}

function PitchAlertListenerSkeleton() {
  return (
    <div className="glass-panel p-4 border border-border-color rounded-lg animate-pulse">
      <div className="h-4 w-1/3 bg-surface-color rounded" />
    </div>
  );
}
