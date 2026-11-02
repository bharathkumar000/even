import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { getActiveSubmissionForm, getSubmissionDraft, getTeamFinalSubmission } from "@/app/actions/team-submissions";
import TeamDynamicSubmissionClientView from "./dynamic-submission-client";

export const dynamic = "force-dynamic";

export default async function TeamSubmissionPage() {
  const { user, teamId, role } = await requireAuthenticatedTeamUser();

  const effectiveTeamId = teamId;
  const userId = user.id;

  // Get active published submission form for the team's round
  const formData = await getActiveSubmissionForm(effectiveTeamId);

  let formId: string | null = null;
  let formStatus = "draft";
  let submissionState = "not_open";
  let submissionOpenAt: string | null = null;
  let submissionCloseAt: string | null = null;
  let allowMemberSubmit = false;
  let autoLockAtDeadline = true;
  let maxMarks: number | null = null;

  if (formData.form) {
    formId = formData.form.id;
    formStatus = formData.form.form_status || "draft";
    submissionState = formData.form.submission_state || "not_open";
    submissionOpenAt = formData.form.submission_open_at || null;
    submissionCloseAt = formData.form.submission_close_at || null;
    allowMemberSubmit = formData.form.allow_member_submit || false;
    autoLockAtDeadline = formData.form.auto_lock_at_deadline ?? true;
    maxMarks = formData.form.max_marks || null;
  }

  // Determine submission state based on dates
  const now = new Date();
  let isOpen = false;
  let isLocked = false;
  let isNotOpen = true;

  if (submissionState === "open") {
    const openAt = submissionOpenAt ? new Date(submissionOpenAt) : null;
    const closeAt = submissionCloseAt ? new Date(submissionCloseAt) : null;
    if (openAt && now < openAt) {
      isNotOpen = true;
      isOpen = false;
      isLocked = false;
    } else if (closeAt && now > closeAt && autoLockAtDeadline) {
      isNotOpen = false;
      isOpen = false;
      isLocked = true;
    } else {
      isNotOpen = false;
      isOpen = true;
      isLocked = false;
    }
  }

  // Get current submission: check draft first, then final
  let currentSubmissionId: string | null = null;
  let currentVersion: number | null = null;
  let currentSubmittedAt: string | null = null;
  let currentReferenceNumber: string | null = null;
  let currentAnswers: Record<string, unknown> | null = null;
  let currentFileRefs: Record<string, unknown>[] | null = null;

  if (formId) {
    // Check draft first
    const draftRes = await getSubmissionDraft(formId, effectiveTeamId);
    if (draftRes.draft) {
      currentSubmissionId = draftRes.draft.id;
      currentSubmittedAt = draftRes.draft.last_saved_at;
      currentAnswers = draftRes.draft.answers;
      currentFileRefs = draftRes.draft.file_references;
    } else {
      // Check final submission
      const finalRes = await getTeamFinalSubmission(formId, effectiveTeamId);
      if (finalRes.submission) {
        currentSubmissionId = finalRes.submission.id;
        currentVersion = finalRes.submission.version;
        currentSubmittedAt = finalRes.submission.submitted_at;
        currentReferenceNumber = finalRes.submission.reference_number;
        currentAnswers = finalRes.submission.answers;
        currentFileRefs = finalRes.submission.file_references;
      }
    }
  }

  const isLeader = role === "leader" || !teamId;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-border-color pb-6">
        <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
          Team Portal // Deliverables Submission
        </p>
        <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0">
          Project Deliverables
        </h1>
        <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl">
          Submit official project presentation slides and repository links for evaluation.
          {isLeader ? "Only the Team Leader is authorized to submit." : "You can view your team's submission status."}
        </p>
      </div>

      {!formId ? (
        <div className="glass-panel p-8 border border-border-color rounded-lg text-center">
          <p className="font-tech text-text-secondary text-sm">
            No published submission form is available at this time. Please check back later.
          </p>
        </div>
      ) : (
        <TeamDynamicSubmissionClientView
          teamId={effectiveTeamId}
          userId={userId}
          role={role}
          activeRound={null}
          formId={formId}
          formStatus={formStatus}
          submissionState={submissionState}
          submissionOpenAt={submissionOpenAt}
          submissionCloseAt={submissionCloseAt}
          allowMemberSubmit={allowMemberSubmit}
          autoLockAtDeadline={autoLockAtDeadline}
          maxMarks={maxMarks}
          isOpen={isOpen}
          isLocked={isLocked}
          isNotOpen={isNotOpen}
          isLeader={isLeader}
          currentSubmission={{
            id: currentSubmissionId || "",
            version: currentVersion || 0,
            status: currentSubmissionId ? (currentFileRefs ? "submitted" : "draft") : "not_started",
            answers: currentAnswers || {},
            file_references: currentFileRefs || [],
            submitted_by: null,
            submitted_at: currentSubmittedAt || "",
            reference_number: currentReferenceNumber || "",
          }}
        />
      )}
    </div>
  );
}
