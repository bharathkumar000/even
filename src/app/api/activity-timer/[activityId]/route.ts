import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  const { activityId } = await params;

  if (!activityId) {
    return NextResponse.json({ error: "Missing activityId" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("problem_statements")
      .select("timer_end_time, timer_auto_publish, timer_timezone")
      .eq("id", activityId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ endTime: null, autoPublish: true, timezone: "UTC" });
    }

    return NextResponse.json({
      endTime: data.timer_end_time,
      autoPublish: data.timer_auto_publish ?? true,
      timezone: data.timer_timezone ?? "UTC",
    });
  } catch (e) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}