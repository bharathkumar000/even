"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Github,
  ExternalLink,
  Presentation,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Clock,
  Megaphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { saveOrSubmitEvaluation } from "@/app/actions/judge-evaluation";
import ScoringSlider from "@/components/judge/ScoringSlider";
import PitchTimer from "@/components/judge/PitchTimer";
import { createClient } from "@/lib/supabase/client";
import {
  saveOfflineDraft,
  getOfflineDraft,
  deleteOfflineDraft,
} from "@/lib/offline-storage";

export interface TeamDetail {
  id: string;
  name: string;
  code?: string | null;
  leader_name?: string | null;
  leader_email?: string | null;
  track?: string | null;
  member_count?: number | null;
}

export interface SubmissionDetail {
  id: string;
  team_id: string;
  problem_statement?: string | null;
  problem_description?: string | null;
  proposed_solution?: string | null;
  solution_description?: string | null;
  ppt_url?: string | null;
  github_url?: string | null;
  pitch_deck_url?: string | null;
  prototype_url?: string | null;
  additional_url?: string | null;
  demo_url?: string | null;
}

export interface ActiveRoundDetail {
  id: string;
  title: string;
  status: string;
  sequence_order: number;
}

export interface CriterionDetail {
  id: string;
  round_id: string;
  title: string;
  description?: string | null;
  max_marks: number;
}

export interface ExistingEvaluationDetail {
  id?: string;
  feedback?: string | null;
  status?: string;
  scores_breakdown?: Array<{ criterion_id: string; score: number }> | null;
}

export default function EvaluateClientView({
  teamId,
  team,
  submission,
  activeRound,
  criteria,
  existingEvaluation,
}: {
  teamId: string;
  team: TeamDetail | null;
  submission: SubmissionDetail | null;
  activeRound: ActiveRoundDetail | null;
  criteria: CriterionDetail[];
  existingEvaluation: ExistingEvaluationDetail | null;
}) {
  // Prepopulate existing scores or set empty
  const initialScores: Record<string, number> = {};
  if (existingEvaluation?.scores_breakdown && Array.isArray(existingEvaluation.scores_breakdown)) {
    for (const item of existingEvaluation.scores_breakdown) {
      if (item.criterion_id) {
        initialScores[item.criterion_id] = item.score;
      }
    }
  }

  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [feedback, setFeedback] = useState<string>(existingEvaluation?.feedback || "");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draftRestoredMsg, setDraftRestoredMsg] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pitchCalling, setPitchCalling] = useState(false);
  const [pitchCallSent, setPitchCallSent] = useState(false);

  const isLocked = existingEvaluation?.status === "locked";
  const draftKey = `ivc_draft_${activeRound?.id || "noround"}_${teamId}`;

  // Check localStorage for timer toggle preference on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedTimerPref = localStorage.getItem("ivc_judge_show_timer");
      if (savedTimerPref === "true") {
        setShowTimer(true);
      }
    } catch {}
  }, []);

  // Network status detection & offline sync listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync draft to cloud if we have active round and scores
      if (activeRound?.id) {
        getOfflineDraft(draftKey).then((saved) => {
          if (saved?.data?.scores && Object.keys(saved.data.scores).length > 0) {
            setDraftRestoredMsg("Back online: Ready to sync scores to cloud.");
          }
        });
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [activeRound?.id, draftKey]);

  // Check IndexedDB + localStorage for unsaved drafts on mount if not already submitted
  useEffect(() => {
    if (typeof window === "undefined" || isLocked || existingEvaluation?.status === "submitted") return;
    getOfflineDraft(draftKey).then((saved) => {
      if (saved && saved.data) {
        const draftContent = saved.data;
        if (draftContent.scores && Object.keys(draftContent.scores).length > 0) {
          setScores(draftContent.scores);
          if (draftContent.feedback) setFeedback(draftContent.feedback);
          const timeAgo = Math.round((Date.now() - (saved.savedAt || Date.now())) / 60000);
          setDraftRestoredMsg(`Recovered offline draft from IndexedDB (${timeAgo < 1 ? "just now" : `${timeAgo}m ago`})`);
        }
      }
    });
  }, [draftKey, isLocked, existingEvaluation?.status]);

  // Auto-save in-progress draft to IndexedDB and localStorage
  useEffect(() => {
    if (typeof window === "undefined" || isLocked || existingEvaluation?.status === "submitted") return;
    const hasScores = Object.values(scores).some((val) => val > 0);
    if (hasScores || feedback.trim().length > 0) {
      saveOfflineDraft(draftKey, {
        scores,
        feedback,
      });
    }
  }, [scores, feedback, draftKey, isLocked, existingEvaluation?.status]);

  const clearLocalDraft = async () => {
    await deleteOfflineDraft(draftKey);
    setScores(initialScores);
    setFeedback(existingEvaluation?.feedback || "");
    setDraftRestoredMsg(null);
  };

  const callTeamToPitch = async () => {
    try {
      setPitchCalling(true);
      const supabase = createClient();
      const channel = supabase.channel("team-pitch-alerts");
      await channel.send({
        type: "broadcast",
        event: "pitch_call",
        payload: {
          team_id: teamId,
          team_name: team?.name || `Team ${teamId.slice(0, 8)}`,
          round_title: activeRound?.title || "Active Round",
          track: team?.track || "Innovation Track",
          timestamp: Date.now(),
        },
      });
      setPitchCallSent(true);
      setTimeout(() => setPitchCallSent(false), 5000);
    } catch (err) {
      console.warn("Pitch call broadcast notice:", err);
    } finally {
      setPitchCalling(false);
    }
  };

  const totalScore = criteria.reduce((sum, c) => sum + (scores[c.id] || 0), 0);
  const maxPossibleScore = criteria.reduce((sum, c) => sum + (c.max_marks || 0), 0);

  const handleScoreChange = (criterionId: string, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(val, max));
    setScores((prev) => ({ ...prev, [criterionId]: clamped }));
  };

  const handleSave = async (isDraft: boolean) => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const scoreItems = criteria.map((c) => ({
        criterion_id: c.id,
        score: scores[c.id] || 0,
      }));

      if (!activeRound) {
        throw new Error("No active evaluation round found");
      }

      if (!isDraft && scoreItems.length === 0) {
        throw new Error("Cannot submit evaluation without scoring criteria");
      }

      await saveOrSubmitEvaluation({
        round_id: activeRound.id,
        team_id: teamId,
        scores: scoreItems,
        feedback,
        is_draft: isDraft,
      });

      if (!isDraft) {
        await deleteOfflineDraft(draftKey);
        setDraftRestoredMsg(null);
      }

      setSuccessMsg(
        isDraft
          ? "Draft saved successfully to cloud."
          : "Evaluation officially submitted and recorded!"
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to process evaluation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/judge"
          className="inline-flex items-center gap-1.5 font-tech text-xs uppercase text-text-secondary hover:text-text-primary mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Assigned Teams</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-color pb-6">
          <div>
            <span className="font-tech text-xs uppercase tracking-[2px] text-accent-secondary font-bold">
              {team?.track || "INNOVATION TRACK"}
            </span>
            <h1 className="text-3xl md:text-4xl font-heading text-text-primary uppercase m-0 mt-1">
              {team?.name || `Team ${teamId.slice(0, 8)}`}
            </h1>
            <p className="font-tech text-xs text-text-secondary mt-1 m-0">
              Leader: <span className="text-text-primary">{team?.leader_name || "N/A"}</span> | Members:{" "}
              <span className="text-text-primary">{team?.member_count || 4}</span>
            </p>
          </div>

          <div className="glass-panel px-4 py-2 border border-accent-primary/40 text-right">
            <span className="font-tech text-[10px] text-text-secondary uppercase font-bold block">
              Active Round
            </span>
            <span className="font-heading text-sm text-accent-primary uppercase">
              {activeRound?.title || "Preliminary Round"}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {draftRestoredMsg && (
        <div className="p-3 bg-accent-secondary/15 border border-accent-secondary text-accent-secondary font-tech text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            <span>{draftRestoredMsg}</span>
          </div>
          <button
            onClick={clearLocalDraft}
            className="flex items-center gap-1 text-[11px] uppercase underline hover:text-text-primary transition-colors"
          >
            <RotateCcw size={12} />
            <span>Discard Draft</span>
          </button>
        </div>
      )}

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

      {/* Pitch Timekeeper & Operations Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 glass-panel border border-border-color bg-surface-color/60 rounded">
        <div className="flex flex-wrap items-center gap-2.5">
          <Clock size={16} className={showTimer ? "text-accent-secondary" : "text-text-secondary"} />
          <span className="font-tech text-xs uppercase tracking-wider text-text-primary font-bold">
            Live Presentation & Q&A Pitch Timekeeper
          </span>
          <span className={`text-[10px] font-tech uppercase px-1.5 py-0.5 rounded border font-bold ${
            showTimer ? "border-accent-secondary/50 text-accent-secondary bg-accent-secondary/10" : "border-border-color text-text-secondary"
          }`}>
            {showTimer ? "Active" : "Hidden"}
          </span>

          {/* Network State Chip */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-tech uppercase font-bold border ${
            isOnline ? "border-status-success/40 text-status-success bg-status-success/10" : "border-status-warning/40 text-status-warning bg-status-warning/10"
          }`}>
            {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span>{isOnline ? "Online (Auto-Sync)" : "Offline (IndexedDB Active)"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pitch Call Alert Button */}
          <button
            type="button"
            onClick={callTeamToPitch}
            disabled={pitchCalling || pitchCallSent}
            className={`flex items-center gap-1.5 px-3 py-1 font-tech text-xs uppercase font-bold tracking-wider rounded border transition-colors ${
              pitchCallSent
                ? "border-status-success bg-status-success/20 text-status-success"
                : "border-accent-primary bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30"
            }`}
          >
            <Megaphone size={13} />
            <span>{pitchCallSent ? "Team Notified!" : pitchCalling ? "Calling..." : "Call Team to Pitch"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !showTimer;
              setShowTimer(next);
              try {
                localStorage.setItem("ivc_judge_show_timer", String(next));
              } catch {}
            }}
            className={`px-3 py-1 font-tech text-xs uppercase font-bold tracking-wider rounded border transition-colors ${
              showTimer
                ? "border-border-color bg-surface-color-light text-text-secondary hover:text-text-primary"
                : "border-accent-secondary bg-accent-secondary/20 text-accent-secondary hover:bg-accent-secondary/30"
            }`}
          >
            {showTimer ? "Hide Pitch Timer" : "Launch Pitch Timer"}
          </button>
        </div>
      </div>

      {showTimer && (
        <div className="space-y-3">
          <PitchTimer initialSeconds={300} />
        </div>
      )}


      {/* Submission Assets Panel */}
      <div className="glass-panel p-6 border border-border-color space-y-6">
        <h2 className="font-heading text-lg text-text-primary uppercase m-0 flex items-center gap-2">
          <Presentation className="text-accent-tertiary" size={20} />
          Team Submission & Deliverables
        </h2>

        {/* Problem Statement & Proposed Solution */}
        {(submission?.problem_statement || submission?.proposed_solution) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-color/60 border border-border-color">
            <div className="space-y-1">
              <span className="font-tech text-[10px] text-accent-secondary uppercase font-bold tracking-wider">
                Problem Statement
              </span>
              <p className="font-heading text-sm text-text-primary uppercase m-0">
                {submission.problem_statement}
              </p>
              {submission.problem_description && (
                <p className="font-tech text-xs text-text-secondary mt-1">
                  {submission.problem_description}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <span className="font-tech text-[10px] text-accent-primary uppercase font-bold tracking-wider">
                Proposed Solution
              </span>
              <p className="font-heading text-sm text-text-primary uppercase m-0">
                {submission.proposed_solution}
              </p>
              {submission.solution_description && (
                <p className="font-tech text-xs text-text-secondary mt-1">
                  {submission.solution_description}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* PPT Link */}
          <div className="p-4 bg-surface-color-light/40 border border-border-color flex flex-col justify-between">
            <div>
              <span className="font-tech text-[10px] text-accent-primary uppercase font-bold block mb-1">
                Mandatory Deck
              </span>
              <p className="font-heading text-sm text-text-primary uppercase m-0 flex items-center gap-1.5">
                <FileText size={16} className="text-accent-primary" />
                Presentation File
              </p>
            </div>
            <div className="pt-4 mt-2">
              <a
                href={submission?.ppt_url || "#"}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1.5 font-tech text-xs text-accent-primary hover:underline font-bold uppercase"
              >
                <span>Open / Download File</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* GitHub Repo */}
          <div className="p-4 bg-surface-color-light/40 border border-border-color flex flex-col justify-between">
            <div>
              <span className="font-tech text-[10px] text-text-secondary uppercase font-bold block mb-1">
                Source Code
              </span>
              <p className="font-heading text-sm text-text-primary uppercase m-0 flex items-center gap-1.5">
                <Github size={16} />
                GitHub Repository
              </p>
            </div>
            <div className="pt-4 mt-2">
              {submission?.github_url ? (
                <a
                  href={submission.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-tech text-xs text-text-primary hover:text-accent-secondary font-bold uppercase"
                >
                  <span>Open Repo</span>
                  <ExternalLink size={13} />
                </a>
              ) : (
                <span className="font-tech text-xs text-text-secondary italic">Not provided</span>
              )}
            </div>
          </div>

          {/* Live Prototype */}
          <div className="p-4 bg-surface-color-light/40 border border-border-color flex flex-col justify-between">
            <div>
              <span className="font-tech text-[10px] text-text-secondary uppercase font-bold block mb-1">
                Interactive Demo
              </span>
              <p className="font-heading text-sm text-text-primary uppercase m-0 flex items-center gap-1.5">
                <ExternalLink size={16} className="text-accent-secondary" />
                Live Demo / Prototype
              </p>
            </div>
            <div className="pt-4 mt-2">
              {submission?.demo_url ? (
                <a
                  href={submission.demo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-tech text-xs text-accent-secondary hover:underline font-bold uppercase"
                >
                  <span>Launch Demo</span>
                  <ExternalLink size={13} />
                </a>
              ) : (
                <span className="font-tech text-xs text-text-secondary italic">Not provided</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scoring Form */}
      <div className="glass-panel p-6 border border-border-color space-y-6">
        <div className="flex items-center justify-between border-b border-border-color pb-4">
          <div>
            <h2 className="font-heading text-xl text-text-primary uppercase m-0">
              Evaluation Rubric
            </h2>
            <p className="font-tech text-xs text-text-secondary m-0 mt-0.5">
              Score each criterion within its bounded range.
            </p>
          </div>

          <div className="text-right">
            <span className="font-tech text-xs text-text-secondary uppercase block">
              Cumulative Score
            </span>
            <span className="font-heading text-2xl text-accent-primary">
              {totalScore} / {maxPossibleScore} PTS
            </span>
          </div>
        </div>

        {criteria.length === 0 ? (
          <p className="font-tech text-xs text-text-secondary italic p-4 text-center">
            No evaluation criteria configured for this round.
          </p>
        ) : (
          <div className="space-y-6">
            {criteria.map((criterion, idx) => (
              <ScoringSlider
                key={criterion.id}
                index={idx}
                criterionId={criterion.id}
                criterionTitle={criterion.title}
                description={criterion.description ?? undefined}
                maxMarks={criterion.max_marks}
                value={scores[criterion.id] ?? 0}
                disabled={isLocked}
                onChange={handleScoreChange}
              />
            ))}

            {/* Qualitative Feedback */}
            <div className="space-y-2 pt-2">
              <label className="block font-tech text-xs uppercase tracking-wider text-text-secondary font-bold">
                Judge Qualitative Feedback (Optional)
              </label>
              <textarea
                value={feedback}
                disabled={isLocked}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide constructive feedback, strengths, and areas for improvement..."
                className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-xs font-sans tracking-normal h-24 focus:border-accent-secondary outline-none"
              />
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border-color">
          <p className="font-tech text-xs text-text-secondary m-0">
            {isLocked
              ? "This evaluation is locked by administrator. Modifications are disabled."
              : "Drafts can be adjusted anytime before round locking."}
          </p>

          {!isLocked && (
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-surface-color-light border border-border-color hover:border-text-secondary text-text-primary font-tech font-bold uppercase text-xs transition-colors"
              >
                <Save size={15} />
                Save Draft
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent-secondary hover:bg-accent-secondary/80 text-white font-tech font-bold uppercase text-xs transition-colors shadow-lg shadow-accent-secondary/20"
              >
                <Send size={15} />
                Submit Final Evaluation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
