import { SkeletonDashboard, SkeletonGrid } from "@/components/ui/skeleton-loader";

export default function OpsScannerLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in font-tech">
      <div className="border-b border-border-color pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="h-4 w-40 bg-surface-color/80 rounded animate-pulse" />
            <div className="h-8 md:h-12 w-80 bg-surface-color/60 rounded animate-pulse" />
            <div className="h-4 w-96 max-w-full bg-surface-color/40 rounded animate-pulse" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="glass-panel p-4 sm:p-6 border border-border-color rounded-lg animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-8 w-40 bg-surface-color rounded" />
            <div className="h-8 w-20 bg-surface-color rounded" />
          </div>
          <div className="relative w-full h-64 bg-surface-color border border-dashed border-border-color rounded animate-pulse" />
        </div>
      </div>

      <div className="space-y-3">
        <SkeletonGrid count={4} />
      </div>
    </div>
  );
}
