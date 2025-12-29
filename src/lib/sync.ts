/**
 * Data Sync - Synchronizace mezi localStorage a Supabase
 * 
 * Umožňuje:
 * 1. Přenést existující data z localStorage do Supabase
 * 2. Stáhnout data ze Supabase do localStorage
 * 3. Detekovat konflikty a řešit je
 */

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import * as storage from "./storage";
import type { Goalie, Match, GoalieEvent, Competition, Season, Team } from "./types";
import { v4 as uuidv4 } from "uuid";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  uploaded: {
    goalies: number;
    matches: number;
    events: number;
    competitions: number;
    teams: number;
  };
  errors: string[];
}

export interface SyncStatus {
  isConfigured: boolean;
  lastSync: string | null;
  localCounts: {
    goalies: number;
    matches: number;
    events: number;
  };
  remoteCounts: {
    goalies: number;
    matches: number;
    events: number;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Check if ID is valid UUID
// ─────────────────────────────────────────────────────────────────────────────

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Generate UUID if needed
// ─────────────────────────────────────────────────────────────────────────────

function ensureUuid(id: string): string {
  return isValidUuid(id) ? id : uuidv4();
}

// ─────────────────────────────────────────────────────────────────────────────
// Check Sync Status
// ─────────────────────────────────────────────────────────────────────────────

export async function getSyncStatus(): Promise<SyncStatus> {
  const localCounts = {
    goalies: storage.getGoalies().length,
    matches: storage.getMatches().length,
    events: storage.getEvents().length,
  };

  if (!isSupabaseConfigured() || !supabase) {
    return {
      isConfigured: false,
      lastSync: null,
      localCounts,
      remoteCounts: null,
    };
  }

  try {
    const [goaliesRes, matchesRes, eventsRes] = await Promise.all([
      supabase.from("goalies").select("id", { count: "exact", head: true }),
      supabase.from("matches").select("id", { count: "exact", head: true }),
      supabase.from("goalie_events").select("id", { count: "exact", head: true }),
    ]);

    return {
      isConfigured: true,
      lastSync: localStorage.getItem("lastSupabaseSync"),
      localCounts,
      remoteCounts: {
        goalies: goaliesRes.count || 0,
        matches: matchesRes.count || 0,
        events: eventsRes.count || 0,
      },
    };
  } catch (err) {
    console.error("[sync] Error getting status:", err);
    return {
      isConfigured: true,
      lastSync: null,
      localCounts,
      remoteCounts: null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Local Data to Supabase
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadToSupabase(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    uploaded: {
      goalies: 0,
      matches: 0,
      events: 0,
      competitions: 0,
      teams: 0,
    },
    errors: [],
  };

  if (!isSupabaseConfigured() || !supabase) {
    result.success = false;
    result.errors.push("Supabase není nakonfigurován. Nastav NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY v .env.local");
    return result;
  }

  try {
    // 1. Upload Teams
    const teams = storage.getTeams();
    if (teams.length > 0) {
      const teamsPayload = teams.map((t) => ({
        id: ensureUuid(t.id),
        name: t.name,
        short_name: t.shortName || null,
        club_external_id: t.clubExternalId || null,
        team_external_id: t.teamExternalId || null,
      }));

      const { error: teamsError } = await supabase
        .from("teams")
        .upsert(teamsPayload, { onConflict: "id" });

      if (teamsError) {
        result.errors.push(`Teams: ${teamsError.message}`);
      } else {
        result.uploaded.teams = teams.length;
      }
    }

    // 2. Upload Competitions
    const competitions = storage.getCompetitions();
    if (competitions.length > 0) {
      const compsPayload = competitions.map((c) => ({
        id: ensureUuid(c.id),
        name: c.name,
        category: c.category || null,
        season_id: c.seasonId || null,
        external_id: c.externalId || null,
        source: c.source || "manual",
        standings_url: c.standingsUrl || null,
      }));

      const { error: compsError } = await supabase
        .from("competitions")
        .upsert(compsPayload, { onConflict: "id" });

      if (compsError) {
        result.errors.push(`Competitions: ${compsError.message}`);
      } else {
        result.uploaded.competitions = competitions.length;
      }
    }

    // 3. Upload Goalies
    const goalies = storage.getGoalies();
    const goalieIdMap = new Map<string, string>(); // old ID -> new UUID

    if (goalies.length > 0) {
      const goaliesPayload = goalies.map((g) => {
        const newId = ensureUuid(g.id);
        goalieIdMap.set(g.id, newId);
        return {
          id: newId,
          first_name: g.firstName,
          last_name: g.lastName,
          birth_year: g.birthYear || null,
          team: g.team || null,
          jersey_number: g.jerseyNumber || null,
          catch_hand: g.catchHand || null,
          photo_url: g.photo || g.profilePhotoUrl || null,
          note: g.note || null,
        };
      });

      const { error: goaliesError } = await supabase
        .from("goalies")
        .upsert(goaliesPayload, { onConflict: "id" });

      if (goaliesError) {
        result.errors.push(`Goalies: ${goaliesError.message}`);
      } else {
        result.uploaded.goalies = goalies.length;
      }
    }

    // 4. Upload Matches
    const matches = storage.getMatches();
    const matchIdMap = new Map<string, string>(); // old ID -> new UUID

    if (matches.length > 0) {
      const matchesPayload = matches.map((m) => {
        const newId = ensureUuid(m.id);
        matchIdMap.set(m.id, newId);
        
        // Get mapped goalie ID
        const goalieId = m.goalieId ? goalieIdMap.get(m.goalieId) || null : null;
        
        return {
          id: newId,
          home_team_name: m.home,
          away_team_name: m.away,
          type: m.matchType || "friendly",
          competition: m.category || null,
          season: m.seasonId || null,
          datetime: m.datetime,
          venue: m.venue || null,
          status: m.completed ? "closed" : (m.status || "open"),
          home_score: m.homeScore ?? null,
          away_score: m.awayScore ?? null,
          goalie_id: isValidUuid(goalieId || "") ? goalieId : null,
          source: m.source || "manual",
          external_id: m.externalId || null,
          external_url: m.externalUrl || null,
          manual_shots: m.manualStats?.shots ?? null,
          manual_saves: m.manualStats?.saves ?? null,
          manual_goals: m.manualStats?.goals ?? null,
        };
      });

      const { error: matchesError } = await supabase
        .from("matches")
        .upsert(matchesPayload, { onConflict: "id" });

      if (matchesError) {
        result.errors.push(`Matches: ${matchesError.message}`);
      } else {
        result.uploaded.matches = matches.length;
      }
    }

    // 5. Upload Events
    const events = storage.getEvents();
    if (events.length > 0) {
      const eventsPayload = events
        .filter((e) => e.status !== "deleted")
        .map((e) => {
          const matchId = matchIdMap.get(e.matchId) || e.matchId;
          const goalieId = goalieIdMap.get(e.goalieId) || e.goalieId;

          return {
            id: ensureUuid(e.id),
            match_id: isValidUuid(matchId) ? matchId : null,
            goalie_id: isValidUuid(goalieId) ? goalieId : null,
            period: String(e.period) as "1" | "2" | "3" | "OT",
            game_time: e.gameTime || null,
            result: e.result,
            shot_x: e.shotPosition?.x ?? null,
            shot_y: e.shotPosition?.y ?? null,
            shot_zone: e.shotPosition?.zone || null,
            goal_x: e.goalPosition?.x ?? null,
            goal_y: e.goalPosition?.y ?? null,
            shot_target: e.shotTarget || null,
            save_type: e.saveType || null,
            goal_type: e.goalType || null,
            situation: e.situation || "even",
            is_rebound: e.rebound || false,
            screened_view: e.screenedView || false,
            input_source: e.inputSource || "manual",
            status: e.status || "confirmed",
          };
        })
        .filter((e) => e.match_id !== null); // Only upload events with valid match_id

      if (eventsPayload.length > 0) {
        const { error: eventsError } = await supabase
          .from("goalie_events")
          .upsert(eventsPayload, { onConflict: "id" });

        if (eventsError) {
          result.errors.push(`Events: ${eventsError.message}`);
        } else {
          result.uploaded.events = eventsPayload.length;
        }
      }
    }

    // Mark sync time
    if (result.errors.length === 0) {
      localStorage.setItem("lastSupabaseSync", new Date().toISOString());
    } else {
      result.success = false;
    }

  } catch (err) {
    result.success = false;
    result.errors.push(`Neočekávaná chyba: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Download from Supabase to LocalStorage
// ─────────────────────────────────────────────────────────────────────────────

export async function downloadFromSupabase(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    uploaded: {
      goalies: 0,
      matches: 0,
      events: 0,
      competitions: 0,
      teams: 0,
    },
    errors: [],
  };

  if (!isSupabaseConfigured() || !supabase) {
    result.success = false;
    result.errors.push("Supabase není nakonfigurován");
    return result;
  }

  try {
    // 1. Download Goalies
    const { data: goaliesData, error: goaliesError } = await supabase
      .from("goalies")
      .select("*");

    if (goaliesError) {
      result.errors.push(`Goalies: ${goaliesError.message}`);
    } else if (goaliesData) {
      goaliesData.forEach((g) => {
        const goalie: Goalie = {
          id: g.id,
          firstName: g.first_name,
          lastName: g.last_name,
          birthYear: g.birth_year || 0,
          team: g.team || "",
          jerseyNumber: g.jersey_number || undefined,
          catchHand: g.catch_hand || undefined,
          photo: g.photo_url || undefined,
          note: g.note || undefined,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
        };
        storage.saveGoalie(goalie);
      });
      result.uploaded.goalies = goaliesData.length;
    }

    // 2. Download Matches
    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*");

    if (matchesError) {
      result.errors.push(`Matches: ${matchesError.message}`);
    } else if (matchesData) {
      matchesData.forEach((m) => {
        const match: Match = {
          id: m.id,
          home: m.home_team_name || "Domácí",
          away: m.away_team_name || "Hosté",
          category: m.competition || "",
          matchType: m.type || "friendly",
          seasonId: m.season || "",
          datetime: m.datetime,
          venue: m.venue || undefined,
          status: m.status || "open",
          completed: m.status === "closed",
          homeScore: m.home_score ?? undefined,
          awayScore: m.away_score ?? undefined,
          goalieId: m.goalie_id || undefined,
          source: m.source || "manual",
          externalId: m.external_id || undefined,
          externalUrl: m.external_url || undefined,
          manualStats: m.manual_shots != null ? {
            shots: m.manual_shots,
            saves: m.manual_saves || 0,
            goals: m.manual_goals || 0,
          } : undefined,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
        };
        storage.saveMatch(match);
      });
      result.uploaded.matches = matchesData.length;
    }

    // 3. Download Events
    const { data: eventsData, error: eventsError } = await supabase
      .from("goalie_events")
      .select("*");

    if (eventsError) {
      result.errors.push(`Events: ${eventsError.message}`);
    } else if (eventsData) {
      eventsData.forEach((e) => {
        const event: GoalieEvent = {
          id: e.id,
          matchId: e.match_id,
          goalieId: e.goalie_id || "",
          period: e.period === "OT" ? "OT" : parseInt(e.period) as 1 | 2 | 3,
          gameTime: e.game_time || "00:00",
          timestamp: e.created_at,
          result: e.result,
          shotPosition: e.shot_x != null && e.shot_y != null ? {
            x: e.shot_x,
            y: e.shot_y,
            zone: e.shot_zone || "slot",
          } : undefined,
          goalPosition: e.goal_x != null && e.goal_y != null ? {
            x: e.goal_x,
            y: e.goal_y,
            zone: "middle_center",
          } : undefined,
          shotTarget: e.shot_target || undefined,
          saveType: e.save_type || undefined,
          goalType: e.goal_type || undefined,
          situation: e.situation || "even",
          rebound: e.is_rebound || false,
          screenedView: e.screened_view || false,
          inputSource: e.input_source || "manual",
          status: e.status || "confirmed",
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        };
        storage.saveEvent(event);
      });
      result.uploaded.events = eventsData.length;
    }

    // Mark sync time
    if (result.errors.length === 0) {
      localStorage.setItem("lastSupabaseSync", new Date().toISOString());
    } else {
      result.success = false;
    }

  } catch (err) {
    result.success = false;
    result.errors.push(`Neočekávaná chyba: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}




