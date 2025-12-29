/**
 * Goalies Repository - Supabase integration for goalies table
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Goalie } from "@/lib/types";
import { isUuid } from "./matches";

// ─────────────────────────────────────────────────────────────────────────────
// Database types
// ─────────────────────────────────────────────────────────────────────────────

export interface DbGoalie {
  id: string;
  first_name: string;
  last_name: string;
  birth_year: number | null;
  team_id: string | null;
  team_name: string | null;
  jersey_number: number | null;
  catch_hand: "L" | "R" | null;
  photo_url: string | null;
  competition_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

export function dbGoalieToAppGoalie(db: DbGoalie): Goalie {
  return {
    id: db.id,
    firstName: db.first_name,
    lastName: db.last_name,
    birthYear: db.birth_year || 0,
    teamId: db.team_id || undefined,
    teamName: db.team_name || undefined,
    team: db.team_name || "", // Legacy field
    jerseyNumber: db.jersey_number || undefined,
    catchHand: db.catch_hand || undefined,
    photo: db.photo_url || undefined,
    photoUrl: db.photo_url || undefined,
    profilePhotoUrl: db.photo_url || undefined,
    competitionId: db.competition_id || undefined,
    note: db.note || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function appGoalieToDbPayload(goalie: Partial<Goalie>): Partial<DbGoalie> {
  const payload: Record<string, unknown> = {};

  if (goalie.firstName !== undefined) payload.first_name = goalie.firstName;
  if (goalie.lastName !== undefined) payload.last_name = goalie.lastName;
  if (goalie.birthYear !== undefined) payload.birth_year = goalie.birthYear || null;
  if (goalie.teamId !== undefined) payload.team_id = isUuid(goalie.teamId) ? goalie.teamId : null;
  if (goalie.teamName !== undefined || goalie.team !== undefined) {
    payload.team_name = goalie.teamName || goalie.team || null;
  }
  if (goalie.jerseyNumber !== undefined) payload.jersey_number = goalie.jerseyNumber || null;
  if (goalie.catchHand !== undefined) payload.catch_hand = goalie.catchHand || null;
  if (goalie.photoUrl !== undefined || goalie.photo !== undefined || goalie.profilePhotoUrl !== undefined) {
    payload.photo_url = goalie.photoUrl || goalie.profilePhotoUrl || goalie.photo || null;
  }
  if (goalie.competitionId !== undefined) payload.competition_id = isUuid(goalie.competitionId) ? goalie.competitionId : null;
  if (goalie.note !== undefined) payload.note = goalie.note || null;

  return payload as Partial<DbGoalie>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all goalies
 */
export async function getGoalies(): Promise<Goalie[]> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[goalies] Supabase not configured");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("goalies")
      .select("*")
      .order("last_name", { ascending: true });

    if (error) {
      console.warn("[goalies] Error fetching:", error.message);
      return [];
    }

    return (data || []).map(dbGoalieToAppGoalie);
  } catch (err) {
    console.error("[goalies] Unexpected error:", err);
    return [];
  }
}

/**
 * Get goalie by ID
 */
export async function getGoalieById(id: string): Promise<Goalie | null> {
  if (!isSupabaseConfigured() || !supabase || !isUuid(id)) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("goalies")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[goalies] Error fetching by id:", error.message);
      return null;
    }

    return data ? dbGoalieToAppGoalie(data) : null;
  } catch (err) {
    console.error("[goalies] Unexpected error:", err);
    return null;
  }
}

/**
 * Create a new goalie
 */
export async function createGoalie(goalie: Omit<Goalie, "id" | "createdAt">): Promise<Goalie | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[goalies] Supabase not configured");
    return null;
  }

  try {
    const payload = appGoalieToDbPayload(goalie);
    
    const { data, error } = await supabase
      .from("goalies")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[goalies] Error creating:", error.message);
      return null;
    }

    return data ? dbGoalieToAppGoalie(data) : null;
  } catch (err) {
    console.error("[goalies] Unexpected error:", err);
    return null;
  }
}

/**
 * Update a goalie
 */
export async function updateGoalie(id: string, goalie: Partial<Goalie>): Promise<Goalie | null> {
  if (!isSupabaseConfigured() || !supabase || !isUuid(id)) {
    return null;
  }

  try {
    const payload = {
      ...appGoalieToDbPayload(goalie),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("goalies")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[goalies] Error updating:", error.message);
      return null;
    }

    return data ? dbGoalieToAppGoalie(data) : null;
  } catch (err) {
    console.error("[goalies] Unexpected error:", err);
    return null;
  }
}

/**
 * Delete a goalie
 */
export async function deleteGoalie(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !isUuid(id)) {
    return false;
  }

  try {
    const { error } = await supabase
      .from("goalies")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[goalies] Error deleting:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[goalies] Unexpected error:", err);
    return false;
  }
}




