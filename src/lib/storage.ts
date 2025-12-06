"use client";

import type { Goalie, GoalieEvent, Match, Season } from "./types";

const STORAGE_KEYS = {
  goalies: "goalie-tracker-goalies",
  matches: "goalie-tracker-matches",
  events: "goalie-tracker-events",
  seasons: "goalie-tracker-seasons",
} as const;

// Default season
const DEFAULT_SEASON: Season = {
  id: "2024-2025",
  name: "2024/2025",
  startDate: "2024-09-01",
  endDate: "2025-06-30",
  isActive: true,
};

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

// Goalies
export function getGoalies(): Goalie[] {
  return getItem<Goalie[]>(STORAGE_KEYS.goalies, []);
}

export function saveGoalie(goalie: Goalie): void {
  const goalies = getGoalies();
  const index = goalies.findIndex((g) => g.id === goalie.id);
  if (index >= 0) {
    goalies[index] = goalie;
  } else {
    goalies.push(goalie);
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

// Matches
export function getMatches(): Match[] {
  return getItem<Match[]>(STORAGE_KEYS.matches, []);
}

export function saveMatch(match: Match): void {
  const matches = getMatches();
  const index = matches.findIndex((m) => m.id === match.id);
  if (index >= 0) {
    matches[index] = match;
  } else {
    matches.push(match);
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
  return getMatches().find((m) => m.id === id);
}

// Events
export function getEvents(): GoalieEvent[] {
  return getItem<GoalieEvent[]>(STORAGE_KEYS.events, []);
}

export function getEventsByMatch(matchId: string): GoalieEvent[] {
  return getEvents().filter((e) => e.matchId === matchId);
}

export function getEventsByGoalie(goalieId: string): GoalieEvent[] {
  return getEvents().filter((e) => e.goalieId === goalieId);
}

export function saveEvent(event: GoalieEvent): void {
  const events = getEvents();
  const index = events.findIndex((e) => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
  } else {
    events.push(event);
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

// Seasons
export function getSeasons(): Season[] {
  const seasons = getItem<Season[]>(STORAGE_KEYS.seasons, []);
  if (seasons.length === 0) {
    setItem(STORAGE_KEYS.seasons, [DEFAULT_SEASON]);
    return [DEFAULT_SEASON];
  }
  return seasons;
}

export function getActiveSeason(): Season {
  const seasons = getSeasons();
  return seasons.find((s) => s.isActive) || seasons[0] || DEFAULT_SEASON;
}

export function saveSeason(season: Season): void {
  const seasons = getSeasons();
  const index = seasons.findIndex((s) => s.id === season.id);
  if (index >= 0) {
    seasons[index] = season;
  } else {
    seasons.push(season);
  }
  setItem(STORAGE_KEYS.seasons, seasons);
}

// Stats calculation - includes both event-based and manual stats
export function calculateGoalieStats(goalieId: string, seasonId?: string) {
  const matches = getMatches().filter(
    (m) => m.goalieId === goalieId && (!seasonId || m.seasonId === seasonId)
  );
  const events = getEvents().filter((e) => e.goalieId === goalieId);

  const matchIds = new Set(matches.map((m) => m.id));
  const relevantEvents = events.filter((e) => matchIds.has(e.matchId));

  // Calculate from events
  let totalShots = relevantEvents.filter(
    (e) => e.result === "save" || e.result === "goal"
  ).length;
  let totalSaves = relevantEvents.filter((e) => e.result === "save").length;
  let totalGoals = relevantEvents.filter((e) => e.result === "goal").length;

  // Add manual stats from matches
  matches.forEach((match) => {
    if (match.manualStats && match.manualStats.shots > 0) {
      // Check if this match has event-based stats
      const matchEventCount = relevantEvents.filter(
        (e) => e.matchId === match.id
      ).length;

      // If no events, use manual stats
      if (matchEventCount === 0) {
        totalShots += match.manualStats.shots;
        totalSaves += match.manualStats.saves;
        totalGoals += match.manualStats.goals;
      }
    }
  });

  const savePercentage = totalShots > 0 ? (totalSaves / totalShots) * 100 : 0;

  // Count shutouts (matches where goalie had 0 goals against)
  const shutouts = matches.filter((match) => {
    // Check event-based first
    const matchEvents = relevantEvents.filter((e) => e.matchId === match.id);
    if (matchEvents.length > 0) {
      const goalsAgainst = matchEvents.filter((e) => e.result === "goal").length;
      return goalsAgainst === 0;
    }
    // Check manual stats
    if (match.manualStats && match.manualStats.shots > 0) {
      return match.manualStats.goals === 0;
    }
    return false;
  }).length;

  return {
    goalieId,
    seasonId: seasonId || "all",
    gamesPlayed: matches.length,
    totalShots,
    totalSaves,
    totalGoals,
    savePercentage,
    shutouts,
    wins: 0,
    losses: 0,
    otLosses: 0,
  };
}
