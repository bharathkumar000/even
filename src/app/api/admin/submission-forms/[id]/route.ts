import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { z } from "zod";

const UpdateFormSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  round_id: z.string().uuid().optional().nullable(),
  form_status: z.enum(["draft", "scheduled", "published", "unpublished", "archived"]).optional(),
  submission_state: z.enum(["not_open", "open", "closed", "locked"]).optional(),
  timezone: z.string().optional(),
  allow_early_view: z.boolean().optional(),
  allow_draft_before_open: z.boolean().optional(),
  allow_edit_after_submit: z.boolean().optional(),
  allow_resubmission: z.boolean().optional(),
  resubmission_policy: z.enum(["none", "until_deadline", "after_approval"]).optional(),
  auto_lock_at_deadline: z.boolean().optional(),
  allow_member_submit: z.boolean().optional(),
  max_marks: z.number().optional().nullable(),
  view_available_at: z.string().optional().nullable(),
  submission_open_at: z.string().optional().nullable(),
  submission_close_at: z.string().optional().nullable(),
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional().nullable(),
    sort_order: z.number().optional(),
    is_required: z.boolean().optional(),
    questions: z.array(z.object({
      id: z.string(),
      section_id: z.string().optional(),
      title: z.string(),
      description: z.string().optional().nullable(),
      placeholder: z.string().optional().nullable(),
      question_type: z.string(),
      is_required: z.boolean().optional(),
      sort_order: z.number().optional(),
      default_value: z.string().optional().nullable(),
      min_chars: z.number().optional().nullable(),
      max_chars: z.number().optional().nullable(),
      min_value: z.number().optional().nullable(),
      max_value: z.number().optional().nullable(),
      max_selections: z.number().optional().nullable(),
      max_file_size: z.number().optional().nullable(),
      max_attachments: z.number().optional().nullable(),
      allowed_file_types: z.array(z.string()).optional().nullable(),
      validation_rules: z.record(z.string(), z.unknown()).optional(),
      conditional_visibility: z.record(z.string(), z.unknown()).optional(),
      options: z.array(z.object({
        id: z.string().optional(),
        question_id: z.string().optional(),
        option_text: z.string(),
        option_value: z.string(),
        sort_order: z.number().optional(),
      })).optional(),
    })).optional(),
  })).optional(),
  [CSRF_CONSTANTS.HEADER_NAME]: z.string().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const { data: form, error: formError } = await supabaseAdmin
      .from("submission_forms")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (formError) {
      return NextResponse.json({ error: formError.message }, { status: 500 });
    }

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from("form_sections")
      .select("*")
      .eq("form_id", id)
      .order("sort_order", { ascending: true });

    if (sectionsError) {
      return NextResponse.json({ error: sectionsError.message }, { status: 500 });
    }

    const sectionIds = (sections || []).map((s) => s.id);

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("form_questions")
      .select("*")
      .in("section_id", sectionIds)
      .order("sort_order", { ascending: true });

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    const questionIds = (questions || []).map((q) => q.id);

    const { data: options, error: optionsError } = await supabaseAdmin
      .from("form_question_options")
      .select("*")
      .in("question_id", questionIds)
      .order("sort_order", { ascending: true });

    if (optionsError) {
      return NextResponse.json({ error: optionsError.message }, { status: 500 });
    }

    const optionsMap: Record<string, any[]> = {};
    for (const opt of (options || [])) {
      if (!optionsMap[opt.question_id]) optionsMap[opt.question_id] = [];
      optionsMap[opt.question_id].push(opt);
    }

    const questionsWithOptions = (questions || []).map((q) => ({
      ...q,
      options: optionsMap[q.id] || [],
    }));

    const sectionsWithQuestions = (sections || []).map((s) => ({
      ...s,
      questions: questionsWithOptions.filter((q) => q.section_id === s.id),
    }));

    return NextResponse.json({
      form,
      sections: sectionsWithQuestions,
      questions: questionsWithOptions,
      options: optionsMap,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    await validateCsrfToken(body[CSRF_CONSTANTS.HEADER_NAME] || null);

    const validated = UpdateFormSchema.parse(body);

    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.round_id !== undefined) updateData.round_id = validated.round_id;
    if (validated.form_status !== undefined) updateData.form_status = validated.form_status;
    if (validated.submission_state !== undefined) updateData.submission_state = validated.submission_state;
    if (validated.timezone !== undefined) updateData.timezone = validated.timezone;
    if (validated.allow_early_view !== undefined) updateData.allow_early_view = validated.allow_early_view;
    if (validated.allow_draft_before_open !== undefined) updateData.allow_draft_before_open = validated.allow_draft_before_open;
    if (validated.allow_edit_after_submit !== undefined) updateData.allow_edit_after_submit = validated.allow_edit_after_submit;
    if (validated.allow_resubmission !== undefined) updateData.allow_resubmission = validated.allow_resubmission;
    if (validated.resubmission_policy !== undefined) updateData.resubmission_policy = validated.resubmission_policy;
    if (validated.auto_lock_at_deadline !== undefined) updateData.auto_lock_at_deadline = validated.auto_lock_at_deadline;
    if (validated.allow_member_submit !== undefined) updateData.allow_member_submit = validated.allow_member_submit;
    if (validated.max_marks !== undefined) updateData.max_marks = validated.max_marks;
    if (validated.view_available_at !== undefined) updateData.view_available_at = validated.view_available_at;
    if (validated.submission_open_at !== undefined) updateData.submission_open_at = validated.submission_open_at;
    if (validated.submission_close_at !== undefined) updateData.submission_close_at = validated.submission_close_at;

    const { data, error } = await supabaseAdmin
      .from("submission_forms")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process sections if provided in the payload
    if (validated.sections !== undefined) {
      // Delete all existing sections (cascades to questions and options)
      await supabaseAdmin
        .from("form_sections")
        .delete()
        .eq("form_id", id);

      // Insert sections from payload
      const sectionsToInsert = validated.sections.map((s, idx) => ({
        form_id: id,
        title: s.title,
        description: s.description ?? null,
        sort_order: s.sort_order ?? idx,
        is_required: s.is_required ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      if (sectionsToInsert.length > 0) {
        const { data: insertedSections, error: sectionsError } = await supabaseAdmin
          .from("form_sections")
          .insert(sectionsToInsert)
          .select();

        if (sectionsError) {
          return NextResponse.json({ error: sectionsError.message }, { status: 500 });
        }

        // For each section, insert questions and options
        for (let i = 0; i < validated.sections.length; i++) {
          const sectionPayload = validated.sections[i];
          const insertedSection = insertedSections[i];
          const sectionId = insertedSection.id;

          const sectionQuestions = sectionPayload.questions || [];
          const questionsToInsert = sectionQuestions.map((q, qIdx) => ({
            section_id: sectionId,
            title: q.title,
            description: q.description ?? null,
            placeholder: q.placeholder ?? null,
            question_type: q.question_type,
            is_required: q.is_required ?? true,
            sort_order: q.sort_order ?? qIdx,
            default_value: q.default_value ?? null,
            min_chars: q.min_chars ?? null,
            max_chars: q.max_chars ?? null,
            min_value: q.min_value ?? null,
            max_value: q.max_value ?? null,
            max_selections: q.max_selections ?? null,
            max_file_size: q.max_file_size ?? null,
            max_attachments: q.max_attachments ?? 1,
            allowed_file_types: q.allowed_file_types ?? null,
            validation_rules: q.validation_rules ?? {},
            conditional_visibility: q.conditional_visibility ?? {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          if (questionsToInsert.length > 0) {
            const { data: insertedQuestions, error: questionsError } = await supabaseAdmin
              .from("form_questions")
              .insert(questionsToInsert)
              .select();

            if (questionsError) {
              return NextResponse.json({ error: questionsError.message }, { status: 500 });
            }

            // For each question, insert options
            for (let j = 0; j < sectionQuestions.length; j++) {
              const questionPayload = sectionQuestions[j];
              const insertedQuestion = insertedQuestions[j];
              const questionId = insertedQuestion.id;

              const optionsToInsert = (questionPayload.options || []).map((opt, oIdx) => ({
                question_id: questionId,
                option_text: opt.option_text,
                option_value: opt.option_value,
                sort_order: opt.sort_order ?? oIdx,
                created_at: new Date().toISOString(),
              }));

              if (optionsToInsert.length > 0) {
                const { error: optionsError } = await supabaseAdmin
                  .from("form_question_options")
                  .insert(optionsToInsert);

                if (optionsError) {
                  return NextResponse.json({ error: optionsError.message }, { status: 500 });
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ form: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update form" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("submission_forms")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete form" }, { status: 400 });
  }
}
