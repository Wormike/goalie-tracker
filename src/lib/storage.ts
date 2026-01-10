"use client";

import type {
  Goalie,
  GoalieEvent,
  Match,
  Season,
  Team,
  Competition,
  ExternalMapping,
  ExportBundle,
  GoalieSeasonStats,
  CompetitionStandings,
} from "./types";
import { normalizeMatchStatus } from "./utils/matchStatus";

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEYS = {
  goalies: "goalie-tracker-goalies",
  matches: "goalie-tracker-matches",
  events: "goalie-tracker-events",
  seasons: "goalie-tracker-seasons",
  teams: "goalie-tracker-teams",
  competitions: "goalie-tracker-competitions",
  externalMappings: "goalie-tracker-external-mappings",
  standings: "goalie-tracker-standings",
} as const;

const EXPORT_VERSION = 1;

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT DATA
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_SEASON: Season = {
  id: "2024-2025",
  name: "2024/2025",
  label: "2024/2025",
  startDate: "2024-09-01",
  endDate: "2025-06-30",
  startYear: 2024,
  endYear: 2025,
  isActive: false,
  isCurrent: false,
};

const DEFAULT_SEASON_2025: Season = {
  id: "2025-2026",
  name: "2025/2026",
  label: "2025/2026",
  startDate: "2025-09-01",
  endDate: "2026-06-30",
  startYear: 2025,
  endYear: 2026,
  isActive: true,
  isCurrent: true,
};

const DEFAULT_TEAM: Team = {
  id: "slovan-usti",
  name: "HC Slovan Ústí nad Labem",
  shortName: "Slovan Ústí",
  externalId: "228", // ID on ustecky.ceskyhokej.cz
  createdAt: new Date().toISOString(),
};

const DEFAULT_COMPETITIONS: Competition[] = [
  {
    id: "starsi-zaci-a-2025",
    name: "Liga starších žáků A – Ústecká",
    category: "Starší žáci A",
    seasonId: "2025-2026",
    externalId: "1860",
    source: "ceskyhokej",
  },
  {
    id: "starsi-zaci-b-2025",
    name: "Liga starších žáků B – Ústecká",
    category: "Starší žáci B",
    seasonId: "2025-2026",
    externalId: "1872",
    source: "ceskyhokej",
  },
  {
    id: "mladsi-zaci-a-2025",
    name: "Liga mladších žáků A – Ústecká",
    category: "Mladší žáci A",
    seasonId: "2025-2026",
    externalId: "1884",
    source: "ceskyhokej",
  },
  {
    id: "mladsi-zaci-b-2025",
    name: "Liga mladších žáků B – Ústecká",
    category: "Mladší žáci B",
    seasonId: "2025-2026",
    externalId: "1894",
    source: "ceskyhokej",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GOALIES
// ═══════════════════════════════════════════════════════════════════════════

export function getGoalies(): Goalie[] {
  return getItem<Goalie[]>(STORAGE_KEYS.goalies, []);
}

export function saveGoalie(goalie: Goalie): void {
  const goalies = getGoalies();
  const index = goalies.findIndex((g) => g.id === goalie.id);
  const now = new Date().toISOString();
  
  if (index >= 0) {
    goalies[index] = { ...goalie, updatedAt: now };
  } else {
    goalies.push({ ...goalie, createdAt: goalie.createdAt || now });
  }
  setItem(STORAGE_KEYS.goalies, goalies);
}

export function deleteGoalie(id: string): void {
  const goalies = getGoalies().filter((g) => g.id !== id);
  setItem(STORAGE_KEYS.goalies, goalies);
}

export function getGoalieById(id: string): Goalie | undefined {
  return getGoalies().find((g) => g.id === id);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════════════════════════════════════════

export function getTeams(): Team[] {
  const teams = getItem<Team[]>(STORAGE_KEYS.teams, []);
  // Ensure default team exists
  if (teams.length === 0 || !teams.find((t) => t.id === DEFAULT_TEAM.id)) {
    const withDefault = teams.find((t) => t.id === DEFAULT_TEAM.id)
      ? teams
      : [DEFAULT_TEAM, ...teams];
    setItem(STORAGE_KEYS.teams, withDefault);
    return withDefault;
  }
  return teams;
}

export function saveTeam(team: Team): void {
  const teams = getTeams();
  const index = teams.findIndex((t) => t.id === team.id);
  const now = new Date().toISOString();
  
  if (index >= 0) {
    teams[index] = { ...team, updatedAt: now };
  } else {
    teams.push({ ...team, id: team.id || generateId(), createdAt: now });
  }
  setItem(STORAGE_KEYS.teams, teams);
}

export function deleteTeam(id: string): void {
  // Don't delete default team
  if (id === DEFAULT_TEAM.id) return;
  const teams = getTeams().filter((t) => t.id !== id);
  setItem(STORAGE_KEYS.teams, teams);
}

export function getTeamById(id: string): Team | undefined {
  return getTeams().find((t) => t.id === id);
}

export function getTeamByName(name: string): Team | undefined {
  return getTeams().find(
    (t) =>
      t.name.toLowerCase() === name.toLowerCase() ||
      t.shortName?.toLowerCase() === name.toLowerCase()
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPETITIONS
// ═══════════════════════════════════════════════════════════════════════════

export function getCompetitions(): Competition[] {
  const competitions = getItem<Competition[]>(STORAGE_KEYS.competitions, []);
  // Ensure default competitions exist
  if (competitions.length === 0) {
    setItem(STORAGE_KEYS.competitions, DEFAULT_COMPETITIONS);
    return DEFAULT_COMPETITIONS;
  }
  return competitions;
}

export function saveCompetition(competition: Competition): void {
  const competitions = getCompetitions();
  const index = competitions.findIndex((c) => c.id === competition.id);
  const now = new Date().toISOString();
  
  if (index >= 0) {
    competitions[index] = { ...competition, updatedAt: now };
  } else {
    competitions.push({
      ...competition,
      id: competition.id || generateId(),
      createdAt: now,
    });
  }
  setItem(STORAGE_KEYS.competitions, competitions);
}

export function deleteCompetition(id: string): void {
  const competitions = getCompetitions().filter((c) => c.id !== id);
  setItem(STORAGE_KEYS.competitions, competitions);
}

export function getCompetitionById(id: string): Competition | undefined {
  return getCompetitions().find((c) => c.id === id);
}

export function getCompetitionsBySeasonId(seasonId: string): Competition[] {
  return getCompetitions().filter((c) => c.seasonId === seasonId);
}

export function getCompetitionByExternalId(
  externalId: string
): Competition | undefined {
  return getCompetitions().find((c) => c.externalId === externalId);
}

// ═══════════════════════════════════════════════════════════════════════════
// MATCHES
// ═══════════════════════════════════════════════════════════════════════════

export function getMatches(): Match[] {
  const data = getItem<Match[]>(STORAGE_KEYS.matches, []);
  // Normalizuj legacy statusy na nové hodnoty
  return data.map(m => ({
    ...m,
    status: normalizeMatchStatus(m.status),
  }));
}

export function saveMatch(match: Match): void {
  const matches = getMatches();
  const index = matches.findIndex((m) => m.id === match.id);
  const now = new Date().toISOString();
  
  if (index >= 0) {
    // Preserve goalieId if it exists in the existing match and is not explicitly being removed
    const existingMatch = matches[index];
    const preservedMatch = {
      ...match,
      // Preserve goalieId from existing match if new match doesn't have it explicitly set
      goalieId: match.goalieId !== undefined ? match.goalieId : existingMatch.goalieId,
      updatedAt: now,
    };
    matches[index] = preservedMatch;
  } else {
    matches.push({ ...match, createdAt: match.createdAt || now });
  }
  setItem(STORAGE_KEYS.matches, matches);
}

export function deleteMatch(id: string): void {
  const matches = getMatches().filter((m) => m.id !== id);
  setItem(STORAGE_KEYS.matches, matches);
  // Also delete events for this match
  const events = getEvents().filter((e) => e.matchId !== id);
  setItem(STORAGE_KEYS.events, events);
}

export function getMatchById(id: string): Match | undefined {
  const match = getItem<Match[]>(STORAGE_KEYS.matches, []).find((m) => m.id === id);
  if (!match) return undefined;
  // Normalizuj legacy status
  return {
    ...match,
    status: normalizeMatchStatus(match.status),
  };
}

export function getMatchesByGoalie(goalieId: string): Match[] {
  return getMatches().filter((m) => m.goalieId === goalieId);
}

export function getMatchesBySeason(seasonId: string): Match[] {
  return getMatches().filter((m) => m.seasonId === seasonId);
}

export function getMatchesByCompetition(competitionId: string): Match[] {
  return getMatches().filter((m) => m.competitionId === competitionId);
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════

export function getEvents(): GoalieEvent[] {
  return getItem<GoalieEvent[]>(STORAGE_KEYS.events, []);
}

export function getEventsByMatch(matchId: string): GoalieEvent[] {
  return getEvents().filter(
    (e) => e.matchId === matchId && e.status !== "deleted"
  );
}

export function getAllEventsByMatch(matchId: string): GoalieEvent[] {
  // Include deleted events
  return getEvents().filter((e) => e.matchId === matchId);
}

export function getEventsByGoalie(goalieId: string): GoalieEvent[] {
  return getEvents().filter(
    (e) => e.goalieId === goalieId && e.status !== "deleted"
  );
}

export function saveEvent(event: GoalieEvent): void {
  const events = getEvents();
  const index = events.findIndex((e) => e.id === event.id);
  const now = new Date().toISOString();
  
  if (index >= 0) {
    events[index] = { ...event, updatedAt: now };
  } else {
    events.push({
      ...event,
      createdAt: event.createdAt || now,
      status: event.status || "confirmed",
      inputSource: event.inputSource || "live",
    });
  }
  setItem(STORAGE_KEYS.events, events);
}

export function saveEvents(newEvents: GoalieEvent[]): void {
  setItem(STORAGE_KEYS.events, newEvents);
}

export function deleteEvent(id: string): void {
  const events = getEvents().filter((e) => e.id !== id);
  setItem(STORAGE_KEYS.events, events);
}

export function softDeleteEvent(id: string): void {
  const events = getEvents();
  const index = events.findIndex((e) => e.id === id);
  if (index >= 0) {
    events[index] = {
      ...events[index],
      status: "deleted",
      updatedAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.events, events);
  }
}

export function restoreEvent(id: string): void {
  const events = getEvents();
  const index = events.findIndex((e) => e.id === id);
  if (index >= 0) {
    events[index] = {
      ...events[index],
      status: "confirmed",
      updatedAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.events, events);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEASONS
// ═══════════════════════════════════════════════════════════════════════════

// Helper to generate season label from years
export function generateSeasonLabel(startYear: number, endYear: number): string {
  return `${startYear}/${endYear}`;
}

// Helper to generate season ID from years
export function generateSeasonId(startYear: number, endYear: number): string {
  return `${startYear}-${endYear}`;
}

export function getSeasons(): Season[] {
  const seasons = getItem<Season[]>(STORAGE_KEYS.seasons, []);
  if (seasons.length === 0) {
    const defaultSeasons = [DEFAULT_SEASON_2025, DEFAULT_SEASON];
    setItem(STORAGE_KEYS.seasons, defaultSeasons);
    return defaultSeasons;
  }
  // Ensure all seasons have required fields
  return seasons.map((s) => ({
    ...s,
    label: s.label || generateSeasonLabel(s.startYear, s.endYear),
    isCurrent: s.isCurrent ?? s.isActive ?? false,
  }));
}

export function getCurrentSeason(): Season {
  const seasons = getSeasons();
  // First try to find season with isCurrent = true
  const current = seasons.find((s) => s.isCurrent);
  if (current) return current;
  
  // Fallback: find highest startYear
  const sorted = [...seasons].sort((a, b) => b.startYear - a.startYear);
  return sorted[0] || DEFAULT_SEASON_2025;
}

// Legacy alias for backwards compatibility
export function getActiveSeason(): Season {
  return getCurrentSeason();
}

export function saveSeason(season: Season): void {
  const seasons = getSeasons();
  const index = seasons.findIndex((s) => s.id === season.id);
  
  // Ensure label is generated
  const seasonWithLabel: Season = {
    ...season,
    label: season.label || generateSeasonLabel(season.startYear, season.endYear),
    name: season.name || generateSeasonLabel(season.startYear, season.endYear),
  };
  
  if (index >= 0) {
    seasons[index] = seasonWithLabel;
  } else {
    seasons.push(seasonWithLabel);
  }
  setItem(STORAGE_KEYS.seasons, seasons);
}

export function deleteSeason(id: string): { success: boolean; error?: string } {
  const seasons = getSeasons();
  
  // Check if season is used by any matches
  const matches = getMatches();
  const matchesUsingSeason = matches.filter((m) => m.seasonId === id);
  if (matchesUsingSeason.length > 0) {
    return {
      success: false,
      error: `Nelze smazat - sezóna je použita u ${matchesUsingSeason.length} zápasů`,
    };
  }
  
  // Check if season is used by any competitions
  const competitions = getCompetitions();
  const competitionsUsingSeason = competitions.filter((c) => c.seasonId === id);
  if (competitionsUsingSeason.length > 0) {
    return {
      success: false,
      error: `Nelze smazat - sezóna je použita u ${competitionsUsingSeason.length} soutěží`,
    };
  }
  
  const filtered = seasons.filter((s) => s.id !== id);
  
  // If we deleted the current season, set another one as current
  if (seasons.find((s) => s.id === id)?.isCurrent && filtered.length > 0) {
    const sorted = [...filtered].sort((a, b) => b.startYear - a.startYear);
    sorted[0].isCurrent = true;
  }
  
  setItem(STORAGE_KEYS.seasons, filtered);
  return { success: true };
}

export function setCurrentSeason(seasonId: string): void {
  const seasons = getSeasons().map((s) => ({
    ...s,
    isCurrent: s.id === seasonId,
    isActive: s.id === seasonId, // Also update legacy field
  }));
  setItem(STORAGE_KEYS.seasons, seasons);
}

// Legacy alias
export function setActiveSeason(seasonId: string): void {
  setCurrentSeason(seasonId);
}

export function getSeasonById(id: string): Season | undefined {
  return getSeasons().find((s) => s.id === id);
}

// ═══════════════════════════════════════════════════════════════════════════
// STANDINGS
// ═══════════════════════════════════════════════════════════════════════════

export function getStandings(): CompetitionStandings[] {
  return getItem<CompetitionStandings[]>(STORAGE_KEYS.standings, []);
}

export function saveStandings(standings: CompetitionStandings): void {
  const allStandings = getStandings();
  const index = allStandings.findIndex(
    (s) => s.competitionId === standings.competitionId && s.seasonId === standings.seasonId
  );
  
  if (index >= 0) {
    allStandings[index] = standings;
  } else {
    allStandings.push(standings);
  }
  setItem(STORAGE_KEYS.standings, allStandings);
}

export function getStandingsByCompetition(
  competitionId: string,
  seasonId?: string
): CompetitionStandings | undefined {
  const allStandings = getStandings();
  return allStandings.find(
    (s) =>
      s.competitionId === competitionId &&
      (!seasonId || s.seasonId === seasonId)
  );
}

export function getStandingsByExternalId(
  externalCompetitionId: string,
  seasonId?: string
): CompetitionStandings | undefined {
  const allStandings = getStandings();
  return allStandings.find(
    (s) =>
      s.externalCompetitionId === externalCompetitionId &&
      (!seasonId || s.seasonId === seasonId)
  );
}

export function deleteStandings(competitionId: string, seasonId: string): void {
  const filtered = getStandings().filter(
    (s) => !(s.competitionId === competitionId && s.seasonId === seasonId)
  );
  setItem(STORAGE_KEYS.standings, filtered);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTERNAL MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

export function getExternalMappings(): ExternalMapping[] {
  return getItem<ExternalMapping[]>(STORAGE_KEYS.externalMappings, []);
}

export function saveExternalMapping(mapping: ExternalMapping): void {
  const mappings = getExternalMappings();
  const index = mappings.findIndex((m) => m.id === mapping.id);
  
  if (index >= 0) {
    mappings[index] = mapping;
  } else {
    mappings.push({
      ...mapping,
      id: mapping.id || generateId(),
      createdAt: new Date().toISOString(),
    });
  }
  setItem(STORAGE_KEYS.externalMappings, mappings);
}

export function findExternalMapping(
  source: ExternalMapping["source"],
  externalType: ExternalMapping["externalType"],
  externalId: string
): ExternalMapping | undefined {
  return getExternalMappings().find(
    (m) =>
      m.source === source &&
      m.externalType === externalType &&
      m.externalId === externalId
  );
}

export function deleteExternalMapping(id: string): void {
  const mappings = getExternalMappings().filter((m) => m.id !== id);
  setItem(STORAGE_KEYS.externalMappings, mappings);
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

export function calculateGoalieStats(
  goalieId: string,
  seasonId?: string,
  competitionId?: string,
  allEvents?: GoalieEvent[], // Optional: pass events from Supabase if available
  allMatches?: Match[] // Optional: pass matches from Supabase if available
): GoalieSeasonStats {
  // Use provided matches or fall back to localStorage
  const matches = (allMatches || getMatches()).filter(
    (m) =>
      m.goalieId === goalieId &&
      (!seasonId || m.seasonId === seasonId) &&
      (!competitionId || m.competitionId === competitionId)
  );
  // Use provided events or fall back to localStorage
  const events = (allEvents || getEvents()).filter(
    (e) => e.goalieId === goalieId && e.status !== "deleted"
  );

  const matchIds = new Set(matches.map((m) => m.id));
  const relevantEvents = events.filter((e) => matchIds.has(e.matchId));

  // Calculate from events
  let totalShots = relevantEvents.filter(
    (e) => e.result === "save" || e.result === "goal"
  ).length;
  let totalSaves = relevantEvents.filter((e) => e.result === "save").length;
  let totalGoals = relevantEvents.filter((e) => e.result === "goal").length;

  // Situation breakdown
  let shotsEven = 0,
    savesEven = 0;
  let shotsPP = 0,
    savesPP = 0;
  let shotsSH = 0,
    savesSH = 0;

  // Goal type breakdown
  let goalsDirect = 0,
    goalsRebound = 0,
    goalsBreakaway = 0;

  relevantEvents.forEach((e) => {
    if (e.result === "save" || e.result === "goal") {
      if (e.situation === "even" || !e.situation) {
        shotsEven++;
        if (e.result === "save") savesEven++;
      } else if (e.situation === "powerplay") {
        shotsPP++;
        if (e.result === "save") savesPP++;
      } else if (e.situation === "shorthanded") {
        shotsSH++;
        if (e.result === "save") savesSH++;
      }

      if (e.result === "goal") {
        if (e.goalType === "direct" || !e.goalType) goalsDirect++;
        else if (e.goalType === "rebound") goalsRebound++;
        else if (e.goalType === "breakaway") goalsBreakaway++;
      }
    }
  });

  // Add manual stats from matches
  matches.forEach((match) => {
    if (match.manualStats && match.manualStats.shots > 0) {
      const matchEventCount = relevantEvents.filter(
        (e) => e.matchId === match.id
      ).length;

      if (matchEventCount === 0) {
        totalShots += match.manualStats.shots;
        totalSaves += match.manualStats.saves;
        totalGoals += match.manualStats.goals;
        // Add to even strength by default for manual stats
        shotsEven += match.manualStats.shots;
        savesEven += match.manualStats.saves;
        goalsDirect += match.manualStats.goals;
      }
    }
  });

  const savePercentage = totalShots > 0 ? (totalSaves / totalShots) * 100 : 0;

  // Count shutouts
  const shutouts = matches.filter((match) => {
    const matchEvents = relevantEvents.filter((e) => e.matchId === match.id);
    if (matchEvents.length > 0) {
      const goalsAgainst = matchEvents.filter(
        (e) => e.result === "goal"
      ).length;
      return goalsAgainst === 0;
    }
    if (match.manualStats && match.manualStats.shots > 0) {
      return match.manualStats.goals === 0;
    }
    return false;
  }).length;

  return {
    goalieId,
    seasonId: seasonId || "all",
    competitionId,
    gamesPlayed: matches.length,
    totalShots,
    totalSaves,
    totalGoals,
    savePercentage,
    shotsEven,
    savesEven,
    shotsPP,
    savesPP,
    shotsSH,
    savesSH,
    goalsDirect,
    goalsRebound,
    goalsBreakaway,
    shutouts,
    wins: 0,
    losses: 0,
    otLosses: 0,
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════════════════════

export function exportData(): ExportBundle {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    goalies: getGoalies(),
    teams: getTeams(),
    seasons: getSeasons(),
    competitions: getCompetitions(),
    matches: getMatches(),
    events: getEvents(),
    externalMappings: getExternalMappings(),
    standings: getStandings(),
  };
}

export interface ImportResult {
  success: boolean;
  imported: {
    goalies: number;
    teams: number;
    seasons: number;
    competitions: number;
    matches: number;
    events: number;
    externalMappings: number;
    standings: number;
  };
  errors: string[];
}

export function importData(
  bundle: ExportBundle,
  mode: "merge" | "replace"
): ImportResult {
  const result: ImportResult = {
    success: true,
    imported: {
      goalies: 0,
      teams: 0,
      seasons: 0,
      competitions: 0,
      matches: 0,
      events: 0,
      externalMappings: 0,
      standings: 0,
    },
    errors: [],
  };

  try {
    // Validate version
    if (!bundle.version || bundle.version > EXPORT_VERSION) {
      result.errors.push(
        `Neplatná verze exportu: ${bundle.version}. Podporovaná verze: ${EXPORT_VERSION}`
      );
      result.success = false;
      return result;
    }

    if (mode === "replace") {
      // Clear all data first
      setItem(STORAGE_KEYS.goalies, []);
      setItem(STORAGE_KEYS.teams, []);
      setItem(STORAGE_KEYS.seasons, []);
      setItem(STORAGE_KEYS.competitions, []);
      setItem(STORAGE_KEYS.matches, []);
      setItem(STORAGE_KEYS.events, []);
      setItem(STORAGE_KEYS.externalMappings, []);
      setItem(STORAGE_KEYS.standings, []);
    }

    // Import goalies
    if (bundle.goalies?.length) {
      const existing = mode === "merge" ? getGoalies() : [];
      const existingIds = new Set(existing.map((g) => g.id));
      bundle.goalies.forEach((goalie) => {
        if (!existingIds.has(goalie.id)) {
          saveGoalie(goalie);
          result.imported.goalies++;
        }
      });
    }

    // Import teams
    if (bundle.teams?.length) {
      const existing = mode === "merge" ? getTeams() : [];
      const existingIds = new Set(existing.map((t) => t.id));
      bundle.teams.forEach((team) => {
        if (!existingIds.has(team.id)) {
          saveTeam(team);
          result.imported.teams++;
        }
      });
    }

    // Import seasons
    if (bundle.seasons?.length) {
      const existing = mode === "merge" ? getSeasons() : [];
      const existingIds = new Set(existing.map((s) => s.id));
      bundle.seasons.forEach((season) => {
        if (!existingIds.has(season.id)) {
          saveSeason(season);
          result.imported.seasons++;
        }
      });
    }

    // Import competitions
    if (bundle.competitions?.length) {
      const existing = mode === "merge" ? getCompetitions() : [];
      const existingIds = new Set(existing.map((c) => c.id));
      bundle.competitions.forEach((competition) => {
        if (!existingIds.has(competition.id)) {
          saveCompetition(competition);
          result.imported.competitions++;
        }
      });
    }

    // Import matches
    if (bundle.matches?.length) {
      const existing = mode === "merge" ? getMatches() : [];
      const existingIds = new Set(existing.map((m) => m.id));
      bundle.matches.forEach((match) => {
        if (!existingIds.has(match.id)) {
          saveMatch(match);
          result.imported.matches++;
        }
      });
    }

    // Import events
    if (bundle.events?.length) {
      const existing = mode === "merge" ? getEvents() : [];
      const existingIds = new Set(existing.map((e) => e.id));
      bundle.events.forEach((event) => {
        if (!existingIds.has(event.id)) {
          saveEvent(event);
          result.imported.events++;
        }
      });
    }

    // Import external mappings
    if (bundle.externalMappings?.length) {
      const existing = mode === "merge" ? getExternalMappings() : [];
      const existingIds = new Set(existing.map((m) => m.id));
      bundle.externalMappings.forEach((mapping) => {
        if (!existingIds.has(mapping.id)) {
          saveExternalMapping(mapping);
          result.imported.externalMappings++;
        }
      });
    }

    // Import standings
    if (bundle.standings?.length) {
      const existing = mode === "merge" ? getStandings() : [];
      bundle.standings.forEach((standings) => {
        const existingStandings = existing.find(
          (s) =>
            s.competitionId === standings.competitionId &&
            s.seasonId === standings.seasonId
        );
        if (!existingStandings) {
          saveStandings(standings);
          result.imported.standings++;
        }
      });
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      `Chyba při importu: ${error instanceof Error ? error.message : "Neznámá chyba"}`
    );
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

export function getStorageStats(): {
  goalies: number;
  teams: number;
  seasons: number;
  competitions: number;
  matches: number;
  events: number;
} {
  return {
    goalies: getGoalies().length,
    teams: getTeams().length,
    seasons: getSeasons().length,
    competitions: getCompetitions().length,
    matches: getMatches().length,
    events: getEvents().length,
  };
}
