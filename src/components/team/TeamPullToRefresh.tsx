"use client";

import React from "react";
import { useRouter } from "next/navigation";
import PullToRefresh from "@/components/mobile/PullToRefresh";

export default function TeamPullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleRefresh = async () => {
    router.refresh();
    // Allow brief duration for Next.js server action/RSC pipeline to finish re-fetching
    await new Promise((resolve) => setTimeout(resolve, 750));
  };

  return <PullToRefresh onRefresh={handleRefresh}>{children}</PullToRefresh>;
}
