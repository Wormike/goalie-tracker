"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { emitToast } from "@/contexts/ToastContext";
import { generateId, isUuid } from "@/lib/utils/uuid";
import type { Competition, Goalie, GoalieEvent, GoalieSeasonStats, Match } from "@/lib/types";
import * as storage from "@/lib/storage";
import * as matchesRepo from "@/lib/repositories/matches";
import * as goaliesRepo from "@/lib/repositories/goalies";
import * as eventsRepo from "@/lib/repositories/events";
import type { CreateEventPayload } from "@/lib/repositories/events";
import * as competitionsRepo from "@/lib/repositories/competitions";
import { COMPETITION_PRESETS } from "@/lib/competitionPresets";

const ID_MAP_KEY = "goalie-tracker-id-map";

function getIdMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ID_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveIdMap(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function ensureUuid(id: string): string {
  if (isUuid(id)) return id;
  const map = getIdMap();
  if (map[id]) return map[id];
  const next = generateId();
  map[id] = next;
  saveIdMap(map);
  return next;
}

function normalizeMatchIds(match: Match): Match {
  return {
    ...match,
    id: match.id ? ensureUuid(match.id) : generateId(),
    homeTeamId: match.homeTeamId ? ensureUuid(match.homeTeamId) : match.homeTeamId,
    awayTeamId: match.awayTeamId ? ensureUuid(match.awayTeamId) : match.awayTeamId,
    competitionId: match.competitionId ? ensureUuid(match.competitionId) : match.competitionId,
    goalieId: match.goalieId ? ensureUuid(match.goalieId) : match.goalieId,
  };
}

function normalizeGoalieIds(goalie: Goalie): Goalie {
  return {
    ...goalie,
    id: goalie.id ? ensureUuid(goalie.id) : generateId(),
    teamId: goalie.teamId ? ensureUuid(goalie.teamId) : goalie.teamId,
    competitionId: goalie.competitionId ? ensureUuid(goalie.competitionId) : goalie.competitionId,
  };
}

function normalizeEventIds(event: GoalieEvent): GoalieEvent {
  return {
    ...event,
    id: event.id ? ensureUuid(event.id) : generateId(),
    matchId: ensureUuid(event.matchId),
    goalieId: ensureUuid(event.goalieId),
  };
}

function normalizeEventStatus(status?: GoalieEvent["status"]): "confirmed" | "pending" | "deleted" | undefined {
  if (!status) return undefined;
  if (status === "edited") return "confirmed";
  return status as "confirmed" | "pending" | "deleted";
}

function mapSituationToPayload(
  situation?: GoalieEvent["situation"]
): "even" | "pp" | "sh" | "4v4" | "3v3" | undefined {
  if (!situation) return undefined;
  if (situation === "powerplay") return "pp";
  if (situation === "shorthanded") return "sh";
  return situation as "even" | "pp" | "sh" | "4v4" | "3v3";
}

function eventToPayload(event: GoalieEvent): CreateEventPayload {
  const period = event.period === "OT" ? "OT" : (String(event.period) as "1" | "2" | "3");
  const status = normalizeEventStatus(event.status);
  const situation = mapSituationToPayload(event.situation);
  return {
    match_id: event.matchId,
    goalie_id: event.goalieId || undefined,
    period,
    game_time: event.gameTime || "00:00",
    result: event.result,
    shot_x: event.shotPosition?.x,
    shot_y: event.shotPosition?.y,
    shot_zone: event.shotPosition?.zone,
    goal_x: event.goalPosition?.x,
    goal_y: event.goalPosition?.y,
    goal_zone: event.goalPosition?.zone,
    shot_type: event.shotType,
    save_type: event.saveType,
    goal_type: event.goalType,
    situation,
    is_rebound: event.isRebound ?? event.rebound,
    is_screened: event.isScreened ?? event.screenedView,
    status,
    input_source: event.inputSource,
  };
}

function matchToCreatePayload(match: Match): matchesRepo.CreateMatchPayload {
  return {
    home_team_id: match.homeTeamId,
    home_team_name: match.homeTeamName || match.home,
    away_team_id: match.awayTeamId,
    away_team_name: match.awayTeamName || match.away,
    datetime: match.datetime,
    competition_id: match.competitionId,
    season_id: match.seasonId,
    venue: match.venue,
    match_type: match.matchType,
    status: match.status,
    goalie_id: match.goalieId,
    home_score: match.homeScore,
    away_score: match.awayScore,
    manual_shots: match.manualStats?.shots,
    manual_saves: match.manualStats?.saves,
    manual_goals_against: match.manualStats?.goals,
    source: match.source,
    external_id: match.externalId,
    external_url: match.externalUrl,
    completed: match.completed,
  };
}

export const dataService = {
  async getMatches(): Promise<Match[]> {
    if (isSupabaseConfigured()) {
      try {
        const remote = await matchesRepo.getMatches();
        remote.forEach((m) => storage.saveMatch(m));
        return remote;
      } catch (err) {
        console.error("[dataService] getMatches failed, falling back to local:", err);
      }
    }
    return storage.getMatches();
  },

  async saveMatch(match: Match): Promise<Match> {
    const normalized = normalizeMatchIds(match);

    if (isSupabaseConfigured()) {
      const payload = matchToCreatePayload(normalized);
      let saved: Match | null = null;
      if (isUuid(normalized.id)) {
        saved = await matchesRepo.updateMatch(normalized.id, payload);
      }
      if (!saved) {
        saved = await matchesRepo.createMatch(payload);
      }
      if (saved) {
        storage.saveMatch(saved);
        return saved;
      }
      emitToast("Nepodařilo se uložit do cloudu. Data jsou uložena lokálně.", "error");
    }

    storage.saveMatch(normalized);
    return normalized;
  },

  async deleteMatch(id: string): Promise<boolean> {
    const normalizedId = ensureUuid(id);
    let success = true;
    if (isSupabaseConfigured() && isUuid(normalizedId)) {
      success = await matchesRepo.deleteMatch(normalizedId);
    }
    storage.deleteMatch(id);
    return success;
  },

  async getGoalies(): Promise<Goalie[]> {
    if (isSupabaseConfigured()) {
      try {
        const remote = await goaliesRepo.getGoalies();
        remote.forEach((g) => storage.saveGoalie(g));
        return remote;
      } catch (err) {
        console.error("[dataService] getGoalies failed, falling back to local:", err);
      }
    }
    return storage.getGoalies();
  },

  async saveGoalie(goalie: Goalie): Promise<Goalie> {
    const normalized = normalizeGoalieIds(goalie);

    if (isSupabaseConfigured()) {
      let saved: Goalie | null = null;
      if (isUuid(normalized.id)) {
        saved = await goaliesRepo.updateGoalie(normalized.id, normalized);
      }
      if (!saved) {
        saved = await goaliesRepo.createGoalie(normalized);
      }
      if (saved) {
        storage.saveGoalie(saved);
        return saved;
      }
      emitToast("Nepodařilo se uložit do cloudu. Data jsou uložena lokálně.", "error");
    }

    storage.saveGoalie(normalized);
    return normalized;
  },

  async deleteGoalie(id: string): Promise<boolean> {
    const normalizedId = ensureUuid(id);
    let success = true;
    if (isSupabaseConfigured() && isUuid(normalizedId)) {
      success = await goaliesRepo.deleteGoalie(normalizedId);
    }
    storage.deleteGoalie(id);
    return success;
  },

  async getEvents(matchId?: string): Promise<GoalieEvent[]> {
    if (isSupabaseConfigured()) {
      try {
        if (matchId && isUuid(matchId)) {
          const remote = await eventsRepo.getEventsForMatch(matchId);
          return remote;
        }
        const remote = await eventsRepo.getAllEvents();
        return remote;
      } catch (err) {
        console.error("[dataService] getEvents failed, falling back to local:", err);
      }
    }
    const events = storage.getEvents();
    return matchId ? events.filter((e) => e.matchId === matchId) : events;
  },

  async saveEvent(event: GoalieEvent): Promise<GoalieEvent> {
    const normalized = normalizeEventIds(event);
    const payload = eventToPayload(normalized);

    if (isSupabaseConfigured()) {
      let saved: GoalieEvent | null = null;
      if (isUuid(normalized.id)) {
        const { match_id: _matchId, ...updatePayload } = payload;
        saved = await eventsRepo.updateEvent(normalized.id, updatePayload);
      }
      if (!saved) {
        saved = await eventsRepo.createEvent(payload);
      }
      if (saved) {
        storage.saveEvent(saved);
        return saved;
      }
      emitToast("Nepodařilo se uložit do cloudu. Data jsou uložena lokálně.", "error");
    }

    storage.saveEvent(normalized);
    return normalized;
  },

  async deleteEvent(id: string): Promise<boolean> {
    const normalizedId = ensureUuid(id);
    let success = true;
    if (isSupabaseConfigured() && isUuid(normalizedId)) {
      success = await eventsRepo.deleteEvent(normalizedId);
    }
    storage.deleteEvent(id);
    return success;
  },

  async getCompetitions(): Promise<Competition[]> {
    if (isSupabaseConfigured()) {
      try {
        const remote = await competitionsRepo.getCompetitions();
        return remote;
      } catch (err) {
        console.error("[dataService] getCompetitions failed, falling back to local:", err);
      }
    }
    return storage.getCompetitions();
  },

  async saveCompetition(comp: Competition): Promise<Competition> {
    const normalized: Competition = {
      ...comp,
      id: comp.id ? ensureUuid(comp.id) : generateId(),
    };

    if (isSupabaseConfigured()) {
      let saved: Competition | null = null;
      if (isUuid(normalized.id)) {
        saved = await competitionsRepo.updateCompetition(normalized.id, normalized);
      }
      if (!saved) {
        saved = await competitionsRepo.createCompetition(normalized);
      }
      if (saved) {
        storage.saveCompetition(saved);
        return saved;
      }
      emitToast("Nepodařilo se uložit do cloudu. Data jsou uložena lokálně.", "error");
    }

    storage.saveCompetition(normalized);
    return normalized;
  },

  async calculateGoalieStats(goalieId: string, seasonId?: string, competitionId?: string): Promise<GoalieSeasonStats> {
    const [events, matches] = await Promise.all([
      this.getEvents(),
      this.getMatches(),
    ]);
    return storage.calculateGoalieStats(goalieId, seasonId, competitionId, events, matches);
  },
};

type SeedSeason = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
  isCurrent: boolean;
};

const SEASON_PRESETS: SeedSeason[] = [
  {
    id: "2024-2025",
    name: "2024/2025",
    startDate: "2024-09-01",
    endDate: "2025-06-30",
    startYear: 2024,
    endYear: 2025,
    isCurrent: false,
  },
  {
    id: "2025-2026",
    name: "2025/2026",
    startDate: "2025-09-01",
    endDate: "2026-06-30",
    startYear: 2025,
    endYear: 2026,
    isCurrent: true,
  },
];

export async function ensureSeasonsExist(): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    const rows = SEASON_PRESETS.map((s) => ({
      id: s.id,
      name: s.name,
      start_date: s.startDate,
      end_date: s.endDate,
      start_year: s.startYear,
      end_year: s.endYear,
      is_current: s.isCurrent,
    }));
    const { error } = await supabase.from("seasons").upsert(rows, { onConflict: "id" });
    if (error) {
      console.error("[seed] Failed to ensure seasons:", error.message);
    }
    return;
  }

  SEASON_PRESETS.forEach((s) => {
    const existing = storage.getSeasonById(s.id);
    if (!existing) {
      storage.saveSeason({
        id: s.id,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        startYear: s.startYear,
        endYear: s.endYear,
        isActive: s.isCurrent,
        isCurrent: s.isCurrent,
      });
    }
  });
}

export async function ensurePresetsExist(): Promise<void> {
  if (isSupabaseConfigured()) {
    for (const preset of COMPETITION_PRESETS) {
      const existing = preset.externalId
        ? await competitionsRepo.findCompetitionByExternalId(preset.externalId)
        : null;
      if (!existing) {
        await competitionsRepo.createCompetition({
          name: preset.name,
          category: preset.name,
          seasonId: preset.season,
          externalId: preset.externalId,
          leagueFilter: preset.leagueFilter,
          parentId: preset.parentId,
          source: "ceskyhokej",
          standingsUrl: preset.standingsUrl,
        });
      }
    }
    return;
  }

  const local = storage.getCompetitions();
  for (const preset of COMPETITION_PRESETS) {
    const byExternalId = preset.externalId
      ? local.find((c) => c.externalId === preset.externalId)
      : undefined;
    if (byExternalId) continue;

    const byName = local.find((c) => c.name.toLowerCase() === preset.name.toLowerCase());
    if (byName) {
      storage.saveCompetition({
        ...byName,
        externalId: preset.externalId,
        source: "ceskyhokej",
        seasonId: preset.season,
        standingsUrl: preset.standingsUrl,
      });
      continue;
    }

    storage.saveCompetition({
      id: preset.id,
      name: preset.name,
      category: preset.name,
      seasonId: preset.season,
      externalId: preset.externalId,
      leagueFilter: preset.leagueFilter,
      parentId: preset.parentId,
      source: "ceskyhokej",
      standingsUrl: preset.standingsUrl,
      createdAt: new Date().toISOString(),
    });
  }
}

