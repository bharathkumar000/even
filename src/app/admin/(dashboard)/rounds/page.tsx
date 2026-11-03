import { createClient } from "@/lib/supabase/server";
import RoundsClientView, {
  AdminRoundItem,
  AdminCriterionItem,
} from "./rounds-client";

export const dynamic = "force-dynamic";

export default async function AdminRoundsPage() {
  let rounds: AdminRoundItem[] = [];
  let criteria: AdminCriterionItem[] = [];
  let events: { id: string; title: string }[] = [];

  try {
    const fetchRoundsData = async () => {
      const supabase = await createClient();
      const [roundsRes, criteriaRes, eventsRes] = await Promise.all([
        supabase
          .from("evaluation_rounds")
          .select("*")
          .order("sequence_order", { ascending: true }),
        supabase
          .from("evaluation_criteria")
          .select("*"),
        supabase
          .from("events")
          .select("id, title")
          .order("created_at", { ascending: false }),
      ]);
      return {
        rounds: (roundsRes.data || []) as AdminRoundItem[],
        criteria: (criteriaRes.data || []) as AdminCriterionItem[],
        events: (eventsRes.data || []) as { id: string; title: string }[],
      };
    };

    const timeoutPromise = new Promise<{
      rounds: AdminRoundItem[];
      criteria: AdminCriterionItem[];
      events: { id: string; title: string }[];
    }>((resolve) =>
      setTimeout(
        () =>
          resolve({
            rounds: [],
            criteria: [],
            events: [{ id: "11111111-1111-1111-1111-111111111111", title: "Main Event" }],
          }),
        2500
      )
    );

    const data = await Promise.race([fetchRoundsData(), timeoutPromise]);
    rounds = data.rounds;
    criteria = data.criteria;
    events = data.events;
  } catch (err) {
    console.error("Failed to load rounds/criteria data:", err);
  }

  if (!events || events.length === 0) {
    events = [{ id: "11111111-1111-1111-1111-111111111111", title: "Main Event" }];
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <RoundsClientView
        initialRounds={rounds}
        initialCriteria={criteria}
        initialEvents={events}
      />
    </div>
  );
}
