"use client";

import React from "react";

interface StandingsLinkProps {
  url?: string;
  className?: string;
  variant?: "button" | "inline";
}

/**
 * Simple external link to competition standings on ceskyhokej.cz
 * Opens in a new tab - no scraping, just a direct link
 */
export function StandingsLink({ 
  url, 
  className = "",
  variant = "button" 
}: StandingsLinkProps) {
  if (!url) return null;
  
  if (variant === "inline") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-accentPrimary hover:text-accentPrimary/80 text-sm underline underline-offset-2 ${className}`}
      >
        Tabulka
        <ExternalLinkIcon className="w-3 h-3" />
      </a>
    );
  }
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accentPrimary/10 text-accentPrimary hover:bg-accentPrimary/20 transition-colors text-sm font-medium ${className}`}
    >
      📊 Tabulka na ceskyhokej.cz
      <ExternalLinkIcon className="w-4 h-4" />
    </a>
  );
}

// Simple SVG icon for external link
function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 20 20" 
      fill="currentColor" 
      className={className}
    >
      <path 
        fillRule="evenodd" 
        d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" 
        clipRule="evenodd" 
      />
      <path 
        fillRule="evenodd" 
        d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" 
        clipRule="evenodd" 
      />
    </svg>
  );
}

// Standalone button version for when you just want a button
interface StandingsButtonProps {
  url?: string;
  label?: string;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function StandingsButton({
  url,
  label = "Tabulka",
  className = "",
  loading = false,
  disabled = false,
}: StandingsButtonProps) {
  if (!url) {
    return (
      <button
        disabled
        className={`flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-500 cursor-not-allowed ${className}`}
      >
        📊 {label}
        <span className="text-[10px]">(není k dispozici)</span>
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-accentPrimary hover:bg-slate-700 transition-colors ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`}
    >
      {loading ? (
        <span className="animate-spin">⏳</span>
      ) : (
        <span>📊</span>
      )}
      {label}
      <ExternalLinkIcon className="w-3 h-3" />
    </a>
  );
}






