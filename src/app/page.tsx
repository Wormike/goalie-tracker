"use client";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Match, Goalie } from "@/lib/types";
import {
  getGoalies,
  getGoalieById,
  getEventsByMatch as getEventsByMatchLocal,
} from "@/lib/storage";
import { dataService } from "@/lib/dataService";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { ManualStatsModal } from "@/components/ManualStatsModal";
import { ImportWizard } from "@/components/ImportWizard";
import { StandingsButton } from "@/components/StandingsLink";
import { CompetitionSwitcher } from "@/components/CompetitionSwitcher";
import { useCompetitions } from "@/lib/competitionService";
import { COMPETITION_PRESETS } from "@/lib/competitionPresets";
import { findCompetitionByExternalId, findCompetitionByLeagueFilter } from "@/lib/repositories/competitions";
import {
  createMatch as createMatchSupabase,
  findMatchByExternalId,
  updateMatch,
} from "@/lib/repositories/matches";
import { findOrCreateTeam } from "@/lib/repositories/teams";

export default function HomePage() {
  // User competition context
  const { activeCompetition, competitions: userCompetitions } = useCompetitions();
  const pathname = usePathname();
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [goalies, setGoalies] = useState<Goalie[]>([]);
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
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);

  // Competition assignment is stored directly on match.competitionId

  // Helper function to get category abbreviation (e.g. "Starší žáci B" -> "SŽB")
  const getCategoryAbbreviation = (categoryOrCompetitionName: string): string => {
    if (!categoryOrCompetitionName || categoryOrCompetitionName.trim() === "") return "";
    
    const normalized = categoryOrCompetitionName.toLowerCase().trim();
    
    // Extract key words
    const words = normalized
      .replace(/liga\s*/g, "")
      .replace(/starších|starší/g, "starsi")
      .replace(/mladších|mladší/g, "mladsi")
      .replace(/žáků|žák/g, "zaci")
      .replace(/sk\.?\s*\d+/g, "")
      .replace(/["']/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(w => w && w.length > 1);
    
    // Build abbreviation: first letter of each significant word
    // "starsi zaci b" -> "SŽB"
    // "mladsi zaci a" -> "MŽA"
    const abbreviation = words
      .map(word => {
        // Special handling for "starsi" -> "S", "mladsi" -> "M", "zaci" -> "Ž"
        if (word === "starsi") return "S";
        if (word === "mladsi") return "M";
        if (word === "zaci") return "Ž";
        // For letter (A, B) return uppercase
        if (word.length === 1) return word.toUpperCase();
        // For other words, return first letter uppercase
        return word.charAt(0).toUpperCase();
      })
      .join("");
    
    return abbreviation || categoryOrCompetitionName.substring(0, 3).toUpperCase();
  };

  // Competition assignment is stored directly on match.competitionId

  // Load matches - try Supabase first, fall back to localStorage
  const loadMatches = useCallback(async () => {
    const loadedMatches = await dataService.getMatches();
    setMatches(deduplicateMatches(loadedMatches));
  }, []);

  const handleAssignCompetition = async (match: Match, competitionId: string | null) => {
    const updatedMatch: Match = {
      ...match,
      competitionId: competitionId || undefined,
      competitionIdManuallySet: true,
    };

    const saved = await dataService.saveMatch(updatedMatch);
    setMatches((prev) => prev.map((m) => (m.id === match.id ? saved : m)));
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
  }, [loadMatches]);

  // Reload matches when navigating back to home page (but not on initial mount)
  const prevPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevPathnameRef.current !== null && pathname === '/' && prevPathnameRef.current !== '/') {
      // Only reload if we're navigating back to home from another page
      loadMatches();
    }
    prevPathnameRef.current = pathname;
  }, [pathname, loadMatches]);

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
  }, [loadMatches]);

  // Competition assignment is managed manually per match

  // Categories are no longer used for filtering; competitionId is the source of truth
  // Filter matches by active competition
  const filteredMatches = useMemo(() => {
    if (activeCompetition === null) {
      return matches.filter((m) => !m.competitionId);
    }
    if (activeCompetition) {
      return matches.filter((m) => m.competitionId === activeCompetition.id);
    }
    return matches;
  }, [matches, activeCompetition]);

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
  
  const matchTypeLabels: Record<string, string> = {
    friendly: "Přátelský",
    league: "Soutěžní",
    tournament: "Turnaj",
    cup: "Pohár",
  };

  // Standings URL is taken from active competition

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
      const preset =
        COMPETITION_PRESETS.find((p) => p.id === importConfig.category) || selectedPreset;
      const response = await fetch("/api/matches/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season: importConfig.season,
          category: importConfig.category || undefined,
          leagueFilter: preset.leagueFilter || undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.matches) {
        const importPreset =
          COMPETITION_PRESETS.find((p) => p.id === importConfig.category) || selectedPreset;

        let competitionId: string | undefined;
        if (importPreset.leagueFilter) {
          if (isSupabaseConfigured()) {
            competitionId = (await findCompetitionByLeagueFilter(importPreset.leagueFilter))?.id;
          } else {
            competitionId = userCompetitions.find(
              (c) => c.leagueFilter === importPreset.leagueFilter
            )?.id;
          }
        } else if (importPreset.externalId) {
          if (isSupabaseConfigured()) {
            competitionId = (await findCompetitionByExternalId(importPreset.externalId))?.id;
          } else {
            competitionId = userCompetitions.find(
              (c) => c.externalId === importPreset.externalId
            )?.id;
          }
        }

        if (!competitionId) {
          alert("Soutěž nebyla nalezena. Zkuste obnovit stránku.");
          return;
        }

        for (const m of data.matches) {
          const homeTeamName = m.home || m.homeTeamName || "HC Slovan Ústí n.L.";
          const awayTeamName = m.away || m.awayTeamName || "Hosté";
          const matchToSave = {
            ...m,
            competitionId,
            competitionIdManuallySet: false,
          };

          if (isSupabaseConfigured()) {
            const homeTeamId = await findOrCreateTeam(homeTeamName);
            const awayTeamId = await findOrCreateTeam(awayTeamName);
            const payload = {
              home_team_id: homeTeamId || undefined,
              home_team_name: homeTeamName,
              away_team_id: awayTeamId || undefined,
              away_team_name: awayTeamName,
              datetime: matchToSave.datetime,
              competition_id: competitionId,
              season_id: matchToSave.seasonId || importConfig.season,
              venue: matchToSave.venue || undefined,
              match_type: (matchToSave.matchType || "league") as
                | "friendly"
                | "league"
                | "tournament"
                | "playoff"
                | "cup",
              status: matchToSave.status,
              goalie_id: matchToSave.goalieId || undefined,
              home_score: matchToSave.homeScore ?? undefined,
              away_score: matchToSave.awayScore ?? undefined,
              source: matchToSave.source || "ceskyhokej",
              external_id: matchToSave.externalId || undefined,
              external_url: matchToSave.externalUrl || undefined,
            };

            const existing = matchToSave.externalId
              ? await findMatchByExternalId(matchToSave.externalId)
              : null;

            if (existing) {
              const updatePayload = {
                ...payload,
                goalie_id: existing.goalieId ? undefined : payload.goalie_id,
                status: existing.status === "completed" ? undefined : payload.status,
                manual_shots: undefined,
                manual_saves: undefined,
                manual_goals_against: undefined,
              };
              const updated = await updateMatch(existing.id, updatePayload);
              if (updated) {
                continue;
              }
            }

            const created = await createMatchSupabase(payload);
            if (created) {
              continue;
            }
          } else {
            await dataService.saveMatch(matchToSave);
          }
        }

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

  const handleJsonImport = async () => {
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
      for (const m of newMatches) {
        // Ensure required fields
        if (m.home && m.away && m.datetime) {
          await dataService.saveMatch({
            ...m,
            id: m.id || crypto.randomUUID(),
            seasonId: m.seasonId || "2024-2025",
            matchType: m.matchType || "league",
            source: "ceskyhokej",
          });
          importedCount++;
        }
      }
      
      // Reload matches (prefer Supabase if configured)
      await loadMatches();
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

  const handleManualStatsSave = async (data: {
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

    await dataService.saveMatch(updatedMatch);
    await loadMatches();
    setEditingMatch(null);
  };

  const handleDeleteMatch = async () => {
    if (!deletingMatch) return;
    
    const success = await dataService.deleteMatch(deletingMatch.id);
    if (!success && isSupabaseConfigured()) {
      alert("Nepodařilo se smazat zápas z databáze");
      setDeletingMatch(null);
      return;
    }
    
    // Reload matches to reflect deletion
    await loadMatches();
    setDeletingMatch(null);
  };

  // Handle bulk delete selected matches
  const handleBulkDelete = async () => {
    if (selectedMatchIds.size === 0) return;
    
    const count = selectedMatchIds.size;
    if (!confirm(`Opravdu smazat ${count} vybraných zápasů?`)) return;

    for (const matchId of selectedMatchIds) {
      await dataService.deleteMatch(matchId);
    }
    
    // Clear selection and reload matches
    setSelectedMatchIds(new Set());
    await loadMatches();
  };

  // Handle bulk move selected matches to different competition
  const handleBulkMove = async (targetCompetitionId: string | null) => {
    if (selectedMatchIds.size === 0) return;
    
    const finalCompetitionId = targetCompetitionId && targetCompetitionId.trim() !== "" ? targetCompetitionId : undefined;
    
    // Update all selected matches
    for (const matchId of selectedMatchIds) {
      const match = matches.find(m => m.id === matchId);
      if (!match) continue;

      const updatedMatch = {
        ...match,
        competitionId: finalCompetitionId,
        competitionIdManuallySet: true,
      };
      await dataService.saveMatch(updatedMatch);
    }
    
    // Clear selection and reload matches
    setSelectedMatchIds(new Set());
    setShowBulkMoveModal(false);
    await loadMatches();
  };

  // Toggle match selection
  const toggleMatchSelection = (matchId: string) => {
    setSelectedMatchIds(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  // Select all visible matches
  const selectAllVisible = () => {
    const allIds = new Set([...upcomingMatches, ...pastMatches].map(m => m.id));
    setSelectedMatchIds(allIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedMatchIds(new Set());
  };

  const handleDeleteFilteredMatches = async () => {
    if (filteredMatches.length === 0) return;
    const label = `opravdu smazat všech ${filteredMatches.length} zápasů?`;
    if (!confirm(`Chcete ${label}`)) return;

    for (const m of filteredMatches) {
      await dataService.deleteMatch(m.id);
    }
    
    // Reload matches to reflect deletions
    await loadMatches();
  };

  // Get current standings URL based on category filter or active competition
  const currentStandingsUrl = activeCompetition?.standingsUrl;

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

      {filteredMatches.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleDeleteFilteredMatches}
            className="rounded-full bg-accentDanger/10 px-3 py-1.5 text-[10px] font-medium text-accentDanger hover:bg-accentDanger/20"
          >
            🗑️ Smazat {filteredMatches.length} záznamů
          </button>
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

      {/* Bulk move modal */}
      {showBulkMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-bgSurfaceSoft p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-200">
              Přesunout {selectedMatchIds.size} zápasů
            </h3>
            <p className="mb-4 text-sm text-slate-400">
              Vyberte cílovou soutěž pro vybrané zápasy:
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <button
                onClick={() => handleBulkMove(null)}
                className="w-full rounded-lg px-4 py-3 text-left bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <div className="font-medium">Nepřiřazeno</div>
                <div className="text-xs text-slate-400">Zápasy nebudou přiřazeny k žádné soutěži</div>
              </button>
              {userCompetitions.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => handleBulkMove(comp.id)}
                  className="w-full rounded-lg px-4 py-3 text-left bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <div className="font-medium">{comp.name}</div>
                  {comp.category && (
                    <div className="text-xs text-slate-400">{comp.category}</div>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowBulkMoveModal(false)}
                className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600"
              >
                Zrušit
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
              ? `Máte ${matches.length} zápasů celkem, ale žádný není přiřazen do soutěže "${activeCompetition.name}". Zkuste změnit výběr soutěže v dropdownu.`
              : `Máte ${matches.length} zápasů, ale žádný neprošel filtrem.`}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 rounded-lg bg-slate-800 p-3 text-left text-xs text-slate-400 max-w-md">
              <div>Debug info:</div>
              <div>Total matches: {matches.length}</div>
              <div>Filtered matches: {filteredMatches.length}</div>
              <div>Active competition: {activeCompetition?.name || 'none'} (ID: {activeCompetition?.id || 'none'})</div>
              <div className="mt-2">Sample matches (first 5):</div>
              {matches.slice(0, 5).map(m => (
                <div key={m.id} className="ml-2">
                  {`${m.id.substring(0, 20)}...: category="${m.category || "empty"}", competitionId="${m.competitionId || "none"}"`}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Upcoming matches */}
          {upcomingMatches.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-slate-400">
                    NADCHÁZEJÍCÍ ZÁPASY ({upcomingMatches.length})
                  </h2>
                  {selectedMatchIds.size > 0 && (
                    <span className="text-xs text-slate-500">
                      ({selectedMatchIds.size} vybráno)
                    </span>
                  )}
                </div>
                {selectedMatchIds.size > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBulkDelete}
                      className="rounded-lg bg-accentDanger/10 px-3 py-1.5 text-xs font-medium text-accentDanger hover:bg-accentDanger/20"
                    >
                      🗑️ Smazat ({selectedMatchIds.size})
                    </button>
                    <button
                      onClick={() => setShowBulkMoveModal(true)}
                      className="rounded-lg bg-accentPrimary/10 px-3 py-1.5 text-xs font-medium text-accentPrimary hover:bg-accentPrimary/20"
                    >
                      📁 Přesunout ({selectedMatchIds.size})
                    </button>
                    <button
                      onClick={clearSelection}
                      className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600"
                    >
                      Zrušit
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllVisible}
                      className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                    >
                      ✓ Vybrat vše
                    </button>
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
                            for (const m of upcomingFromApi) {
                              await dataService.saveMatch(m);
                            }
                            // Reload matches
                            await loadMatches();
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
                )}
              </div>
              <div className="space-y-3">
                {upcomingMatches.map((m) => {
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
                        className={`rounded-2xl bg-bgSurfaceSoft p-4 shadow-sm shadow-black/40 ${selectedMatchIds.has(m.id) ? 'ring-2 ring-accentPrimary' : ''}`}
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedMatchIds.has(m.id)}
                              onChange={() => toggleMatchSelection(m.id)}
                              className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-accentPrimary focus:ring-accentPrimary"
                              onClick={(e) => e.stopPropagation()}
                            />
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
                            {(() => {
                              // Get competition name/category for abbreviation
                              const competition = m.competitionId ? userCompetitions.find(c => c.id === m.competitionId) : null;
                              const categoryDisplay = competition ? (competition.category || competition.name) : m.category;
                              const categoryAbbr = categoryDisplay ? getCategoryAbbreviation(categoryDisplay) : null;
                              
                              if (categoryAbbr || goalieInitials) {
                                const parts: string[] = [];
                                if (categoryAbbr) parts.push(`kat: ${categoryAbbr}`);
                                if (goalieInitials) parts.push(`g: ${goalieInitials}`);
                                return <span className="text-xs text-slate-400">{parts.join(", ")}</span>;
                              }
                              return <span>{m.category || "Nepřiřazeno"}</span>;
                            })()}
                          </div>
                          <button
                            onClick={() => setDeletingMatch(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-accentDanger"
                            aria-label="Smazat zápas"
                          >
                            🗑️
                          </button>
                        </div>
                        <div className="mt-3">
                          <label className="mb-1 block text-[10px] text-slate-500">Soutěž</label>
                          <select
                            value={m.competitionId || ""}
                            onChange={(e) => handleAssignCompetition(m, e.target.value || null)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200"
                          >
                            <option value="">Nezařazené</option>
                            {userCompetitions.map((comp) => (
                              <option key={comp.id} value={comp.id}>
                                {comp.name}
                              </option>
                            ))}
                          </select>
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
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-slate-400">
                    ODEHRANÉ ZÁPASY ({pastMatches.length})
                  </h2>
                  {selectedMatchIds.size > 0 && (
                    <span className="text-xs text-slate-500">
                      ({selectedMatchIds.size} vybráno)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedMatchIds.size > 0 ? (
                    <>
                      <button
                        onClick={handleBulkDelete}
                        className="rounded-lg bg-accentDanger/10 px-3 py-1.5 text-xs font-medium text-accentDanger hover:bg-accentDanger/20"
                      >
                        🗑️ Smazat ({selectedMatchIds.size})
                      </button>
                      <button
                        onClick={() => setShowBulkMoveModal(true)}
                        className="rounded-lg bg-accentPrimary/10 px-3 py-1.5 text-xs font-medium text-accentPrimary hover:bg-accentPrimary/20"
                      >
                        📁 Přesunout ({selectedMatchIds.size})
                      </button>
                      <button
                        onClick={clearSelection}
                        className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600"
                      >
                        Zrušit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={selectAllVisible}
                        className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                      >
                        ✓ Vybrat vše
                      </button>
                      <StandingsButton 
                        url={currentStandingsUrl} 
                        label="Tabulka"
                      />
                    </>
                  )}
                </div>
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
                      className={`rounded-xl bg-bgSurfaceSoft/50 p-3 ${selectedMatchIds.has(m.id) ? 'ring-2 ring-accentPrimary' : ''}`}
                    >
                      {/* Main row with flex layout for consistent alignment */}
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedMatchIds.has(m.id)}
                          onChange={() => toggleMatchSelection(m.id)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-accentPrimary focus:ring-accentPrimary"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {/* Match info - takes remaining space */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col text-sm font-medium">
                            <div>{m.home || m.homeTeamName || "Domácí"}</div>
                            <div className="text-xs text-slate-400">vs {m.away || m.awayTeamName || "Hosté"}</div>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {new Date(m.datetime).toLocaleDateString("cs-CZ")} • {(() => {
                              // Get competition name/category for abbreviation
                              const competition = m.competitionId ? userCompetitions.find(c => c.id === m.competitionId) : null;
                              const categoryDisplay = competition ? (competition.category || competition.name) : m.category;
                              const categoryAbbr = categoryDisplay ? getCategoryAbbreviation(categoryDisplay) : null;
                              const goalieAbbr = goalieInitials || null;
                              
                              if (categoryAbbr || goalieAbbr) {
                                const parts: string[] = [];
                                if (categoryAbbr) parts.push(`kat: ${categoryAbbr}`);
                                if (goalieAbbr) parts.push(`g: ${goalieAbbr}`);
                                return parts.join(", ");
                              }
                              return m.category || "Nepřiřazeno";
                            })()}
                            {m.source === "ceskyhokej" && (
                              <span className="ml-1 text-accentSuccess">(import)</span>
                            )}
                          </div>
                          <div className="mt-2">
                            <label className="mb-1 block text-[10px] text-slate-500">Soutěž</label>
                            <select
                              value={m.competitionId || ""}
                              onChange={(e) => handleAssignCompetition(m, e.target.value || null)}
                              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200"
                            >
                              <option value="">Nezařazené</option>
                              {userCompetitions.map((comp) => (
                                <option key={comp.id} value={comp.id}>
                                  {comp.name}
                                </option>
                              ))}
                            </select>
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
