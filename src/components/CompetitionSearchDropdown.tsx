"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface DiscoveredCompetition {
  name: string;
  fullName?: string;
  abbreviation: string;
  matchCount: number;
  completedCount?: number;
  upcomingCount?: number;
  hasUpcoming: boolean;
  hasCompleted: boolean;
  sampleMatch?: string;
}

interface CompetitionSearchDropdownProps {
  onSelect: (competition: DiscoveredCompetition | null) => void;
  selectedCompetition: DiscoveredCompetition | null;
  season?: string;
  teamId?: string;
  placeholder?: string;
  className?: string;
}

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSeason(season?: string): string {
  if (!season) return "2025";
  const match = season.match(/^(\d{4})/);
  return match ? match[1] : season;
}

function getPhaseBadge(label: string): { text: string; className: string } | null {
  const normalized = label.toLowerCase();
  if (normalized.includes("nadstavba")) {
    return { text: "Nadstavba", className: "bg-accentSuccess/20 text-accentSuccess" };
  }
  if (normalized.includes("o umístění") || normalized.includes("o umisteni")) {
    return { text: "O umístění", className: "bg-accentPrimary/20 text-accentPrimary" };
  }
  return null;
}

export function CompetitionSearchDropdown({
  onSelect,
  selectedCompetition,
  season,
  teamId,
  placeholder = "Vyberte soutěž z ceskyhokej.cz...",
  className = "",
}: CompetitionSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [competitions, setCompetitions] = useState<DiscoveredCompetition[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || competitions.length > 0) return;
    setLoading(true);
    const fetchSeason = normalizeSeason(season);
    const fetchTeam = teamId || "1710";
    fetch(`/api/competitions/discover?season=${fetchSeason}&teamId=${fetchTeam}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCompetitions(data.competitions || []);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen, season, teamId, competitions.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search) return competitions;
    const needle = normalizeSearch(search);
    return competitions.filter((c) => {
      const label = normalizeSearch(c.fullName || c.name);
      const abbr = normalizeSearch(c.abbreviation);
      return label.includes(needle) || abbr.includes(needle);
    });
  }, [competitions, search]);

  const selectedLabel =
    selectedCompetition?.fullName ||
    selectedCompetition?.name ||
    placeholder;
  const selectedMeta = selectedCompetition
    ? `${selectedCompetition.abbreviation}${selectedCompetition.matchCount ? ` • ${selectedCompetition.matchCount} zápasů` : ""}`
    : "";
  const selectedPhase = selectedCompetition
    ? getPhaseBadge(selectedCompetition.fullName || selectedCompetition.name)
    : null;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 flex-1 flex-col text-left">
          <span className={`truncate ${selectedCompetition ? "text-slate-100" : "text-slate-400"}`}>
            {selectedLabel}
          </span>
            {selectedCompetition && (
              <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                <span className="truncate">{selectedMeta}</span>
                {selectedPhase && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${selectedPhase.className}`}>
                    {selectedPhase.text}
                  </span>
                )}
              </span>
            )}
        </span>
        <span className="text-slate-400">{isOpen ? "▴" : "▾"}</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-borderSoft bg-bgSurfaceSoft shadow-lg shadow-black/30">
          <div className="border-b border-borderSoft p-2">
            <input
              type="text"
              placeholder="Filtrovat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          {loading ? (
            <div className="px-3 py-3 text-sm text-slate-400">
              ⏳ Načítám soutěže...
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {filtered.map((comp) => {
                const phase = getPhaseBadge(comp.fullName || comp.name);
                return (
                <button
                  key={comp.abbreviation}
                  onClick={() => {
                    onSelect(comp);
                    setIsOpen(false);
                  }}
                  className="flex w-full flex-col items-start gap-1 border-b border-borderSoft px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                  role="option"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="truncate font-medium">
                      {comp.fullName || comp.name}
                    </span>
                    {phase && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${phase.className}`}>
                        {phase.text}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {comp.abbreviation}
                    {comp.matchCount ? ` • ${comp.matchCount} zápasů` : ""}
                    {comp.completedCount !== undefined
                      ? ` • ${comp.completedCount} odehráno`
                      : ""}
                    {comp.upcomingCount !== undefined
                      ? ` • ${comp.upcomingCount} nadcházejících`
                      : ""}
                  </span>
                </button>
              )})}
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-sm text-slate-400">
                  Žádná soutěž nenalezena.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
