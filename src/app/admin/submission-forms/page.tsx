import { getProjectSubmissionForms } from "@/app/actions/project-submission-forms";
import { requireAdmin } from "@/lib/auth/admin";
import SubmissionFormsClient from "./submission-forms-client";

export const dynamic = "force-dynamic";

export default async function SubmissionFormsPage() {
  await requireAdmin();

  let forms: any[] = [];
  let errorMsg: string | undefined = undefined;

  try {
    const res = await getProjectSubmissionForms();
    forms = res.forms || [];
    if (res.error) errorMsg = res.error;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Failed to load project submission forms.";
  }

  return (
    <SubmissionFormsClient
      initialForms={forms}
      initialError={errorMsg}
    />
  );
}
