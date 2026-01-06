"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UserCompetition {
  id: string;
  name: string;           // "7. třída - Vojta"
  standingsUrl?: string;  // External URL to ceskyhokej.cz standings
  category?: string;      // Internal category for filtering
  seasonId?: string;      // Reference to season
  createdAt: string;
}

interface CompetitionContextType {
  // State
  competitions: UserCompetition[];
  activeCompetition: UserCompetition | null;
  activeCompetitionId: string | null;
  isLoading: boolean;
  
  // Actions
  setActiveCompetitionId: (id: string) => void;
  addCompetition: (data: Omit<UserCompetition, 'id' | 'createdAt'>) => UserCompetition;
  updateCompetition: (id: string, data: Partial<UserCompetition>) => void;
  deleteCompetition: (id: string) => void;
  
  // Helpers
  hasCompetitions: boolean;
  needsOnboarding: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Local Storage Keys
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY_COMPETITIONS = 'user-competitions';
const STORAGE_KEY_ACTIVE_ID = 'active-competition-id';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const CompetitionContext = createContext<CompetitionContextType | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

interface CompetitionProviderProps {
  children: ReactNode;
}

export function CompetitionProvider({ children }: CompetitionProviderProps) {
  const [competitions, setCompetitions] = useState<UserCompetition[]>([]);
  const [activeCompetitionId, setActiveCompetitionIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Hydrate from localStorage on mount
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Load competitions
      const savedCompetitions = localStorage.getItem(STORAGE_KEY_COMPETITIONS);
      if (savedCompetitions) {
        const parsed = JSON.parse(savedCompetitions);
        if (Array.isArray(parsed)) {
          setCompetitions(parsed);
        }
      }
      
      // Load active ID
      const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
      if (savedActiveId) {
        setActiveCompetitionIdState(savedActiveId);
      }
    } catch (err) {
      console.error('[CompetitionContext] Failed to load from localStorage:', err);
    } finally {
      setIsLoading(false);
      setIsHydrated(true);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Persist to localStorage on changes
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY_COMPETITIONS, JSON.stringify(competitions));
    } catch (err) {
      console.error('[CompetitionContext] Failed to save competitions:', err);
    }
  }, [competitions, isHydrated]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    
    try {
      if (activeCompetitionId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeCompetitionId);
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
      }
    } catch (err) {
      console.error('[CompetitionContext] Failed to save active ID:', err);
    }
  }, [activeCompetitionId, isHydrated]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────────────────────────────────
  
  const activeCompetition = competitions.find(c => c.id === activeCompetitionId) || null;
  const hasCompetitions = competitions.length > 0;
  const needsOnboarding = isHydrated && !isLoading && !hasCompetitions;

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────
  
  const setActiveCompetitionId = useCallback((id: string) => {
    // Verify competition exists
    const exists = competitions.some(c => c.id === id);
    if (exists) {
      setActiveCompetitionIdState(id);
    }
  }, [competitions]);

  const addCompetition = useCallback((data: Omit<UserCompetition, 'id' | 'createdAt'>): UserCompetition => {
    const newCompetition: UserCompetition = {
      ...data,
      id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    setCompetitions(prev => [...prev, newCompetition]);
    
    // If this is the first competition, set it as active
    if (competitions.length === 0) {
      setActiveCompetitionIdState(newCompetition.id);
    }
    
    return newCompetition;
  }, [competitions.length]);

  const updateCompetition = useCallback((id: string, data: Partial<UserCompetition>) => {
    setCompetitions(prev => 
      prev.map(c => c.id === id ? { ...c, ...data } : c)
    );
  }, []);

  const deleteCompetition = useCallback((id: string) => {
    setCompetitions(prev => prev.filter(c => c.id !== id));
    
    // If we deleted the active competition, switch to another
    if (activeCompetitionId === id) {
      const remaining = competitions.filter(c => c.id !== id);
      setActiveCompetitionIdState(remaining[0]?.id || null);
    }
  }, [activeCompetitionId, competitions]);

  // ─────────────────────────────────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────────────────────────────────
  
  const value: CompetitionContextType = {
    competitions,
    activeCompetition,
    activeCompetitionId,
    isLoading,
    setActiveCompetitionId,
    addCompetition,
    updateCompetition,
    deleteCompetition,
    hasCompetitions,
    needsOnboarding,
  };

  return (
    <CompetitionContext.Provider value={value}>
      {children}
    </CompetitionContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useCompetition() {
  const context = useContext(CompetitionContext);
  if (!context) {
    throw new Error('useCompetition must be used within a CompetitionProvider');
  }
  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional hook that returns null if not in provider (for conditional usage)
// ─────────────────────────────────────────────────────────────────────────────

export function useCompetitionOptional() {
  return useContext(CompetitionContext);
}








