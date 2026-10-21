"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string | React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  dropdownClassName?: string;
  variant?: "default" | "pink" | "yellow" | "cyan";
  colorVariant?: "default" | "pink" | "yellow" | "cyan";
  size?: "sm" | "md" | "lg";
  title?: string;
  ariaLabel?: string;
  id?: string;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  containerClassName = "w-full",
  dropdownClassName = "",
  variant = "default",
  colorVariant,
  size = "md",
  title,
  ariaLabel,
  id,
}: CustomSelectProps) {
  const activeVariant = colorVariant || variant;
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "bottom" | "top";
  }>({ top: 0, left: 0, width: 0, placement: "bottom" });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const popoverHeight = 220;
    const placement =
      spaceBelow < popoverHeight && spaceAbove > spaceBelow ? "top" : "bottom";

    const width = Math.max(rect.width, 150);
    let left = rect.left;
    if (typeof window !== "undefined" && left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }

    setCoords({
      top: placement === "bottom" ? rect.bottom + 4 : rect.top - 4,
      left,
      width,
      placement,
    });
  }, []);

  // Update position on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleScroll = (event: Event) => {
      // Don't close or jump if scrolling inside the dropdown itself
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(event.target as Node)
      ) {
        return;
      }
      updateCoords();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen, updateCoords]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation: Escape closes
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "Escape") {
        setIsOpen(false);
      } else if (e.key === "Enter" || e.key === " ") {
        if (!isOpen) {
          e.preventDefault();
          updateCoords();
          setIsOpen(true);
        }
      } else if (e.key === "ArrowDown" && !isOpen) {
        e.preventDefault();
        updateCoords();
        setIsOpen(true);
      }
    },
    [disabled, isOpen, updateCoords]
  );

  const selectedOption = options.find((opt) => opt.value === value);

  // Size styles
  const sizeClasses = {
    sm: "py-1 px-2.5 text-[11px] min-h-[30px]",
    md: "py-2 px-3 text-xs min-h-[36px]",
    lg: "py-2.5 px-3.5 text-sm min-h-[42px]",
  }[size];

  // Variant border & glow colors
  const variantStyles = {
    default: {
      border: "border-border-color",
      focusBorder: "focus:border-accent-secondary",
      activeGlow: "shadow-[0_0_12px_rgba(255,0,127,0.2)]",
      activeText: "text-accent-secondary",
      badgeDefault: "bg-surface-color-light text-text-secondary border-border-color",
    },
    pink: {
      border: "border-accent-secondary/50",
      focusBorder: "focus:border-accent-secondary",
      activeGlow: "shadow-[0_0_12px_rgba(255,0,127,0.25)]",
      activeText: "text-accent-secondary",
      badgeDefault: "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/40",
    },
    yellow: {
      border: "border-accent-primary/50",
      focusBorder: "focus:border-accent-primary",
      activeGlow: "shadow-[0_0_12px_rgba(251,200,21,0.25)]",
      activeText: "text-accent-primary",
      badgeDefault: "bg-accent-primary/15 text-accent-primary border-accent-primary/40",
    },
    cyan: {
      border: "border-accent-tertiary/50",
      focusBorder: "focus:border-accent-tertiary",
      activeGlow: "shadow-[0_0_12px_rgba(0,240,255,0.25)]",
      activeText: "text-accent-tertiary",
      badgeDefault: "bg-accent-tertiary/15 text-accent-tertiary border-accent-tertiary/40",
    },
  }[activeVariant];

  const handleSelect = (optValue: string, optDisabled?: boolean) => {
    if (optDisabled) return;
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${containerClassName} ${
        isOpen ? "z-50" : ""
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onKeyDown={handleKeyDown}
      title={title}
      id={id}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          if (!isOpen) {
            updateCoords();
          }
          setIsOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between gap-2.5 bg-surface-color border ${variantStyles.border} ${variantStyles.focusBorder} text-text-primary rounded-none font-tech tracking-wider uppercase transition-all duration-200 cursor-pointer select-none hover:bg-surface-color-light hover:border-accent-secondary/70 focus:outline-none ${isOpen ? `${variantStyles.activeGlow} border-accent-secondary` : ""} ${sizeClasses} ${className}`}
      >
        <span className="flex items-center gap-2 truncate font-semibold">
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded border font-mono uppercase tracking-widest ${
                selectedOption.badgeColor || variantStyles.badgeDefault
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </span>

        <ChevronDown
          size={14}
          className={`shrink-0 text-text-secondary transition-transform duration-200 ${
            isOpen ? "rotate-180 text-accent-secondary" : ""
          }`}
        />
      </button>

      {/* Uppermost Layer Dropdown Popover via React Portal */}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: coords.placement === "bottom" ? coords.top : undefined,
              bottom:
                coords.placement === "top"
                  ? window.innerHeight - coords.top
                  : undefined,
              left: coords.left,
              width: coords.width,
              zIndex: 99999,
            }}
            className={`bg-[#0c0c14] border border-border-color shadow-[0_15px_45px_rgba(0,0,0,0.95),0_0_25px_rgba(255,0,127,0.25)] animate-fade-in custom-scrollbar ${dropdownClassName}`}
          >
            {/* Subtle Cyberpunk Neon Top Edge Accent */}
            <div className="h-[2px] w-full bg-gradient-to-r from-accent-secondary via-accent-primary to-accent-tertiary" />

            <ul
              ref={listRef}
              role="listbox"
              tabIndex={-1}
              className="py-1.5 max-h-60 overflow-y-auto custom-scrollbar font-tech uppercase"
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(option.value, option.disabled);
                    }}
                    className={`group relative flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-semibold tracking-wider cursor-pointer transition-all duration-150 border-l-[3px] ${
                      option.disabled
                        ? "opacity-40 cursor-not-allowed border-transparent"
                        : isSelected
                        ? "bg-gradient-to-r from-[rgba(255,0,127,0.25)] to-transparent text-text-primary border-accent-secondary font-bold"
                        : "text-text-secondary border-transparent hover:text-text-primary hover:bg-[rgba(255,0,127,0.12)] hover:border-accent-secondary/60 hover:pl-4"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {option.icon && (
                        <span className="shrink-0 text-text-secondary group-hover:text-text-primary transition-colors">
                          {option.icon}
                        </span>
                      )}
                      <span className="truncate">{option.label}</span>
                      {option.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border font-mono tracking-widest ${
                            option.badgeColor || variantStyles.badgeDefault
                          }`}
                        >
                          {option.badge}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check
                        size={14}
                        className="shrink-0 text-accent-secondary drop-shadow-[0_0_6px_#FF007F]"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
