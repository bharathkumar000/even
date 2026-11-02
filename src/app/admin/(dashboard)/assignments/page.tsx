import { Suspense } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Loader2 } from "lucide-react";
import AssignmentsClientView from "./assignments-client";

export const dynamic = "force-dynamic";

interface RoundOption {
  id: string;
  title: string;
}

export default async function AdminAssignmentsPage() {
  // Default to the first evaluation round so the grid has data immediately.
  let defaultRoundId = "";
  let rounds: RoundOption[] = [];
  try {
    const roundsRes = await supabaseAdmin
      .from("evaluation_rounds")
      .select("id, title, sequence_order")
      .order("sequence_order", { ascending: true });
    rounds = (roundsRes.data || []).map((r) => ({ id: r.id, title: r.title }));
    if (rounds[0]) defaultRoundId = rounds[0].id;
  } catch {
    rounds = [];
    defaultRoundId = "";
  }

  return (
    <div className="space-y-8 animate-fade-in font-tech">
      {/* Header */}
      <div className="border-b border-border-color pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent-secondary animate-pulse" />
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold m-0">
              Administration // Evaluation Operations
            </p>
          </div>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
            Judge Assignments
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl m-0">
            Allocate up to two distinct judges per team per evaluation round. Each judge submits an
            independent evaluation out of 50; the combined score is out of 100.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="min-h-[400px] flex flex-col items-center justify-center border border-border-color bg-surface-color/50 rounded p-8">
            <Loader2 className="w-8 h-8 text-accent-primary animate-spin mb-3" />
            <p className="font-tech text-text-secondary text-sm uppercase tracking-wider">
              Loading assignment matrix…
            </p>
          </div>
        }
      >
        <AssignmentsClientView defaultRoundId={defaultRoundId} rounds={rounds} />
      </Suspense>
    </div>
  );
}
