import { requireAuthenticatedTeamUser } from "@/lib/auth/team";
import { getActiveSubmissionForm, getSubmissionDraft, getTeamFinalSubmission } from "@/app/actions/team-submissions";
import TeamDynamicSubmissionClientView from "./dynamic-submission-client";

export const dynamic = "force-dynamic";

interface ErrorState {
  type: "auth" | "no_team" | "no_event" | "no_form" | "db_error" | "access_denied";
  message: string;
  title: string;
}

export default async function TeamSubmissionPage() {
  let userId = "";
  let teamId: string | null = null;
  let role = "";

  let authUser: { id: string } | null = null;

  try {
    const { user, teamId: tId, role: r } = await requireAuthenticatedTeamUser();
    userId = user.id;
    teamId = tId;
    role = r;
    authUser = { id: user.id };
  } catch (err) {
    // Re-throw Next.js redirects (NEXT_REDIRECT) so the browser is actually
    // sent to /login instead of rendering a misleading "Authentication Required"
    // card. requireAuthenticatedTeamUser() calls redirect("/login") on every
    // auth failure path; other team routes (/team/results, /team/qr) let this
    // propagate, but this page's broad catch was swallowing it.
    if (
      err != null &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: string }).digest === "string" &&
      (err as { digest?: string }).digest!.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }

    // Non-redirect errors (e.g. unexpected session initialization failure) are
    // surfaced as a session error, never hidden behind "Authentication Required".
    console.error("Team session verification failed:", err);
    const errorState: ErrorState = {
      type: "db_error",
      title: "Session Verification Error",
      message:
        "Unable to verify your session. Please refresh the page or sign in again.",
    };
    return renderErrorState(errorState);
  }

  const effectiveTeamId = teamId;

  if (!effectiveTeamId) {
    const errorState: ErrorState = {
      type: "no_team",
      title: "No Team Association",
      message: "You are not associated with a team. Please contact your team leader or administrator.",
    };
    return renderErrorState(errorState);
  }

  // Get active published submission form for the team's event
  const formData = await getActiveSubmissionForm(effectiveTeamId);

  if (formData.error && formData.errorType) {
    const errorState: ErrorState = {
      type: formData.errorType,
      title: getErrorTitle(formData.errorType),
      message: formData.error,
    };
    return renderErrorState(errorState, { userId, teamId: effectiveTeamId, role });
  }

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
          currentSubmission={currentSubmissionId ? {
            id: currentSubmissionId,
            version: currentVersion || 0,
            status: currentFileRefs && currentFileRefs.length > 0 ? "submitted" : "draft",
            answers: currentAnswers || {},
            file_references: currentFileRefs || [],
            submitted_by: null,
            submitted_at: currentSubmittedAt || "",
            reference_number: currentReferenceNumber || "",
          } : null}
        />
      )}
    </div>
  );
}

function getErrorTitle(type: ErrorState["type"]): string {
  switch (type) {
    case "auth": return "Authentication Required";
    case "no_team": return "No Team Association";
    case "no_event": return "No Active Event";
    case "no_form": return "No Published Form";
    case "db_error": return "Database Error";
    case "access_denied": return "Access Denied";
    default: return "Error";
  }
}

function renderErrorState(
  errorState: ErrorState,
  context?: { userId: string; teamId: string | null; role: string }
): JSX.Element {
  const icons: Record<string, React.ReactNode> = {
    auth: <span className="w-8 h-8 rounded bg-accent-secondary/10 flex items-center justify-center">🔐</span>,
    no_team: <span className="w-8 h-8 rounded bg-status-warning/10 flex items-center justify-center">👥</span>,
    no_event: <span className="w-8 h-8 rounded bg-status-warning/10 flex items-center justify-center">📅</span>,
    no_form: <span className="w-8 h-8 rounded bg-accent-secondary/10 flex items-center justify-center">📝</span>,
    db_error: <span className="w-8 h-8 rounded bg-status-error/10 flex items-center justify-center">⚠️</span>,
    access_denied: <span className="w-8 h-8 rounded bg-status-error/10 flex items-center justify-center">🚫</span>,
  };

  const actionText: Record<string, string> = {
    auth: "Please log in to continue.",
    no_team: "You are not associated with a team. Please contact your team leader or administrator.",
    no_event: "Your team is not associated with an active event. Please contact your administrator.",
    no_form: "No published submission form is available for your event at this time. Please check back later.",
    db_error: "A database error occurred while loading the form. Please try again later.",
    access_denied: "You do not have access to this resource.",
  };

  return (
    <div className="space-y-8 animate-fade-in min-h-[600px] flex flex-col justify-center">
      <div className="glass-panel p-8 border border-border-color rounded-lg text-center max-w-md mx-auto">
        <div className={`w-12 h-12 rounded flex items-center justify-center mx-auto mb-4 ${
          errorState.type === "no_form" ? "bg-accent-secondary/10" :
          errorState.type === "db_error" || errorState.type === "access_denied" ? "bg-status-error/10" :
          "bg-surface-color/40"
        }`}>
          {icons[errorState.type]}
        </div>
        <h2 className="font-heading text-lg text-text-primary uppercase m-0 mb-2">
          {errorState.title}
        </h2>
        <p className="font-tech text-text-secondary text-sm mb-6 leading-relaxed">
          {errorState.message}
        </p>
        {errorState.type === "auth" && (
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-secondary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90"
          >
            <span>Sign In</span>
          </a>
        )}
      </div>
    </div>
  );
}
