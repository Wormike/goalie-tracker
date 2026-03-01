"use client";

import React, { useState, useEffect } from "react";
import { useCompetitions } from "@/lib/competitionService";
import { getCurrentSeason } from "@/lib/storage";
import {
  CompetitionSearchDropdown,
  type DiscoveredCompetition,
} from "@/components/CompetitionSearchDropdown";

interface OnboardingWizardProps {
  onComplete?: () => void;
}

/**
 * Onboarding wizard displayed on first app launch when no competitions exist,
 * or when user wants to switch/create a competition.
 * Allows user to select existing competition or create a new one.
 */
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { 
    competitions, 
    addCompetition, 
    setActiveCompetitionId,
    needsOnboarding, 
    isLoading 
  } = useCompetitions();
  
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("");
  const [createMode, setCreateMode] = useState<"web" | "manual">("web");
  const [selectedWebComp, setSelectedWebComp] = useState<DiscoveredCompetition | null>(null);
  const [webDisplayName, setWebDisplayName] = useState("");
  const [name, setName] = useState("");
  const [standingsUrl, setStandingsUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If competitions exist, default to select mode
  // IMPORTANT: This hook must be called before any conditional returns
  // to follow React's Rules of Hooks
  useEffect(() => {
    if (competitions.length > 0) {
      setMode("select");
      setSelectedCompetitionId(competitions[0].id);
    } else {
      setMode("create");
    }
  }, [competitions]);

  // Don't render if loading or if onboarding is not needed
  if (isLoading || !needsOnboarding) {
    return null;
  }

  const handleSelectCompetition = () => {
    if (!selectedCompetitionId) {
      setError("Prosím vyberte soutěž");
      return;
    }
    
    setActiveCompetitionId(selectedCompetitionId);
    onComplete?.();
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Název soutěže je povinný");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Název musí mít alespoň 2 znaky");
      return;
    }

    // Validate URL if provided
    if (standingsUrl.trim()) {
      try {
        new URL(standingsUrl.trim());
      } catch {
        setError("Neplatná URL adresa");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const season = getCurrentSeason();
      // Create the competition
      const newComp = await addCompetition({
        name: trimmedName,
        displayName: trimmedName,
        standingsUrl: standingsUrl.trim() || undefined,
        category: "",
        seasonId: season?.id || "",
        source: "manual",
      });
      if (newComp) {
        setActiveCompetitionId(newComp.id);
      }

      // Call completion callback
      onComplete?.();
    } catch (err) {
      console.error("[OnboardingWizard] Failed to create competition:", err);
      setError("Nepodařilo se vytvořit soutěž. Zkuste to znovu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bgMain p-4">
      <div className="w-full max-w-sm">
        {/* Logo and welcome */}
        <div className="mb-8 text-center">
          <div className="mb-4 text-6xl">🏒</div>
          <h1 className="mb-2 text-2xl font-bold">Goalie Tracker</h1>
          <p className="text-sm text-slate-400">
            Sledování statistik hokejových brankářů
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-bgSurfaceSoft p-6">
          <h2 className="mb-2 text-center text-lg font-semibold">
            {competitions.length > 0 
              ? "Vyberte nebo vytvořte soutěž" 
              : "Nejdřív si nastav soutěž"}
          </h2>
          <p className="mb-6 text-center text-sm text-slate-400">
            {competitions.length > 0 
              ? "kterou chcete sledovat"
              : "kterou chceš sledovat"}
          </p>

          {/* Mode selector (only if competitions exist) */}
          {competitions.length > 0 && (
            <div className="mb-6 flex gap-2 rounded-xl bg-slate-800/50 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("select");
                  setError("");
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === "select"
                    ? "bg-accentPrimary text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Vybrat existující
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("create");
                  setError("");
                  setName("");
                  setStandingsUrl("");
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === "create"
                    ? "bg-accentPrimary text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Vytvořit novou
              </button>
            </div>
          )}

          {/* Select existing competition */}
          {mode === "select" && competitions.length > 0 && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-300">
                  Vyberte soutěž *
                </label>
                <div className="space-y-2">
                  {competitions.map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setSelectedCompetitionId(comp.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                        selectedCompetitionId === comp.id
                          ? "border-accentPrimary bg-accentPrimary/20 text-accentPrimary"
                          : "border-borderSoft bg-slate-800 text-slate-200 hover:border-slate-600"
                      }`}
                    >
                      <div className="font-medium">{comp.name}</div>
                      {comp.standingsUrl && (
                        <div className="mt-1 text-xs text-slate-500">
                          📊 Tabulka nastavena
                        </div>
                      )}
                      <div className="mt-1 text-xs text-slate-500">
                        Vytvořeno: {comp.createdAt ? new Date(comp.createdAt).toLocaleDateString("cs-CZ") : "Neznámé"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-accentDanger/20 px-3 py-2 text-xs text-accentDanger">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSelectCompetition}
                disabled={!selectedCompetitionId}
                className="w-full rounded-xl bg-accentPrimary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accentPrimary/90 disabled:opacity-50"
              >
                Použít tuto soutěž
              </button>
            </div>
          )}

          {/* Create new competition */}
          {mode === "create" && (
            <div className="space-y-4">
              <div className="flex gap-2 rounded-xl bg-slate-800/50 p-1">
                <button
                  type="button"
                  onClick={() => setCreateMode("web")}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    createMode === "web"
                      ? "bg-accentPrimary text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Z ceskyhokej.cz
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("manual")}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    createMode === "manual"
                      ? "bg-accentPrimary text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Vlastní soutěž
                </button>
              </div>

              {createMode === "web" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-300">
                      Vyberte soutěž *
                    </label>
                    <CompetitionSearchDropdown
                      onSelect={(comp) => {
                        setSelectedWebComp(comp);
                        setWebDisplayName(comp?.fullName || comp?.name || "");
                      }}
                      selectedCompetition={selectedWebComp}
                    />
                  </div>

                  {selectedWebComp && (
                    <div className="space-y-2">
                      <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                        <div className="font-medium text-slate-200">
                          {selectedWebComp.fullName || selectedWebComp.name}
                        </div>
                        <div className="mt-1">
                          {selectedWebComp.abbreviation}
                          {selectedWebComp.matchCount ? ` • ${selectedWebComp.matchCount} zápasů` : ""}
                          {selectedWebComp.completedCount !== undefined
                            ? ` • ${selectedWebComp.completedCount} odehráno`
                            : ""}
                          {selectedWebComp.upcomingCount !== undefined
                            ? ` • ${selectedWebComp.upcomingCount} nadcházejících`
                            : ""}
                        </div>
                        {(selectedWebComp.fullName || selectedWebComp.name).toLowerCase().includes("nadstavba") && (
                          <span className="mt-1 inline-flex rounded bg-accentSuccess/20 px-1.5 py-0.5 text-[10px] text-accentSuccess">
                            Nadstavba
                          </span>
                        )}
                        {(selectedWebComp.fullName || selectedWebComp.name)
                          .toLowerCase()
                          .includes("o umístění") && (
                          <span className="mt-1 inline-flex rounded bg-accentPrimary/20 px-1.5 py-0.5 text-[10px] text-accentPrimary">
                            O umístění
                          </span>
                        )}
                      </div>
                      <label className="mb-2 block text-xs font-medium text-slate-300">
                        Název v aplikaci (můžete přepsat)
                      </label>
                      <input
                        type="text"
                        value={webDisplayName}
                        onChange={(e) => setWebDisplayName(e.target.value)}
                        className="w-full rounded-xl border border-borderSoft bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accentPrimary focus:outline-none focus:ring-2 focus:ring-accentPrimary/20"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="rounded-lg bg-accentDanger/20 px-3 py-2 text-xs text-accentDanger">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!selectedWebComp || isSubmitting}
                    onClick={async () => {
                      if (!selectedWebComp) return;
                      setIsSubmitting(true);
                      setError("");
                      try {
                        const season = getCurrentSeason();
                        const newComp = await addCompetition({
                          name: selectedWebComp.fullName || selectedWebComp.name,
                          displayName:
                            webDisplayName ||
                            selectedWebComp.fullName ||
                            selectedWebComp.name,
                          abbreviation:
                            selectedWebComp.abbreviation || selectedWebComp.name,
                          category: selectedWebComp.name,
                          seasonId: season?.id || "",
                          source: "ceskyhokej",
                        });
                        if (newComp) {
                          setActiveCompetitionId(newComp.id);
                        }
                        onComplete?.();
                      } catch (err) {
                        console.error("[OnboardingWizard] Failed to create competition:", err);
                        setError("Nepodařilo se vytvořit soutěž. Zkuste to znovu.");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="w-full rounded-xl bg-accentPrimary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accentPrimary/90 disabled:opacity-50"
                  >
                    {isSubmitting ? "Vytvářím..." : "Vytvořit soutěž"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateCompetition} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-300">
                      Název soutěže *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="7. třída - Vojta"
                      className="w-full rounded-xl border border-borderSoft bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accentPrimary focus:outline-none focus:ring-2 focus:ring-accentPrimary/20"
                      autoFocus
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-300">
                      Odkaz na tabulku
                      <span className="ml-1 font-normal text-slate-500">(volitelné)</span>
                    </label>
                    <input
                      type="url"
                      value={standingsUrl}
                      onChange={(e) => setStandingsUrl(e.target.value)}
                      placeholder="https://www.ceskyhokej.cz/competition/standings/24"
                      className="w-full rounded-xl border border-borderSoft bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accentPrimary focus:outline-none focus:ring-2 focus:ring-accentPrimary/20"
                      disabled={isSubmitting}
                    />
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                      <span className="mt-0.5">💡</span>
                      <span>
                        Najdi tabulku na ceskyhokej.cz a zkopíruj URL z prohlížeče
                      </span>
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-accentDanger/20 px-3 py-2 text-xs text-accentDanger">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    className="w-full rounded-xl bg-accentPrimary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accentPrimary/90 disabled:opacity-50"
                  >
                    {isSubmitting ? "Vytvářím..." : "Vytvořit soutěž"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-slate-500">
            Můžeš přidat další soutěže později v{" "}
            <span className="text-slate-400">Nastavení → Správa soutěží</span>
          </p>
        </div>
      </div>
    </div>
  );
}



