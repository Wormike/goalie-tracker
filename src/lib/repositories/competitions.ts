/**
 * Competitions Repository - Supabase integration for competitions table
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Competition } from "@/lib/types";
import { isUuid } from "./matches";

// ─────────────────────────────────────────────────────────────────────────────
// Database types
// ─────────────────────────────────────────────────────────────────────────────

export interface DbCompetition {
  id: string;
  name: string;
  category: string | null;
  season_id: string | null;
  external_id: string | null;
  source: string | null;
  standings_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

export function dbCompetitionToApp(db: DbCompetition): Competition {
  return {
    id: db.id,
    name: db.name,
    category: db.category || "",
    seasonId: db.season_id || "",
    externalId: db.external_id || undefined,
    source: (db.source as Competition["source"]) || "manual",
    standingsUrl: db.standings_url || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function appCompetitionToDbPayload(comp: Partial<Competition>): Partial<DbCompetition> {
  const payload: Record<string, unknown> = {};

  if (comp.name !== undefined) payload.name = comp.name;
  if (comp.category !== undefined) payload.category = comp.category || null;
  if (comp.seasonId !== undefined) payload.season_id = comp.seasonId || null;
  if (comp.externalId !== undefined) payload.external_id = comp.externalId || null;
  if (comp.source !== undefined) payload.source = comp.source || "manual";
  if (comp.standingsUrl !== undefined) payload.standings_url = comp.standingsUrl || null;

  return payload as Partial<DbCompetition>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all competitions
 */
export async function getCompetitions(): Promise<Competition[]> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[competitions] Supabase not configured");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("competitions")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("[competitions] Error fetching:", error.message);
      return [];
    }

    return (data || []).map(dbCompetitionToApp);
  } catch (err) {
    console.error("[competitions] Unexpected error:", err);
    return [];
  }
}

/**
 * Get competition by ID
 */
export async function getCompetitionById(id: string): Promise<Competition | null> {
  if (!isSupabaseConfigured() || !supabase || !isUuid(id)) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("competitions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[competitions] Error fetching by id:", error.message);
      return null;
    }

    return data ? dbCompetitionToApp(data) : null;
  } catch (err) {
    console.error("[competitions] Unexpected error:", err);
    return null;
  }
}

/**
 * Get competitions by season
 */
export async function getCompetitionsBySeason(seasonId: string): Promise<Competition[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("competitions")
      .select("*")
      .eq("season_id", seasonId)
      .order("name", { ascending: true });

    if (error) {
      console.warn("[competitions] Error fetching by season:", error.message);
      return [];
    }

    return (data || []).map(dbCompetitionToApp);
  } catch (err) {
    console.error("[competitions] Unexpected error:", err);
    return [];
  }
}

/**
 * Create a new competition
 */
export async function createCompetition(comp: Omit<Competition, "id" | "createdAt">): Promise<Competition | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[competitions] Supabase not configured");
    return null;
  }

  try {
    const payload = appCompetitionToDbPayload(comp);

    const { data, error } = await supabase
      .from("competitions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[competitions] Error creating:", error.message);
      return null;
    }

    return data ? dbCompetitionToApp(data) : null;
  } catch (err) {
    console.error("[competitions] Unexpected error:", err);
    return null;
  }
}

/**
 * Update a competition
 */
export async function updateCompetition(id: string, comp: Partial<Competition>): Promise<Competition | null> {
  if (!isSupabaseConfigured() || !supabase || !isUuid(id)) {
    return null;
  }

  try {
    const payload = {
      ...appCompetitionToDbPayload(comp),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("competitions")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[competitions] Error updating:", error.message);
      return null;
    }

    return data ? dbCompetitionToApp(data) : null;
  } catch (err) {
    console.error("[competitions] Unexpected error:", err);
    return null;
  }
}

/**
 * Delete a competition
 */
export async function deleteCompetition(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !isUuid(id)) {
    return false;
  }

  try {
    const { error } = await supabase
      .from("competitions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[competitions] Error deleting:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[competitions] Unexpected error:", err);
    return false;
  }
}


