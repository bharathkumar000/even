import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { z } from "zod";

const CreateFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  round_id: z.string().uuid().optional().nullable(),
  form_status: z.enum(["draft", "scheduled", "published", "unpublished", "archived"]).default("draft"),
  submission_state: z.enum(["not_open", "open", "closed", "locked"]).default("not_open"),
  timezone: z.string().default("Asia/Kolkata"),
  allow_early_view: z.boolean().default(false),
  allow_draft_before_open: z.boolean().default(false),
  allow_edit_after_submit: z.boolean().default(false),
  allow_resubmission: z.boolean().default(false),
  resubmission_policy: z.enum(["none", "until_deadline", "after_approval"]).default("none"),
  auto_lock_at_deadline: z.boolean().default(true),
  allow_member_submit: z.boolean().default(false),
  max_marks: z.number().optional().nullable(),
  view_available_at: z.string().optional().nullable(),
  submission_open_at: z.string().optional().nullable(),
  submission_close_at: z.string().optional().nullable(),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from("submission_forms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ forms: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin();
    const body = await req.json();
    await validateCsrfToken(body[CSRF_CONSTANTS.HEADER_NAME] || null);

    const validated = CreateFormSchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from("submission_forms")
      .insert([
        {
          title: validated.title,
          description: validated.description || null,
          round_id: validated.round_id || null,
          form_status: validated.form_status,
          submission_state: validated.submission_state,
          timezone: validated.timezone,
          allow_early_view: validated.allow_early_view,
          allow_draft_before_open: validated.allow_draft_before_open,
          allow_edit_after_submit: validated.allow_edit_after_submit,
          allow_resubmission: validated.allow_resubmission,
          resubmission_policy: validated.resubmission_policy,
          auto_lock_at_deadline: validated.auto_lock_at_deadline,
          allow_member_submit: validated.allow_member_submit,
          max_marks: validated.max_marks ?? null,
          view_available_at: validated.view_available_at || null,
          submission_open_at: validated.submission_open_at || null,
          submission_close_at: validated.submission_close_at || null,
          created_by: user.id,
          updated_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ form: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create form" }, { status: 400 });
  }
}
