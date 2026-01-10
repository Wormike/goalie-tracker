"use client";

import { ReactNode } from 'react';
import { useAutoSync } from '@/hooks/useAutoSync';

interface AutoSyncProviderProps {
  children: ReactNode;
}

/**
 * Provider component that starts auto-sync in background
 */
export function AutoSyncProvider({ children }: AutoSyncProviderProps) {
  // Auto-sync is started by useAutoSync hook
  // This component just ensures the hook is called at app level
  useAutoSync();

  return <>{children}</>;
}








