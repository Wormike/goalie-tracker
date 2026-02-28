"use client";

import React, { useState, useEffect } from "react";
import type {
  Match,
  Goalie,
  Team,
  Competition,
} from "@/lib/types";
import {
  getGoalies,
  getTeams,
  saveMatch,
  saveExternalMapping,
  findExternalMapping,
} from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  createMatch as createMatchSupabase,
  findMatchByExternalId,
  updateMatch,
} from "@/lib/repositories/matches";
import { Select } from "@/components/ui/Select";
import { useCompetitions } from "@/lib/competitionService";
import { COMPETITION_PRESETS } from "@/lib/competitionPresets";
import { findCompetitionByExternalId } from "@/lib/repositories/competitions";
import { findOrCreateTeam } from "@/lib/repositories/teams";
import { isUuid } from "@/lib/utils/uuid";

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (importedCount: number) => void;
}

type Step = 0 | 1 | 2 | 3;

export function ImportWizard({ open, onClose, onComplete }: ImportWizardProps) {
  const { competitions: userCompetitions } = useCompetitions();
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0: Source selection
  const [selectedPreset, setSelectedPreset] = useState(COMPETITION_PRESETS[0]);

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

      if (!savedCompMapping && selectedPreset.externalId) {
        const presetCompetition = userCompetitions.find(
          (c) => c.externalId === selectedPreset.externalId
        );
        if (presetCompetition) {
          setMappings((m) => ({ ...m, competitionId: presetCompetition.id }));
        }
      }
    }
  }, [open, selectedPreset.id, selectedPreset.externalId, userCompetitions]);

  if (!open) return null;

  const handleFetchMatches = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/matches/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season: selectedPreset.season,
          category: selectedPreset.id,
        }),
      });

      const data = await response.json();

      if (data.success && data.matches && data.matches.length > 0) {
        setScrapedMatches(data.matches);
        
        let existingCompetition: Competition | null = null;
        if (selectedPreset.externalId) {
          if (isSupabaseConfigured()) {
            existingCompetition = await findCompetitionByExternalId(selectedPreset.externalId);
          } else {
            existingCompetition =
              userCompetitions.find((c) => c.externalId === selectedPreset.externalId) || null;
          }
        }

        if (!existingCompetition) {
          setError("Soutěž nebyla nalezena. Zkuste obnovit stránku.");
          return;
        }

        setMappings((m) => ({ ...m, competitionId: existingCompetition.id }));
        
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
    } catch {
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
        externalId: selectedPreset.id,
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
      // Track created matches with their new IDs for navigation
      const createdMatches: Match[] = [];
      
      if (isSupabaseConfigured()) {
        // Save to Supabase - process sequentially to avoid race conditions
        for (const match of selectedMatches) {
          try {
            const homeTeamName = match.home || match.homeTeamName || "HC Slovan Ústí n.L.";
            const awayTeamName = match.away || match.awayTeamName || "Hosté";
            const mappedHomeId =
              mappings.homeTeamId && isUuid(mappings.homeTeamId)
                ? mappings.homeTeamId
                : null;
            const homeTeamId = mappedHomeId || (await findOrCreateTeam(homeTeamName));
            const awayTeamId = await findOrCreateTeam(awayTeamName);

            const enrichedMatch: Match = {
              ...match,
              goalieId: selectedGoalieId || undefined,
              competitionId: mappings.competitionId || undefined,
              competitionIdManuallySet: false, // Imported matches are not manually set
              homeTeamId: homeTeamId || undefined,
              awayTeamId: awayTeamId || undefined,
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
              home_team_name: homeTeamName,
              away_team_id: enrichedMatch.awayTeamId || undefined,
              away_team_name: awayTeamName,
              datetime: enrichedMatch.datetime,
              competition_id: enrichedMatch.competitionId || undefined, // FK to competitions table
              season_id: enrichedMatch.seasonId || "2025-2026",
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

            const existingMatch = enrichedMatch.externalId
              ? await findMatchByExternalId(enrichedMatch.externalId)
              : null;

            if (existingMatch) {
              const updatePayload = {
                ...payload,
                goalie_id: existingMatch.goalieId ? undefined : payload.goalie_id,
                status: existingMatch.status === "completed" ? undefined : payload.status,
                manual_shots: undefined,
                manual_saves: undefined,
                manual_goals_against: undefined,
              };
              const updated = await updateMatch(existingMatch.id, updatePayload);
              if (updated) {
                createdMatches.push(updated);
                importedCount++;
                continue;
              }
            }
            
            const created = await createMatchSupabase(payload);
            if (created) {
              createdMatches.push(created); // Store created match with new UUID
              importedCount++;
            } else {
              console.warn("[ImportWizard] Failed to create match in Supabase, falling back to localStorage");
              // Fallback to localStorage
              saveMatch(enrichedMatch);
              createdMatches.push(enrichedMatch); // Store with original ID
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
            createdMatches.push(enrichedMatch); // Store with original ID
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
          createdMatches.push(enrichedMatch); // Store with original ID
          importedCount++;
        });
      }

      onComplete(importedCount);
      
      // Optionally open the first upcoming match for tracking
      // Use created matches (with correct UUIDs from Supabase) instead of original selectedMatches
      if (openAfterImport && createdMatches.length > 0) {
        const firstUpcoming = createdMatches.find((m) => !m.completed);
        if (firstUpcoming) {
          // Use the correct ID (UUID from Supabase or original ID from localStorage)
          window.location.href = `/match/${firstUpcoming.id}`;
          return;
        }
      }
      
      onClose();
    } catch {
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

