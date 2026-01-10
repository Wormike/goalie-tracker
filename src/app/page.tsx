"use client";
import type { CompetitionStandings } from "@/lib/types";
import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Match, Goalie } from "@/lib/types";
import {
  getMatches as getMatchesLocal,
  getGoalies,
  getGoalieById,
  saveMatch,
  deleteMatch as deleteMatchLocal,
  getEventsByMatch as getEventsByMatchLocal,
} from "@/lib/storage";
import {
  getMatches as getMatchesSupabase,
  deleteMatch as deleteMatchSupabase,
  updateMatch as updateMatchSupabase,
} from "@/lib/repositories/matches";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { ManualStatsModal } from "@/components/ManualStatsModal";
import { ImportWizard } from "@/components/ImportWizard";
import { StandingsButton } from "@/components/StandingsLink";
import { CompetitionSwitcher } from "@/components/CompetitionSwitcher";
import { useCompetition } from "@/contexts/CompetitionContext";
import { COMPETITION_PRESETS } from "@/lib/competitionPresets";

export default function HomePage() {
  // User competition context
  const { activeCompetition, hasCompetitions } = useCompetition();
  const pathname = usePathname();
  
  // Debug: Log activeCompetition changes
  useEffect(() => {
    console.log(`[HomePage] activeCompetition changed:`, activeCompetition ? `${activeCompetition.name} (${activeCompetition.id})` : 'null');
  }, [activeCompetition?.id, activeCompetition?.name]);
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [goalies, setGoalies] = useState<Goalie[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(COMPETITION_PRESETS[0]);
  const [importConfig, setImportConfig] = useState({
    category: "starsi-zaci-a",
    season: "2025-2026",
  });
  const [importResult, setImportResult] = useState<{
    total: number;
    completed: number;
    upcoming: number;
  } | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [deletingMatch, setDeletingMatch] = useState<Match | null>(null);
  const [importMode, setImportMode] = useState<"api" | "json">("api");
  const [jsonInput, setJsonInput] = useState("");
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"supabase" | "local">("local");

  // Helper function to load manually set competition flags from metadata
  const loadManuallySetFlags = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const metadata = JSON.parse(localStorage.getItem('match-competition-metadata') || '{}');
      return new Set(Object.keys(metadata).filter(id => metadata[id] === true));
    } catch {
      return new Set();
    }
  };

  // Helper function to save manually set competition flag
  const saveManuallySetFlag = (matchId: string, isManuallySet: boolean) => {
    if (typeof window === 'undefined') return;
    try {
      const metadata = JSON.parse(localStorage.getItem('match-competition-metadata') || '{}');
      if (isManuallySet) {
        metadata[matchId] = true;
      } else {
        delete metadata[matchId];
      }
      localStorage.setItem('match-competition-metadata', JSON.stringify(metadata));
    } catch (err) {
      console.error('[HomePage] Failed to save competition metadata:', err);
    }
  };

  // Helper function to assign competitionId to matches without it
  const assignCompetitionIds = (matches: Match[]): Match[] => {
    if (!activeCompetition) return matches;
    
    // Load manually set flags
    const manuallySetMatchIds = loadManuallySetFlags();
    
    return matches.map(m => {
      // If match has manually set competitionId, never overwrite it
      const isManuallySet = manuallySetMatchIds.has(m.id) || m.competitionIdManuallySet;
      if (isManuallySet && m.competitionId) {
        return { ...m, competitionIdManuallySet: true };
      }
      
      // If match already has competitionId (but not manually set), check if it matches
      if (m.competitionId && !isManuallySet) {
        // If it already matches activeCompetition, keep it
        if (m.competitionId === activeCompetition.id) {
          return m;
        }
        // If it doesn't match, we'll try to reassign based on category below
      }
      
      // Try to match by category (if category exists and is not empty)
      const hasCategory = m.category && m.category.trim() !== "";
      if (hasCategory) {
        // Normalize strings for comparison
        const categoryNormalized = m.category.toLowerCase().trim()
          .replace(/["']/g, "")
          .replace(/\s+/g, " ")
          .replace(/\s+sk\./g, " sk")
          .replace(/\s+sk/g, " sk");
        
        const compNameNormalized = activeCompetition.name.toLowerCase().trim()
          .replace(/["']/g, "")
          .replace(/\s+/g, " ");

        // Extract key words
        const categoryWords = categoryNormalized
          .replace(/liga\s*/g, "")
          .replace(/starších|starší/g, "starsi")
          .replace(/mladších|mladší/g, "mladsi")
          .replace(/žáků|žák/g, "zaci")
          .replace(/sk\.?\s*\d+/g, "")
          .trim()
          .split(/\s+/)
          .filter(w => w && w.length > 1);

        const compNameWords = compNameNormalized
          .replace(/starší/g, "starsi")
          .replace(/mladší/g, "mladsi")
          .replace(/žák/g, "zaci")
          .trim()
          .split(/\s+/)
          .filter(w => w && w.length > 1);

        // Match if all key words from competition name are in category, or vice versa
        const allCompWordsInCategory = compNameWords.length > 0 && 
          compNameWords.every(w => categoryWords.some(cw => cw.includes(w) || w.includes(cw)));
        const allCategoryWordsInComp = categoryWords.length > 0 &&
          categoryWords.every(cw => compNameWords.some(w => cw.includes(w) || w.includes(cw)));

        // Direct substring match
        const directMatch = categoryNormalized.includes(compNameNormalized) ||
                           compNameNormalized.includes(categoryNormalized) ||
                           categoryNormalized === compNameNormalized;

        // Match by category field if available
        const matchesCategory = activeCompetition.category ? 
                               (categoryNormalized === activeCompetition.category.toLowerCase().trim()) : false;

        if (directMatch || allCompWordsInCategory || allCategoryWordsInComp || matchesCategory) {
          // Only assign if not manually set
          if (!isManuallySet) {
            return { ...m, competitionId: activeCompetition.id, competitionIdManuallySet: false };
          }
        }
      }
      
      // Don't automatically assign matches without category to activeCompetition
      // Users should manually assign these matches or they should be matched by category
      // Automatic assignment was causing issues where matches from different competitions
      // were incorrectly assigned to the currently active competition
      
      return m;
    });
  };

  // Load matches - try Supabase first, fall back to localStorage
  const loadMatches = async () => {
    setLoading(true);
    console.log("[HomePage] loadMatches: Starting to load matches...");
    
    if (isSupabaseConfigured()) {
      try {
        console.log("[HomePage] Supabase is configured, loading from Supabase...");
        const supabaseMatches = await getMatchesSupabase();
        console.log(`[HomePage] Loaded ${supabaseMatches.length} matches from Supabase:`, supabaseMatches);
        
        // Always use Supabase if configured, even if empty (to show deleted matches are gone)
          // Deduplicate matches by ID and externalId
          let uniqueMatches = deduplicateMatches(supabaseMatches);
        console.log(`[HomePage] After deduplication: ${uniqueMatches.length} matches`);
        
        // Load manually set flags and merge with matches
        const manuallySetMatchIds = loadManuallySetFlags();
        uniqueMatches = uniqueMatches.map(m => ({
          ...m,
          competitionIdManuallySet: manuallySetMatchIds.has(m.id) || m.competitionIdManuallySet,
        }));
        
        // Assign competitionId to matches that don't have it (respecting manual flags)
        const beforeAssign = uniqueMatches.map(m => m.competitionId);
        console.log(`[HomePage] Active competition:`, activeCompetition);
        console.log(`[HomePage] Matches before assignCompetitionIds:`, uniqueMatches.map(m => ({ id: m.id, category: m.category, competitionId: m.competitionId })));
          uniqueMatches = assignCompetitionIds(uniqueMatches);
        console.log(`[HomePage] Matches after assignCompetitionIds:`, uniqueMatches.map(m => ({ id: m.id, category: m.category, competitionId: m.competitionId })));
        
        // Delete matches without category and competitionId (they cannot be assigned and are useless)
        const matchesToDelete = uniqueMatches.filter(m => {
          const hasCategory = m.category && m.category.trim() !== "";
          const hasCompetitionId = !!m.competitionId;
          return !hasCategory && !hasCompetitionId;
        });
        
        if (matchesToDelete.length > 0) {
          console.log(`[HomePage] Found ${matchesToDelete.length} matches without category and competitionId - deleting them`);
          for (const match of matchesToDelete) {
            try {
              if (isSupabaseConfigured()) {
                await deleteMatchSupabase(match.id);
              } else {
                deleteMatchLocal(match.id);
              }
              // Also remove manually set flag if exists
              saveManuallySetFlag(match.id, false);
            } catch (err) {
              console.error(`[HomePage] Failed to delete match ${match.id}:`, err);
            }
          }
          // Remove deleted matches from the list
          uniqueMatches = uniqueMatches.filter(m => {
            const hasCategory = m.category && m.category.trim() !== "";
            const hasCompetitionId = !!m.competitionId;
            return hasCategory || hasCompetitionId;
          });
        }
        
        // Save competitionId updates back to database if changed and Supabase is configured
        // Note: Only save if competitionId is a valid UUID (not a local UserCompetition ID)
        if (isSupabaseConfigured()) {
          for (let i = 0; i < uniqueMatches.length; i++) {
            const match = uniqueMatches[i];
            const oldCompetitionId = beforeAssign[i];
            // If competitionId was assigned/updated and match wasn't manually set, save to DB
            // Only save if competitionId is a valid UUID (Supabase requires UUID, not local IDs)
            if (match.competitionId && match.competitionId !== oldCompetitionId && !match.competitionIdManuallySet) {
              // Check if competitionId is a valid UUID (Supabase competitions table uses UUIDs)
              // Local UserCompetition IDs (like "comp-xxx") are not UUIDs and should not be saved to Supabase
              const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(match.competitionId);
              if (isValidUuid) {
                try {
                  console.log(`[HomePage] Updating competitionId for match ${match.id}: ${oldCompetitionId} -> ${match.competitionId}`);
                  await updateMatchSupabase(match.id, { competition_id: match.competitionId });
                } catch (err) {
                  console.error(`[HomePage] Failed to update competitionId for match ${match.id}:`, err);
                }
              } else {
                console.log(`[HomePage] Skipping Supabase update for match ${match.id}: competitionId "${match.competitionId}" is not a valid UUID (likely a local UserCompetition ID)`);
              }
            }
          }
        }
        
        console.log(`[HomePage] Setting ${uniqueMatches.length} matches to state`);
          setMatches(uniqueMatches);
          setDataSource("supabase");
          setLoading(false);
          return;
      } catch (err) {
        console.error("[HomePage] Failed to load from Supabase:", err);
      }
    }
    
    // Fallback to localStorage
    let localMatches = getMatchesLocal();
    // Load manually set flags and merge with matches
    const manuallySetMatchIds = loadManuallySetFlags();
    localMatches = localMatches.map(m => ({
      ...m,
      competitionIdManuallySet: manuallySetMatchIds.has(m.id) || m.competitionIdManuallySet,
    }));
    // Deduplicate matches by ID and externalId
    let uniqueMatches = deduplicateMatches(localMatches);
    // Assign competitionId to matches that don't have it (respecting manual flags)
    uniqueMatches = assignCompetitionIds(uniqueMatches);
    
    // Delete matches without category and competitionId (they cannot be assigned and are useless)
    const matchesToDelete = uniqueMatches.filter(m => {
      const hasCategory = m.category && m.category.trim() !== "";
      const hasCompetitionId = !!m.competitionId;
      return !hasCategory && !hasCompetitionId;
    });
    
    if (matchesToDelete.length > 0) {
      console.log(`[HomePage] Found ${matchesToDelete.length} matches without category and competitionId - deleting them`);
      for (const match of matchesToDelete) {
        try {
          deleteMatchLocal(match.id);
          // Also remove manually set flag if exists
          saveManuallySetFlag(match.id, false);
        } catch (err) {
          console.error(`[HomePage] Failed to delete match ${match.id}:`, err);
        }
      }
      // Remove deleted matches from the list
      uniqueMatches = uniqueMatches.filter(m => {
        const hasCategory = m.category && m.category.trim() !== "";
        const hasCompetitionId = !!m.competitionId;
        return hasCategory || hasCompetitionId;
      });
    }
    
    setMatches(uniqueMatches);
    setDataSource("local");
    setLoading(false);
  };
  
  // Helper function to deduplicate matches
  // Only deduplicate by ID and externalId - do NOT deduplicate by datetime+teams
  // as this could remove legitimate matches (e.g., same teams playing on same date but different matches)
  const deduplicateMatches = (matches: Match[]): Match[] => {
    const seenIds = new Set<string>();
    const seenByExternalId = new Map<string, Match>();
    const unique: Match[] = [];
    
    for (const match of matches) {
      // First check by ID (most reliable)
      if (match.id && seenIds.has(match.id)) {
        continue;
      }
      if (match.id) seenIds.add(match.id);
      
      // Check by externalId (if exists) - this is for imported matches
      if (match.externalId) {
        const existing = seenByExternalId.get(match.externalId);
        if (existing) {
          // If same externalId but different ID, prefer the one with more data
          const currentHasData = match.goalieId || match.manualStats || match.homeScore !== undefined;
          const existingHasData = existing.goalieId || existing.manualStats || existing.homeScore !== undefined;
          
          if (currentHasData && !existingHasData) {
            // Replace existing with current (has more data)
            const index = unique.findIndex(m => m.id === existing.id);
            if (index >= 0) {
              unique[index] = match;
              seenByExternalId.set(match.externalId, match);
              if (existing.id && match.id !== existing.id) {
                seenIds.delete(existing.id);
                seenIds.add(match.id);
              }
            }
            continue;
          } else {
            continue;
          }
        }
        seenByExternalId.set(match.externalId, match);
      }
      
      // Do NOT deduplicate by datetime + teams - this is too aggressive and could remove legitimate matches
      unique.push(match);
    }
    
    return unique;
  };

  useEffect(() => {
    loadMatches();
    setGoalies(getGoalies());
  }, []);

  // Reload matches when navigating back to home page (but not on initial mount)
  const prevPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevPathnameRef.current !== null && pathname === '/' && prevPathnameRef.current !== '/') {
      // Only reload if we're navigating back to home from another page
      loadMatches();
    }
    prevPathnameRef.current = pathname;
  }, [pathname]);

  // Reload matches when page becomes visible (e.g., after returning from match detail)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMatches();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Reassign competitionIds when activeCompetition changes
  // This effect runs when activeCompetition changes, not when matches change
  useEffect(() => {
    console.log(`[HomePage] useEffect triggered for activeCompetition change:`, {
      activeCompetitionId: activeCompetition?.id || 'null',
      activeCompetitionName: activeCompetition?.name || 'null',
      matchesCount: matches.length
    });
    
    if (matches.length > 0) {
      console.log(`[HomePage] activeCompetition changed to: ${activeCompetition?.name || 'none'} (${activeCompetition?.id || 'none'}), reassigning competitionIds...`);
      // Reassign competitionIds to existing matches when activeCompetition changes
      // Always create new array with new object references to ensure React sees the change
      const reassignedMatches = assignCompetitionIds(matches.map(m => ({ ...m })));
      
      // Check if any competitionIds actually changed
      const hasChanges = matches.some((m, i) => m.competitionId !== reassignedMatches[i].competitionId);
      
      console.log(`[HomePage] Reassignment result: hasChanges=${hasChanges}, reassignedMatches.length=${reassignedMatches.length}`);
      
      if (hasChanges || activeCompetition) {
        // Update matches state to trigger filtering recalculation
        // Even if no changes, we need to trigger re-filtering for the new activeCompetition
        console.log(`[HomePage] Updating matches state (hasChanges: ${hasChanges}, activeCompetition: ${!!activeCompetition})`);
      setMatches(reassignedMatches);
        
        // Save competitionId updates back to database if changed (async, don't wait)
        // Note: Only save if competitionId is a valid UUID (not a local UserCompetition ID)
        if (isSupabaseConfigured() && activeCompetition && hasChanges) {
          reassignedMatches.forEach((match, i) => {
            const oldMatch = matches[i];
            if (match.competitionId && match.competitionId !== oldMatch.competitionId && !match.competitionIdManuallySet) {
              // Check if competitionId is a valid UUID (Supabase competitions table uses UUIDs)
              // Local UserCompetition IDs (like "comp-xxx") are not UUIDs and should not be saved to Supabase
              const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(match.competitionId);
              if (isValidUuid) {
                updateMatchSupabase(match.id, { competition_id: match.competitionId }).catch(err => {
                  console.error(`[HomePage] Failed to update competitionId for match ${match.id}:`, err);
                });
              } else {
                console.log(`[HomePage] Skipping Supabase update for match ${match.id}: competitionId "${match.competitionId}" is not a valid UUID (likely a local UserCompetition ID)`);
              }
            }
          });
        }
      } else {
        console.log(`[HomePage] No changes detected and no activeCompetition, skipping update`);
      }
    } else {
      console.log(`[HomePage] No matches to process (matches.length = 0)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompetition?.id]); // Only depend on activeCompetition.id, not matches (to avoid infinite loop)

  // Get unique categories from matches
  const categories = Array.from(
    new Set(matches.map((m) => m.category).filter(Boolean))
  ).sort();

  // Auto-select first category if none selected
  useEffect(() => {
    if (categoryFilter === null && categories.length > 0) {
      setCategoryFilter(categories[0]);
    }
  }, [categoryFilter, categories]);

  // Helper function to match category with competition name
  const matchesCompetition = (match: Match, competition: typeof activeCompetition): boolean => {
    if (!competition) {
      console.log(`[HomePage] matchesCompetition: No competition provided for match ${match.id}`);
      return false;
    }
    
    // Primary: Exact match by competitionId (most reliable)
    if (match.competitionId && match.competitionId === competition.id) {
      console.log(`[HomePage] matchesCompetition: Match ${match.id} matches by competitionId (${match.competitionId} === ${competition.id})`);
      return true;
    }
    
    // Fallback: Match by category name (for backward compatibility with old matches)
    // Treat empty string as "no category" (falsy check handles both null/undefined and empty string)
    if (!match.category || match.category.trim() === "") {
      console.log(`[HomePage] matchesCompetition: Match ${match.id} has no category, cannot match by category`);
      return false;
    }
    
    // Normalize strings for comparison (same logic as in import)
    const categoryNormalized = match.category.toLowerCase().trim()
      .replace(/["']/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+sk\./g, " sk")
      .replace(/\s+sk/g, " sk");
    
    const compNameNormalized = competition.name.toLowerCase().trim()
      .replace(/["']/g, "")
      .replace(/\s+/g, " ");
    
    // Match by category field if available
    if (competition.category) {
      const compCategoryNormalized = competition.category.toLowerCase().trim();
      if (categoryNormalized === compCategoryNormalized) {
        return true;
      }
    }
    
    // Extract key words
    const categoryWords = categoryNormalized
      .replace(/liga\s*/g, "")
      .replace(/starších|starší/g, "starsi")
      .replace(/mladších|mladší/g, "mladsi")
      .replace(/žáků|žák/g, "zaci")
      .replace(/sk\.?\s*\d+/g, "")
      .trim()
      .split(/\s+/)
      .filter(w => w && w.length > 1);
    
    const compNameWords = compNameNormalized
      .replace(/starší/g, "starsi")
      .replace(/mladší/g, "mladsi")
      .replace(/žák/g, "zaci")
      .trim()
      .split(/\s+/)
      .filter(w => w && w.length > 1);
    
    // Match if all key words from competition name are in category, or vice versa
    const allCompWordsInCategory = compNameWords.length > 0 && 
      compNameWords.every(w => categoryWords.some(cw => cw.includes(w) || w.includes(cw)));
    const allCategoryWordsInComp = categoryWords.length > 0 &&
      categoryWords.every(cw => compNameWords.some(w => cw.includes(w) || w.includes(cw)));
    
    // Direct substring match
    const directMatch = categoryNormalized.includes(compNameNormalized) ||
                       compNameNormalized.includes(categoryNormalized) ||
                       categoryNormalized === compNameNormalized;
    
    return directMatch || allCompWordsInCategory || allCategoryWordsInComp;
  };

  // Filter matches by active competition first (if set), then by category
  // Use useMemo to ensure filtering recalculates when activeCompetition or matches change
  const filteredMatches = useMemo(() => {
    console.log(`[HomePage] useMemo filteredMatches recalculating...`, {
      matchesCount: matches.length,
      activeCompetition: activeCompetition ? `${activeCompetition.name} (${activeCompetition.id})` : 'null',
      categoryFilter: categoryFilter || 'none'
    });
    
    const filtered = matches.filter((m) => {
    // If activeCompetition is set, filter by competitionId or name/category match
    if (activeCompetition) {
        // Treat empty string as "no category" - check both null/undefined and empty string
        const hasCategory = m.category && m.category.trim() !== "";
        const hasCompetitionId = !!m.competitionId;
        
        // If match has no competitionId and no category, it's truly unassigned
        // These matches cannot be automatically assigned and should be deleted or manually assigned
        // For now, hide them to avoid confusion - they can be manually assigned via match detail page
        if (!hasCompetitionId && !hasCategory) {
          console.log(`[HomePage] Match ${m.id} filtered out: truly unassigned (no competitionId, no category) - should be deleted or manually assigned`);
          return false; // Hide unassigned matches - they should be deleted or manually assigned
        }
        
        const matches = matchesCompetition(m, activeCompetition);
        if (!matches) {
          console.log(`[HomePage] Match ${m.id} filtered out: category="${m.category || '(empty)'}", competitionId="${m.competitionId || '(none)'}", activeCompetition="${activeCompetition.name}" (${activeCompetition.id})`);
        } else {
          console.log(`[HomePage] Match ${m.id} included: category="${m.category || '(empty)'}", competitionId="${m.competitionId || '(none)'}", matches competition`);
        }
        return matches;
    }
    // If no activeCompetition, filter by category only
      const result = categoryFilter ? m.category === categoryFilter : true;
      if (!result) {
        console.log(`[HomePage] Match ${m.id} filtered out: category="${m.category}", categoryFilter="${categoryFilter}"`);
      }
      return result;
    });
    
    console.log(`[HomePage] Filtering result: ${matches.length} total matches, ${filtered.length} after filter, activeCompetition=${activeCompetition?.name || 'none'} (${activeCompetition?.id || 'none'}), categoryFilter=${categoryFilter || 'none'}`);
    return filtered;
  }, [matches, activeCompetition, categoryFilter]);

  // Sort matches: upcoming first, then by date
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    const now = new Date().getTime();
    const aTime = new Date(a.datetime).getTime();
    const bTime = new Date(b.datetime).getTime();

    const aUpcoming = aTime >= now;
    const bUpcoming = bTime >= now;

    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;

    return aUpcoming ? aTime - bTime : bTime - aTime;
  });

  // Split by completed status AND date
  // Upcoming: not completed OR completed but datetime is in future (or less than 3 hours ago)
  // Past: completed AND datetime is more than 3 hours ago
  const now = Date.now();
  const threeHoursAgo = now - 3600000 * 3;
  
  const upcomingMatches = sortedMatches.filter((m) => {
    const matchTime = new Date(m.datetime).getTime();
    // Not completed -> upcoming
    if (!m.completed) return true;
    // Completed but datetime is in future or very recent (less than 3 hours ago) -> still show in upcoming
    if (m.completed && matchTime >= threeHoursAgo) return true;
    return false;
  });
  
  const pastMatches = sortedMatches.filter((m) => {
    const matchTime = new Date(m.datetime).getTime();
    // Completed and datetime is more than 3 hours ago -> past
    return m.completed && matchTime < threeHoursAgo;
  });
  
  console.log(`[HomePage] Match split: ${upcomingMatches.length} upcoming, ${pastMatches.length} past, ${sortedMatches.length} total sorted`);

  const matchTypeLabels: Record<string, string> = {
    friendly: "Přátelský",
    league: "Soutěžní",
    tournament: "Turnaj",
    cup: "Pohár",
  };

  // Get standings URL for current category filter or active competition
  const getStandingsUrlForCategory = (category: string): string | undefined => {
    // First check if active competition has a standings URL
    if (activeCompetition?.standingsUrl) {
      return activeCompetition.standingsUrl;
    }
    // Fall back to preset
    const preset = COMPETITION_PRESETS.find(p => p.name === category);
    return preset?.standingsUrl;
  };

  const handlePresetChange = (preset: typeof COMPETITION_PRESETS[0]) => {
    setSelectedPreset(preset);
    setImportConfig({
      category: preset.id,
      season: preset.season,
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const response = await fetch("/api/matches/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season: importConfig.season,
          category: importConfig.category || undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.matches) {
        // Check for duplicates before saving
        const existingMatches = getMatchesLocal();
        const existingByExternalId = new Map(
          existingMatches.filter(m => m.externalId).map(m => [m.externalId!, m])
        );
        const existingByKey = new Map(
          existingMatches.map(m => {
            // Create unique key from datetime + home + away
            const key = `${m.datetime}-${m.home}-${m.away}`;
            return [key, m];
          })
        );

        let savedCount = 0;
        let skippedCount = 0;

        data.matches.forEach((m: Match) => {
          // Check by externalId first (most reliable)
          if (m.externalId && existingByExternalId.has(m.externalId)) {
            skippedCount++;
            return;
          }

          // Check by datetime + teams combination
          const key = `${m.datetime}-${m.home}-${m.away}`;
          if (existingByKey.has(key)) {
            skippedCount++;
            return;
          }

          // Assign competitionId if activeCompetition is set and match doesn't have one
          let matchToSave = { ...m };
          if (!matchToSave.competitionId && activeCompetition && m.category) {
            // Normalize strings for comparison
            const categoryNormalized = m.category.toLowerCase().trim()
              .replace(/["']/g, "") // Remove quotes
              .replace(/\s+/g, " ") // Normalize spaces
              .replace(/\s+sk\./g, " sk") // Normalize "sk."
              .replace(/\s+sk/g, " sk"); // Normalize "sk "
            
            const compNameNormalized = activeCompetition.name.toLowerCase().trim()
              .replace(/["']/g, "")
              .replace(/\s+/g, " ");
            
            // Extract key words from category (e.g., "starsi zaci b" from "Liga starších žáků \"B\" sk. 10")
            const categoryWords = categoryNormalized
              .replace(/liga\s*/g, "")
              .replace(/starších|starší/g, "starsi")
              .replace(/mladších|mladší/g, "mladsi")
              .replace(/žáků|žák/g, "zaci")
              .replace(/sk\.?\s*\d+/g, "")
              .trim()
              .split(/\s+/)
              .filter(w => w && w.length > 1);
            
            const compNameWords = compNameNormalized
              .replace(/starší/g, "starsi")
              .replace(/mladší/g, "mladsi")
              .replace(/žák/g, "zaci")
              .trim()
              .split(/\s+/)
              .filter(w => w && w.length > 1);
            
            // Match if all key words from competition name are in category, or vice versa
            const allCompWordsInCategory = compNameWords.length > 0 && 
              compNameWords.every(w => categoryWords.some(cw => cw.includes(w) || w.includes(cw)));
            const allCategoryWordsInComp = categoryWords.length > 0 &&
              categoryWords.every(cw => compNameWords.some(w => cw.includes(w) || w.includes(cw)));
            
            // Also check direct substring match
            const directMatch = categoryNormalized.includes(compNameNormalized) ||
                               compNameNormalized.includes(categoryNormalized) ||
                               categoryNormalized === compNameNormalized;
            
            if (directMatch || allCompWordsInCategory || allCategoryWordsInComp) {
              matchToSave.competitionId = activeCompetition.id;
            }
          }

          // No duplicate found, save the match
          saveMatch(matchToSave);
          savedCount++;
          
          // Add to tracking maps to avoid duplicates within the same import batch
          if (matchToSave.externalId) {
            existingByExternalId.set(matchToSave.externalId, matchToSave);
          }
          existingByKey.set(key, matchToSave);
        });


        // Reload matches (prefer Supabase if configured)
        await loadMatches();

//         // Also save standings if available
//         if (data.standings && data.standings.length > 0) {
//           data.standings.forEach((s: CompetitionStandings) => saveStandings(s));
//         }

        setImportResult({
          total: data.matches.length,
          completed: data.completedCount || 0,
          upcoming: data.upcomingCount || 0,
        });
      } else {
        alert("Import selhal: " + (data.error || "Neznámá chyba"));
      }
    } catch (error) {
      console.error("Import failed:", error);
      alert("Import selhal. Zkuste to znovu.");
    } finally {
      setImporting(false);
    }
  };

  const handleJsonImport = () => {
    setImporting(true);
    setImportResult(null);
    try {
      const importedMatches: Match[] = JSON.parse(jsonInput);
      
      if (!Array.isArray(importedMatches)) {
        throw new Error("JSON musí být pole zápasů");
      }

      // Save imported matches (avoid duplicates)
      const existingIds = new Set(matches.map((m) => m.externalId || m.id));
      const newMatches = importedMatches.filter(
        (m) => !existingIds.has(m.externalId || m.id)
      );

      let importedCount = 0;
      newMatches.forEach((m) => {
        // Ensure required fields
        if (m.home && m.away && m.datetime) {
          saveMatch({
            ...m,
            id: m.id || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            seasonId: m.seasonId || "2024-2025",
            matchType: m.matchType || "league",
            source: "ceskyhokej",
          });
          importedCount++;
        }
      });
      
      // Reload matches (prefer Supabase if configured)
      loadMatches();
      setImportResult({
        total: importedCount,
        completed: 0,
        upcoming: 0,
      });
      setJsonInput("");
    } catch (error) {
      console.error("JSON Import failed:", error);
      alert(`Import selhal: ${error instanceof Error ? error.message : "Neplatný JSON"}`);
    } finally {
      setImporting(false);
    }
  };

  const handleManualStatsSave = (data: {
    goalieId: string;
    shots: number;
    saves: number;
    goals: number;
  }) => {
    if (!editingMatch) return;

    const updatedMatch: Match = {
      ...editingMatch,
      goalieId: data.goalieId,
      manualStats: {
        shots: data.shots,
        saves: data.saves,
        goals: data.goals,
      },
    };

    saveMatch(updatedMatch);
    // Reload matches
    loadMatches();
    setEditingMatch(null);
  };

  const handleDeleteMatch = async () => {
    if (!deletingMatch) return;
    
    // Always try to delete from Supabase if configured, even if dataSource is "local"
    // This ensures matches are deleted from database
    if (isSupabaseConfigured()) {
      const success = await deleteMatchSupabase(deletingMatch.id);
      if (!success) {
        alert("Nepodařilo se smazat zápas z databáze");
        setDeletingMatch(null);
        return;
      }
    }
    
    // Also delete from localStorage if exists there
      deleteMatchLocal(deletingMatch.id);
    
    // Remove manually set flag if exists
    if (typeof window !== 'undefined') {
      try {
        const metadata = JSON.parse(localStorage.getItem('match-competition-metadata') || '{}');
        delete metadata[deletingMatch.id];
        localStorage.setItem('match-competition-metadata', JSON.stringify(metadata));
      } catch (err) {
        // Ignore errors
      }
    }
    
    // Reload matches to reflect deletion
    await loadMatches();
    setDeletingMatch(null);
  };

  const handleDeleteFilteredMatches = async () => {
    if (filteredMatches.length === 0) return;
    const label = categoryFilter
      ? `opravdu smazat všech ${filteredMatches.length} zápasů v kategorii "${categoryFilter}"?`
      : `opravdu smazat všech ${filteredMatches.length} zápasů?`;
    if (!confirm(`Chcete ${label}`)) return;

    // Always try to delete from Supabase if configured
    if (isSupabaseConfigured()) {
      for (const m of filteredMatches) {
        // best-effort – pokud se některý zápas nepodaří smazat, pokračujeme dál
        // eslint-disable-next-line no-await-in-loop
        await deleteMatchSupabase(m.id);
      }
    }
    
    // Also delete from localStorage
      filteredMatches.forEach((m) => deleteMatchLocal(m.id));
    
    // Remove manually set flags
    if (typeof window !== 'undefined') {
      try {
        const metadata = JSON.parse(localStorage.getItem('match-competition-metadata') || '{}');
        filteredMatches.forEach(m => {
          delete metadata[m.id];
        });
        localStorage.setItem('match-competition-metadata', JSON.stringify(metadata));
      } catch (err) {
        // Ignore errors
      }
    }
    
    // Reload matches to reflect deletions
    await loadMatches();
  };

  // Get current standings URL based on category filter or active competition
  const currentStandingsUrl = categoryFilter
    ? getStandingsUrlForCategory(categoryFilter) 
    : (activeCompetition?.standingsUrl || (categories.length > 0 ? getStandingsUrlForCategory(categories[0]) : undefined));

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">🥅 Goalie Tracker</h1>
        <div className="flex items-center gap-2">
          <CompetitionSwitcher />
          <Link
            href="/goalies"
            className="rounded-lg bg-bgSurfaceSoft px-3 py-1.5 text-xs text-accentPrimary"
          >
            Brankáři ({goalies.length})
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/matches/new"
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accentPrimary/50 bg-accentPrimary/10 py-4 text-sm font-medium text-accentPrimary"
        >
          <span className="text-lg">+</span>
          Nový zápas
        </Link>
        <button
          onClick={() => setShowImportWizard(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accentSuccess/50 bg-accentSuccess/10 py-4 text-sm font-medium text-accentSuccess"
        >
          <span className="text-lg">↓</span>
          Import z webu
        </button>
      </div>
      
      {/* Quick import button */}
      <button
        onClick={() => setShowImport(true)}
        className="w-full rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400"
      >
        Rychlý import / JSON import
      </button>

      {/* Category filter - no "Vše" option, always filter by category */}
      {categories.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const count = matches.filter((m) => m.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    categoryFilter === cat
                      ? "bg-accentPrimary text-white"
                      : "bg-bgSurfaceSoft text-slate-400"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
          {filteredMatches.length > 0 && (
            <button
              onClick={handleDeleteFilteredMatches}
              className="rounded-full bg-accentDanger/10 px-3 py-1.5 text-[10px] font-medium text-accentDanger hover:bg-accentDanger/20"
            >
              🗑️ Smazat {filteredMatches.length} záznamů
            </button>
          )}
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-bgSurfaceSoft p-5">
            <h3 className="mb-4 text-center text-lg font-semibold">
              Import zápasů
            </h3>

            {/* Mode selector */}
            <div className="mb-4 flex rounded-lg bg-slate-800 p-1">
              <button
                onClick={() => setImportMode("api")}
                className={`flex-1 rounded-md py-2 text-xs font-medium ${
                  importMode === "api"
                    ? "bg-accentPrimary text-white"
                    : "text-slate-400"
                }`}
              >
                Z webu
              </button>
              <button
                onClick={() => setImportMode("json")}
                className={`flex-1 rounded-md py-2 text-xs font-medium ${
                  importMode === "json"
                    ? "bg-accentPrimary text-white"
                    : "text-slate-400"
                }`}
              >
                Z JSON
              </button>
            </div>

            {importMode === "api" && (
              <>
                {/* Competition presets */}
                <div className="mb-4">
                  <label className="mb-2 block text-xs text-slate-400">
                    Vyberte soutěž
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {COMPETITION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetChange(preset)}
                        className={`rounded-lg px-3 py-2.5 text-xs font-medium ${
                          selectedPreset.id === preset.id
                            ? "bg-accentPrimary text-white"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced config (collapsible) */}
                <details className="mb-4">
                  <summary className="cursor-pointer text-xs text-slate-400">
                    Pokročilé nastavení
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">
                        Klíč soutěže (slug)
                      </label>
                      <input
                        type="text"
                        value={importConfig.category}
                        onChange={(e) =>
                          setImportConfig({ ...importConfig, category: e.target.value })
                        }
                        placeholder="např. starsi-zaci-a"
                        className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">
                        Sezóna
                      </label>
                      <input
                        type="text"
                        value={importConfig.season}
                        onChange={(e) =>
                          setImportConfig({ ...importConfig, season: e.target.value })
                        }
                        className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                  </div>
                </details>

                <div className="mb-4 rounded-lg bg-accentSuccess/10 p-3 text-xs text-accentSuccess">
                  <p className="mb-1">✓ Import ze zapasy.ceskyhokej.cz</p>
                  <p className="text-slate-400">
                    Načte zápasy HC Slovan Ústí nad Labem v okně −7 až +21 dní kolem dneška
                    (podle vybrané sezóny a filtru kategorie).
                  </p>
                </div>
              </>
            )}

            {importMode === "json" && (
              <>
                <div className="mb-4">
                  <label className="mb-2 block text-xs text-slate-400">
                    Vložte JSON pole zápasů
                  </label>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={`[
  {
    "home": "HC Slovan Ústí",
    "away": "HC Litvínov",
    "datetime": "2024-12-15T10:00:00",
    "category": "Starší žáci B",
    "homeScore": 3,
    "awayScore": 2,
    "completed": true
  }
]`}
                    className="h-40 w-full rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>

                <div className="mb-4 rounded-lg bg-slate-800/50 p-3 text-xs text-slate-400">
                  <p className="mb-1">📋 Povinná pole:</p>
                  <ul className="list-inside list-disc">
                    <li>home, away (názvy týmů)</li>
                    <li>datetime (ISO formát)</li>
                  </ul>
                  <p className="mt-2">Volitelná: category, homeScore, awayScore, venue, completed</p>
                </div>
              </>
            )}

            {importResult && (
              <div className="mb-4 rounded-lg bg-accentSuccess/20 p-3 text-xs text-accentSuccess">
                ✓ Importováno {importResult.total} zápasů
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportResult(null);
                  setJsonInput("");
                }}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm text-slate-300"
              >
                Zavřít
              </button>
              <button
                onClick={importMode === "api" ? handleImport : handleJsonImport}
                disabled={importing || (importMode === "api" ? !importConfig.category : !jsonInput.trim())}
                className="flex-1 rounded-xl bg-accentSuccess py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {importing ? "Importuji..." : "Importovat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-bgSurfaceSoft p-5">
            <h3 className="mb-2 text-center text-lg font-semibold text-accentDanger">
              Smazat zápas?
            </h3>
            <p className="mb-4 text-center text-sm text-slate-400">
              {deletingMatch.home} vs {deletingMatch.away}
              <br />
              <span className="text-xs">
                {new Date(deletingMatch.datetime).toLocaleDateString("cs-CZ")}
              </span>
            </p>
            <p className="mb-4 text-center text-xs text-accentDanger">
              Tato akce smaže i všechny zaznamenané události zápasu!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingMatch(null)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm text-slate-300"
              >
                Zrušit
              </button>
              <button
                onClick={handleDeleteMatch}
                className="flex-1 rounded-xl bg-accentDanger py-2.5 text-sm font-semibold text-white"
              >
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual stats modal */}
      {editingMatch && (
        <ManualStatsModal
          open={!!editingMatch}
          onClose={() => setEditingMatch(null)}
          onSave={handleManualStatsSave}
          match={editingMatch}
          goalies={goalies}
        />
      )}

      {/* Import Wizard */}
      <ImportWizard
        open={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onComplete={(count) => {
          loadMatches();
          setShowImportWizard(false);
          alert(`Importováno ${count} zápasů`);
        }}
      />

      {/* Matches list */}
      {matches.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 text-5xl">🏒</div>
          <h2 className="mb-2 text-lg font-semibold">Zatím žádné zápasy</h2>
          <p className="mb-6 max-w-xs text-sm text-slate-400">
            Vytvořte nový zápas nebo importujte z webu ceskyhokej.cz
          </p>
          <div className="flex gap-3">
            <Link
              href="/matches/new"
              className="rounded-xl bg-accentPrimary px-5 py-2.5 text-sm font-semibold text-white"
            >
              + Nový zápas
            </Link>
            <button
              onClick={() => setShowImport(true)}
              className="rounded-xl bg-accentSuccess px-5 py-2.5 text-sm font-semibold text-white"
            >
              ↓ Import
            </button>
          </div>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 text-5xl">🔍</div>
          <h2 className="mb-2 text-lg font-semibold">Žádné zápasy pro aktuální filtr</h2>
          <p className="mb-6 max-w-xs text-sm text-slate-400">
            {activeCompetition 
              ? `Máte ${matches.length} zápasů celkem, ale žádný neodpovídá soutěži "${activeCompetition.name}". Zkuste změnit výběr soutěže v dropdownu.`
              : categoryFilter
              ? `Máte ${matches.length} zápasů celkem, ale žádný neodpovídá kategorii "${categoryFilter}".`
              : `Máte ${matches.length} zápasů, ale žádný neprošel filtrem.`}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 rounded-lg bg-slate-800 p-3 text-left text-xs text-slate-400 max-w-md">
              <div>Debug info:</div>
              <div>Total matches: {matches.length}</div>
              <div>Filtered matches: {filteredMatches.length}</div>
              <div>Active competition: {activeCompetition?.name || 'none'} (ID: {activeCompetition?.id || 'none'})</div>
              <div>Category filter: {categoryFilter || 'none'}</div>
              <div className="mt-2">Sample matches (first 5):</div>
              {matches.slice(0, 5).map(m => (
                <div key={m.id} className="ml-2">
                  {m.id.substring(0, 20)}...: category="{m.category || 'empty'}", competitionId="{m.competitionId || 'none'}"
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Upcoming matches */}
          {upcomingMatches.filter(m => !m.completed).length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-400">
                  NADCHÁZEJÍCÍ ZÁPASY ({upcomingMatches.filter(m => !m.completed).length})
                </h2>
                <button
                  onClick={async () => {
                    if (!confirm("Aktualizovat nadcházející zápasy z webu?")) return;
                    setImporting(true);
                    try {
                      const res = await fetch("/api/matches/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ season: "2025-2026" }),
                      });
                      const data = await res.json();
                      if (data.success && data.matches) {
                        // Update only upcoming matches
                        const upcomingFromApi = data.matches.filter((m: Match) => !m.completed);
                        upcomingFromApi.forEach((m: Match) => saveMatch(m));
                        // Reload matches
                        loadMatches();
                        alert(`Aktualizováno ${upcomingFromApi.length} nadcházejících zápasů`);
                      }
                    } catch (e) {
                      alert("Chyba při aktualizaci: " + e);
                    }
                    setImporting(false);
                  }}
                  disabled={importing}
                  className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:text-white disabled:opacity-50"
                >
                  {importing ? "⏳" : "🔄"} Aktualizovat
                </button>
              </div>
              <div className="space-y-3">
                {upcomingMatches
                  .filter(m => !m.completed)
                  .map((m) => {
                    const goalie = m.goalieId
                      ? getGoalieById(m.goalieId)
                      : null;
                    const matchEvents = getEventsByMatchLocal(m.id);
                    const hasEvents = matchEvents.length > 0;
                    const goalieInitials = goalie 
                      ? `${goalie.firstName.charAt(0).toUpperCase()}${goalie.lastName.charAt(0).toUpperCase()}`
                      : null;
                    
                    return (
                      <div
                        key={m.id}
                        className="rounded-2xl bg-bgSurfaceSoft p-4 shadow-sm shadow-black/40"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                m.matchType === "friendly"
                                  ? "bg-accentPrimary/20 text-accentPrimary"
                                  : m.matchType === "league"
                                  ? "bg-accentSuccess/20 text-accentSuccess"
                                  : "bg-accentHighlight/20 text-accentHighlight"
                              }`}
                            >
                              {matchTypeLabels[m.matchType] || m.matchType}
                            </span>
                            <span>{m.category}</span>
                          </div>
                          <button
                            onClick={() => setDeletingMatch(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-accentDanger"
                            aria-label="Smazat zápas"
                          >
                            🗑️
                          </button>
                        </div>
                        <Link href={`/match/${m.id}`} className="block">
                          <div className="mt-1 text-sm font-semibold">
                            {m.home || m.homeTeamName || "Domácí"} vs {m.away || m.awayTeamName || "Hosté"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            📅 {new Date(m.datetime).toLocaleString("cs-CZ")}
                          </div>
                          {m.venue && (
                            <div className="mt-0.5 text-xs text-slate-500">
                              📍 {m.venue}
                            </div>
                          )}
                          {goalie && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accentPrimary/20 text-[10px] font-bold text-accentPrimary">
                                {goalie.jerseyNumber || goalie.firstName[0]}
                              </span>
                              <span>
                                {goalie.firstName} {goalie.lastName}
                                {goalieInitials && (
                                  <span className="ml-1.5 rounded bg-accentPrimary/20 px-1.5 py-0.5 text-[10px] font-medium text-accentPrimary">
                                    {goalieInitials}
                                  </span>
                                )}
                              </span>
                              {hasEvents && (
                                <span className="ml-2 rounded bg-accentSuccess/20 px-1.5 py-0.5 text-[10px] font-medium text-accentSuccess">
                                  📊 {matchEvents.length}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="mt-3 text-xs text-accentPrimary">
                            Klepni pro live tracking →
                          </div>
                        </Link>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Past matches */}
          {pastMatches.length > 0 && (
            <section>
              {/* Section header with external standings link */}
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-400">
                  ODEHRANÉ ZÁPASY ({pastMatches.length})
                </h2>
                <StandingsButton 
                  url={currentStandingsUrl} 
                  label="Tabulka"
                />
              </div>

              <div className="space-y-2">
                {pastMatches.slice(0, 20).map((m) => {
                  const goalie = m.goalieId
                    ? getGoalieById(m.goalieId)
                    : null;
                  const hasStats = m.manualStats && m.manualStats.shots > 0;
                  const hasScore = m.homeScore !== undefined && m.awayScore !== undefined;
                  const matchEvents = getEventsByMatchLocal(m.id);
                  const hasEvents = matchEvents.length > 0;
                  
                  // Generate initials from first and last name
                  const goalieInitials = goalie 
                    ? `${goalie.firstName.charAt(0).toUpperCase()}${goalie.lastName.charAt(0).toUpperCase()}`
                    : null;

                  return (
                    <div
                      key={m.id}
                      className="rounded-xl bg-bgSurfaceSoft/50 p-3"
                    >
                      {/* Main row with flex layout for consistent alignment */}
                      <div className="flex items-center gap-3">
                        {/* Match info - takes remaining space */}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {m.home || m.homeTeamName || "Domácí"} vs {m.away || m.awayTeamName || "Hosté"}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {new Date(m.datetime).toLocaleDateString("cs-CZ")} • {m.category}
                            {m.source === "ceskyhokej" && (
                              <span className="ml-1 text-accentSuccess">(import)</span>
                            )}
                          </div>
                          {/* Roster summary */}
                          {m.roster?.goalScorers && m.roster.goalScorers.length > 0 && (
                            <div className="mt-1 truncate text-xs text-slate-400">
                              ⚽ {m.roster.goalScorers
                                .filter(gs => gs.isOurTeam)
                                .map(gs => gs.name)
                                .join(", ")}
                            </div>
                          )}
                          {goalie && (
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                              <span>🥅</span>
                              <span>
                                {goalie.firstName} {goalie.lastName}
                                {goalieInitials && (
                                  <span className="ml-1.5 rounded bg-accentPrimary/20 px-1.5 py-0.5 text-[10px] font-medium text-accentPrimary">
                                    {goalieInitials}
                                  </span>
                                )}
                              </span>
                              {hasStats && (
                                <span className="ml-2 text-accentPrimary">
                                  {m.manualStats!.saves}/{m.manualStats!.shots}{" "}
                                  ({((m.manualStats!.saves / m.manualStats!.shots) * 100).toFixed(1)}%)
                                </span>
                              )}
                              {hasEvents && !hasStats && (
                                <span className="ml-2 rounded bg-accentSuccess/20 px-1.5 py-0.5 text-[10px] font-medium text-accentSuccess">
                                  📊 {matchEvents.length} událostí
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Score badge - fixed width for alignment */}
                        {hasScore && (
                          <div className="flex h-8 min-w-[3.5rem] items-center justify-center rounded-lg bg-slate-700 px-2 text-sm font-bold tabular-nums">
                            {m.homeScore}:{m.awayScore}
                          </div>
                        )}

                        {/* Action buttons - consistent spacing */}
                        <div className="flex items-center gap-1">
                          {/* Plus/Edit button - more visible */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setEditingMatch(m);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accentPrimary/20 text-sm text-accentPrimary hover:bg-accentPrimary/30"
                            aria-label={goalie ? "Upravit statistiky" : "Přidat statistiky"}
                          >
                            {goalie ? "✏️" : "+"}
                          </button>
                          
                          {/* Detail link */}
                          <Link
                            href={`/match/${m.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accentPrimary/20 text-sm text-accentPrimary hover:bg-accentPrimary/30"
                            aria-label="Detail zápasu"
                          >
                            →
                          </Link>
                          
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setDeletingMatch(m);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-sm text-slate-400 hover:bg-slate-600 hover:text-accentDanger"
                            aria-label="Smazat zápas"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Bottom nav */}
      <div className="mt-auto space-y-2 pt-4">
        <Link
          href="/goalies"
          className="block rounded-2xl bg-bgSurfaceSoft p-4 text-center"
        >
          <span className="text-sm text-slate-400">
            👤 Správa brankářů a sezónní statistiky
          </span>
        </Link>
        <div className="flex gap-2">
          <Link
            href="/stats"
            className="flex-1 rounded-xl bg-bgSurfaceSoft p-3 text-center text-xs text-slate-400"
          >
            📊 Porovnání
          </Link>
          <Link
            href="/settings"
            className="flex-1 rounded-xl bg-bgSurfaceSoft p-3 text-center text-xs text-slate-400"
          >
            ⚙️ Nastavení
          </Link>
        </div>
        </div>
      </main>
  );
}
