import { createClient } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const STORAGE_BUCKET = "submission-attachments";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
  ".csv", ".zip", ".jpg", ".jpeg", ".png", ".webp", ".mp4",
  ".mov", ".avi", ".txt", ".md", ".json",
];

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { draftId, submissionId, questionId, fileName, mimeType, size } = body;

    const ext = fileExtension(fileName);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB limit` },
        { status: 400 }
      );
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `submissions/${Date.now()}-${safeName}`;

    const { data: uploadData, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !uploadData) {
      return NextResponse.json(
        { error: `Failed to prepare upload: ${error?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bucket: STORAGE_BUCKET,
      path: uploadData.path,
      token: uploadData.token,
      signedUrl: uploadData.signedUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Upload preparation failed" }, { status: 400 });
  }
}
