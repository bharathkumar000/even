"use client";

import React from "react";
import {
  Github,
  Presentation,
  Laptop,
  FolderPlus,
  Upload,
} from "lucide-react";

interface SubmissionFormProps {
  problemStatement: string;
  problemDescription: string;
  proposedSolution: string;
  solutionDescription: string;
  pptUrl: string;
  onProblemStatementChange: (v: string) => void;
  onProblemDescriptionChange: (v: string) => void;
  onProposedSolutionChange: (v: string) => void;
  onSolutionDescriptionChange: (v: string) => void;
  githubUrl: string;
  pitchDeckUrl: string;
  prototypeUrl: string;
  additionalUrl: string;
  isLocked: boolean;
  isLeader: boolean;
  loading: boolean;
  onPptChange: (v: string) => void;
  onGithubChange: (v: string) => void;
  onPitchDeckChange: (v: string) => void;
  onPrototypeChange: (v: string) => void;
  onAdditionalChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SubmissionForm({
  problemStatement,
  problemDescription,
  proposedSolution,
  solutionDescription,
  pptUrl,
  onProblemStatementChange,
  onProblemDescriptionChange,
  onProposedSolutionChange,
  onSolutionDescriptionChange,
  githubUrl,
  pitchDeckUrl,
  prototypeUrl,
  additionalUrl,
  isLocked,
  isLeader,
  loading,
  onPptChange,
  onGithubChange,
  onPitchDeckChange,
  onPrototypeChange,
  onAdditionalChange,
  onSubmit,
}: SubmissionFormProps) {
  return (
    <form onSubmit={onSubmit} className="glass-panel p-6 border border-border-color space-y-6 font-tech">
      {/* SECTION 1: MANDATORY PROBLEM & SOLUTION SPECIFICATION */}
      <div className="space-y-5 pb-6 border-b border-border-color">
        <div className="border-b border-border-color/60 pb-2">
          <h3 className="font-heading text-lg text-text-primary uppercase m-0 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-secondary inline-block"></span>
            1. Problem & Solution Statement
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Specify the core challenge your project solves and your proposed technical solution. All 4 fields are mandatory.
          </p>
        </div>

        {/* 1. Problem Statement */}
        <div className="space-y-2">
          <label className="block text-xs uppercase text-text-primary font-bold flex items-center justify-between">
            <span>Problem Statement *</span>
            <span className="text-[10px] text-accent-secondary uppercase font-bold">MANDATORY</span>
          </label>
          <input
            type="text"
            required
            disabled={isLocked || !isLeader}
            value={problemStatement}
            onChange={(e) => onProblemStatementChange(e.target.value)}
            placeholder="e.g. Inefficient agricultural cold-chain distribution leading to 35% crop spoilage."
            className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-sm font-sans tracking-normal focus:border-accent-secondary outline-none disabled:opacity-60"
          />
        </div>

        {/* 2. Problem Description */}
        <div className="space-y-2">
          <label className="block text-xs uppercase text-text-primary font-bold flex items-center justify-between">
            <span>Problem Description *</span>
            <span className="text-[10px] text-accent-secondary uppercase font-bold">MANDATORY</span>
          </label>
          <textarea
            required
            rows={3}
            disabled={isLocked || !isLeader}
            value={problemDescription}
            onChange={(e) => onProblemDescriptionChange(e.target.value)}
            placeholder="Describe the root causes, current limitations, and who is affected by this challenge in detail..."
            className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-sm font-sans tracking-normal focus:border-accent-secondary outline-none disabled:opacity-60 resize-y"
          />
        </div>

        {/* 3. Proposed Solution */}
        <div className="space-y-2">
          <label className="block text-xs uppercase text-text-primary font-bold flex items-center justify-between">
            <span>Proposed Solution *</span>
            <span className="text-[10px] text-accent-secondary uppercase font-bold">MANDATORY</span>
          </label>
          <input
            type="text"
            required
            disabled={isLocked || !isLeader}
            value={proposedSolution}
            onChange={(e) => onProposedSolutionChange(e.target.value)}
            placeholder="e.g. Decentralized IoT sensor network with predictive routing algorithm."
            className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-sm font-sans tracking-normal focus:border-accent-secondary outline-none disabled:opacity-60"
          />
        </div>

        {/* 4. Solution Description */}
        <div className="space-y-2">
          <label className="block text-xs uppercase text-text-primary font-bold flex items-center justify-between">
            <span>Solution Description *</span>
            <span className="text-[10px] text-accent-secondary uppercase font-bold">MANDATORY</span>
          </label>
          <textarea
            required
            rows={3}
            disabled={isLocked || !isLeader}
            value={solutionDescription}
            onChange={(e) => onSolutionDescriptionChange(e.target.value)}
            placeholder="Explain how your solution works, key architecture/technologies used, and expected impact..."
            className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-sm font-sans tracking-normal focus:border-accent-secondary outline-none disabled:opacity-60 resize-y"
          />
        </div>
      </div>

      {/* SECTION 2: MANDATORY CANVA PPT LINK */}
      <div className="space-y-3 pb-6 border-b border-border-color">
        <div className="border-b border-border-color/60 pb-2">
          <h3 className="font-heading text-lg text-text-primary uppercase m-0 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-secondary inline-block"></span>
            2. Canva PPT Link Deliverable
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Provide a link to your Canva presentation (e.g., https://www.canva.com/design/...).
          </p>
        </div>
        <label className="block text-xs uppercase text-text-primary font-bold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Presentation size={16} className="text-accent-secondary" />
            Canva PPT Link *
          </span>
          <span className="text-[10px] text-accent-secondary uppercase font-bold">MANDATORY LINK</span>
        </label>
        <input
          type="url"
          required
          disabled={isLocked || !isLeader}
          value={pptUrl}
          onChange={(e) => onPptChange(e.target.value)}
          placeholder="https://www.canva.com/design/..."
          className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-sm font-sans tracking-normal focus:border-accent-secondary outline-none disabled:opacity-60"
        />
        {pptUrl && (
          <p className="mt-2 text-xs text-text-secondary">
            Current link: <a href={pptUrl} target="_blank" rel="noreferrer" className="text-accent-secondary underline">{pptUrl}</a>
          </p>
        )}
      </div>

      {/* GitHub URL */}
      <div className="space-y-2">
        <label className="block text-xs uppercase text-text-secondary font-bold flex items-center gap-2">
          <Github size={16} />
          GitHub Repository URL (Optional)
        </label>
        <input
          type="url"
          disabled={isLocked || !isLeader}
          value={githubUrl}
          onChange={(e) => onGithubChange(e.target.value)}
          placeholder="https://github.com/organization/repo"
          className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-sm font-sans tracking-normal focus:border-accent-secondary outline-none disabled:opacity-60"
        />
      </div>

      {/* Pitch Deck URL */}
      <div className="space-y-2">
        <label className="block text-xs uppercase text-text-secondary font-bold flex items-center gap-2">
          <Presentation size={16} />
          Secondary Pitch Deck / Executive Summary URL (Optional)
        </label>
        <input
          type="url"
          disabled={isLocked || !isLeader}
          value={pitchDeckUrl}
          onChange={(e) => onPitchDeckChange(e.target.value)}
          placeholder="https://..."
          className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-sm font-sans tracking-normal focus:border-accent-secondary outline-none disabled:opacity-60"
        />
      </div>

      {/* Live Prototype */}
      <div className="space-y-2">
        <label className="block text-xs uppercase text-text-secondary font-bold flex items-center gap-2">
          <Laptop size={16} />
          Live Deployment / Prototype URL (Optional)
        </label>
        <input
          type="url"
          disabled={isLocked || !isLeader}
          value={prototypeUrl}
          onChange={(e) => onPrototypeChange(e.target.value)}
          placeholder="https://my-app.vercel.app or Figma prototype"
          className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-sm font-sans tracking-normal focus:border-accent-secondary outline-none disabled:opacity-60"
        />
      </div>

      {/* Additional Material */}
      <div className="space-y-2">
        <label className="block text-xs uppercase text-text-secondary font-bold flex items-center gap-2">
          <FolderPlus size={16} />
          Additional Material / Drive Folder URL (Optional)
        </label>
        <input
          type="url"
          disabled={isLocked || !isLeader}
          value={additionalUrl}
          onChange={(e) => onAdditionalChange(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
          className="w-full bg-surface-color border border-border-color p-3 text-text-primary text-sm font-sans tracking-normal focus:border-accent-secondary outline-none disabled:opacity-60"
        />
      </div>

      {/* Submit Button */}
      <div className="pt-4 border-t border-border-color flex justify-end">
        <button
          type="submit"
          disabled={loading || isLocked || !isLeader}
          className="flex items-center gap-2 px-6 py-3 bg-accent-secondary hover:bg-accent-secondary/80 text-white font-bold uppercase text-xs transition-colors disabled:opacity-50 shadow-lg shadow-accent-secondary/20"
        >
          <Upload size={16} />
          {loading ? "Submitting Deliverables..." : "Submit Deliverables"}
        </button>
      </div>
    </form>
  );
}
