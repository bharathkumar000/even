"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";

interface ScoringSliderProps {
  criterionId: string;
  criterionTitle: string;
  description?: string;
  maxMarks: number;
  value: number;
  disabled?: boolean;
  onChange: (criterionId: string, value: number, maxMarks: number) => void;
  index: number;
}

export default function ScoringSlider({
  criterionId,
  criterionTitle,
  description,
  maxMarks,
  value,
  disabled = false,
  onChange,
  index,
}: ScoringSliderProps) {
  const currentVal = value ?? 0;

  const handleDecrement = () => {
    if (disabled || currentVal <= 0) return;
    onChange(criterionId, Math.max(0, currentVal - 1), maxMarks);
  };

  const handleIncrement = () => {
    if (disabled || currentVal >= maxMarks) return;
    onChange(criterionId, Math.min(maxMarks, currentVal + 1), maxMarks);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(criterionId, 0, maxMarks);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(0, Math.min(maxMarks, parsed));
      onChange(criterionId, clamped, maxMarks);
    }
  };

  const pctAwarded = maxMarks > 0 ? Math.min(100, Math.round((currentVal / maxMarks) * 100)) : 0;

  return (
    <div className="p-4 bg-surface-color-light/30 border border-border-color space-y-3 rounded-sm transition-all hover:border-border-color/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-tech text-[11px] text-accent-secondary font-bold mr-2 uppercase">
            Criterion #{index + 1}
          </span>
          <h3 className="font-heading text-base text-text-primary inline uppercase m-0">
            {criterionTitle}
          </h3>
        </div>

        <span className="font-tech text-xs text-accent-primary font-bold">
          Max Marks: {maxMarks} PTS
        </span>
      </div>

      {description && (
        <p className="font-tech text-xs text-text-secondary m-0">{description}</p>
      )}

      {/* Stepper with - and + buttons and direct number input */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-color/60 p-2.5 border border-border-color/60 rounded">
        <div className="flex items-center gap-2">
          {/* Minus Button */}
          <button
            type="button"
            disabled={disabled || currentVal <= 0}
            onClick={handleDecrement}
            title="Decrement by 1"
            className="w-10 h-10 flex items-center justify-center rounded bg-surface-color-light border border-border-color text-text-primary hover:border-accent-secondary hover:text-accent-secondary hover:bg-accent-secondary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
          >
            <Minus size={18} />
          </button>

          {/* Direct Typeable Number Input */}
          <div className="relative flex items-center">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="0"
              max={maxMarks}
              value={currentVal === 0 ? "" : currentVal}
              placeholder="0"
              disabled={disabled}
              onChange={handleInputChange}
              className="w-24 h-10 bg-surface-color border border-border-color text-text-primary font-heading font-bold text-lg text-center px-2 focus:border-accent-secondary focus:shadow-[0_0_12px_rgba(255,0,127,0.25)] outline-none rounded"
              onKeyDown={(e) => {
                // Only allow: backspace, delete, tab, escape, enter, numbers, arrow keys
                const allowedKeys = [
                  "Backspace", "Delete", "Tab", "Escape", "Enter",
                  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
                  "Home", "End"
                ];
                const isNumber = e.key >= "0" && e.key <= "9";
                if (!allowedKeys.includes(e.key) && !isNumber) {
                  e.preventDefault();
                }
              }}
            />
          </div>

          {/* Plus Button */}
          <button
            type="button"
            disabled={disabled || currentVal >= maxMarks}
            onClick={handleIncrement}
            title="Increment by 1"
            className="w-10 h-10 flex items-center justify-center rounded bg-surface-color-light border border-border-color text-text-primary hover:border-accent-secondary hover:text-accent-secondary hover:bg-accent-secondary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
          >
            <Plus size={18} />
          </button>

          <span className="font-tech text-xs text-text-secondary ml-1 font-mono">
            / {maxMarks} PTS
          </span>
        </div>

        {/* Visual score percentage meter */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="w-24 sm:w-32 h-2 bg-surface-color-light rounded-full overflow-hidden border border-border-color/40">
            <div
              className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-300"
              style={{ width: `${pctAwarded}%` }}
            />
          </div>
          <span className="font-tech text-xs font-bold text-accent-secondary w-9 text-right">
            {pctAwarded}%
          </span>
        </div>
      </div>

      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="font-tech text-[10px] text-text-secondary uppercase">Quick:</span>
          {[0.25, 0.5, 0.75, 1.0].map((pct) => {
            const presetVal = Math.round(maxMarks * pct);
            const isSelected = currentVal === presetVal;
            return (
              <button
                key={pct}
                type="button"
                onClick={() => onChange(criterionId, presetVal, maxMarks)}
                className={`font-tech text-[10px] px-2.5 py-1 border rounded transition-colors ${
                  isSelected
                    ? "border-accent-secondary bg-accent-secondary/20 text-accent-secondary font-bold"
                    : "border-border-color text-text-secondary hover:text-text-primary hover:border-text-secondary"
                }`}
              >
                {Math.round(pct * 100)}% ({presetVal})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onChange(criterionId, 0, maxMarks)}
            className="font-tech text-[10px] px-2.5 py-1 border border-border-color text-text-secondary hover:text-status-error hover:border-status-error/40 rounded transition-colors ml-auto"
          >
            Clear (0)
          </button>
        </div>
      )}
    </div>
  );
}
