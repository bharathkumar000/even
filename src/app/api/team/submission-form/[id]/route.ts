import { createClient } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const TYPE_MAP: Record<string, string> = {
  textarea: "long_answer",
  text: "short_answer",
  url: "url",
  email: "email",
  number: "number",
  date: "date",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;

    // Verify team membership
    const { data: membership } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "No team membership" }, { status: 403 });
    }

    // Read the published project submission form (not the legacy submission_forms table)
    const { data: form, error: formError } = await supabaseAdmin
      .from("project_submission_forms")
      .select("*")
      .eq("id", id)
      .eq("form_status", "published")
      .maybeSingle();

    if (formError || !form) {
      return NextResponse.json({ error: "Form not found or not published" }, { status: 404 });
    }

    // Build sections + questions from the JSONB form_config
    const formConfig = form.form_config || {};
    const rawSections = Array.isArray(formConfig.sections) ? formConfig.sections : [];

    const sections = rawSections.map((s: any, sIdx: number) => ({
      id: s.id || `section-${sIdx}`,
      form_id: form.id,
      title: s.title || "Untitled Section",
      description: s.description ?? null,
      sort_order: s.sort_order ?? sIdx,
      is_required: Boolean(s.is_required),
      questions: Array.isArray(s.fields)
        ? s.fields.map((f: any, fIdx: number) => ({
            id: f.id || `field-${sIdx}-${fIdx}`,
            section_id: s.id || `section-${sIdx}`,
            title: f.label || "Untitled Question",
            description: null,
            placeholder: f.placeholder ?? null,
            question_type: TYPE_MAP[f.type] ?? "short_answer",
            is_required: Boolean(f.required),
            sort_order: f.sort_order ?? fIdx,
            default_value: null,
            min_chars: null,
            max_chars: null,
            min_value: null,
            max_value: null,
            max_selections: null,
            max_file_size: null,
            max_attachments: 1,
            allowed_file_types: null,
            validation_rules: f.validation_rules ?? {},
            conditional_visibility: f.conditional_visibility ?? {},
            options: [],
          }))
        : [],
    }));

    return NextResponse.json({
      form: {
        id: form.id,
        title: form.title,
        description: form.description ?? null,
        form_status: form.form_status,
        submission_state: form.submission_state ?? (form.form_status === "published" ? "open" : "not_open"),
        submission_open_at: form.submission_open_at ?? null,
        submission_close_at: form.submission_close_at ?? null,
        timezone: form.timezone ?? "Asia/Kolkata",
        allow_member_submit: Boolean(form.allow_member_submit),
        auto_lock_at_deadline: Boolean(form.auto_lock_at_deadline ?? true),
        max_marks: form.max_marks ?? null,
      },
      sections,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}
