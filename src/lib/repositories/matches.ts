/**
 * Matches Repository - Supabase integration for matches table
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Match, MatchType, MatchStatus } from "@/lib/types";

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
  type: "friendly" | "league" | "tournament" | "cup";
  status: "open" | "closed";
  home_team_id: string | null;
  away_team_name: string | null;
  datetime: string;
  competition: string | null;
  season: string | null;
  venue: string | null;
  goalie_id: string | null;
  home_score: number | null;
  away_score: number | null;
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
    name: string;
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
  return {
    id: db.id,
    // Teams
    home: db.home_team?.name || "Domácí",
    away: db.away_team_name || "Hosté",
    homeTeamId: db.home_team_id || undefined,
    awayTeamName: db.away_team_name || undefined,
    // Classification
    category: db.competition || "",
    matchType: db.type as MatchType,
    seasonId: db.season || "",
    // Timing
    datetime: db.datetime,
    venue: db.venue || undefined,
    // Status
    status: db.status as MatchStatus,
    completed: db.status === "closed",
    // Scores
    homeScore: db.home_score ?? undefined,
    awayScore: db.away_score ?? undefined,
    // Goalie
    goalieId: db.goalie_id || undefined,
    // Timestamps
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    // Source
    source: "manual",
  };
}

/**
 * Convert app Match to database insert/update payload
 */
export function appMatchToDbPayload(match: Partial<Match>): Partial<DbMatch> {
  const payload: Record<string, unknown> = {};
  
  if (match.homeTeamId !== undefined) payload.home_team_id = match.homeTeamId || null;
  if (match.awayTeamName !== undefined || match.away !== undefined) {
    payload.away_team_name = match.awayTeamName || match.away || null;
  }
  if (match.datetime !== undefined) payload.datetime = match.datetime;
  if (match.category !== undefined) payload.competition = match.category || null;
  if (match.seasonId !== undefined) payload.season = match.seasonId || null;
  if (match.venue !== undefined) payload.venue = match.venue || null;
  if (match.matchType !== undefined) payload.type = match.matchType;
  if (match.status !== undefined) payload.status = match.status;
  if (match.completed !== undefined) payload.status = match.completed ? "closed" : "open";
  if (match.goalieId !== undefined) payload.goalie_id = match.goalieId || null;
  if (match.homeScore !== undefined) payload.home_score = match.homeScore ?? null;
  if (match.awayScore !== undefined) payload.away_score = match.awayScore ?? null;
  
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
        goalie:goalies!matches_goalie_id_fkey(id, name, jersey_number)
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
        goalie:goalies!matches_goalie_id_fkey(id, name, jersey_number)
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
  away_team_name: string;
  datetime: string;
  competition?: string;
  season?: string;
  venue?: string;
  type?: "friendly" | "league" | "tournament" | "cup";
  status?: "open" | "closed";
  goalie_id?: string;
}

export async function createMatch(payload: CreateMatchPayload): Promise<Match | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[matches] Supabase not configured");
    return null;
  }

  try {
    const cleanPayload = {
      home_team_id: isUuid(payload.home_team_id) ? payload.home_team_id : null,
      away_team_name: payload.away_team_name,
      datetime: payload.datetime,
      competition: payload.competition || null,
      season: payload.season || null,
      venue: payload.venue || null,
      type: payload.type || "friendly",
      status: payload.status || "open",
      goalie_id: isUuid(payload.goalie_id) ? payload.goalie_id : null,
    };

    const { data, error } = await supabase
      .from("matches")
      .insert(cleanPayload)
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name),
        goalie:goalies!matches_goalie_id_fkey(id, name, jersey_number)
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
  payload: Partial<CreateMatchPayload> & { home_score?: number; away_score?: number }
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
    if (payload.away_team_name !== undefined) updatePayload.away_team_name = payload.away_team_name;
    if (payload.datetime !== undefined) updatePayload.datetime = payload.datetime;
    if (payload.competition !== undefined) updatePayload.competition = payload.competition || null;
    if (payload.season !== undefined) updatePayload.season = payload.season || null;
    if (payload.venue !== undefined) updatePayload.venue = payload.venue || null;
    if (payload.type !== undefined) updatePayload.type = payload.type;
    if (payload.status !== undefined) updatePayload.status = payload.status;
    if (payload.goalie_id !== undefined) updatePayload.goalie_id = payload.goalie_id || null;
    if (payload.home_score !== undefined) updatePayload.home_score = payload.home_score;
    if (payload.away_score !== undefined) updatePayload.away_score = payload.away_score;

    const { data, error } = await supabase
      .from("matches")
      .update(updatePayload)
      .eq("id", id)
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name),
        goalie:goalies!matches_goalie_id_fkey(id, name, jersey_number)
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

