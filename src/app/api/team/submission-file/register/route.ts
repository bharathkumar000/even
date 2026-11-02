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
    const { draftId, submissionId, questionId, fileName, filePath, mimeType, size } = body;

    const { data, error } = await supabaseAdmin
      .from("submission_attachments")
      .insert([
        {
          draft_id: draftId || null,
          submission_id: submissionId || null,
          question_id: questionId || null,
          file_name: fileName,
          file_path: filePath,
          mime_type: mimeType || null,
          size_bytes: size,
          uploaded_by: user.id,
          is_final: !!submissionId,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attachment: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to register attachment" }, { status: 400 });
  }
}
