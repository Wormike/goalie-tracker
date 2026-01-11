"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useCompetition } from "@/contexts/CompetitionContext";

interface CompetitionSwitcherProps {
  className?: string;
}

/**
 * Dropdown switcher for selecting active competition.
 * Shows current competition name and allows switching between competitions.
 */
export function CompetitionSwitcher({ className = "" }: CompetitionSwitcherProps) {
  const { 
    competitions, 
    activeCompetition, 
    setActiveCompetitionId,
    hasCompetitions,
  } = useCompetition();
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  // Don't render if no competitions
  if (!hasCompetitions) {
    return null;
  }

  const handleSelect = (id: string | null) => {
    console.log(`[CompetitionSwitcher] handleSelect called with id: ${id || 'null (unassigned)'}`);
    console.log(`[CompetitionSwitcher] Current activeCompetition:`, activeCompetition ? `${activeCompetition.name} (${activeCompetition.id})` : 'null');
    setActiveCompetitionId(id);
    console.log(`[CompetitionSwitcher] setActiveCompetitionId(${id || 'null'}) called`);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-bgSurfaceSoft px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="max-w-[140px] truncate">
          {activeCompetition === null ? "Nezařazené" : activeCompetition?.name || "Vyberte soutěž"}
        </span>
        <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-borderSoft bg-bgSurfaceSoft shadow-lg shadow-black/30">
          {/* Competition list */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {/* "Nezařazené" option - shows matches without competitionId */}
            <button
              onClick={() => handleSelect(null)}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                activeCompetition === null
                  ? "bg-accentPrimary/10 text-accentPrimary"
                  : "text-slate-200 hover:bg-slate-700"
              }`}
              role="option"
              aria-selected={activeCompetition === null}
            >
              {activeCompetition === null && (
                <span className="text-xs">✓</span>
              )}
              <span className={activeCompetition === null ? "" : "ml-5"}>
                Nezařazené
              </span>
            </button>
            {competitions.map((comp) => (
              <button
                key={comp.id}
                onClick={() => handleSelect(comp.id)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                  comp.id === activeCompetition?.id
                    ? "bg-accentPrimary/10 text-accentPrimary"
                    : "text-slate-200 hover:bg-slate-700"
                }`}
                role="option"
                aria-selected={comp.id === activeCompetition?.id}
              >
                {comp.id === activeCompetition?.id && (
                  <span className="text-xs">✓</span>
                )}
                <span className={comp.id === activeCompetition?.id ? "" : "ml-5"}>
                  {comp.name}
                </span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-borderSoft" />

          {/* Manage link */}
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            <span>⚙️</span>
            <span>Spravovat soutěže</span>
          </Link>
        </div>
      )}
    </div>
  );
}

// Simple chevron icon
function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Compact version for inline display - just shows the active competition name
 */
export function ActiveCompetitionBadge({ className = "" }: { className?: string }) {
  const { activeCompetition, hasCompetitions } = useCompetition();

  if (!hasCompetitions || !activeCompetition) {
    return null;
  }

  return (
    <span className={`inline-flex items-center rounded-full bg-accentPrimary/10 px-2.5 py-0.5 text-xs font-medium text-accentPrimary ${className}`}>
      {activeCompetition.name}
    </span>
  );
}










