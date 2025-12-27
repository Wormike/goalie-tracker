"use client";

import React, { useState } from "react";
import { useCompetition } from "@/contexts/CompetitionContext";

interface OnboardingWizardProps {
  onComplete?: () => void;
}

/**
 * Onboarding wizard displayed on first app launch when no competitions exist.
 * Allows user to create their first competition with name and optional standings URL.
 */
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { addCompetition, needsOnboarding, isLoading } = useCompetition();
  
  const [name, setName] = useState("");
  const [standingsUrl, setStandingsUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Don't render if loading or if onboarding is not needed
  if (isLoading || !needsOnboarding) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
      // Create the competition
      addCompetition({
        name: trimmedName,
        standingsUrl: standingsUrl.trim() || undefined,
      });

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
            Nejdřív si nastav soutěž
          </h2>
          <p className="mb-6 text-center text-sm text-slate-400">
            kterou chceš sledovat
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Competition name */}
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

            {/* Standings URL */}
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

            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-accentDanger/20 px-3 py-2 text-xs text-accentDanger">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full rounded-xl bg-accentPrimary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accentPrimary/90 disabled:opacity-50"
            >
              {isSubmitting ? "Vytvářím..." : "Vytvořit soutěž"}
            </button>
          </form>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-slate-500">
            Můžeš přidat další soutěže později
            <br />
            v <span className="text-slate-400">Nastavení → Správa soutěží</span>
          </p>
        </div>
      </div>
    </div>
  );
}


