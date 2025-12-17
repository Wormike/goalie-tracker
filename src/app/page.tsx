"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Match, Goalie, CompetitionStandings } from "@/lib/types";
import {
  getMatches as getMatchesLocal,
  getGoalies,
  getGoalieById,
  saveMatch,
  deleteMatch as deleteMatchLocal,
  getStandings,
  saveStandings,
} from "@/lib/storage";
import {
  getMatches as getMatchesSupabase,
  deleteMatch as deleteMatchSupabase,
} from "@/lib/repositories/matches";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { ManualStatsModal } from "@/components/ManualStatsModal";
import { ImportWizard } from "@/components/ImportWizard";
import { StandingsModal } from "@/components/StandingsTable";

// Preset competitions for HC Slovan Ústí nad Labem (zapasy.ceskyhokej.cz)
const COMPETITION_PRESETS = [
  { id: "starsi-zaci-a", name: 'Liga starších žáků "A" sk. 2', season: "2025-2026", externalId: "Z8", standingsSeason: "2026" },
  { id: "starsi-zaci-b", name: 'Liga starších žáků "B" sk. 10', season: "2025-2026", externalId: "Z7", standingsSeason: "2026" },
  { id: "mladsi-zaci-a", name: 'Liga mladších žáků "A" sk. 4', season: "2025-2026", externalId: "Z6", standingsSeason: "2026" },
  { id: "mladsi-zaci-b", name: 'Liga mladších žáků "B" sk. 14', season: "2025-2026", externalId: "Z5", standingsSeason: "2026" },
];

export default function HomePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [goalies, setGoalies] = useState<Goalie[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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
  
  // Standings state
  const [showStandings, setShowStandings] = useState(false);
  const [currentStandings, setCurrentStandings] = useState<CompetitionStandings | null>(null);
  const [loadingStandings, setLoadingStandings] = useState(false);

  // Load matches - try Supabase first, fall back to localStorage
  const loadMatches = async () => {
    setLoading(true);
    
    if (isSupabaseConfigured()) {
      try {
        const supabaseMatches = await getMatchesSupabase();
        if (supabaseMatches.length > 0) {
          setMatches(supabaseMatches);
          setDataSource("supabase");
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("[HomePage] Failed to load from Supabase:", err);
      }
    }
    
    // Fallback to localStorage
    setMatches(getMatchesLocal());
    setDataSource("local");
    setLoading(false);
  };

  useEffect(() => {
    loadMatches();
    setGoalies(getGoalies());
  }, []);

  // Get unique categories from matches
  const categories = Array.from(
    new Set(matches.map((m) => m.category).filter(Boolean))
  ).sort();

  // Filter matches by category
  const filteredMatches =
    categoryFilter === "all"
      ? matches
      : matches.filter((m) => m.category === categoryFilter);

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
  const upcomingMatches = sortedMatches.filter(
    (m) => !m.completed || new Date(m.datetime).getTime() >= Date.now() - 3600000 * 3
  );
  const pastMatches = sortedMatches.filter(
    (m) => m.completed && new Date(m.datetime).getTime() < Date.now() - 3600000 * 3
  );

  const matchTypeLabels: Record<string, string> = {
    friendly: "Přátelský",
    league: "Soutěžní",
    tournament: "Turnaj",
    cup: "Pohár",
  };

  // Find standings for current category filter
  const findStandingsForCategory = (category: string): CompetitionStandings | null => {
    const allStandings = getStandings();
    const preset = COMPETITION_PRESETS.find(p => p.name === category);
    if (preset) {
      return allStandings.find(s => s.externalCompetitionId === preset.externalId) || null;
    }
    // Try to find by competition ID from matches
    const matchWithCompetition = matches.find(m => m.category === category && m.competitionId);
    if (matchWithCompetition?.competitionId) {
      return allStandings.find(s => s.competitionId === matchWithCompetition.competitionId) || null;
    }
    return null;
  };

  // Load standings for current filter
  const handleLoadStandings = async () => {
    const category = categoryFilter !== "all" ? categoryFilter : categories[0];
    if (!category) return;
    
    // Check local storage first
    const localStandings = findStandingsForCategory(category);
    if (localStandings) {
      setCurrentStandings(localStandings);
      setShowStandings(true);
      return;
    }
    
    // Fetch from API
    setLoadingStandings(true);
    const preset = COMPETITION_PRESETS.find(p => p.name === category);
    if (!preset) {
      setLoadingStandings(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/standings?competitionId=${preset.externalId}&season=${preset.standingsSeason || preset.season}`);
      const data = await res.json();
      if (data.success && data.standings) {
        saveStandings(data.standings);
        setCurrentStandings(data.standings);
        setShowStandings(true);
      }
    } catch (error) {
      console.error("Failed to load standings:", error);
    } finally {
      setLoadingStandings(false);
    }
  };

  const handleRefreshStandings = async () => {
    const category = categoryFilter !== "all" ? categoryFilter : categories[0];
    const preset = COMPETITION_PRESETS.find(p => p.name === category);
    if (!preset) return;
    
    setLoadingStandings(true);
    try {
      const res = await fetch(`/api/standings?competitionId=${preset.externalId}&season=${preset.standingsSeason || preset.season}`);
      const data = await res.json();
      if (data.success && data.standings) {
        saveStandings(data.standings);
        setCurrentStandings(data.standings);
      }
    } catch (error) {
      console.error("Failed to refresh standings:", error);
    } finally {
      setLoadingStandings(false);
    }
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
        // Save all imported matches to localStorage
        data.matches.forEach((m: Match) => saveMatch(m));
        // Reload matches (prefer Supabase if configured)
        await loadMatches();

        // Also save standings if available
        if (data.standings && data.standings.length > 0) {
          data.standings.forEach((s: CompetitionStandings) => saveStandings(s));
        }

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
    
    if (dataSource === "supabase") {
      const success = await deleteMatchSupabase(deletingMatch.id);
      if (success) {
        await loadMatches();
      } else {
        alert("Nepodařilo se smazat zápas");
      }
    } else {
      deleteMatchLocal(deletingMatch.id);
      setMatches(getMatchesLocal());
    }
    
    setDeletingMatch(null);
  };

  // Check if standings are available for current category
  const currentCategoryStandings = categoryFilter !== "all" 
    ? findStandingsForCategory(categoryFilter) 
    : (categories.length > 0 ? findStandingsForCategory(categories[0]) : null);

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">🥅 Goalie Tracker</h1>
        <Link
          href="/goalies"
          className="rounded-lg bg-bgSurfaceSoft px-3 py-1.5 text-xs text-accentPrimary"
        >
          Brankáři ({goalies.length})
        </Link>
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

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              categoryFilter === "all"
                ? "bg-accentPrimary text-white"
                : "bg-bgSurfaceSoft text-slate-400"
            }`}
          >
            Vše ({matches.length})
          </button>
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

      {/* Standings Modal */}
      <StandingsModal
        open={showStandings}
        onClose={() => setShowStandings(false)}
        standings={currentStandings}
        title={categoryFilter !== "all" ? `Tabulka: ${categoryFilter}` : "Tabulka soutěže"}
        loading={loadingStandings}
        onRefresh={handleRefreshStandings}
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
                            {m.home} vs {m.away}
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
                              {goalie.firstName} {goalie.lastName}
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
              {/* Section header with standings link */}
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-400">
                  ODEHRANÉ ZÁPASY ({pastMatches.length})
                </h2>
                <button
                  onClick={handleLoadStandings}
                  disabled={loadingStandings}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-accentPrimary hover:bg-slate-700 disabled:opacity-50"
                  aria-label="Zobrazit tabulku soutěže"
                >
                  {loadingStandings ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <span>📊</span>
                  )}
                  Tabulka
                </button>
              </div>
              
              {/* Standings hint if not available */}
              {!currentCategoryStandings && categoryFilter !== "all" && (
                <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-800/30 px-3 py-2 text-xs text-slate-500">
                  <span>Tabulka soutěže zatím není k dispozici</span>
                  <button
                    onClick={handleLoadStandings}
                    disabled={loadingStandings}
                    className="text-accentPrimary hover:underline disabled:opacity-50"
                  >
                    Načíst
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {pastMatches.slice(0, 20).map((m) => {
                  const goalie = m.goalieId
                    ? getGoalieById(m.goalieId)
                    : null;
                  const hasStats = m.manualStats && m.manualStats.shots > 0;
                  const hasScore = m.homeScore !== undefined && m.awayScore !== undefined;

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
                            {m.home} vs {m.away}
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
                            <div className="mt-1 text-xs text-slate-400">
                              🥅 {goalie.firstName} {goalie.lastName}
                              {hasStats && (
                                <span className="ml-2 text-accentPrimary">
                                  {m.manualStats!.saves}/{m.manualStats!.shots}{" "}
                                  ({((m.manualStats!.saves / m.manualStats!.shots) * 100).toFixed(1)}%)
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
