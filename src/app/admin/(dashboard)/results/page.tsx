import { supabaseAdmin } from "@/lib/supabase/admin";
import ResultsClientView, { ResultItem } from "./results-client";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  let results: ResultItem[] = [];
  let isPublished = false;
  let isLocked = false;
  let eventId = ""; // No hardcoded mock event ID

  try {
    const fetchResultsData = async () => {
      const { data } = await supabaseAdmin
        .from("event_results")
        .select("*")
        .order("total_score", { ascending: false });
      return data || [];
    };

    const timeoutPromise = new Promise<ResultItem[]>((resolve) =>
      setTimeout(() => resolve([]), 2500)
    );

    const data = await Promise.race([fetchResultsData(), timeoutPromise]);
if (data && data.length > 0) {
  results = data;
  // Capture the event ID from the first result row (if available)
  eventId = (data[0] as any).event_id || "";
  isPublished = data.some((r) => r.is_published);
  isLocked = data.some((r) => r.is_locked);
}
  } catch (err) {
    console.error("Failed to load results data:", err);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-border-color pb-6">
        <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
          Administration // Tabulation & Finals
        </p>
        <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
          Results Engine
        </h1>
        <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
          Control scoring calculations, freeze standings, and manage the official leaderboard publication state.
        </p>
      </div>

      <ResultsClientView
        eventId={eventId}
        initialResults={results}
        initialIsPublished={isPublished}
        initialIsLocked={isLocked}
      />
    </div>
  );
}
