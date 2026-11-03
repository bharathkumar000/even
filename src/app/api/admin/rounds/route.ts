import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: rounds, error } = await supabase
      .from("evaluation_rounds")
      .select("id, title, sequence_order, status")
      .order("sequence_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rounds: rounds || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
