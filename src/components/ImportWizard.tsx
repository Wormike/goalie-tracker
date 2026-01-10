"use client";

import React, { useState, useEffect } from "react";
import type {
  Match,
  Goalie,
  Team,
} from "@/lib/types";
import {
  getGoalies,
  getTeams,
  saveMatch,
  saveExternalMapping,
  findExternalMapping,
} from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { createMatch as createMatchSupabase } from "@/lib/repositories/matches";
import { Select } from "@/components/ui/Select";
import { useCompetition } from "@/contexts/CompetitionContext";
import { COMPETITION_PRESETS } from "@/lib/competitionPresets";

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (importedCount: number) => void;
}

type Step = 0 | 1 | 2 | 3;

// Helper function to map category name to competition name
// e.g., "Liga mladších žáků \"B\" sk. 14" -> "Mladší žáci B"
function mapCategoryToCompetitionName(categoryName: string): string {
  // Remove quotes and normalize
  const normalized = categoryName
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  // Extract key parts: "Liga mladších žáků B sk. 14" -> "Mladší žáci B"
  // Pattern: Liga [age] žáků [letter] sk. [number]
  const match = normalized.match(/liga\s+(mladších|starších)\s+žáků\s+"?([AB])"?/i);
  if (match) {
    const age = match[1].toLowerCase();
    const letter = match[2].toUpperCase();
    const ageShort = age === "mladších" ? "Mladší" : "Starší";
    return `${ageShort} žáci ${letter}`;
  }
  
  // Fallback: try to extract from any pattern
  const fallbackMatch = normalized.match(/(mladší|starší)\s*žáci?\s*([AB])?/i);
  if (fallbackMatch) {
    const age = fallbackMatch[1];
    const letter = fallbackMatch[2] || "";
    const ageCapitalized = age.charAt(0).toUpperCase() + age.slice(1);
    return letter ? `${ageCapitalized} žáci ${letter.toUpperCase()}` : `${ageCapitalized} žáci`;
  }
  
  // Last resort: return simplified version
  return normalized
    .replace(/^liga\s+/i, "")
    .replace(/\s+sk\.\s*\d+.*$/i, "")
    .trim();
}

export function ImportWizard({ open, onClose, onComplete }: ImportWizardProps) {
  const { addCompetition, competitions: userCompetitions } = useCompetition();
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0: Source selection
  const [selectedPreset, setSelectedPreset] = useState(COMPETITION_PRESETS[0]);
  const [customCompetitionId, setCustomCompetitionId] = useState("");

  // Step 1: Mapping
  const [scrapedMatches, setScrapedMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [mappings, setMappings] = useState<{
    competitionId: string;
    homeTeamId: string;
  }>({
    competitionId: "",
    homeTeamId: "",
  });
  const [rememberMapping, setRememberMapping] = useState(true);
  const [autoCreatedCompetition, setAutoCreatedCompetition] = useState<string | null>(null);

  // Step 2: Goalie selection
  const [goalies, setGoalies] = useState<Goalie[]>([]);
  const [selectedGoalieId, setSelectedGoalieId] = useState("");
  const [openAfterImport, setOpenAfterImport] = useState(true);

  // Step 3: Review
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (open) {
      setTeams(getTeams());
      setGoalies(getGoalies());
      
      // Check for saved mappings
      const savedCompMapping = findExternalMapping(
        "ceskyhokej",
        "competition",
        selectedPreset.id
      );
      if (savedCompMapping) {
        // Check if the saved competition still exists in userCompetitions
        const exists = userCompetitions.some(c => c.id === savedCompMapping.internalId);
        if (exists) {
          setMappings((m) => ({ ...m, competitionId: savedCompMapping.internalId }));
        }
      }
    }
  }, [open, selectedPreset.id, userCompetitions]);

  if (!open) return null;

  const handleFetchMatches = async () => {
    setLoading(true);
    setError(null);
    setAutoCreatedCompetition(null);

    try {
      const compId = customCompetitionId || selectedPreset.id;
      const response = await fetch("/api/matches/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season: selectedPreset.season,
          category: compId,
        }),
      });

      const data = await response.json();

      if (data.success && data.matches && data.matches.length > 0) {
        setScrapedMatches(data.matches);
        
        // Get category from first match (all matches should have same category)
        const firstMatch = data.matches[0] as Match;
        const categoryName = firstMatch.category || selectedPreset.name;
        
        // Map category name to competition name
        const competitionName = mapCategoryToCompetitionName(categoryName);
        
        // Check if competition with this name already exists
        let existingCompetition = userCompetitions.find(
          (c) => c.name.toLowerCase() === competitionName.toLowerCase()
        );
        
        // If not found, create new competition automatically
        if (!existingCompetition) {
          existingCompetition = addCompetition({
            name: competitionName,
            category: categoryName, // Store original category for matching
            standingsUrl: selectedPreset.standingsUrl,
          });
          setAutoCreatedCompetition(existingCompetition.id);
        }
        
        // Set the competition mapping
        setMappings((m) => ({ ...m, competitionId: existingCompetition!.id }));
        
        // Pre-select all upcoming matches
        const upcomingIds = new Set<string>(
          data.matches
            .filter((m: Match) => !m.completed)
            .map((m: Match) => m.id)
        );
        setSelectedMatchIds(upcomingIds);
        setStep(1);
      } else {
        setError(data.error || "Nepodařilo se načíst zápasy");
      }
    } catch (err) {
      setError("Chyba při komunikaci se serverem");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMapping = () => {
    // Save mapping if requested
    if (rememberMapping && mappings.competitionId) {
      saveExternalMapping({
        id: `mapping-${Date.now()}`,
        source: "ceskyhokej",
        externalType: "competition",
        externalId: customCompetitionId || selectedPreset.id,
        externalName: selectedPreset.name,
        internalId: mappings.competitionId,
        createdAt: new Date().toISOString(),
      });
    }
    setStep(2);
  };

  const handleConfirmGoalie = () => {
    setStep(3);
  };

  const handleImport = async () => {
    setLoading(true);

    try {
      let importedCount = 0;
      const selectedMatches = scrapedMatches.filter((m) =>
        selectedMatchIds.has(m.id)
      );

      // Import matches - save to Supabase if configured, otherwise to localStorage
      if (isSupabaseConfigured()) {
        // Save to Supabase - process sequentially to avoid race conditions
        for (const match of selectedMatches) {
          try {
            const enrichedMatch: Match = {
              ...match,
              goalieId: selectedGoalieId || undefined,
              competitionId: mappings.competitionId || undefined,
              competitionIdManuallySet: false, // Imported matches are not manually set
              homeTeamId: mappings.homeTeamId || undefined,
            };
            
            // Determine status based on match completion
            let matchStatus: "scheduled" | "in_progress" | "completed" | "cancelled" = "scheduled";
            if (enrichedMatch.completed || (enrichedMatch.homeScore !== undefined && enrichedMatch.awayScore !== undefined)) {
              matchStatus = "completed";
            } else if (enrichedMatch.status) {
              matchStatus = enrichedMatch.status;
            }
            
            const payload = {
              home_team_id: enrichedMatch.homeTeamId || undefined,
              home_team_name: enrichedMatch.home || enrichedMatch.homeTeamName || "HC Slovan Ústí n.L.",
              away_team_name: enrichedMatch.away || enrichedMatch.awayTeamName || "Hosté",
              datetime: enrichedMatch.datetime,
              // Note: competition (TEXT) field is not in production schema, skip it
              // Category is stored in app Match type and used for filtering/matching
              competition_id: enrichedMatch.competitionId || undefined, // FK to competitions table
              season_id: enrichedMatch.seasonId || "2025-2026", // Keep as string, Supabase will handle it
              venue: enrichedMatch.venue || undefined,
              match_type: (enrichedMatch.matchType || "league") as "friendly" | "league" | "tournament" | "playoff" | "cup",
              status: matchStatus,
              goalie_id: enrichedMatch.goalieId || undefined,
              home_score: enrichedMatch.homeScore ?? undefined,
              away_score: enrichedMatch.awayScore ?? undefined,
              source: enrichedMatch.source || "ceskyhokej",
              external_id: enrichedMatch.externalId || undefined,
              external_url: enrichedMatch.externalUrl || undefined,
            };
            
            const created = await createMatchSupabase(payload);
            if (created) {
              importedCount++;
            } else {
              console.warn("[ImportWizard] Failed to create match in Supabase, falling back to localStorage");
              // Fallback to localStorage
              saveMatch(enrichedMatch);
              importedCount++;
            }
          } catch (err) {
            console.error("[ImportWizard] Error saving match to Supabase:", err);
            // Fallback to localStorage
            const enrichedMatch: Match = {
              ...match,
              goalieId: selectedGoalieId || undefined,
              competitionId: mappings.competitionId || undefined,
              competitionIdManuallySet: false,
              homeTeamId: mappings.homeTeamId || undefined,
            };
            saveMatch(enrichedMatch);
            importedCount++;
          }
        }
      } else {
        // Save to localStorage
        selectedMatches.forEach((match) => {
          const enrichedMatch: Match = {
            ...match,
            goalieId: selectedGoalieId || undefined,
            competitionId: mappings.competitionId || undefined,
            competitionIdManuallySet: false, // Imported matches are not manually set
            homeTeamId: mappings.homeTeamId || undefined,
          };
          saveMatch(enrichedMatch);
          importedCount++;
        });
      }

      onComplete(importedCount);
      
      // Optionally open the first upcoming match for tracking
      if (openAfterImport && selectedMatches.length > 0) {
        const firstUpcoming = selectedMatches.find((m) => !m.completed);
        if (firstUpcoming) {
          window.location.href = `/match/${firstUpcoming.id}`;
          return;
        }
      }
      
      onClose();
    } catch (err) {
      setError("Chyba při importu");
    } finally {
      setLoading(false);
    }
  };

  const toggleMatchSelection = (id: string) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllMatches = () => {
    setSelectedMatchIds(new Set(scrapedMatches.map((m) => m.id)));
  };

  const selectNoneMatches = () => {
    setSelectedMatchIds(new Set());
  };

  const selectUpcomingMatches = () => {
    setSelectedMatchIds(
      new Set(scrapedMatches.filter((m) => !m.completed).map((m) => m.id))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-bgSurfaceSoft">
        {/* Header */}
        <div className="sticky top-0 border-b border-borderSoft bg-bgSurfaceSoft p-4">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-700" />
          <h2 className="text-center text-lg font-semibold">
            Import zápasů z ceskyhokej.cz
          </h2>
          {/* Progress indicator */}
          <div className="mt-3 flex justify-center gap-2">
            {[0, 1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full ${
                  s <= step ? "bg-accentPrimary" : "bg-slate-700"
                }`}
              />
            ))}
          </div>
          <div className="mt-2 text-center text-xs text-slate-500">
            Krok {step + 1} ze 4:{" "}
            {step === 0 && "Výběr zdroje"}
            {step === 1 && "Mapování"}
            {step === 2 && "Brankář"}
            {step === 3 && "Kontrola"}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div className="mb-4 rounded-lg bg-accentDanger/20 p-3 text-sm text-accentDanger">
              {error}
            </div>
          )}

          {/* Step 0: Source Selection */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Vyberte soutěž pro import zápasů HC Slovan Ústí.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {COMPETITION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset)}
                    className={`rounded-xl px-3 py-3 text-sm font-medium ${
                      selectedPreset.id === preset.id
                        ? "bg-accentPrimary text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <details className="rounded-lg bg-slate-800/50 p-3">
                <summary className="cursor-pointer text-xs text-slate-400">
                  Vlastní klíč soutěže
                </summary>
                <input
                  type="text"
                  placeholder="např. starsi-zaci-a"
                  value={customCompetitionId}
                  onChange={(e) => setCustomCompetitionId(e.target.value)}
                  className="mt-2 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </details>

              <div className="rounded-lg bg-slate-800/50 p-3 text-xs text-slate-400">
                <p>
                  📍 Zdroj: <span className="text-slate-200">zapasy.ceskyhokej.cz</span>
                </p>
                <p className="mt-1">
                  📅 Sezóna: <span className="text-slate-200">{selectedPreset.season}</span>
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Mapping */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Nalezeno <span className="text-accentPrimary font-bold">{scrapedMatches.length}</span> zápasů.
                Přiřaďte je k lokální soutěži a týmu.
              </p>

              {autoCreatedCompetition && (
                <div className="rounded-lg bg-accentSuccess/10 border border-accentSuccess/20 p-3 text-sm">
                  <p className="text-accentSuccess font-medium">
                    ✓ Soutěž "{userCompetitions.find(c => c.id === autoCreatedCompetition)?.name}" byla automaticky vytvořena
                  </p>
                </div>
              )}

              <Select
                label="Přiřadit k soutěži"
                value={mappings.competitionId}
                onChange={(val) =>
                  setMappings({ ...mappings, competitionId: val })
                }
                options={[
                  { value: "", label: "-- Ponechat z importu --" },
                  ...userCompetitions.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
              />

              <Select
                label="Přiřadit domácí tým"
                value={mappings.homeTeamId}
                onChange={(val) =>
                  setMappings({ ...mappings, homeTeamId: val })
                }
                options={[
                  { value: "", label: "-- Ponechat z importu --" },
                  ...teams.map((t) => ({
                    value: t.id,
                    label: t.name,
                  })),
                ]}
              />

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMapping}
                  onChange={(e) => setRememberMapping(e.target.checked)}
                  className="rounded"
                />
                Zapamatovat pro příště
              </label>
            </div>
          )}

          {/* Step 2: Goalie Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Vyberte brankáře pro přiřazení k importovaným zápasům.
              </p>

              {goalies.length === 0 ? (
                <div className="rounded-lg bg-accentPrimary/10 p-4 text-center">
                  <p className="text-sm text-slate-300">
                    Zatím nemáte žádné brankáře
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Můžete je přiřadit později
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedGoalieId("")}
                    className={`w-full rounded-lg px-3 py-3 text-left text-sm ${
                      !selectedGoalieId
                        ? "bg-slate-700 ring-2 ring-accentPrimary"
                        : "bg-slate-800"
                    }`}
                  >
                    <span className="text-slate-400">Nepřiřazovat brankáře</span>
                  </button>
                  {goalies.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGoalieId(g.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 ${
                        selectedGoalieId === g.id
                          ? "bg-accentPrimary/20 ring-2 ring-accentPrimary"
                          : "bg-slate-800"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                          selectedGoalieId === g.id
                            ? "bg-accentPrimary text-white"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {g.jerseyNumber || g.firstName[0]}
                      </span>
                      <div className="text-left">
                        <div className="font-medium text-slate-100">
                          {g.firstName} {g.lastName}
                        </div>
                        <div className="text-xs text-slate-500">{g.team}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={openAfterImport}
                  onChange={(e) => setOpenAfterImport(e.target.checked)}
                  className="rounded"
                />
                Po importu otevřít nejbližší zápas
              </label>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Vybráno{" "}
                  <span className="font-bold text-accentPrimary">
                    {selectedMatchIds.size}
                  </span>{" "}
                  z {scrapedMatches.length} zápasů
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={selectAllMatches}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300"
                  >
                    Vše
                  </button>
                  <button
                    onClick={selectUpcomingMatches}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300"
                  >
                    Nadcházející
                  </button>
                  <button
                    onClick={selectNoneMatches}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300"
                  >
                    Nic
                  </button>
                </div>
              </div>

              <div className="max-h-60 space-y-2 overflow-y-auto">
                {scrapedMatches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMatchSelection(m.id)}
                    className={`w-full rounded-lg p-3 text-left ${
                      selectedMatchIds.has(m.id)
                        ? "bg-accentPrimary/20 ring-1 ring-accentPrimary"
                        : "bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedMatchIds.has(m.id)}
                          onChange={() => {}}
                          className="rounded"
                        />
                        <div>
                          <div className="text-sm font-medium">
                            {m.home} vs {m.away}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(m.datetime).toLocaleDateString("cs-CZ")} •{" "}
                            {m.category}
                          </div>
                        </div>
                      </div>
                      {m.completed ? (
                        <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                          {m.homeScore}:{m.awayScore}
                        </span>
                      ) : (
                        <span className="rounded bg-accentSuccess/20 px-2 py-0.5 text-xs text-accentSuccess">
                          Nadcházející
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-slate-800/50 p-3 text-xs text-slate-400">
                <p>
                  🥅 Brankář:{" "}
                  <span className="text-slate-200">
                    {selectedGoalieId
                      ? goalies.find((g) => g.id === selectedGoalieId)
                          ?.firstName +
                        " " +
                        goalies.find((g) => g.id === selectedGoalieId)?.lastName
                      : "Nepřiřazen"}
                  </span>
                </p>
                <p className="mt-1">
                  📂 Soutěž:{" "}
                  <span className="text-slate-200">
                    {mappings.competitionId
                      ? userCompetitions.find((c) => c.id === mappings.competitionId)
                          ?.name || "Neznámá soutěž"
                      : "Z importu"}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-borderSoft bg-bgSurfaceSoft p-4">
          <div className="flex gap-3">
            {step === 0 ? (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-medium text-slate-300"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleFetchMatches}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading ? "Načítám..." : "Načíst zápasy →"}
                </button>
              </>
            ) : step === 1 ? (
              <>
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-medium text-slate-300"
                >
                  ← Zpět
                </button>
                <button
                  onClick={handleConfirmMapping}
                  className="flex-1 rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white"
                >
                  Pokračovat →
                </button>
              </>
            ) : step === 2 ? (
              <>
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-medium text-slate-300"
                >
                  ← Zpět
                </button>
                <button
                  onClick={handleConfirmGoalie}
                  className="flex-1 rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white"
                >
                  Pokračovat →
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-medium text-slate-300"
                >
                  ← Zpět
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || selectedMatchIds.size === 0}
                  className="flex-1 rounded-xl bg-accentSuccess py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading
                    ? "Importuji..."
                    : `Importovat ${selectedMatchIds.size} zápasů`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

