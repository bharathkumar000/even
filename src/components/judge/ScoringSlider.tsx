"use client";

import React from "react";

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
  return (
    <div className="p-4 bg-surface-color-light/30 border border-border-color space-y-3">
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

      <div className="pt-2 flex items-center gap-4">
        <input
          type="range"
          min="0"
          max={maxMarks}
          value={value || 0}
          disabled={disabled}
          onChange={(e) => onChange(criterionId, Number(e.target.value), maxMarks)}
          className="flex-1 accent-accent-secondary cursor-pointer"
        />
        <input
          type="number"
          min="0"
          max={maxMarks}
          value={value ?? 0}
          disabled={disabled}
          onChange={(e) => onChange(criterionId, Number(e.target.value), maxMarks)}
          className="w-20 bg-surface-color border border-border-color text-text-primary font-sans tracking-normal font-bold text-sm text-center py-1.5 focus:border-accent-secondary outline-none"
        />
      </div>

      {!disabled && (
        <div className="flex items-center gap-2 pt-1">
          <span className="font-tech text-[10px] text-text-secondary uppercase">Quick:</span>
          {[0.25, 0.5, 0.75, 1.0].map((pct) => {
            const presetVal = Math.round(maxMarks * pct);
            const isSelected = value === presetVal;
            return (
              <button
                key={pct}
                type="button"
                onClick={() => onChange(criterionId, presetVal, maxMarks)}
                className={`font-tech text-[10px] px-2 py-0.5 border rounded transition-colors ${
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
            className="font-tech text-[10px] px-2 py-0.5 border border-border-color text-text-secondary hover:text-status-error hover:border-status-error/40 rounded transition-colors ml-auto"
          >
            Clear (0)
          </button>
        </div>
      )}
    </div>
  );
}
