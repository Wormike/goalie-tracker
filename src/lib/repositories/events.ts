/**
 * Events Repository - Supabase integration for goalie_events table
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { GoalieEvent, Period, ResultType, InputSource } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Database types (match Supabase schema)
// ─────────────────────────────────────────────────────────────────────────────

export interface DbGoalieEvent {
  id: string;
  match_id: string;
  goalie_id: string | null;
  period: "1" | "2" | "3" | "OT";
  game_time: string | null;
  result: "save" | "goal" | "miss";
  shot_x: number | null;
  shot_y: number | null;
  input_source: "live" | "manual" | "import" | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert database event to app GoalieEvent type
 */
export function dbEventToAppEvent(db: DbGoalieEvent): GoalieEvent {
  // Convert period string to Period type
  const periodMap: Record<string, Period> = {
    "1": 1,
    "2": 2,
    "3": 3,
    "OT": "OT",
  };

  return {
    id: db.id,
    matchId: db.match_id,
    goalieId: db.goalie_id || "",
    period: periodMap[db.period] || 1,
    gameTime: db.game_time || "00:00",
    timestamp: db.created_at,
    result: db.result as ResultType,
    shotPosition: db.shot_x !== null && db.shot_y !== null
      ? {
          x: Number(db.shot_x),
          y: Number(db.shot_y),
          zone: getZoneFromCoords(Number(db.shot_x), Number(db.shot_y)),
        }
      : undefined,
    inputSource: (db.input_source as InputSource) || "manual",
    status: "confirmed",
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * Get zone from coordinates
 */
function getZoneFromCoords(x: number, y: number): "slot" | "left_wing" | "right_wing" | "blue_line" | "behind_goal" {
  if (y < 30) return "blue_line";
  if (y > 85) return "behind_goal";
  if (x < 30) return "left_wing";
  if (x > 70) return "right_wing";
  return "slot";
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all events for a match, sorted by created_at
 */
export async function getEventsForMatch(matchId: string): Promise<GoalieEvent[]> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[events] Supabase not configured, returning empty array");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("goalie_events")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[events] Error fetching events:", error.message);
      return [];
    }

    return (data || []).map(dbEventToAppEvent);
  } catch (err) {
    console.error("[events] Unexpected error:", err);
    return [];
  }
}

/**
 * Get all events for a goalie (across all matches)
 */
export async function getEventsForGoalie(goalieId: string): Promise<GoalieEvent[]> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[events] Supabase not configured, returning empty array");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("goalie_events")
      .select("*")
      .eq("goalie_id", goalieId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[events] Error fetching events:", error.message);
      return [];
    }

    return (data || []).map(dbEventToAppEvent);
  } catch (err) {
    console.error("[events] Unexpected error:", err);
    return [];
  }
}

/**
 * Create a new event
 */
export interface CreateEventPayload {
  match_id: string;
  goalie_id?: string;
  period: "1" | "2" | "3" | "OT";
  game_time: string;
  result: "save" | "goal" | "miss";
  shot_x?: number;
  shot_y?: number;
  input_source?: "live" | "manual" | "import";
}

export async function createEvent(payload: CreateEventPayload): Promise<GoalieEvent | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[events] Supabase not configured");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("goalie_events")
      .insert({
        match_id: payload.match_id,
        goalie_id: payload.goalie_id || null,
        period: payload.period,
        game_time: payload.game_time,
        result: payload.result,
        shot_x: payload.shot_x ?? null,
        shot_y: payload.shot_y ?? null,
        input_source: payload.input_source || "manual",
      })
      .select()
      .single();

    if (error) {
      console.error("[events] Error creating event:", error.message);
      return null;
    }

    return data ? dbEventToAppEvent(data) : null;
  } catch (err) {
    console.error("[events] Unexpected error:", err);
    return null;
  }
}

/**
 * Update an event
 */
export async function updateEvent(
  id: string,
  payload: Partial<Omit<CreateEventPayload, "match_id">>
): Promise<GoalieEvent | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[events] Supabase not configured");
    return null;
  }

  try {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.goalie_id !== undefined) updatePayload.goalie_id = payload.goalie_id || null;
    if (payload.period !== undefined) updatePayload.period = payload.period;
    if (payload.game_time !== undefined) updatePayload.game_time = payload.game_time;
    if (payload.result !== undefined) updatePayload.result = payload.result;
    if (payload.shot_x !== undefined) updatePayload.shot_x = payload.shot_x;
    if (payload.shot_y !== undefined) updatePayload.shot_y = payload.shot_y;
    if (payload.input_source !== undefined) updatePayload.input_source = payload.input_source;

    const { data, error } = await supabase
      .from("goalie_events")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[events] Error updating event:", error.message);
      return null;
    }

    return data ? dbEventToAppEvent(data) : null;
  } catch (err) {
    console.error("[events] Unexpected error:", err);
    return null;
  }
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[events] Supabase not configured");
    return false;
  }

  try {
    const { error } = await supabase
      .from("goalie_events")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[events] Error deleting event:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[events] Unexpected error:", err);
    return false;
  }
}

/**
 * Delete all events for a match
 */
export async function deleteEventsForMatch(matchId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[events] Supabase not configured");
    return false;
  }

  try {
    const { error } = await supabase
      .from("goalie_events")
      .delete()
      .eq("match_id", matchId);

    if (error) {
      console.error("[events] Error deleting events:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[events] Unexpected error:", err);
    return false;
  }
}








