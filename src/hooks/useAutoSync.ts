"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { startAutoSync, stopAutoSync, getLastSyncTime, forceSync, onSync } from '@/lib/autoSync';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import type { SyncResult } from '@/lib/sync';
import { useToast } from '@/contexts/ToastContext';

export function useAutoSync() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const { addToast } = useToast();
  const hasShownOfflineToast = useRef(false);

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
        if (result.success) {
          addToast("Synchronizace dokončena", "success");
        } else {
          addToast("Synchronizace selhala. Data jsou uložena lokálně.", "error");
        }
      });

      // Cleanup on unmount
      return () => {
        stopAutoSync();
        unsubscribe();
      };
    }
    if (!isSupabaseConfigured() && !hasShownOfflineToast.current) {
      addToast("Offline režim: data se synchronizují po připojení.", "info");
      hasShownOfflineToast.current = true;
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
      if (result.success) {
        addToast("Synchronizace dokončena", "success");
      } else {
        addToast("Synchronizace selhala. Data jsou uložena lokálně.", "error");
      }
      return result;
    }
    return null;
  }, [addToast]);

  return {
    lastSync,
    isSyncing,
    lastSyncResult,
    syncNow,
    isConfigured: isSupabaseConfigured(),
  };
}










