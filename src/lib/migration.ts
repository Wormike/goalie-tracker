/**
 * Migration utilities for Goalie Tracker
 * 
 * These functions ensure backward compatibility when the data model changes.
 * They run automatically on app startup.
 */

const MIGRATION_VERSION_KEY = 'goalie-tracker-migration-version';
const CURRENT_MIGRATION_VERSION = 1;

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

  // Add future migrations here as:
  // if (currentVersion < 2) {
  //   migrateSomething();
  //   setMigrationVersion(2);
  // }
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
 * Migration v1: Create default user competitions from existing match categories
 * 
 * If the user has existing matches but no user-competitions, this creates
 * one competition for each unique category found in their matches.
 */
function migrateToUserCompetitions(): void {
  console.log('[Migration] Running migration to user competitions...');

  try {
    // Check if user already has competitions
    const existingCompetitions = localStorage.getItem('user-competitions');
    if (existingCompetitions) {
      const parsed = JSON.parse(existingCompetitions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('[Migration] User already has competitions, skipping migration');
        return;
      }
    }

    // Get existing matches
    const matchesJson = localStorage.getItem('matches');
    if (!matchesJson) {
      console.log('[Migration] No matches found, skipping migration');
      return;
    }

    const matches = JSON.parse(matchesJson);
    if (!Array.isArray(matches) || matches.length === 0) {
      console.log('[Migration] No matches found, skipping migration');
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
      console.log('[Migration] No categories found in matches, skipping migration');
      return;
    }

    // Create user competitions for each category
    const userCompetitions = Array.from(categories).map((category, index) => ({
      id: `migrated-${index}-${Date.now()}`,
      name: category,
      category: category,
      createdAt: new Date().toISOString(),
    }));

    // Save the new competitions
    localStorage.setItem('user-competitions', JSON.stringify(userCompetitions));

    // Set the first one as active
    if (userCompetitions.length > 0) {
      localStorage.setItem('active-competition-id', userCompetitions[0].id);
    }

    console.log(`[Migration] Created ${userCompetitions.length} competitions from existing categories:`, 
      userCompetitions.map(c => c.name));

  } catch (err) {
    console.error('[Migration] Failed to migrate to user competitions:', err);
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


