"use client";

import { useEffect, useState, useCallback } from 'react';
import { startAutoSync, stopAutoSync, getLastSyncTime, forceSync, onSync } from '@/lib/autoSync';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import type { SyncResult } from '@/lib/sync';

export function useAutoSync() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    // Start auto-sync if Supabase is configured
    if (isSupabaseConfigured()) {
      startAutoSync();
      setLastSync(getLastSyncTime());

      // Subscribe to sync events
      const unsubscribe = onSync((result) => {
        setLastSync(getLastSyncTime());
        setLastSyncResult(result);
        setIsSyncing(false);
      });

      // Cleanup on unmount
      return () => {
        stopAutoSync();
        unsubscribe();
      };
    }
  }, []);

  // Manual sync trigger
  const syncNow = useCallback(async () => {
    if (isSupabaseConfigured()) {
      setIsSyncing(true);
      const result = await forceSync();
      setLastSync(getLastSyncTime());
      setLastSyncResult(result);
      setIsSyncing(false);
      return result;
    }
    return null;
  }, []);

  return {
    lastSync,
    isSyncing,
    lastSyncResult,
    syncNow,
    isConfigured: isSupabaseConfigured(),
  };
}





