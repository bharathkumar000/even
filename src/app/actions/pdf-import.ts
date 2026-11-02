"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB
const STORAGE_BUCKET = "content-releases";

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  filename: string;
  size: number;
}

export interface PdfImportPreview {
  extractedText: string;
  pageCount: number;
  filename: string;
  fileSize: number;
  fileBuffer: ArrayBuffer;
  mimeType: string;
}

export async function importPdfExtract(
  input: {
    fileBuffer: ArrayBuffer;
    fileName: string;
    fileSize: number;
    mimeType?: string;
    [CSRF_CONSTANTS.HEADER_NAME]?: string;
  }
): Promise<PdfExtractionResult> {
  await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { fileName, fileSize } = input;

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Invalid file format. Only PDF files are accepted.");
  }

  if (fileSize === 0) {
    throw new Error("The PDF file is empty.");
  }

  if (fileSize > MAX_PDF_SIZE) {
    throw new Error("File exceeds maximum allowed size of 50MB.");
  }

  // Dynamic import for server-side PDF.js
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");

  // Configure worker for server-side text extraction
  const workerModule = pdfjsWorker as unknown as { default?: unknown; workerSrc?: string };
  const workerSrc =
    (workerModule.default as string) ||
    (workerModule as any).workerSrc ||
    "";

  if (workerSrc) {
    (pdfjsLib.GlobalWorkerOptions as any).workerSrc = workerSrc;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(input.fileBuffer),
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  let extractedText = "";

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (item as any).str || "")
      .join(" ");
    extractedText += pageText + "\n";
  }

  const trimmedText = extractedText.trim();

  if (!trimmedText) {
    throw new Error(
      "No extractable text found in this PDF. It may be a scanned or image-only document."
    );
  }

  return {
    text: trimmedText,
    pageCount,
    filename: fileName,
    size: fileSize,
  };
}

async function ensureStorageBucket() {
  const { data: bucket } = await supabaseAdmin.storage.getBucket(STORAGE_BUCKET);
  if (bucket) return;

  const { error } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: MAX_PDF_SIZE,
  });

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Failed to prepare content storage: ${error.message}`);
  }
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, 120) || "file";
}

export async function importPdfContent(
  input: {
    fileBuffer: ArrayBuffer;
    fileName: string;
    fileSize: number;
    mimeType?: string;
    activityId: string;
    title?: string;
    summary?: string;
    body?: string;
    domain?: string;
    [CSRF_CONSTANTS.HEADER_NAME]?: string;
  }
): Promise<{
  itemId: string;
  extractedText: string;
  pageCount: number;
  filename: string;
  fileSize: number;
}> {
  await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { fileName, fileSize, activityId, mimeType } = input;

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Invalid file format. Only PDF files are accepted.");
  }

  if (fileSize === 0) {
    throw new Error("The PDF file is empty.");
  }

  if (fileSize > MAX_PDF_SIZE) {
    throw new Error("File exceeds maximum allowed size of 50MB.");
  }

  // Extract text from PDF
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");

  const workerModule = pdfjsWorker as unknown as { default?: unknown; workerSrc?: string };
  const workerSrc =
    (workerModule.default as string) ||
    (workerModule as any).workerSrc ||
    "";

  if (workerSrc) {
    (pdfjsLib.GlobalWorkerOptions as any).workerSrc = workerSrc;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(input.fileBuffer),
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  let extractedText = "";

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (item as any).str || "")
      .join(" ");
    extractedText += pageText + "\n";
  }

  const trimmedText = extractedText.trim();

  if (!trimmedText) {
    throw new Error(
      "No extractable text found in this PDF. It may be a scanned or image-only document."
    );
  }

  // Ensure storage bucket exists
  await ensureStorageBucket();

  const cleanFileName = sanitizeFileName(fileName);
  const filePath = `pdf-imports/${activityId}/${Date.now()}_${cleanFileName}`;

  const buffer = Buffer.from(input.fileBuffer);

  // Upload original PDF to storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: mimeType || "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    // Don't lose extracted text if upload fails - still return the extraction result
    throw new Error(`Failed to upload PDF to storage: ${uploadError.message}`);
  }

  // Use extracted text for body if no body provided
  const body = input.body || trimmedText;

  // Try to extract a title from the first line of the extracted text
  const firstLine = trimmedText.split("\n")[0]?.trim() || "";
  const title = input.title || (firstLine.length > 0 && firstLine.length < 100 ? firstLine : null);

  // Create content item
  const { data: createdItem, error: createError } = await supabaseAdmin
    .from("problem_statements")
    .insert([
      {
        reference_number: null,
        title: title || "Imported PDF Content",
        domain: input.domain || null,
        summary: input.summary?.trim() || null,
        description: body,
        status: "draft",
        resource_links: {
          __hub_item: {
            activity_id: activityId,
            item_type: "problem_statement",
            metadata: {
              source: "pdf_import",
              source_file: fileName,
              page_count: pageCount,
              extracted_text_length: trimmedText.length,
            },
          },
        },
        attachments: [
          {
            id: crypto.randomUUID(),
            name: fileName,
            path: filePath,
            mime_type: mimeType || "application/pdf",
            size: fileSize,
            uploaded_at: new Date().toISOString(),
            uploaded_by: (await requireAdmin()).user.id,
            __hub_file: true,
          },
        ],
        created_by: (await requireAdmin()).user.id,
        updated_by: (await requireAdmin()).user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();

  if (createError) {
    // Try to clean up the uploaded file if item creation fails
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([filePath]);
    throw new Error(`Failed to create content item: ${createError.message}`);
  }

  revalidatePath("/admin/content-releases");

  return {
    itemId: createdItem.id,
    extractedText: trimmedText,
    pageCount,
    filename: fileName,
    fileSize,
  };
}

export async function importPdfContentWithoutStorage(
  input: {
    fileBuffer: ArrayBuffer;
    fileName: string;
    fileSize: number;
    mimeType?: string;
    activityId: string;
    title?: string;
    summary?: string;
    body?: string;
    domain?: string;
    [CSRF_CONSTANTS.HEADER_NAME]?: string;
  }
): Promise<{
  itemId: string;
  extractedText: string;
  pageCount: number;
  filename: string;
  fileSize: number;
  storageUploaded: boolean;
}> {
  await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  const { fileName, fileSize, activityId, mimeType } = input;

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Invalid file format. Only PDF files are accepted.");
  }

  if (fileSize === 0) {
    throw new Error("The PDF file is empty.");
  }

  if (fileSize > MAX_PDF_SIZE) {
    throw new Error("File exceeds maximum allowed size of 50MB.");
  }

  // Extract text from PDF
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");

  const workerModule = pdfjsWorker as unknown as { default?: unknown; workerSrc?: string };
  const workerSrc =
    (workerModule.default as string) ||
    (workerModule as any).workerSrc ||
    "";

  if (workerSrc) {
    (pdfjsLib.GlobalWorkerOptions as any).workerSrc = workerSrc;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(input.fileBuffer),
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  let extractedText = "";

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (item as any).str || "")
      .join(" ");
    extractedText += pageText + "\n";
  }

  const trimmedText = extractedText.trim();

  if (!trimmedText) {
    throw new Error(
      "No extractable text found in this PDF. It may be a scanned or image-only document."
    );
  }

  // Use extracted text for body if no body provided
  const body = input.body || trimmedText;

  // Try to extract a title from the first line of the extracted text
  const firstLine = trimmedText.split("\n")[0]?.trim() || "";
  const title = input.title || (firstLine.length > 0 && firstLine.length < 100 ? firstLine : null);

  let storageUploaded = false;
  let filePath = "";

  // Try to upload original PDF to storage
  try {
    await ensureStorageBucket();
    const cleanFileName = sanitizeFileName(fileName);
    filePath = `pdf-imports/${activityId}/${Date.now()}_${cleanFileName}`;
    const buffer = Buffer.from(input.fileBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: mimeType || "application/pdf",
        upsert: false,
      });

    if (!uploadError) {
      storageUploaded = true;
    }
  } catch {
    // Storage upload failed - continue without attachment
  }

  // Build attachments array
  const attachments: any[] = [];
  if (storageUploaded) {
    attachments.push({
      id: crypto.randomUUID(),
      name: fileName,
      path: filePath,
      mime_type: mimeType || "application/pdf",
      size: fileSize,
      uploaded_at: new Date().toISOString(),
      uploaded_by: (await requireAdmin()).user.id,
      __hub_file: true,
    });
  }

  // Create content item
  const { data: createdItem, error: createError } = await supabaseAdmin
    .from("problem_statements")
    .insert([
      {
        reference_number: null,
        title: title || "Imported PDF Content",
        domain: input.domain || null,
        summary: input.summary?.trim() || null,
        description: body,
        status: "draft",
        resource_links: {
          __hub_item: {
            activity_id: activityId,
            item_type: "problem_statement",
            metadata: {
              source: "pdf_import",
              source_file: fileName,
              page_count: pageCount,
              extracted_text_length: trimmedText.length,
              storage_uploaded: storageUploaded,
            },
          },
        },
        attachments: attachments.length > 0 ? attachments : [],
        created_by: (await requireAdmin()).user.id,
        updated_by: (await requireAdmin()).user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();

  if (createError) {
    // Clean up uploaded file if item creation fails
    if (storageUploaded && filePath) {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([filePath]);
    }
    throw new Error(`Failed to create content item: ${createError.message}`);
  }

  revalidatePath("/admin/content-releases");

  return {
    itemId: createdItem.id,
    extractedText: trimmedText,
    pageCount,
    filename: fileName,
    fileSize,
    storageUploaded,
  };
}
