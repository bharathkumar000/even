"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { selectProblemStatement } from "@/app/actions/team-problem-statement-selection";

interface SelectStatementButtonProps {
  statementId: string;
  statementTitle: string;
  disabled?: boolean;
}

export default function SelectStatementButton({
  statementId,
  statementTitle,
  disabled = false,
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
        await selectProblemStatement(statementId);
        setSuccess(true);
        router.refresh();
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to select problem statement."
        );
      }
    });
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleSelect}
        disabled={disabled || isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-accent-secondary text-black rounded hover:bg-accent-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : success ? (
          <Check size={12} />
        ) : null}
        {success ? "Selected" : isPending ? "Selecting..." : "Select"}
      </button>
      {error && (
        <p className="text-xs text-status-error mt-1.5 m-0">{error}</p>
      )}
      <span className="sr-only">{statementTitle}</span>
    </div>
  );
}
