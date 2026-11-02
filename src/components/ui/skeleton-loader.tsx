"use client";

import React from "react";

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={`animate-pulse glass-panel p-5 border border-border-color rounded-xl ${className}`}
    >
      <div className="space-y-3">
        <div className="h-3 bg-surface-color rounded w-1/3" />
        <div className="h-2 bg-surface-color rounded w-2/3" />
        <div className="h-4 bg-surface-color rounded w-full" />
      </div>
    </div>
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-surface-color rounded"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

interface SkeletonListItemProps {
  className?: string;
}

export function SkeletonListItem({ className }: SkeletonListItemProps) {
  return (
    <div className={`glass-panel p-4 border border-border-color rounded flex items-center gap-3 animate-pulse ${className}`}>
      <div className="w-8 h-8 rounded bg-surface-color shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-surface-color rounded w-1/2" />
        <div className="h-3 bg-surface-color rounded w-3/4" />
      </div>
      <div className="h-8 bg-surface-color rounded shrink-0" />
    </div>
  );
}

interface SkeletonGridProps {
  count?: number;
  className?: string;
}

export function SkeletonGrid({ count = 6, className }: SkeletonGridProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

interface SkeletonDashboardProps {
  className?: string;
}

export function SkeletonDashboard({ className }: SkeletonDashboardProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="border-b border-border-color pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="h-4 bg-surface-color rounded w-1/4" />
            <div className="h-1 bg-surface-color rounded w-2/3 mt-2" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded bg-surface-color shrink-0" />
            <div className="h-10 w-40 rounded bg-surface-color shrink-0" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="space-y-3">
        <div className="h-3 bg-surface-color rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
        </div>
      </div>
    </div>
  );
}
