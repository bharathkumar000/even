import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const audience = searchParams.get("audience") || "all";
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    // Use the database function for audience-targeted announcements
    const { data, error } = await supabaseAdmin.rpc("get_announcements_for_audience", {
      p_audience: audience,
      p_limit: limit,
    });

    if (error) {
      // Fallback to direct query if RPC fails
      let query = supabaseAdmin
        .from("announcements")
        .select("*")
        .eq("status", "published")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("pin_to_top", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (audience !== "all") {
        query = query.or(`target_audience.eq.all,target_audience.eq.${audience}`);
      }

      const { data: fallbackData, error: fallbackError } = await query;

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }

      return NextResponse.json({ announcements: fallbackData || [] });
    }

    return NextResponse.json({ announcements: data || [] });
  } catch (e) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}