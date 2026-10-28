"use server";

import { requireTeamLeader } from "@/lib/auth/team";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_EXTENSIONS = [".ppt", ".pptx", ".pdf", ".doc", ".docx"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7; // 7 days

export async function uploadPresentationFile(formData: FormData): Promise<{ fileUrl: string; fileName: string; signedUrl: string }> {
  const teamId = formData.get("team_id") as string;
  const file = formData.get("file") as File | null;

  if (!teamId) {
    throw new Error("Missing team ID");
  }

  // Authorize team leader
  await requireTeamLeader(teamId);

  if (!file || typeof file === "string") {
    throw new Error("No file provided for upload");
  }

  // Check file extension
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

  if (!hasValidExt) {
    throw new Error("Invalid file format. Allowed formats: PPT, PPTX, PDF, DOC, DOCX");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds maximum allowed size of 50MB");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Ensure storage bucket exists
  const bucketName = "team-deliverables";
  const { data: bucketData, error: bucketError } = await supabaseAdmin.storage.getBucket(bucketName);
  if (bucketError || !bucketData) {
    // Attempt auto-create if not present
    await supabaseAdmin.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: 52428800,
    });
  }

  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${teamId}/${Date.now()}_${cleanFileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
  }

  // Generate signed URL for private bucket access
  const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
    .from(bucketName)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error("Signed URL creation error:", signedUrlError);
    throw new Error(`Failed to create signed URL: ${signedUrlError?.message}`);
  }

  return {
    fileUrl: signedUrlData.signedUrl,
    fileName,
    signedUrl: signedUrlData.signedUrl,
  };
}
