/**
 * Auto-sync service - automatically syncs localStorage data to Supabase every minute
 */

import { uploadToSupabase, type SyncResult } from './sync';
import { isSupabaseConfigured } from './supabaseClient';

let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;
let lastSyncTime: string | null = null;
let syncCallbacks: Array<(result: SyncResult) => void> = [];

/**
 * Start automatic sync to Supabase (every minute)
 */
export function startAutoSync(): void {
  if (syncInterval) {
    console.log('[AutoSync] Already running');
    return;
  }

  if (!isSupabaseConfigured()) {
    console.log('[AutoSync] Supabase not configured, skipping');
    return;
  }

  console.log('[AutoSync] Starting automatic sync (every 60s)');
  
  // Sync immediately on start
  performSync();

  // Then sync every minute
  syncInterval = setInterval(() => {
    performSync();
  }, 60 * 1000); // 60 seconds
}

/**
 * Stop automatic sync
 */
export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[AutoSync] Stopped');
  }
}

/**
 * Perform sync operation
 */
async function performSync(): Promise<SyncResult> {
  if (isSyncing) {
    console.log('[AutoSync] Sync already in progress, skipping');
    return {
      success: false,
      uploaded: { goalies: 0, matches: 0, events: 0, competitions: 0, teams: 0 },
      errors: ['Sync already in progress'],
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      uploaded: { goalies: 0, matches: 0, events: 0, competitions: 0, teams: 0 },
      errors: ['Supabase not configured'],
    };
  }

  isSyncing = true;

  try {
    const result = await uploadToSupabase();
    lastSyncTime = new Date().toISOString();
    
    // Notify callbacks
    syncCallbacks.forEach(cb => {
      try {
        cb(result);
      } catch (err) {
        console.error('[AutoSync] Callback error:', err);
      }
    });

    if (result.success) {
      console.log('[AutoSync] Sync successful:', {
        goalies: result.uploaded.goalies,
        matches: result.uploaded.matches,
        events: result.uploaded.events,
      });
    } else {
      console.warn('[AutoSync] Sync completed with errors:', result.errors);
    }

    return result;
  } catch (err) {
    console.error('[AutoSync] Sync failed:', err);
    const errorResult: SyncResult = {
      success: false,
      uploaded: { goalies: 0, matches: 0, events: 0, competitions: 0, teams: 0 },
      errors: [err instanceof Error ? err.message : String(err)],
    };
    return errorResult;
  } finally {
    isSyncing = false;
  }
}

/**
 * Force immediate sync (can be called manually)
 */
export async function forceSync(): Promise<SyncResult> {
  return await performSync();
}

/**
 * Get last sync time
 */
export function getLastSyncTime(): string | null {
  return lastSyncTime;
}

/**
 * Check if sync is currently running
 */
export function isSyncRunning(): boolean {
  return isSyncing;
}

/**
 * Register callback for sync events
 */
export function onSync(callback: (result: SyncResult) => void): () => void {
  syncCallbacks.push(callback);
  
  // Return unsubscribe function
  return () => {
    syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
  };
}





