"use client";

import { useEffect, useMemo, useState } from "react";

type DiscoveredCompetition = {
  name: string;
  abbreviation: string;
  matchCount: number;
  hasUpcoming: boolean;
  hasCompleted: boolean;
  sampleMatch?: string;
};

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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [competitions, setCompetitions] = useState<DiscoveredCompetition[]>([]);
  const [selectedComp, setSelectedComp] = useState<DiscoveredCompetition | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [manualName, setManualName] = useState("");

  useEffect(() => {
    if (open && mode === "web" && competitions.length === 0) {
      setLoading(true);
      fetch("/api/competitions/discover")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setCompetitions(data.competitions || []);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, mode, competitions.length]);

  const filtered = useMemo(() => {
    if (!search) return competitions;
    const s = search.toLowerCase();
    return competitions.filter((c) => {
      const name = c.name.toLowerCase();
      const abbr = c.abbreviation.toLowerCase();
      return name.includes(s) || abbr.includes(s);
    });
  }, [competitions, search]);

  const handleSelect = (comp: DiscoveredCompetition) => {
    setSelectedComp(comp);
    setDisplayName(comp.name);
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
              <input
                type="text"
                placeholder="Začněte psát název soutěže..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            {loading ? (
              <div className="rounded-lg bg-slate-800/50 p-3 text-sm text-slate-400">
                Načítám soutěže z ceskyhokej.cz...
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-borderSoft">
                {filtered.map((comp) => (
                  <button
                    key={comp.abbreviation}
                    onClick={() => handleSelect(comp)}
                    className={`w-full border-b border-borderSoft px-3 py-2 text-left text-sm ${
                      selectedComp?.abbreviation === comp.abbreviation
                        ? "bg-accentPrimary/10 text-accentPrimary"
                        : "text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <div className="font-medium">{comp.name}</div>
                    <div className="text-xs text-slate-500">
                      {comp.matchCount} zápasů{comp.sampleMatch ? ` • ${comp.sampleMatch}` : ""}
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">
                    Žádná soutěž nenalezena.
                  </div>
                )}
              </div>
            )}

            {selectedComp && (
              <div className="mt-3">
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
                  name: selectedComp.name,
                  displayName: displayName || selectedComp.name,
                  abbreviation: selectedComp.abbreviation,
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

