"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw, ArrowDown } from "lucide-react";
import { HapticFeedback } from "@/lib/haptic";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  pullThreshold?: number;
  className?: string;
}

export default function PullToRefresh({
  onRefresh,
  children,
  pullThreshold = 70,
  className = "",
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    // Check if at the very top of page / container
    const isAtTop = window.scrollY <= 0 && (!containerRef.current || containerRef.current.scrollTop <= 0);
    if (isAtTop && e.touches[0]) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
      hasTriggeredHapticRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || isRefreshing || !e.touches[0]) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;

    if (deltaY > 0) {
      // Damped drag formula
      const damped = Math.min(110, Math.pow(deltaY, 0.85) * 1.8);
      setPullDistance(damped);

      if (damped >= pullThreshold && !hasTriggeredHapticRef.current) {
        hasTriggeredHapticRef.current = true;
        HapticFeedback.tap();
      } else if (damped < pullThreshold && hasTriggeredHapticRef.current) {
        hasTriggeredHapticRef.current = false;
      }
    } else {
      setPullDistance(0);
      isDraggingRef.current = false;
    }
  };

  const handleTouchEnd = async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(pullThreshold * 0.7);
      HapticFeedback.tap();

      try {
        await Promise.resolve(onRefresh());
      } catch (err) {
        console.warn("Pull-to-refresh error:", err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 400);
      }
    } else {
      setPullDistance(0);
    }
  };

  const readyToRelease = pullDistance >= pullThreshold;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative min-h-full ${className}`}
    >
      {/* Pull down indicator pill */}
      <div
        className="fixed top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-200 flex items-center justify-center"
        style={{
          opacity: pullDistance > 15 || isRefreshing ? 1 : 0,
          transform: `translate(-50%, ${Math.max(0, pullDistance - 20)}px)`,
        }}
      >
        <div className="px-3.5 py-1.5 rounded-full bg-[#0e0e18]/95 border border-accent-secondary/50 text-white shadow-[0_4px_20px_rgba(0,0,0,0.8),0_0_15px_rgba(255,0,127,0.3)] backdrop-blur-md flex items-center gap-2 font-tech text-xs">
          {isRefreshing ? (
            <>
              <RefreshCw size={13} className="text-accent-secondary animate-spin" />
              <span className="text-accent-secondary font-bold uppercase tracking-wider text-[11px]">
                Refreshing live status...
              </span>
            </>
          ) : readyToRelease ? (
            <>
              <RefreshCw size={13} className="text-accent-primary animate-pulse" />
              <span className="text-accent-primary font-bold uppercase tracking-wider text-[11px]">
                Release to refresh
              </span>
            </>
          ) : (
            <>
              <ArrowDown size={13} className="text-text-secondary" />
              <span className="text-text-secondary uppercase tracking-wider text-[11px]">
                Pull down to refresh
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main content translated with spring */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : "none",
          transition: isDraggingRef.current ? "none" : "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

