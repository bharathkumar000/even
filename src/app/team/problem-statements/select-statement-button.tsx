"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { selectProblemStatement } from "@/app/actions/team-problem-statement-selection";
import { withCsrfToken, CSRF_HEADER_NAME } from "@/lib/csrf-client";

interface SelectStatementButtonProps {
  statementId: string;
  statementTitle: string;
  disabled?: boolean;
  isSelected?: boolean;
}

export default function SelectStatementButton({
  statementId,
  statementTitle,
  disabled = false,
  isSelected = false,
}: SelectStatementButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSelect = () => {
    setError("");
    setSuccess(false);
    startTransition(async () => {
      try {
        const res = await selectProblemStatement(statementId, withCsrfToken()[CSRF_HEADER_NAME] || undefined);
        if (res && !res.success) {
          setError(res.error || "Failed to select problem statement.");
          return;
        }
        setSuccess(true);
        router.refresh();
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to select problem statement."
        );
      }
    });
  };

  if (isSelected) {
    return (
      <div>
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-tech font-bold uppercase tracking-wider bg-status-success text-black rounded cursor-default shadow-md w-full sm:w-auto"
        >
          <Check size={13} />
          Selected
        </button>
        <p className="text-xs text-text-secondary mt-1.5 m-0 font-mono">Your team has already selected this problem statement.</p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSelect}
        disabled={disabled || isPending}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-tech font-bold uppercase tracking-wider bg-accent-secondary text-black rounded hover:bg-accent-primary active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md w-full sm:w-auto"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : success ? (
          <Check size={13} />
        ) : null}
        {success ? "Selected" : isPending ? "Selecting…" : "Select Statement"}
      </button>
      {error && (
        <p className="text-xs text-status-error mt-1.5 m-0 font-mono">{error}</p>
      )}
      <span className="sr-only">{statementTitle}</span>
    </div>
  );
}
