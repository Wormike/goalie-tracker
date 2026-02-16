/**
 * Migration utilities for Goalie Tracker
 * 
 * These functions ensure backward compatibility when the data model changes.
 * They run automatically on app startup.
 */

import { v4 as uuidv4 } from "uuid";

const MIGRATION_VERSION_KEY = 'goalie-tracker-migration-version';
const CURRENT_MIGRATION_VERSION = 2;

/**
 * Run all pending migrations on app startup
 */
export function runMigrations(): void {
  if (typeof window === 'undefined') return;

  const currentVersion = getMigrationVersion();
  
  // Run migrations in order
  if (currentVersion < 1) {
    migrateToUserCompetitions();
    setMigrationVersion(1);
  }

  if (currentVersion < 2) {
    migrateCompetitionStorage();
    setMigrationVersion(2);
  }
}

/**
 * Get current migration version
 */
function getMigrationVersion(): number {
  try {
    const version = localStorage.getItem(MIGRATION_VERSION_KEY);
    return version ? parseInt(version, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Set migration version
 */
function setMigrationVersion(version: number): void {
  try {
    localStorage.setItem(MIGRATION_VERSION_KEY, version.toString());
  } catch (err) {
    console.error('[Migration] Failed to save migration version:', err);
  }
}

/**
 * Migration v1: Create default competitions from existing match categories
 * 
 * If the user has existing matches but no competitions, this creates
 * one competition for each unique category found in their matches.
 */
function migrateToUserCompetitions(): void {
  try {
    // Check if user already has competitions
    const existingCompetitions = localStorage.getItem('goalie-tracker-competitions');
    if (existingCompetitions) {
      const parsed = JSON.parse(existingCompetitions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return;
      }
    }

    // Get existing matches
    const matchesJson = localStorage.getItem('goalie-tracker-matches') || localStorage.getItem('matches');
    if (!matchesJson) {
      return;
    }

    const matches = JSON.parse(matchesJson);
    if (!Array.isArray(matches) || matches.length === 0) {
      return;
    }

    // Extract unique categories from matches
    const categories = new Set<string>();
    for (const match of matches) {
      if (match.category && typeof match.category === 'string') {
        categories.add(match.category);
      }
    }

    if (categories.size === 0) {
      return;
    }

    // Create user competitions for each category
    const userCompetitions = Array.from(categories).map((category) => ({
      id: uuidv4(),
      name: category,
      category: category,
      seasonId: "",
      source: "manual",
      createdAt: new Date().toISOString(),
    }));

    // Save the new competitions
    localStorage.setItem('goalie-tracker-competitions', JSON.stringify(userCompetitions));

    // Set the first one as active
    if (userCompetitions.length > 0) {
      localStorage.setItem('active-competition-id', userCompetitions[0].id);
    }

  } catch (err) {
    console.error('[Migration] Failed to migrate to user competitions:', err);
  }
}

/**
 * Migration v2: Unify competitions storage
 * - Move legacy "user-competitions" into "goalie-tracker-competitions" if needed
 * - Remove legacy key
 */
function migrateCompetitionStorage(): void {
  try {
    const legacyRaw = localStorage.getItem("user-competitions");
    if (!legacyRaw) {
      localStorage.removeItem("user-competitions");
      return;
    }

    const legacy = JSON.parse(legacyRaw);
    const currentRaw = localStorage.getItem("goalie-tracker-competitions");
    const current = currentRaw ? JSON.parse(currentRaw) : [];

    if (Array.isArray(legacy) && legacy.length > 0 && (!Array.isArray(current) || current.length === 0)) {
      const migrated = legacy.map((comp: { name: string; standingsUrl?: string; category?: string; seasonId?: string; createdAt?: string; }) => ({
        id: uuidv4(),
        name: comp.name,
        category: comp.category || "",
        seasonId: comp.seasonId || "",
        standingsUrl: comp.standingsUrl,
        source: "manual",
        createdAt: comp.createdAt || new Date().toISOString(),
      }));

      localStorage.setItem("goalie-tracker-competitions", JSON.stringify(migrated));

      const activeId = localStorage.getItem("active-competition-id");
      if (activeId) {
        const byName = migrated.find((c) => c.name && legacy.find((l: { id: string; name: string }) => l.id === activeId && l.name === c.name));
        localStorage.setItem("active-competition-id", byName?.id || migrated[0].id);
      }
    }

    localStorage.removeItem("user-competitions");
  } catch (err) {
    console.error("[Migration] Failed to migrate competitions storage:", err);
  }
}

/**
 * Check if migration is needed (for debugging)
 */
export function isMigrationNeeded(): boolean {
  return getMigrationVersion() < CURRENT_MIGRATION_VERSION;
}

/**
 * Reset migration version (for testing)
 */
export function resetMigrationVersion(): void {
  localStorage.removeItem(MIGRATION_VERSION_KEY);
}












