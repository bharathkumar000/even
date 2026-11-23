import { getAuthenticatedUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedUser();
    if (!session.isAuthenticated || !session.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const user = session.user;

    const body = await req.json();
    const { form_id, team_id, answers, file_references } = body;

    // Verify team membership
    const { data: membership } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .eq("team_id", team_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a team member" }, { status: 403 });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("team_submission_drafts")
      .upsert(
        {
          form_id,
          team_id,
          answers: answers || {},
          file_references: file_references || [],
          last_saved_by: user.id,
          last_saved_at: now,
          updated_at: now,
        },
        { onConflict: "form_id, team_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ draft: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save draft" }, { status: 400 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedUser();
    if (!session.isAuthenticated || !session.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const user = session.user;

    const { searchParams } = new URL(req.url);
    const formId = searchParams.get("formId");
    const teamId = searchParams.get("teamId");

    if (!formId || !teamId) {
      return NextResponse.json({ error: "Missing formId or teamId" }, { status: 400 });
    }

    // Verify membership
    const { data: membership } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a team member" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("team_submission_drafts")
      .select("id, form_id, team_id, answers, file_references, last_saved_by, last_saved_at, created_at, updated_at")
      .eq("form_id", formId)
      .eq("team_id", teamId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ draft: data || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load draft" }, { status: 400 });
  }
}
