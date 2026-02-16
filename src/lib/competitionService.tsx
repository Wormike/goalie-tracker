"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Competition, Match } from "@/lib/types";
import * as storage from "@/lib/storage";
import * as competitionsRepo from "@/lib/repositories/competitions";

type CompetitionContextValue = {
  competitions: Competition[];
  activeCompetition: Competition | null;
  activeCompetitionId: string | null;
  isLoading: boolean;
  hasCompetitions: boolean;
  needsOnboarding: boolean;
  setActiveCompetitionId: (id: string | null) => void;
  addCompetition: (data: Omit<Competition, "id" | "createdAt" | "updatedAt">) => Promise<Competition | null>;
  updateCompetition: (id: string, data: Partial<Competition>) => Promise<Competition | null>;
  deleteCompetition: (id: string) => Promise<boolean>;
  reload: () => Promise<void>;
};

const CompetitionContext = createContext<CompetitionContextValue | null>(null);

const STORAGE_KEY_ACTIVE_ID = "active-competition-id";

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function ensureUuid(value: string): string {
  return isUuid(value) ? value : uuidv4();
}

function persistActiveId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  } catch {
    // ignore
  }
}

function readActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
  } catch {
    return null;
  }
}

function migrateLocalCompetitionIds(competitions: Competition[]): {
  competitions: Competition[];
  mapping: Record<string, string>;
} {
  const mapping: Record<string, string> = {};
  const normalized = competitions.map((comp) => {
    const nextId = ensureUuid(comp.id);
    if (nextId !== comp.id) {
      mapping[comp.id] = nextId;
    }
    return { ...comp, id: nextId };
  });
  return { competitions: normalized, mapping };
}

function updateMatchCompetitionIds(matches: Match[], mapping: Record<string, string>): Match[] {
  if (!Object.keys(mapping).length) return matches;
  return matches.map((match) => {
    const mappedId = match.competitionId ? mapping[match.competitionId] : undefined;
    if (!mappedId) return match;
    return { ...match, competitionId: mappedId };
  });
}

function saveCompetitionsToLocal(competitions: Competition[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("goalie-tracker-competitions", JSON.stringify(competitions));
  } catch {
    // ignore
  }
}

export function CompetitionProvider({ children }: { children: React.ReactNode }) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [activeCompetitionId, setActiveCompetitionIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const remote = await competitionsRepo.getCompetitions();
        setCompetitions(remote);
        saveCompetitionsToLocal(remote);
      } else {
        const local = storage.getCompetitions();
        const { competitions: normalized, mapping } = migrateLocalCompetitionIds(local);
        if (Object.keys(mapping).length) {
          const matches = storage.getMatches();
          const updatedMatches = updateMatchCompetitionIds(matches, mapping);
          updatedMatches.forEach((match) => storage.saveMatch(match));
          saveCompetitionsToLocal(normalized);
        }
        setCompetitions(normalized);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedActiveId = readActiveId();
    setActiveCompetitionIdState(savedActiveId);
    load();
  }, [load]);

  const activeCompetition = useMemo(
    () => competitions.find((c) => c.id === activeCompetitionId) || null,
    [competitions, activeCompetitionId]
  );

  const hasCompetitions = competitions.length > 0;
  const needsOnboarding = !isLoading && !hasCompetitions;

  const setActiveCompetitionId = useCallback((id: string | null) => {
    setActiveCompetitionIdState(id);
    persistActiveId(id);
  }, []);

  const addCompetition = useCallback(async (data: Omit<Competition, "id" | "createdAt" | "updatedAt">) => {
    if (isSupabaseConfigured()) {
      const created = await competitionsRepo.createCompetition(data);
      if (created) {
        setCompetitions((prev) => [...prev, created]);
        if (!activeCompetitionId) {
          setActiveCompetitionId(created.id);
        }
        saveCompetitionsToLocal([...competitions, created]);
        return created;
      }
    }

    const localComp: Competition = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    storage.saveCompetition(localComp);
    setCompetitions((prev) => [...prev, localComp]);
    if (!activeCompetitionId) {
      setActiveCompetitionId(localComp.id);
    }
    return localComp;
  }, [activeCompetitionId, competitions, setActiveCompetitionId]);

  const updateCompetition = useCallback(async (id: string, data: Partial<Competition>) => {
    if (isSupabaseConfigured()) {
      const updated = await competitionsRepo.updateCompetition(id, data);
      if (updated) {
        setCompetitions((prev) => prev.map((c) => (c.id === id ? updated : c)));
        saveCompetitionsToLocal(competitions.map((c) => (c.id === id ? updated : c)));
        return updated;
      }
    }

    const local = competitions.find((c) => c.id === id);
    if (!local) return null;
    const updatedLocal: Competition = {
      ...local,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    storage.saveCompetition(updatedLocal);
    setCompetitions((prev) => prev.map((c) => (c.id === id ? updatedLocal : c)));
    return updatedLocal;
  }, [competitions]);

  const deleteCompetition = useCallback(async (id: string) => {
    if (isSupabaseConfigured()) {
      const ok = await competitionsRepo.deleteCompetition(id);
      if (!ok) return false;
    } else {
      storage.deleteCompetition(id);
    }

    setCompetitions((prev) => prev.filter((c) => c.id !== id));
    if (activeCompetitionId === id) {
      const next = competitions.find((c) => c.id !== id);
      setActiveCompetitionId(next?.id || null);
    }
    return true;
  }, [activeCompetitionId, competitions, setActiveCompetitionId]);

  const value: CompetitionContextValue = {
    competitions,
    activeCompetition,
    activeCompetitionId,
    isLoading,
    hasCompetitions,
    needsOnboarding,
    setActiveCompetitionId,
    addCompetition,
    updateCompetition,
    deleteCompetition,
    reload: load,
  };

  return <CompetitionContext.Provider value={value}>{children}</CompetitionContext.Provider>;
}

export function useCompetitions() {
  const context = useContext(CompetitionContext);
  if (!context) {
    throw new Error("useCompetitions must be used within CompetitionProvider");
  }
  return context;
}

