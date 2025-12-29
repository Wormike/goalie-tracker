/**
 * Match Status Utilities
 * Helper functions for mapping between legacy and new match status values
 */

import type { MatchStatus } from "../types";

/**
 * Map legacy status values to new schema values
 * - "open" → "in_progress" (assumes match is active)
 * - "closed" → "completed"
 */
export function mapLegacyStatusToNew(
  status: MatchStatus | undefined,
  isCompleted: boolean = false
): "scheduled" | "in_progress" | "completed" | "cancelled" {
  if (status === "closed" || isCompleted || status === "completed") {
    return "completed";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  if (status === "in_progress") {
    return "in_progress";
  }
  // "open" or "scheduled" or undefined → default to "in_progress" if match is active,
  // otherwise "scheduled"
  if (status === "open") {
    return "in_progress";
  }
  if (status === "scheduled") {
    return "scheduled";
  }
  // Default: assume match is in progress if status is not explicitly set
  return "in_progress";
}

/**
 * Map new status values to legacy status values
 * - "completed" → "closed"
 * - "in_progress" → "open"
 * - "scheduled" → "open"
 * - "cancelled" → "closed"
 */
export function mapNewStatusToLegacy(
  status: "scheduled" | "in_progress" | "completed" | "cancelled"
): MatchStatus {
  if (status === "completed" || status === "cancelled") {
    return "closed";
  }
  return "open";
}

/**
 * Check if match is closed/completed
 * Works with both legacy and new status values
 */
export function isMatchClosed(match?: {
  status?: MatchStatus | "scheduled" | "in_progress" | "completed" | "cancelled";
  completed?: boolean;
} | null): boolean {
  if (!match) return false;
  
  if (match.completed) return true;
  
  const status = match.status;
  return (
    status === "closed" ||
    status === "completed" ||
    status === "cancelled"
  );
}

/**
 * Check if match is in progress
 */
export function isMatchInProgress(match?: {
  status?: MatchStatus | "scheduled" | "in_progress" | "completed" | "cancelled";
  completed?: boolean;
} | null): boolean {
  if (!match) return false;
  if (isMatchClosed(match)) return false;
  
  const status = match.status;
  return (
    status === "open" ||
    status === "in_progress"
  );
}

/**
 * Get status for new match (when creating)
 * Returns "in_progress" as default for new matches
 */
export function getNewMatchStatus(): "in_progress" {
  return "in_progress";
}

