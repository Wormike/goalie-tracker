"use client";

import React, { useState, useRef } from "react";
import {
  exportData,
  importData,
  getStorageStats,
  clearAllData,
  type ImportResult,
} from "@/lib/storage";
import { dataService } from "@/lib/dataService";
import type { ExportBundle } from "@/lib/types";

interface ExportImportModalProps {
  open: boolean;
  onClose: () => void;
  onDataChange?: () => void;
}

type Tab = "export" | "import" | "danger";

export function ExportImportModal({
  open,
  onClose,
  onDataChange,
}: ExportImportModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("export");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importPreview, setImportPreview] = useState<{
    goalies: number;
    teams: number;
    seasons: number;
    competitions: number;
    matches: number;
    events: number;
  } | null>(null);
  const [importBundle, setImportBundle] = useState<ExportBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const stats = getStorageStats();

  const handleExport = () => {
    try {
      const data = exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `goalie-tracker-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      setError("Chyba při exportu dat");
    }
  };

  const handleShare = async () => {
    try {
      const data = exportData();
      const json = JSON.stringify(data, null, 2);

      if (navigator.share) {
        const file = new File(
          [json],
          `goalie-tracker-export-${new Date().toISOString().split("T")[0]}.json`,
          { type: "application/json" }
        );
        await navigator.share({
          title: "Goalie Tracker Export",
          files: [file],
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(json);
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Chyba při sdílení");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportResult(null);
    setImportPreview(null);
    setImportBundle(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json) as ExportBundle;

        // Validate structure
        if (!data.version || !data.exportedAt) {
          setError("Neplatný formát souboru. Chybí verze nebo datum exportu.");
          return;
        }

        setImportBundle(data);
        setImportPreview({
          goalies: data.goalies?.length || 0,
          teams: data.teams?.length || 0,
          seasons: data.seasons?.length || 0,
          competitions: data.competitions?.length || 0,
          matches: data.matches?.length || 0,
          events: data.events?.length || 0,
        });
      } catch {
        setError("Chyba při čtení souboru. Zkontrolujte, že je to platný JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importBundle) return;

    const result = importData(importBundle, importMode);
    setImportResult(result);

    if (result.success) {
      if (importBundle.competitions?.length) {
        for (const competition of importBundle.competitions) {
          // eslint-disable-next-line no-await-in-loop
          await dataService.saveCompetition(competition);
        }
      }
      setImportBundle(null);
      setImportPreview(null);
      onDataChange?.();
    }
  };

  const handleClearAll = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }

    clearAllData();
    setClearConfirm(false);
    onDataChange?.();
    onClose();
  };

  const resetImport = () => {
    setImportBundle(null);
    setImportPreview(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-bgSurfaceSoft">
        {/* Header */}
        <div className="border-b border-borderSoft p-4">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-700" />
          <h2 className="text-center text-lg font-semibold">
            Export &amp; Import dat
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-borderSoft">
          <button
            onClick={() => setActiveTab("export")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "export"
                ? "border-b-2 border-accentPrimary text-accentPrimary"
                : "text-slate-400"
            }`}
          >
            Export
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "import"
                ? "border-b-2 border-accentPrimary text-accentPrimary"
                : "text-slate-400"
            }`}
          >
            Import
          </button>
          <button
            onClick={() => setActiveTab("danger")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "danger"
                ? "border-b-2 border-accentDanger text-accentDanger"
                : "text-slate-400"
            }`}
          >
            Smazat
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg bg-accentDanger/20 p-3 text-sm text-accentDanger">
              {error}
            </div>
          )}

          {/* Export Tab */}
          {activeTab === "export" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Exportujte všechna data aplikace do JSON souboru pro zálohu nebo
                přenos na jiné zařízení.
              </p>

              {/* Current stats */}
              <div className="rounded-lg bg-slate-800/50 p-3">
                <h4 className="mb-2 text-xs font-semibold text-slate-400">
                  AKTUÁLNÍ DATA
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-lg font-bold text-accentPrimary">
                      {stats.goalies}
                    </div>
                    <div className="text-slate-500">Brankáři</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-accentPrimary">
                      {stats.matches}
                    </div>
                    <div className="text-slate-500">Zápasy</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-accentPrimary">
                      {stats.events}
                    </div>
                    <div className="text-slate-500">Události</div>
                  </div>
                </div>
              </div>

              {exportSuccess && (
                <div className="rounded-lg bg-accentSuccess/20 p-3 text-sm text-accentSuccess">
                  ✓ Export úspěšný!
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleExport}
                  className="flex-1 rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white"
                >
                  ⬇️ Stáhnout JSON
                </button>
                <button
                  onClick={handleShare}
                  className="rounded-xl bg-slate-700 px-4 py-3 text-sm font-medium text-slate-200"
                >
                  📤
                </button>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === "import" && (
            <div className="space-y-4">
              {!importPreview && !importResult && (
                <>
                  <p className="text-sm text-slate-400">
                    Importujte data z dříve exportovaného JSON souboru.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl border-2 border-dashed border-accentPrimary/50 bg-accentPrimary/10 py-6 text-sm font-medium text-accentPrimary"
                  >
                    📁 Vybrat JSON soubor
                  </button>
                </>
              )}

              {/* Import preview */}
              {importPreview && !importResult && (
                <>
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <h4 className="mb-2 text-xs font-semibold text-slate-400">
                      OBSAH SOUBORU
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-lg font-bold text-accentHighlight">
                          {importPreview.goalies}
                        </div>
                        <div className="text-slate-500">Brankáři</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-accentHighlight">
                          {importPreview.matches}
                        </div>
                        <div className="text-slate-500">Zápasy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-accentHighlight">
                          {importPreview.events}
                        </div>
                        <div className="text-slate-500">Události</div>
                      </div>
                    </div>
                  </div>

                  {/* Import mode selector */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400">
                      REŽIM IMPORTU
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setImportMode("merge")}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                          importMode === "merge"
                            ? "bg-accentPrimary text-white"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        Sloučit
                      </button>
                      <button
                        onClick={() => setImportMode("replace")}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                          importMode === "replace"
                            ? "bg-accentDanger text-white"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        Nahradit vše
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      {importMode === "merge"
                        ? "Přidá nové záznamy, existující ponechá beze změny."
                        : "⚠️ Smaže všechna stávající data a nahradí je importovanými!"}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={resetImport}
                      className="flex-1 rounded-xl bg-slate-700 py-3 text-sm font-medium text-slate-200"
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleImport}
                      className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white ${
                        importMode === "replace"
                          ? "bg-accentDanger"
                          : "bg-accentSuccess"
                      }`}
                    >
                      Importovat
                    </button>
                  </div>
                </>
              )}

              {/* Import result */}
              {importResult && (
                <>
                  <div
                    className={`rounded-lg p-3 ${
                      importResult.success
                        ? "bg-accentSuccess/20 text-accentSuccess"
                        : "bg-accentDanger/20 text-accentDanger"
                    }`}
                  >
                    {importResult.success
                      ? "✓ Import úspěšný!"
                      : "✗ Import selhal"}
                  </div>

                  {importResult.success && (
                    <div className="rounded-lg bg-slate-800/50 p-3 text-xs">
                      <h4 className="mb-2 font-semibold text-slate-400">
                        IMPORTOVÁNO
                      </h4>
                      <ul className="space-y-1 text-slate-300">
                        {importResult.imported.goalies > 0 && (
                          <li>• {importResult.imported.goalies} brankářů</li>
                        )}
                        {importResult.imported.teams > 0 && (
                          <li>• {importResult.imported.teams} týmů</li>
                        )}
                        {importResult.imported.competitions > 0 && (
                          <li>
                            • {importResult.imported.competitions} soutěží
                          </li>
                        )}
                        {importResult.imported.matches > 0 && (
                          <li>• {importResult.imported.matches} zápasů</li>
                        )}
                        {importResult.imported.events > 0 && (
                          <li>• {importResult.imported.events} událostí</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {importResult.errors.length > 0 && (
                    <div className="rounded-lg bg-accentDanger/10 p-3 text-xs text-accentDanger">
                      {importResult.errors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={resetImport}
                    className="w-full rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white"
                  >
                    OK
                  </button>
                </>
              )}
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === "danger" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-accentDanger/30 bg-accentDanger/10 p-4">
                <h4 className="mb-2 font-semibold text-accentDanger">
                  ⚠️ Nebezpečná zóna
                </h4>
                <p className="text-sm text-slate-400">
                  Tato akce nenávratně smaže všechna data aplikace - brankáře,
                  zápasy, události a statistiky.
                </p>
              </div>

              {/* Current stats */}
              <div className="rounded-lg bg-slate-800/50 p-3">
                <h4 className="mb-2 text-xs font-semibold text-slate-400">
                  BUDE SMAZÁNO
                </h4>
                <div className="text-xs text-slate-300">
                  {stats.goalies} brankářů • {stats.matches} zápasů •{" "}
                  {stats.events} událostí
                </div>
              </div>

              {!clearConfirm ? (
                <button
                  onClick={handleClearAll}
                  className="w-full rounded-xl border-2 border-accentDanger bg-transparent py-3 text-sm font-semibold text-accentDanger"
                >
                  Smazat všechna data
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-center text-sm text-accentDanger">
                    Opravdu chcete smazat všechna data?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setClearConfirm(false)}
                      className="flex-1 rounded-xl bg-slate-700 py-3 text-sm font-medium text-slate-200"
                    >
                      Ne, zrušit
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="flex-1 rounded-xl bg-accentDanger py-3 text-sm font-semibold text-white"
                    >
                      Ano, smazat
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-borderSoft p-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-800 py-3 text-sm font-medium text-slate-300"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}

