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
  shot_zone: string | null;
  goal_x: number | null;
  goal_y: number | null;
  goal_zone: string | null;
  shot_type: string | null;
  save_type: string | null;
  goal_type: string | null;
  situation: "even" | "pp" | "sh" | "4v4" | "3v3" | null;
  is_rebound: boolean | null;
  is_screened: boolean | null;
  status: "confirmed" | "pending" | "deleted" | null;
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

  // Map situation: "pp"/"sh" -> legacy "powerplay"/"shorthanded" for compatibility
  let situation: string = db.situation || "even";
  if (situation === "pp") situation = "powerplay" as any;
  if (situation === "sh") situation = "shorthanded" as any;

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
          zone: (db.shot_zone || getZoneFromCoords(Number(db.shot_x), Number(db.shot_y))) as any,
        }
      : undefined,
    goalPosition: db.goal_x !== null && db.goal_y !== null
      ? {
          x: Number(db.goal_x),
          y: Number(db.goal_y),
          zone: (db.goal_zone || "middle_center") as any,
        }
      : undefined,
    shotType: db.shot_type || undefined,
    saveType: db.save_type as any || undefined,
    goalType: db.goal_type as any || undefined,
    situation: situation as any,
    isRebound: db.is_rebound ?? false,
    rebound: db.is_rebound ?? false, // Legacy field
    isScreened: db.is_screened ?? false,
    screenedView: db.is_screened ?? false, // Legacy field
    inputSource: (db.input_source as InputSource) || "manual",
    status: (db.status as any) || "confirmed",
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
  shot_zone?: string;
  goal_x?: number;
  goal_y?: number;
  goal_zone?: string;
  shot_type?: string;
  save_type?: string;
  goal_type?: string;
  situation?: "even" | "pp" | "sh" | "4v4" | "3v3";
  is_rebound?: boolean;
  is_screened?: boolean;
  status?: "confirmed" | "pending" | "deleted";
  input_source?: "live" | "manual" | "import";
}

export async function createEvent(payload: CreateEventPayload): Promise<GoalieEvent | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[events] Supabase not configured");
    return null;
  }

  try {
    // Map situation: legacy "powerplay"/"shorthanded" -> "pp"/"sh"
   const rawSituation = payload.situation || "even";
const situationMap: Record<string, string> = {
  "powerplay": "pp",
  "shorthanded": "sh",
};
const situation = situationMap[rawSituation] || rawSituation;

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
        shot_zone: payload.shot_zone || null,
        goal_x: payload.goal_x ?? null,
        goal_y: payload.goal_y ?? null,
        goal_zone: payload.goal_zone || null,
        shot_type: payload.shot_type || null,
        save_type: payload.save_type || null,
        goal_type: payload.goal_type || null,
        situation: situation as "even" | "pp" | "sh" | "4v4" | "3v3",
        is_rebound: payload.is_rebound ?? null,
        is_screened: payload.is_screened ?? null,
        status: payload.status || "confirmed",
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
    if (payload.shot_zone !== undefined) updatePayload.shot_zone = payload.shot_zone || null;
    if (payload.goal_x !== undefined) updatePayload.goal_x = payload.goal_x;
    if (payload.goal_y !== undefined) updatePayload.goal_y = payload.goal_y;
    if (payload.goal_zone !== undefined) updatePayload.goal_zone = payload.goal_zone || null;
    if (payload.shot_type !== undefined) updatePayload.shot_type = payload.shot_type || null;
    if (payload.save_type !== undefined) updatePayload.save_type = payload.save_type || null;
    if (payload.goal_type !== undefined) updatePayload.goal_type = payload.goal_type || null;
    if (payload.situation !== undefined) {
      let situation: string = payload.situation;
      if (situation === "powerplay") situation = "pp" as any;
      if (situation === "shorthanded") situation = "sh" as any;
      updatePayload.situation = situation as "even" | "pp" | "sh" | "4v4" | "3v3";
    }
    if (payload.is_rebound !== undefined) updatePayload.is_rebound = payload.is_rebound ?? null;
    if (payload.is_screened !== undefined) updatePayload.is_screened = payload.is_screened ?? null;
    if (payload.status !== undefined) updatePayload.status = payload.status;
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








