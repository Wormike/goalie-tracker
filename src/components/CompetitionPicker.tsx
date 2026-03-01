"use client";

import { useState } from "react";
import {
  CompetitionSearchDropdown,
  type DiscoveredCompetition,
} from "@/components/CompetitionSearchDropdown";

interface CompetitionPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (competition: {
    name: string;
    displayName: string;
    abbreviation?: string;
    source: "ceskyhokej" | "manual";
  }) => void;
}

export function CompetitionPicker({ open, onClose, onSelect }: CompetitionPickerProps) {
  const [mode, setMode] = useState<"web" | "manual">("web");
  const [selectedComp, setSelectedComp] = useState<DiscoveredCompetition | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [manualName, setManualName] = useState("");
  const handleSelect = (comp: DiscoveredCompetition | null) => {
    if (!comp) return;
    setSelectedComp(comp);
    setDisplayName(comp.fullName || comp.name);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-bgSurfaceSoft p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Přidat soutěž</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setMode("web")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm ${
              mode === "web" ? "bg-accentPrimary text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            Z ceskyhokej.cz
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm ${
              mode === "manual" ? "bg-accentPrimary text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            Vlastní soutěž
          </button>
        </div>

        {mode === "web" ? (
          <>
            <div className="mb-3">
              <CompetitionSearchDropdown
                onSelect={handleSelect}
                selectedCompetition={selectedComp}
              />
            </div>

            {selectedComp && (
              <div className="mt-3 space-y-2">
                <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                  <div className="font-medium text-slate-200">
                    {selectedComp.fullName || selectedComp.name}
                  </div>
                  <div className="mt-1">
                    {selectedComp.abbreviation}
                    {selectedComp.matchCount ? ` • ${selectedComp.matchCount} zápasů` : ""}
                    {selectedComp.completedCount !== undefined
                      ? ` • ${selectedComp.completedCount} odehráno`
                      : ""}
                    {selectedComp.upcomingCount !== undefined
                      ? ` • ${selectedComp.upcomingCount} nadcházejících`
                      : ""}
                  </div>
                  {(selectedComp.fullName || selectedComp.name).toLowerCase().includes("nadstavba") && (
                    <span className="mt-1 inline-flex rounded bg-accentSuccess/20 px-1.5 py-0.5 text-[10px] text-accentSuccess">
                      Nadstavba
                    </span>
                  )}
                  {(selectedComp.fullName || selectedComp.name)
                    .toLowerCase()
                    .includes("o umístění") && (
                    <span className="mt-1 inline-flex rounded bg-accentPrimary/20 px-1.5 py-0.5 text-[10px] text-accentPrimary">
                      O umístění
                    </span>
                  )}
                </div>
                <label className="mb-1 block text-xs text-slate-500">Název v aplikaci</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            )}
          </>
        ) : (
          <div>
            <label className="mb-1 block text-xs text-slate-500">Název soutěže</label>
            <input
              type="text"
              placeholder="Např. Vánoční turnaj Ústí 2025"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300"
          >
            Zrušit
          </button>
          <button
            onClick={() => {
              if (mode === "web" && selectedComp) {
                onSelect({
                  name: selectedComp.fullName || selectedComp.name,
                  displayName: displayName || selectedComp.fullName || selectedComp.name,
                  abbreviation: selectedComp.abbreviation || selectedComp.name,
                  source: "ceskyhokej",
                });
              } else if (mode === "manual" && manualName.trim()) {
                onSelect({
                  name: manualName.trim(),
                  displayName: manualName.trim(),
                  source: "manual",
                });
              }
              onClose();
            }}
            disabled={(mode === "web" && !selectedComp) || (mode === "manual" && !manualName.trim())}
            className="flex-1 rounded-lg bg-accentPrimary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Přidat soutěž
          </button>
        </div>
      </div>
    </div>
  );
}


