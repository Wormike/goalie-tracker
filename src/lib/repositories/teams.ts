/**
 * Teams Repository - Supabase integration for teams table
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

type DbTeam = {
  id: string;
  name: string;
  short_name: string | null;
  club_external_id: string | null;
  team_external_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function findTeamByName(name: string): Promise<DbTeam | null> {
  if (!isSupabaseConfigured() || !supabase || !name) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("name", name)
      .maybeSingle();

    if (error) {
      console.error("[teams] Error fetching by name:", error.message);
      return null;
    }

    return data || null;
  } catch (err) {
    console.error("[teams] Unexpected error:", err);
    return null;
  }
}

export async function findOrCreateTeam(name: string, clubExternalId?: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase || !name) {
    return null;
  }

  try {
    const existing = await findTeamByName(name);
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("teams")
      .insert({
        name,
        club_external_id: clubExternalId || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[teams] Error creating:", error.message);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error("[teams] Unexpected error:", err);
    return null;
  }
}


