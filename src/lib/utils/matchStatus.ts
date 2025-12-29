/**
 * Match Status Utilities
 * Helper functions for normalizing and checking match statuses
 */

import type { MatchStatus, AnyMatchStatus } from "../types";

/**
 * Mapuje legacy status na nový (normalizace)
 */
export function normalizeMatchStatus(status: string | undefined): MatchStatus {
  const statusMap: Record<string, MatchStatus> = {
    // Legacy → New
    "open": "in_progress",
    "closed": "completed",
    // New → New (pass through)
    "scheduled": "scheduled",
    "in_progress": "in_progress",
    "completed": "completed",
    "cancelled": "cancelled",
  };
  return statusMap[status || "scheduled"] || "scheduled";
}

/**
 * Kontrola jestli je zápas aktivní (lze upravovat)
 */
export function isMatchActive(status: string | undefined): boolean {
  const activeStatuses = ["open", "in_progress", "scheduled"];
  return activeStatuses.includes(status || "");
}

/**
 * Kontrola jestli je zápas dokončený
 */
export function isMatchCompleted(status: string | undefined): boolean {
  const completedStatuses = ["closed", "completed"];
  return completedStatuses.includes(status || "");
}

/**
 * Check if match is closed/completed
 * Works with both legacy and new status values
 */
export function isMatchClosed(match?: {
  status?: AnyMatchStatus;
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
  status?: AnyMatchStatus;
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
export function getNewMatchStatus(): MatchStatus {
  return "in_progress";
}

