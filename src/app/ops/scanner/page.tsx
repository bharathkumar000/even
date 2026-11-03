import ScannerClientView from "./scanner-client";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import { getContentForPortal } from "@/app/actions/content-hub";
import AnnouncementBanner from "@/components/AnnouncementBanner";

import RealtimeRoundsListener from "@/components/RealtimeRoundsListener";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Layers, ArrowRight, Sparkles, Shield } from "lucide-react";
import Link from "next/link";
import { ContentActivityHub } from "@/components/content-hub";

export const dynamic = "force-dynamic";

export default async function OpsScannerPage() {
  // Fetch content for ops portal
  let contentItems: any[] = [];
  try {
    const contentData = await getContentForPortal("operations", undefined, undefined, "published", 20);
    contentItems = contentData.items || [];
  } catch (err) {
    console.error("Failed to load content for ops portal:", err);
  }

  const [announcements, roundRes] = await Promise.all([
    getActiveAnnouncements("ops"),
    supabaseAdmin
      .from("evaluation_rounds")
      .select("id, title, sequence_order, status")
      .in("status", ["open", "reopened"])
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const activeRound = roundRes.data;

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      <RealtimeRoundsListener channelName="ops-scanner-rounds" />


      <div className="border-b border-border-color pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="font-tech text-xs uppercase tracking-[3px] text-accent-tertiary font-bold mb-1">
            Logistics Desk // Live Verification
          </p>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
            QR Verification Desk
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
            Scan participant team QR badges using device camera or manual UUID entry to record check-in, kit distribution, lunch, and snack claims.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <Link
            href="/ops/assigned-teams"
            className="glass-panel px-4 py-2.5 border border-accent-secondary/50 hover:border-accent-secondary bg-accent-secondary/10 hover:bg-accent-secondary/20 transition-all flex items-center gap-2.5 rounded"
          >
            <Shield size={16} className="text-accent-secondary" />
            <span className="font-heading text-xs uppercase tracking-wider text-text-primary font-bold">
              My Assigned Teams
            </span>
          </Link>

          {activeRound ? (
            <Link
              href="/ops/rounds"
              className="glass-panel px-4 py-2.5 border border-accent-tertiary/40 hover:border-accent-tertiary transition-all flex items-center gap-3 shrink-0 rounded"
            >
              <div className="p-2 bg-accent-tertiary/10 border border-accent-tertiary/30 rounded text-accent-tertiary">
                <Layers size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                  <p className="font-tech text-[10px] text-accent-tertiary uppercase font-bold m-0">
                    Live Round {activeRound.sequence_order}
                  </p>
                </div>
                <p className="font-heading text-sm text-text-primary uppercase m-0 flex items-center gap-1">
                  {activeRound.title}
                  <ArrowRight size={13} className="text-accent-tertiary" />
                </p>
              </div>
            </Link>
          ) : (
            <Link
              href="/ops/rounds"
              className="glass-panel px-4 py-2.5 border border-border-color text-text-secondary text-xs hover:border-accent-tertiary transition-all shrink-0 flex items-center gap-2 rounded"
            >
              <Layers size={15} />
              <span>View All Rounds</span>
            </Link>
          )}
        </div>
      </div>

      {/* Scanner-first: Scanner interface immediately after header */}
      <ScannerClientView />

      <AnnouncementBanner
        announcements={announcements}
        portalName="Ops Desk"
        audience="ops"
      />

      {/* Content & Activity Hub for Operations */}
      <ContentActivityHub
        portalAudience="operations"
        showFilters={true}
        showSearch={true}
        showCreateButton={false}
        initialItems={[]}
        emptyMessage="No operational content published yet."
        loadingMessage="Loading operational content..."
        errorMessage="Failed to load operational content."
      />
    </div>
  );
}
