"use client";

import { useState } from "react";
import {
  Lock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { upsertTeamSubmission } from "@/app/actions/team-submission";

import SubmissionForm from "@/components/team/SubmissionForm";

export interface ActiveRoundInfo {
  id: string;
  title: string;
  sequence_order?: number;
  status?: string;
}

export interface CurrentSubmissionInfo {
  id?: string;
  problem_statement?: string | null;
  problem_description?: string | null;
  proposed_solution?: string | null;
  solution_description?: string | null;
  ppt_url?: string | null;
  github_url?: string | null;
  pitch_deck_url?: string | null;
  prototype_url?: string | null;
  additional_material_url?: string | null;
  submitted_at?: string | null;
}

export default function TeamSubmissionClientView({
  teamId,
  activeRound,
  currentSubmission,
  isLocked,
  isLeader,
  finalHoursOpen,
}: {
  teamId: string;
  activeRound: ActiveRoundInfo | null;
  currentSubmission: CurrentSubmissionInfo | null;
  isLocked: boolean;
  isLeader: boolean;
  finalHoursOpen: boolean;
}) {
  const [problemStatement, setProblemStatement] = useState(currentSubmission?.problem_statement || "");
  const [problemDescription, setProblemDescription] = useState(currentSubmission?.problem_description || "");
  const [proposedSolution, setProposedSolution] = useState(currentSubmission?.proposed_solution || "");
  const [solutionDescription, setSolutionDescription] = useState(currentSubmission?.solution_description || "");
  const [pptUrl, setPptUrl] = useState(currentSubmission?.ppt_url || "");


  const [githubUrl, setGithubUrl] = useState(currentSubmission?.github_url || "");
  const [pitchDeckUrl, setPitchDeckUrl] = useState(currentSubmission?.pitch_deck_url || "");
  const [prototypeUrl, setPrototypeUrl] = useState(currentSubmission?.prototype_url || "");
  const [additionalUrl, setAdditionalUrl] = useState(currentSubmission?.additional_material_url || "");

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRound?.id) {
      setErrorMsg("No active round available for submission.");
      return;
    }

    if (!problemStatement.trim()) {
      setErrorMsg("Please provide your Problem Statement.");
      return;
    }

    if (!problemDescription.trim()) {
      setErrorMsg("Please provide your Problem Description.");
      return;
    }

    if (!proposedSolution.trim()) {
      setErrorMsg("Please provide your Proposed Solution.");
      return;
    }

    if (!solutionDescription.trim()) {
      setErrorMsg("Please provide your Solution Description.");
      return;
    }

    if (!pptUrl) {
      setErrorMsg("Please provide a Canva PPT link before submitting.");
      return;
    }

    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await upsertTeamSubmission({
        team_id: teamId,
        round_id: activeRound.id,
        problem_statement: problemStatement.trim(),
        problem_description: problemDescription.trim(),
        proposed_solution: proposedSolution.trim(),
        solution_description: solutionDescription.trim(),
        ppt_url: pptUrl,
        github_url: githubUrl,
        pitch_deck_url: pitchDeckUrl,
        prototype_url: prototypeUrl,
        additional_material_url: additionalUrl,
      });

      setSuccessMsg("Team deliverables successfully updated and submitted for evaluation!");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit deliverables");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Final Hours locked notice */}
      {!finalHoursOpen && (
        <div className="p-4 bg-status-warning/15 border border-status-warning text-status-warning font-tech text-sm rounded">
          <h2 className="text-2xl font-heading text-status-warning mb-2">Project Submission Is Not Open Yet</h2>
          <p>Final project submission will become available when the event administrator opens the Final Hours window.</p>
        </div>
      )}

      {/* Round & Lock Status Header */}
      <div className="glass-panel p-4 border border-border-color flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="font-tech text-xs uppercase tracking-wider text-text-secondary font-bold">
            Target Round
          </span>
          <p className="font-heading text-lg text-accent-secondary uppercase m-0 mt-0.5">
            {activeRound?.title || "Evaluation Stage"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLocked ? (
            <span className="px-3 py-1 bg-status-error/15 border border-status-error text-status-error font-tech text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Lock size={14} /> SUBMISSIONS LOCKED
            </span>
          ) : (
            <span className="px-3 py-1 bg-status-success/15 border border-status-success text-status-success font-tech text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={14} /> OPEN FOR SUBMISSION
            </span>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div className="p-4 bg-status-success/15 border border-status-success text-status-success font-tech text-xs flex items-center gap-2">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-status-error/15 border border-status-error text-status-error font-tech text-xs flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {!isLeader && (
        <div className="p-4 bg-status-warning/15 border border-status-warning text-status-warning font-tech text-xs flex items-center gap-2">
          <AlertCircle size={18} />
          <span>You are viewing in read-only mode. Only the designated Team Leader can submit or modify deliverables.</span>
        </div>
      )}

      <SubmissionForm
        problemStatement={problemStatement}
        problemDescription={problemDescription}
        proposedSolution={proposedSolution}
        solutionDescription={solutionDescription}
        onProblemStatementChange={setProblemStatement}
        onProblemDescriptionChange={setProblemDescription}
        onProposedSolutionChange={setProposedSolution}
        onSolutionDescriptionChange={setSolutionDescription}
        pptUrl={pptUrl}
        githubUrl={githubUrl}
        pitchDeckUrl={pitchDeckUrl}
        prototypeUrl={prototypeUrl}
        additionalUrl={additionalUrl}
        isLocked={isLocked}
        isLeader={isLeader}
        loading={loading}
        onPptChange={setPptUrl}
        onGithubChange={setGithubUrl}
        onPitchDeckChange={setPitchDeckUrl}
        onPrototypeChange={setPrototypeUrl}
        onAdditionalChange={setAdditionalUrl}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
