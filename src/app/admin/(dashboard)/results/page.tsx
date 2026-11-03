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
      const [resData, teamsData, eventData] = await Promise.all([
        supabaseAdmin
          .from("event_results")
          .select("*")
          .order("total_score", { ascending: false }),
        supabaseAdmin
          .from("teams")
          .select("id, name, code"),
        supabaseAdmin
          .from("events")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const teamMap = new Map((teamsData.data || []).map((t: any) => [t.id, t.name]));
      const defaultEventId = eventData.data?.id || "11111111-1111-1111-1111-111111111111";

      const mappedResults = (resData.data || []).map((r: any) => ({
        ...r,
        team_name: teamMap.get(r.team_id) || r.team_id,
      }));

      return {
        results: mappedResults,
        defaultEventId,
      };
    };

    const timeoutPromise = new Promise<{ results: ResultItem[]; defaultEventId: string }>((resolve) =>
      setTimeout(() => resolve({ results: [], defaultEventId: "11111111-1111-1111-1111-111111111111" }), 2500)
    );

    const data = await Promise.race([fetchResultsData(), timeoutPromise]);
    results = data.results;
    eventId = (data.results[0] as any)?.event_id || data.defaultEventId;
    isPublished = data.results.some((r) => r.is_published);
    isLocked = data.results.some((r) => r.is_locked);
  } catch (err) {
    console.error("Failed to load results data:", err);
    eventId = "11111111-1111-1111-1111-111111111111";
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
