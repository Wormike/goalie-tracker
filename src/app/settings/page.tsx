"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExportImportModal } from "@/components/ExportImportModal";
import { StandingsLink } from "@/components/StandingsLink";
import { CompetitionPicker } from "@/components/CompetitionPicker";
import { useCompetitions } from "@/lib/competitionService";
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
import { getSyncStatus, uploadToSupabase, downloadFromSupabase, SyncStatus, SyncResult } from "@/lib/sync";
import { useToast } from "@/contexts/ToastContext";
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

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Sync Section
// ─────────────────────────────────────────────────────────────────────────────

function SupabaseSyncSection({ onDataChange }: { onDataChange: () => void }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const { addToast } = useToast();

  const loadStatus = async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleUpload = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await uploadToSupabase();
      setResult(res);
      await loadStatus();
      if (res.success) {
        onDataChange();
        addToast("Data nahrána do cloudu", "success");
      } else {
        addToast(res.errors[0] || "Nahrání do cloudu selhalo", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await downloadFromSupabase();
      setResult(res);
      await loadStatus();
      if (res.success) {
        onDataChange();
        addToast("Data stažena z cloudu", "success");
      } else {
        addToast(res.errors[0] || "Stažení z cloudu selhalo", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl bg-bgSurfaceSoft p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-400">
        ☁️ CLOUDOVÁ DATABÁZE (SUPABASE)
      </h2>
      
      {!syncStatus ? (
        <div className="py-4 text-center text-sm text-slate-500">
          Načítání...
        </div>
      ) : !syncStatus.isConfigured ? (
        <div className="rounded-xl bg-yellow-900/20 p-4 text-center">
          <div className="mb-2 text-2xl">⚠️</div>
          <p className="text-sm text-yellow-200">
            Supabase není nakonfigurován
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Nastav NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY v .env.local
          </p>
          <a 
            href="https://supabase.com/dashboard" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs text-accentPrimary underline"
          >
            Otevřít Supabase Dashboard →
          </a>
        </div>
      ) : (
        <>
          {/* Status */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-800/50 p-3">
              <div className="text-xs text-slate-400">Lokální data</div>
              <div className="mt-1 text-lg font-semibold text-slate-200">
                {syncStatus.localCounts.goalies} brankářů
              </div>
              <div className="text-xs text-slate-500">
                {syncStatus.localCounts.matches} zápasů • {syncStatus.localCounts.events} událostí
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-3">
              <div className="text-xs text-slate-400">V cloudu</div>
              {syncStatus.remoteCounts ? (
                <>
                  <div className="mt-1 text-lg font-semibold text-accentPrimary">
                    {syncStatus.remoteCounts.goalies} brankářů
                  </div>
                  <div className="text-xs text-slate-500">
                    {syncStatus.remoteCounts.matches} zápasů • {syncStatus.remoteCounts.events} událostí
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-slate-500">Nedostupné</div>
              )}
            </div>
          </div>

          {syncStatus.lastSync && (
            <div className="mb-4 text-center text-xs text-slate-500">
              Poslední synchronizace: {new Date(syncStatus.lastSync).toLocaleString("cs-CZ")}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={loading}
              className="flex-1 rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "⏳" : "⬆️"} Nahrát do cloudu
            </button>
            <button
              onClick={handleDownload}
              disabled={loading}
              className="flex-1 rounded-xl bg-slate-700 py-3 text-sm font-semibold text-slate-200 disabled:opacity-50"
            >
              {loading ? "⏳" : "⬇️"} Stáhnout z cloudu
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className={`mt-4 rounded-xl p-3 ${result.success ? "bg-green-900/30" : "bg-red-900/30"}`}>
              <div className={`text-sm font-medium ${result.success ? "text-green-300" : "text-red-300"}`}>
                {result.success ? "✅ Synchronizace dokončena" : "❌ Chyba při synchronizaci"}
              </div>
              {result.success && (
                <div className="mt-1 text-xs text-slate-400">
                  Nahráno: {result.uploaded.goalies} brankářů, {result.uploaded.matches} zápasů, {result.uploaded.events} událostí
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-400">
                  {result.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User Competition Modal
// ─────────────────────────────────────────────────────────────────────────────

interface UserCompetitionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; standingsUrl?: string }) => void;
  editingCompetition?: Competition | null;
}

function UserCompetitionModal({ 
  open, 
  onClose, 
  onSave, 
  editingCompetition 
}: UserCompetitionModalProps) {
  const [name, setName] = useState("");
  const [standingsUrl, setStandingsUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingCompetition) {
      setName(editingCompetition.name);
      setStandingsUrl(editingCompetition.standingsUrl || "");
    } else {
      setName("");
      setStandingsUrl("");
    }
    setError("");
  }, [editingCompetition, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Název soutěže je povinný");
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

    onSave({
      name: trimmedName,
      standingsUrl: standingsUrl.trim() || undefined,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-bgSurfaceSoft p-5">
        <h3 className="mb-4 text-center text-lg font-semibold">
          {editingCompetition ? "Upravit soutěž" : "Nová soutěž"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Název soutěže *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="7. třída - Vojta"
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-slate-400">
              Odkaz na tabulku
              <span className="ml-1 font-normal text-slate-500">(volitelné)</span>
            </label>
            <input
              type="url"
              value={standingsUrl}
              onChange={(e) => setStandingsUrl(e.target.value)}
              placeholder="https://www.ceskyhokej.cz/competition/standings/24"
              className="w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-100"
            />
            <p className="mt-2 text-xs text-slate-500">
              💡 Najdi tabulku na ceskyhokej.cz a zkopíruj URL
            </p>
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
              {editingCompetition ? "Uložit" : "Vytvořit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // User competitions from context
  const { 
    competitions: userCompetitions, 
    activeCompetition,
    addCompetition: addUserCompetition,
    updateCompetition: updateUserCompetition,
    deleteCompetition: deleteUserCompetition,
    setActiveCompetitionId,
  } = useCompetitions();

  const [showExportImport, setShowExportImport] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showUserCompModal, setShowUserCompModal] = useState(false);
  const [showCompetitionPicker, setShowCompetitionPicker] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [editingUserComp, setEditingUserComp] = useState<Competition | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Season | null>(null);
  const [deleteUserCompConfirm, setDeleteUserCompConfirm] = useState<Competition | null>(null);
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

  // Handlers for user competitions
  const handleSaveUserComp = async (data: { name: string; standingsUrl?: string }) => {
    if (editingUserComp) {
      await updateUserCompetition(editingUserComp.id, data);
    } else {
      await addUserCompetition({
        name: data.name,
        displayName: data.name,
        standingsUrl: data.standingsUrl,
        category: "",
        seasonId: currentSeasonState?.id || "",
        source: "manual",
      });
    }
  };

  const handleAddCompetition = async (payload: {
    name: string;
    displayName: string;
    abbreviation?: string;
    source: "ceskyhokej" | "manual";
  }) => {
    await addUserCompetition({
      name: payload.name,
      displayName: payload.displayName,
      abbreviation: payload.abbreviation,
      category: payload.name,
      seasonId: currentSeasonState?.id || "",
      source: payload.source,
    });
    loadData();
  };

  const handleEditUserComp = (comp: Competition) => {
    setEditingUserComp(comp);
    setShowUserCompModal(true);
  };

  const handleDeleteUserComp = (comp: Competition) => {
    setDeleteUserCompConfirm(comp);
  };

  const confirmDeleteUserComp = async () => {
    if (!deleteUserCompConfirm) return;
    await deleteUserCompetition(deleteUserCompConfirm.id);
    setDeleteUserCompConfirm(null);
  };

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

        {/* User Competitions (Moje soutěže) */}
        <section className="rounded-2xl bg-bgSurfaceSoft p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400">
              📋 MOJE SOUTĚŽE
            </h2>
            <button
              onClick={() => {
                setEditingUserComp(null);
                setShowCompetitionPicker(true);
              }}
              className="rounded-lg bg-accentPrimary px-3 py-1.5 text-xs font-medium text-white"
            >
              + Přidat soutěž
            </button>
          </div>
          
          {userCompetitions.length === 0 ? (
            <div className="rounded-xl bg-slate-800/50 p-6 text-center">
              <div className="mb-2 text-3xl">🏒</div>
              <p className="text-sm text-slate-400">Zatím nemáte žádné soutěže</p>
              <p className="mt-1 text-xs text-slate-500">
                Vytvořte první soutěž pro sledování statistik
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {userCompetitions.map((comp) => (
                <div
                  key={comp.id}
                  className={`rounded-xl px-4 py-3 ${
                    comp.id === activeCompetition?.id
                      ? "bg-accentPrimary/20 ring-1 ring-accentPrimary"
                      : "bg-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${
                          comp.id === activeCompetition?.id 
                            ? "text-accentPrimary" 
                            : "text-slate-200"
                        }`}>
                          {comp.displayName || comp.name}
                        </span>
                        {comp.id === activeCompetition?.id && (
                          <span className="rounded bg-accentPrimary/30 px-2 py-0.5 text-[10px] font-medium text-accentPrimary">
                            AKTIVNÍ
                          </span>
                        )}
                      </div>
                      {comp.standingsUrl && (
                        <div className="mt-1">
                          <StandingsLink url={comp.standingsUrl} variant="inline" />
                        </div>
                      )}
                      <div className="mt-1 text-xs text-slate-500">
                        Vytvořeno: {new Date(comp.createdAt || Date.now()).toLocaleDateString("cs-CZ")}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {comp.id !== activeCompetition?.id && (
                        <button
                          onClick={() => setActiveCompetitionId(comp.id)}
                          className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-accentPrimary hover:bg-slate-600"
                          title="Nastavit jako aktivní"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={() => handleEditUserComp(comp)}
                        className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-600"
                        title="Upravit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteUserComp(comp)}
                        className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-accentDanger hover:bg-slate-600"
                        title="Smazat"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

        {/* Supabase Sync */}
        <SupabaseSyncSection onDataChange={loadData} />

        {/* App Info */}
        <section className="rounded-2xl bg-bgSurfaceSoft p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">
            O APLIKACI
          </h2>
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>Verze</span>
              <span className="text-slate-200">1.5.0</span>
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

      {/* User Competition Modal */}
      <UserCompetitionModal
        open={showUserCompModal}
        onClose={() => {
          setShowUserCompModal(false);
          setEditingUserComp(null);
        }}
        onSave={handleSaveUserComp}
        editingCompetition={editingUserComp}
      />

      <CompetitionPicker
        open={showCompetitionPicker}
        onClose={() => setShowCompetitionPicker(false)}
        onSelect={handleAddCompetition}
      />

      {/* Delete User Competition Confirmation Modal */}
      {deleteUserCompConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-bgSurfaceSoft p-5">
            <h3 className="mb-2 text-center text-lg font-semibold text-accentDanger">
              Smazat soutěž?
            </h3>
            <p className="mb-4 text-center text-sm text-slate-400">
              {deleteUserCompConfirm.name}
            </p>
            <p className="mb-4 text-center text-xs text-slate-500">
              Tato akce odstraní soutěž z vašeho seznamu.
              Zápasy a statistiky zůstanou zachovány.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteUserCompConfirm(null)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm text-slate-300"
              >
                Zrušit
              </button>
              <button
                onClick={confirmDeleteUserComp}
                className="flex-1 rounded-xl bg-accentDanger py-2.5 text-sm font-semibold text-white"
              >
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
