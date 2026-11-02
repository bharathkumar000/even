"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown,
  Check,
  X,
  CheckSquare,
  Square,
} from "lucide-react";

export type AudienceValue =
  | "all"
  | "teams"
  | "judges"
  | "ops"
  | "admin"
  | "participants"
  | "staff"
  | "organizers";

export interface AudienceOption {
  value: AudienceValue;
  label: string;
  description: string;
}

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  { value: "all", label: "All Portals", description: "Visible to every portal" },
  { value: "teams", label: "Team Leaders", description: "Team leader portal" },
  { value: "judges", label: "Judges", description: "Judge evaluation portal" },
  { value: "ops", label: "Operations", description: "Operations/scanner portal" },
  { value: "admin", label: "Admin Portal", description: "Admin HQ portal" },
  { value: "participants", label: "Participants", description: "Team participant portal" },
  { value: "staff", label: "Staff", description: "Event staff portal" },
  { value: "organizers", label: "Organizers", description: "Event organizer portal" },
];

export const AUDIENCE_LABELS: Record<string, string> = Object.fromEntries(
  AUDIENCE_OPTIONS.map((o) => [o.value, o.label])
);

interface MultiAudienceSelectorProps {
  value: AudienceValue[];
  onChange: (values: AudienceValue[]) => void;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export default function MultiAudienceSelector({
  value,
  onChange,
  disabled = false,
  className = "",
  required = false,
}: MultiAudienceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isAllSelected = value.includes("all");
  const individualSelected = value.filter((v) => v !== "all");
  const hasSelection = value.length > 0;
  const selectedSummary = isAllSelected
    ? "All Portals"
    : hasSelection
    ? `${individualSelected.length} portal${individualSelected.length !== 1 ? "s" : ""} selected`
    : null;

  const toggleAudience = (audience: AudienceValue) => {
    if (disabled) return;
    if (audience === "all") {
      onChange(["all"]);
    } else {
      const next = isAllSelected ? [audience] : [...value];
      if (next.includes(audience)) {
        const idx = next.indexOf(audience);
        next.splice(idx, 1);
      } else {
        next.push(audience);
      }
      const deduped: AudienceValue[] = [];
      next.forEach((v) => { if (!deduped.includes(v)) deduped.push(v); });
      onChange(deduped);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    onChange(["all"]);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const filteredOptions = AUDIENCE_OPTIONS.filter((opt) =>
    opt.label.toLowerCase().includes(filter.toLowerCase()) ||
    opt.description.toLowerCase().includes(filter.toLowerCase())
  );

  const isSelected = (audience: AudienceValue) => value.includes(audience);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerContent = (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full flex items-center justify-between px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-colors ${disabled ? "bg-gray-900/50" : ""}`}
      >
        <div className="flex-1 min-w-0">
          {hasSelection ? (
            <>
              <span className="block text-sm text-white truncate">{selectedSummary}</span>
              {isAllSelected ? (
                <span className="text-xs text-pink-400 uppercase tracking-wider font-bold">All Portals</span>
              ) : null}
            </>
          ) : (
            <>
              <span className="block text-sm text-gray-400 truncate">Select portals</span>
              <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Choose audiences</span>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {required && !hasSelection && (
        <p className="text-xs text-red-400 mt-1 font-bold uppercase">At least one audience required</p>
      )}
    </div>
  );

  if (!isOpen) {
    return triggerContent;
  }

  return (
    <div className="relative w-full z-50">
      {triggerContent}
      <div
        ref={dropdownRef}
        onKeyDown={handleDropdownKeyDown}
        className="absolute z-[60] mt-1 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
          <div className="relative w-full">
            <X className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter portals..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={selectAll}
              disabled={disabled || isAllSelected}
              className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-pink-400 hover:bg-pink-400/10 rounded transition-colors disabled:opacity-50"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              disabled={disabled || !hasSelection}
              className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-400/10 rounded transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-gray-500 text-xs italic">
              No portals found
            </div>
          ) : (
            <ul role="listbox">
              {filteredOptions.map((opt) => {
                const sel = isSelected(opt.value);
                const isAll = opt.value === "all";
                return (
                  <li key={opt.value} role="option" aria-selected={sel}>
                    <button
                      onClick={() => toggleAudience(opt.value)}
                      disabled={disabled}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors ${disabled ? "text-gray-600" : sel ? "bg-pink-500/10 text-pink-400" : "text-gray-300 hover:bg-gray-800/50"}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isAll && sel ? (
                          <Check className="w-4 h-4 text-pink-400 shrink-0" />
                        ) : sel ? (
                          <CheckSquare className="w-4 h-4 text-pink-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-600 shrink-0" />
                        )}
                        <div>
                          <span className={`block text-sm font-medium ${sel ? "text-white" : "text-gray-300"}`}>
                            {opt.label}
                          </span>
                          <span className="text-xs text-gray-500">{opt.description}</span>
                        </div>
                      </div>
                      {isAll && sel ? (
                        <span className="text-xs text-pink-400 font-bold uppercase">Clears others</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-2 border-t border-gray-700 bg-gray-900/50 flex items-center justify-between">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">
            {hasSelection ? `${individualSelected.length} selected` : "No selection"}
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
