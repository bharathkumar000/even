import { supabaseAdmin } from "@/lib/supabase/admin";
import RoundsClientView from "./rounds-client";
import type { AdminRoundItem, AdminCriterionItem } from "./rounds-client";
import { getCachedAdminRounds } from "@/app/actions/cached-admin";

export const dynamic = "force-dynamic";

export default async function AdminRoundsPage() {
  let rounds: AdminRoundItem[] = [];
  let criteria: AdminCriterionItem[] = [];
  let events: { id: string; title: string }[] = [];

  try {
    const { data } = await getCachedAdminRounds();
    if (data) {
      rounds = data.rounds.map((r) => ({
        id: r.id,
        title: r.title,
        sequence_order: r.sequence_order,
        status: r.status as any,
        event_id: r.event_id,
      }));
      criteria = data.criteria.map((c) => ({
        id: c.id,
        round_id: c.round_id,
        title: c.title,
        description: c.description,
        max_marks: c.max_marks,
        weightage: c.weightage,
        is_required: c.is_required,
      }));
    }
  } catch (err) {
    console.error("Failed to load rounds/criteria data:", err);
  }

  try {
    const eventsRes = await supabaseAdmin
      .from("events")
      .select("id, title")
      .order("created_at", { ascending: false });
    events = (eventsRes.data || []) as { id: string; title: string }[];
  } catch (err) {
    console.error("Failed to load events:", err);
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
