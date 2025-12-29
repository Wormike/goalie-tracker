/**
 * Matches Repository - Supabase integration for matches table
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Match, MatchType, MatchStatus } from "@/lib/types";
import { normalizeMatchStatus } from "@/lib/utils/matchStatus";

export function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Database types (match Supabase schema)
// ─────────────────────────────────────────────────────────────────────────────

export interface DbMatch {
  id: string;
  match_type: "friendly" | "league" | "tournament" | "playoff" | "cup";
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  home_team_id: string | null;
  home_team_name: string | null;
  away_team_id: string | null;
  away_team_name: string | null;
  competition_id: string | null;
  season_id: string | null;
  datetime: string;
  venue: string | null;
  goalie_id: string | null;
  home_score: number | null;
  away_score: number | null;
  manual_shots: number | null;
  manual_saves: number | null;
  manual_goals_against: number | null;
  source: string | null;
  external_id: string | null;
  external_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  home_team?: {
    id: string;
    name: string;
    short_name: string | null;
  } | null;
  goalie?: {
    id: string;
    first_name: string;
    last_name: string;
    jersey_number: number | null;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert database match to app Match type
 */
export function dbMatchToAppMatch(db: DbMatch): Match {
  // Normalizuj status - DB už používá nové hodnoty, jen pro jistotu
  const status = normalizeMatchStatus(db.status) as MatchStatus;
  const isCompleted = status === "completed" || status === "cancelled";
  
  return {
    id: db.id,
    // Teams
    home: db.home_team?.name || db.home_team_name || "Domácí",
    away: db.away_team_name || "Hosté",
    homeTeamId: db.home_team_id || undefined,
    homeTeamName: db.home_team_name || undefined,
    awayTeamId: db.away_team_id || undefined,
    awayTeamName: db.away_team_name || undefined,
    // Classification
    category: db.competition_id || "", // Legacy field
    matchType: (db.match_type || "friendly") as MatchType,
    competitionId: db.competition_id || undefined,
    seasonId: db.season_id || "",
    // Timing
    datetime: db.datetime,
    venue: db.venue || undefined,
    // Status
    status: status as MatchStatus,
    completed: isCompleted,
    // Scores
    homeScore: db.home_score ?? undefined,
    awayScore: db.away_score ?? undefined,
    // Goalie
    goalieId: db.goalie_id || undefined,
    // Manual stats
    manualStats: db.manual_shots != null ? {
      shots: db.manual_shots,
      saves: db.manual_saves || 0,
      goals: db.manual_goals_against || 0,
    } : undefined,
    // Source
source: (db.source || "manual") as "manual" | "imported" | "ceskyhokej",
    externalId: db.external_id || undefined,
    externalUrl: db.external_url || undefined,
    // Timestamps
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * Convert app Match to database insert/update payload
 */
export function appMatchToDbPayload(match: Partial<Match>): Partial<DbMatch> {
  const payload: Record<string, unknown> = {};
  
  if (match.homeTeamId !== undefined) payload.home_team_id = match.homeTeamId || null;
  if (match.homeTeamName !== undefined || match.home !== undefined) {
    payload.home_team_name = match.homeTeamName || match.home || null;
  }
  if (match.awayTeamId !== undefined) payload.away_team_id = match.awayTeamId || null;
  if (match.awayTeamName !== undefined || match.away !== undefined) {
    payload.away_team_name = match.awayTeamName || match.away || null;
  }
  if (match.datetime !== undefined) payload.datetime = match.datetime;
  if (match.competitionId !== undefined) {
    payload.competition_id = isUuid(match.competitionId) ? match.competitionId : null;
  }
  if (match.seasonId !== undefined) {
    payload.season_id = isUuid(match.seasonId) ? match.seasonId : null;
  }
  if (match.venue !== undefined) payload.venue = match.venue || null;
  if (match.matchType !== undefined) payload.match_type = match.matchType;
  
  // Normalizuj status před uložením do DB
  if (match.status !== undefined || match.completed !== undefined) {
    if (match.completed) {
      payload.status = "completed";
    } else {
      payload.status = normalizeMatchStatus(match.status) as "scheduled" | "in_progress" | "completed" | "cancelled";
    }
  }
  
  if (match.goalieId !== undefined) payload.goalie_id = match.goalieId || null;
  if (match.homeScore !== undefined) payload.home_score = match.homeScore ?? null;
  if (match.awayScore !== undefined) payload.away_score = match.awayScore ?? null;
  
  if (match.manualStats !== undefined) {
    payload.manual_shots = match.manualStats.shots ?? null;
    payload.manual_saves = match.manualStats.saves ?? null;
    payload.manual_goals_against = match.manualStats.goals ?? null;
  }
  
  if (match.source !== undefined) payload.source = match.source || null;
  if (match.externalId !== undefined) payload.external_id = match.externalId || null;
  if (match.externalUrl !== undefined) payload.external_url = match.externalUrl || null;
  
  return payload as Partial<DbMatch>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all matches, sorted by datetime descending
 */
export async function getMatches(): Promise<Match[]> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[matches] Supabase not configured, returning empty array");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("matches")
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name),
        goalie:goalies!matches_goalie_id_fkey(id, first_name, last_name, jersey_number)
      `)
      .order("datetime", { ascending: false });

    if (error) {
      console.warn("[matches] Error response fetching matches from Supabase:", error.message);
      return [];
    }

    return (data || []).map(dbMatchToAppMatch);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // In dev prostředí se často objevuje TypeError: Load failed, když není dostupná síť
    // nebo je Supabase URL špatně. Není to fatální – aplikace stejně přejde na localStorage.
    if (message.includes("Load failed")) {
      console.warn("[matches] Supabase request failed (Load failed) – falling back to local matches.");
    } else {
      console.error("[matches] Unexpected error fetching matches:", err);
    }
    return [];
  }
}

/**
 * Get match by ID
 */
export async function getMatchById(id: string): Promise<Match | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[matches] Supabase not configured");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("matches")
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name),
        goalie:goalies!matches_goalie_id_fkey(id, first_name, last_name, jersey_number)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("[matches] Error fetching match:", error.message);
      return null;
    }

    return data ? dbMatchToAppMatch(data) : null;
  } catch (err) {
    console.error("[matches] Unexpected error:", err);
    return null;
  }
}

/**
 * Create a new match
 */
export interface CreateMatchPayload {
  home_team_id?: string;
  home_team_name?: string;
  away_team_id?: string;
  away_team_name: string;
  datetime: string;
  competition_id?: string;
  season_id?: string;
  venue?: string;
  match_type?: "friendly" | "league" | "tournament" | "playoff" | "cup";
  status?: MatchStatus; // Použij nový typ
  goalie_id?: string;
  home_score?: number;
  away_score?: number;
  manual_shots?: number;
  manual_saves?: number;
  manual_goals_against?: number;
  source?: string;
  external_id?: string;
  external_url?: string;
  completed?: boolean;
}

export async function createMatch(payload: CreateMatchPayload): Promise<Match | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[matches] Supabase not configured");
    return null;
  }

  try {
    const cleanPayload = {
      home_team_id: isUuid(payload.home_team_id) ? payload.home_team_id : null,
      home_team_name: payload.home_team_name || null,
      away_team_id: isUuid(payload.away_team_id) ? payload.away_team_id : null,
      away_team_name: payload.away_team_name,
      datetime: payload.datetime,
      competition_id: isUuid(payload.competition_id) ? payload.competition_id : null,
      season_id: isUuid(payload.season_id) ? payload.season_id : null,
      venue: payload.venue || null,
      match_type: payload.match_type || "friendly",
      status: normalizeMatchStatus(payload.status) as "scheduled" | "in_progress" | "completed" | "cancelled",
      goalie_id: isUuid(payload.goalie_id) ? payload.goalie_id : null,
      home_score: payload.home_score ?? null,
      away_score: payload.away_score ?? null,
      manual_shots: payload.manual_shots ?? null,
      manual_saves: payload.manual_saves ?? null,
      manual_goals_against: payload.manual_goals_against ?? null,
      source: payload.source || "manual",
      external_id: payload.external_id || null,
      external_url: payload.external_url || null,
    };

    const { data, error } = await supabase
      .from("matches")
      .insert(cleanPayload)
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name),
        goalie:goalies!matches_goalie_id_fkey(id, first_name, last_name, jersey_number)
      `)
      .single();

    if (error) {
      console.error("[matches] Error creating match:", error.message);
      return null;
    }

    return data ? dbMatchToAppMatch(data) : null;
  } catch (err) {
    console.error("[matches] Unexpected error:", err);
    return null;
  }
}

/**
 * Update a match
 */
export async function updateMatch(
  id: string,
  payload: Partial<CreateMatchPayload>
): Promise<Match | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[matches] Supabase not configured");
    return null;
  }

  try {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (payload.home_team_id !== undefined) updatePayload.home_team_id = payload.home_team_id || null;
    if (payload.home_team_name !== undefined) updatePayload.home_team_name = payload.home_team_name || null;
    if (payload.away_team_id !== undefined) updatePayload.away_team_id = payload.away_team_id || null;
    if (payload.away_team_name !== undefined) updatePayload.away_team_name = payload.away_team_name;
    if (payload.datetime !== undefined) updatePayload.datetime = payload.datetime;
    if (payload.competition_id !== undefined) updatePayload.competition_id = payload.competition_id || null;
    if (payload.season_id !== undefined) updatePayload.season_id = payload.season_id || null;
    if (payload.venue !== undefined) updatePayload.venue = payload.venue || null;
    if (payload.match_type !== undefined) updatePayload.match_type = payload.match_type;
    if (payload.status !== undefined) updatePayload.status = payload.status;
    if (payload.goalie_id !== undefined) updatePayload.goalie_id = payload.goalie_id || null;
    if (payload.home_score !== undefined) updatePayload.home_score = payload.home_score;
    if (payload.away_score !== undefined) updatePayload.away_score = payload.away_score;
    if (payload.manual_shots !== undefined) updatePayload.manual_shots = payload.manual_shots ?? null;
    if (payload.manual_saves !== undefined) updatePayload.manual_saves = payload.manual_saves ?? null;
    if (payload.manual_goals_against !== undefined) updatePayload.manual_goals_against = payload.manual_goals_against ?? null;
    if (payload.source !== undefined) updatePayload.source = payload.source || null;
    if (payload.external_id !== undefined) updatePayload.external_id = payload.external_id || null;
    if (payload.external_url !== undefined) updatePayload.external_url = payload.external_url || null;

    const { data, error } = await supabase
      .from("matches")
      .update(updatePayload)
      .eq("id", id)
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name),
        goalie:goalies!matches_goalie_id_fkey(id, first_name, last_name, jersey_number)
      `)
      .single();

    if (error) {
      console.error("[matches] Error updating match:", error.message);
      return null;
    }

    return data ? dbMatchToAppMatch(data) : null;
  } catch (err) {
    console.error("[matches] Unexpected error:", err);
    return null;
  }
}

/**
 * Delete a match
 */
export async function deleteMatch(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[matches] Supabase not configured");
    return false;
  }

  try {
    const { error } = await supabase
      .from("matches")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[matches] Error deleting match:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[matches] Unexpected error:", err);
    return false;
  }
}

