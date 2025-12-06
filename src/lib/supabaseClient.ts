import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Environment variables - must be set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Creates a Supabase client instance.
 * 
 * Returns null if environment variables are not configured.
 * This allows the app to build even without Supabase credentials.
 */
function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Don't throw during build - just return null
    if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
      console.warn(
        "[Supabase] Missing environment variables. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
      );
    }
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Supabase client instance.
 * 
 * Can be used in:
 * - Server components
 * - API routes (route handlers)
 * - Client components (with NEXT_PUBLIC_ prefix variables)
 * - Server actions
 * 
 * @returns SupabaseClient or null if not configured
 */
export const supabase = createSupabaseClient();

/**
 * Helper to get supabase client with error handling.
 * Throws if client is not configured.
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase client is not configured. " +
      "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  return supabase;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

// Re-export types for convenience
export type { SupabaseClient } from "@supabase/supabase-js";
