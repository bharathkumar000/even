import { getProjectSubmissionFormById } from "@/app/actions/project-submission-forms";
import { requireAdmin } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import { FormBuilderEditor } from "@/components/admin/FormBuilderEditor";

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const { form, error } = await getProjectSubmissionFormById(id);

  if (error || !form) {
    redirect("/admin/submission-forms?error=" + encodeURIComponent(error || "Form not found"));
  }

  return <FormBuilderEditor initialForm={form} />;
}
