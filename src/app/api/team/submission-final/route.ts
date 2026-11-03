import { createClient } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { form_id, team_id, answers, file_references } = body;

    // Verify team membership
    const { data: membership } = await supabaseAdmin
      .from("team_members")
      .select("role")
      .eq("team_id", team_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a team member" }, { status: 403 });
    }

    // Check form state
    const { data: form } = await supabaseAdmin
      .from("project_submission_forms")
      .select("form_status, submission_state, submission_close_at, auto_lock_at_deadline, allow_member_submit, resubmission_policy")
      .eq("id", form_id)
      .maybeSingle();

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.form_status !== "published") {
      return NextResponse.json({ error: "Submissions are not open" }, { status: 400 });
    }

    const now = new Date();
    if (form.submission_close_at && new Date(form.submission_close_at) < now && form.auto_lock_at_deadline) {
      return NextResponse.json({ error: "Submission deadline has passed" }, { status: 400 });
    }

    if (!form.allow_member_submit && membership.role !== "leader") {
      return NextResponse.json({ error: "Only team leader can submit" }, { status: 403 });
    }

    // Check existing submission
    const { data: existing } = await supabaseAdmin
      .from("team_submission_final")
      .select("id, version")
      .eq("form_id", form_id)
      .eq("team_id", team_id)
      .maybeSingle();

    let newVersion = 1;
    if (existing) {
      if (form.resubmission_policy === "none") {
        return NextResponse.json({ error: "Resubmission not allowed" }, { status: 400 });
      }
      newVersion = existing.version + 1;

      // Archive existing version
      const { data: existingFull } = await supabaseAdmin
        .from("team_submission_final")
        .select("*")
        .eq("id", existing.id)
        .maybeSingle();

      if (existingFull) {
        await supabaseAdmin
          .from("submission_versions")
          .insert([
            {
              submission_id: existing.id,
              version: existingFull.version,
              answers: existingFull.answers,
              file_references: existingFull.file_references,
              submitted_by: existingFull.submitted_by,
              submitted_at: existingFull.submitted_at,
            },
          ]);
      }
    }

    const referenceNumber = `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const nowISO = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("team_submission_final")
      .upsert(
        {
          form_id,
          team_id,
          version: newVersion,
          status: "submitted",
          answers: answers || {},
          file_references: file_references || [],
          submitted_by: user.id,
          submitted_at: nowISO,
          reference_number: referenceNumber,
          updated_at: nowISO,
        },
        { onConflict: "form_id, team_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Clear draft
    await supabaseAdmin
      .from("team_submission_drafts")
      .delete()
      .eq("form_id", form_id)
      .eq("team_id", team_id);

    return NextResponse.json({ submission: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Submission failed" }, { status: 400 });
  }
}
