"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExportImportModal } from "@/components/ExportImportModal";
import {
  getStorageStats,
  getSeasons,
  getCurrentSeason,
  setCurrentSeason,
  saveSeason,
  deleteSeason,
  getTeams,
  getCompetitions,
  generateSeasonId,
  generateSeasonLabel,
} from "@/lib/storage";
import type { Season, Team, Competition } from "@/lib/types";

interface SeasonModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (season: Season) => void;
  editingSeason?: Season | null;
}

function SeasonModal({ open, onClose, onSave, editingSeason }: SeasonModalProps) {
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear);
  const [endYear, setEndYear] = useState(currentYear + 1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingSeason) {
      setStartYear(editingSeason.startYear);
      setEndYear(editingSeason.endYear);
    } else {
      setStartYear(currentYear);
      setEndYear(currentYear + 1);
    }
    setError("");
  }, [editingSeason, open, currentYear]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (endYear <= startYear) {
      setError("Koncový rok musí být větší než počáteční rok");
      return;
    }

    if (endYear - startYear !== 1) {
      setError("Sezóna musí trvat přesně jeden rok (např. 2024-2025)");
      return;
    }

    const season: Season = {
      id: editingSeason?.id || generateSeasonId(startYear, endYear),
      name: generateSeasonLabel(startYear, endYear),
      label: generateSeasonLabel(startYear, endYear),
      startDate: `${startYear}-09-01`,
      endDate: `${endYear}-06-30`,
      startYear,
      endYear,
      isActive: editingSeason?.isActive ?? false,
      isCurrent: editingSeason?.isCurrent ?? false,
    };

    onSave(season);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-bgSurfaceSoft p-5">
        <h3 className="mb-4 text-center text-lg font-semibold">
          {editingSeason ? "Upravit sezónu" : "Nová sezóna"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Počáteční rok *
            </label>
            <input
              type="number"
              value={startYear}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setStartYear(val);
                setEndYear(val + 1);
              }}
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100"
              min={2000}
              max={2100}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Koncový rok *
            </label>
            <input
              type="number"
              value={endYear}
              onChange={(e) => setEndYear(parseInt(e.target.value))}
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100"
              min={startYear + 1}
              max={2101}
              required
            />
          </div>

          <div className="rounded-lg bg-slate-800/50 px-3 py-3">
            <div className="text-xs text-slate-400">Náhled:</div>
            <div className="mt-1 text-lg font-semibold text-accentPrimary">
              {generateSeasonLabel(startYear, endYear)}
            </div>
            <div className="text-xs text-slate-500">
              {startYear}-09-01 – {endYear}-06-30
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-accentDanger/20 px-3 py-2 text-xs text-accentDanger">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm text-slate-300"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-accentPrimary py-2.5 text-sm font-semibold text-white"
            >
              {editingSeason ? "Uložit" : "Vytvořit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [showExportImport, setShowExportImport] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Season | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [stats, setStats] = useState({
    goalies: 0,
    teams: 0,
    seasons: 0,
    competitions: 0,
    matches: 0,
    events: 0,
  });
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeasonState, setCurrentSeasonState] = useState<Season | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  const loadData = () => {
    setStats(getStorageStats());
    setSeasons(getSeasons());
    setCurrentSeasonState(getCurrentSeason());
    setTeams(getTeams());
    setCompetitions(getCompetitions());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetCurrent = (seasonId: string) => {
    setCurrentSeason(seasonId);
    loadData();
  };

  const handleSaveSeason = (season: Season) => {
    saveSeason(season);
    loadData();
  };

  const handleEditSeason = (season: Season) => {
    setEditingSeason(season);
    setShowSeasonModal(true);
  };

  const handleDeleteSeason = (season: Season) => {
    setDeleteError("");
    setDeleteConfirm(season);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    
    const result = deleteSeason(deleteConfirm.id);
    if (result.success) {
      setDeleteConfirm(null);
      loadData();
    } else {
      setDeleteError(result.error || "Nepodařilo se smazat sezónu");
    }
  };

  // Sort seasons by start year descending
  const sortedSeasons = [...seasons].sort((a, b) => b.startYear - a.startYear);

  return (
    <main className="flex min-h-screen flex-col bg-bgMain">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-borderSoft bg-bgSurfaceSoft px-4 py-3">
        <Link href="/" className="text-sm text-slate-300">
          ← Zpět
        </Link>
        <h1 className="text-lg font-semibold">Nastavení</h1>
        <div className="w-12" />
      </div>

      <div className="flex-1 space-y-6 p-4">
        {/* Data Overview */}
        <section className="rounded-2xl bg-bgSurfaceSoft p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">
            PŘEHLED DAT
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-800/50 p-3 text-center">
              <div className="text-2xl font-bold text-accentPrimary">
                {stats.goalies}
              </div>
              <div className="text-xs text-slate-500">Brankáři</div>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-3 text-center">
              <div className="text-2xl font-bold text-accentPrimary">
                {stats.matches}
              </div>
              <div className="text-xs text-slate-500">Zápasy</div>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-3 text-center">
              <div className="text-2xl font-bold text-accentPrimary">
                {stats.events}
              </div>
              <div className="text-xs text-slate-500">Události</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-800/50 p-3 text-center">
              <div className="text-xl font-bold text-slate-300">
                {stats.teams}
              </div>
              <div className="text-xs text-slate-500">Týmy</div>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-3 text-center">
              <div className="text-xl font-bold text-slate-300">
                {stats.competitions}
              </div>
              <div className="text-xs text-slate-500">Soutěže</div>
            </div>
          </div>
        </section>

        {/* Seasons Management */}
        <section className="rounded-2xl bg-bgSurfaceSoft p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400">
              SPRÁVA SEZÓN
            </h2>
            <button
              onClick={() => {
                setEditingSeason(null);
                setShowSeasonModal(true);
              }}
              className="rounded-lg bg-accentPrimary px-3 py-1.5 text-xs font-medium text-white"
            >
              + Nová sezóna
            </button>
          </div>
          <div className="space-y-2">
            {sortedSeasons.map((season) => (
              <div
                key={season.id}
                className={`rounded-xl px-4 py-3 ${
                  season.isCurrent
                    ? "bg-accentPrimary/20 ring-1 ring-accentPrimary"
                    : "bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${season.isCurrent ? "text-accentPrimary" : "text-slate-200"}`}>
                        {season.label || season.name}
                      </span>
                      {season.isCurrent && (
                        <span className="rounded bg-accentPrimary/30 px-2 py-0.5 text-[10px] font-medium text-accentPrimary">
                          AKTUÁLNÍ
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {season.startDate} – {season.endDate}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!season.isCurrent && (
                      <button
                        onClick={() => handleSetCurrent(season.id)}
                        className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-accentPrimary hover:bg-slate-600"
                        title="Nastavit jako aktuální"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => handleEditSeason(season)}
                      className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-600"
                      title="Upravit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteSeason(season)}
                      className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-accentDanger hover:bg-slate-600"
                      title="Smazat"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {sortedSeasons.length === 0 && (
              <div className="py-4 text-center text-sm text-slate-500">
                Žádné sezóny. Vytvořte první sezónu.
              </div>
            )}
          </div>
        </section>

        {/* Teams */}
        <section className="rounded-2xl bg-bgSurfaceSoft p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400">TÝMY</h2>
            <span className="text-xs text-slate-500">{teams.length}</span>
          </div>
          <div className="space-y-2">
            {teams.slice(0, 5).map((team) => (
              <div
                key={team.id}
                className="rounded-lg bg-slate-800/50 px-3 py-2"
              >
                <div className="font-medium text-slate-200">{team.name}</div>
                {team.shortName && (
                  <div className="text-xs text-slate-500">{team.shortName}</div>
                )}
              </div>
            ))}
            {teams.length > 5 && (
              <div className="text-center text-xs text-slate-500">
                +{teams.length - 5} dalších
              </div>
            )}
          </div>
        </section>

        {/* Competitions */}
        <section className="rounded-2xl bg-bgSurfaceSoft p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400">SOUTĚŽE</h2>
            <span className="text-xs text-slate-500">{competitions.length}</span>
          </div>
          <div className="space-y-2">
            {competitions
              .filter((c) => c.seasonId === currentSeasonState?.id)
              .map((comp) => (
                <div
                  key={comp.id}
                  className="rounded-lg bg-slate-800/50 px-3 py-2"
                >
                  <div className="font-medium text-slate-200">{comp.category}</div>
                  <div className="text-xs text-slate-500">{comp.name}</div>
                </div>
              ))}
            {competitions.filter((c) => c.seasonId === currentSeasonState?.id)
              .length === 0 && (
              <div className="text-center text-sm text-slate-500">
                Žádné soutěže pro tuto sezónu
              </div>
            )}
          </div>
        </section>

        {/* Export/Import */}
        <section className="rounded-2xl bg-bgSurfaceSoft p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">
            ZÁLOHA DAT
          </h2>
          <button
            onClick={() => setShowExportImport(true)}
            className="w-full rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white"
          >
            📦 Export &amp; Import
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">
            Zálohujte data nebo je přeneste na jiné zařízení
          </p>
        </section>

        {/* App Info */}
        <section className="rounded-2xl bg-bgSurfaceSoft p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">
            O APLIKACI
          </h2>
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>Verze</span>
              <span className="text-slate-200">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Data uložena</span>
              <span className="text-slate-200">Lokálně (localStorage)</span>
            </div>
          </div>
        </section>
      </div>

      {/* Season Modal */}
      <SeasonModal
        open={showSeasonModal}
        onClose={() => {
          setShowSeasonModal(false);
          setEditingSeason(null);
        }}
        onSave={handleSaveSeason}
        editingSeason={editingSeason}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-bgSurfaceSoft p-5">
            <h3 className="mb-2 text-center text-lg font-semibold text-accentDanger">
              Smazat sezónu?
            </h3>
            <p className="mb-4 text-center text-sm text-slate-400">
              {deleteConfirm.label || deleteConfirm.name}
            </p>
            {deleteError && (
              <div className="mb-4 rounded-lg bg-accentDanger/20 px-3 py-2 text-xs text-accentDanger">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirm(null);
                  setDeleteError("");
                }}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm text-slate-300"
              >
                Zrušit
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-accentDanger py-2.5 text-sm font-semibold text-white"
              >
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export/Import Modal */}
      <ExportImportModal
        open={showExportImport}
        onClose={() => setShowExportImport(false)}
        onDataChange={loadData}
      />
    </main>
  );
}
