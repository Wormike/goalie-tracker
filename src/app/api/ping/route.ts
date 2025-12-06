import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

/**
 * GET /api/ping
 * 
 * Test endpoint to verify Supabase connection is configured correctly.
 * Returns JSON with connection status.
 */
export async function GET() {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase client is not configured",
          hint: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
        },
        { status: 503 }
      );
    }

    // Try a simple query to verify connection
    // Using a basic health check - this works even without any tables
    const { error } = await supabase
      .from("_health_check_dummy")
      .select("*")
      .limit(1)
      .maybeSingle();

    // If we get a "relation does not exist" error, that's actually fine
    // It means the connection works, just the table doesn't exist
    if (error && !error.message.includes("does not exist")) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          hint: "Check your Supabase credentials in .env.local",
        },
        { status: 500 }
      );
    }

    // Connection successful
    return NextResponse.json({
      ok: true,
      message: "Supabase client is configured",
      timestamp: new Date().toISOString(),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(
        /https?:\/\/([^.]+)\..*$/,
        "https://$1.***"
      ), // Masked URL for security
    });
  } catch (err) {
    // Catch any unexpected errors
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    
    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        hint: "Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local",
      },
      { status: 500 }
    );
  }
}
