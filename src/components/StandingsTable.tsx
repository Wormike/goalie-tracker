"use client";

import React from "react";
import type { StandingsRow, CompetitionStandings } from "@/lib/types";

interface StandingsTableProps {
  standings: CompetitionStandings;
  title?: string;
  compact?: boolean;
}

export function StandingsTable({ standings, title, compact = false }: StandingsTableProps) {
  if (!standings || standings.rows.length === 0) {
    return (
      <div className="rounded-xl bg-bgSurfaceSoft p-4 text-center text-sm text-slate-500">
        Tabulka není k dispozici
      </div>
    );
  }

  // Check if we have VP/PP columns (overtime wins/losses)
  const hasOvertimeColumns = standings.rows.some(r => r.winsOT !== undefined && r.winsOT > 0);

  // Use competition name from standings if available
  const displayTitle = title || standings.competitionName;

  return (
    <div className="rounded-xl bg-bgSurfaceSoft overflow-hidden">
      {displayTitle && (
        <div className="border-b border-borderSoft px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-300">{displayTitle}</h3>
          <p className="text-xs text-slate-500">
            Aktualizováno: {new Date(standings.updatedAt).toLocaleString("cs-CZ")}
          </p>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-borderSoft bg-slate-800/50 text-slate-400">
              <th className="px-2 py-2 text-center w-8">#</th>
              <th className="px-2 py-2 text-left">Tým</th>
              <th className="px-2 py-2 text-center w-8">Z</th>
              {!compact && (
                <>
                  <th className="px-2 py-2 text-center w-8">V</th>
                  {hasOvertimeColumns ? (
                    <>
                      <th className="px-2 py-2 text-center w-8" title="Výhry v prodloužení">VP</th>
                      <th className="px-2 py-2 text-center w-8" title="Prohry v prodloužení">PP</th>
                    </>
                  ) : (
                    <th className="px-2 py-2 text-center w-8">R</th>
                  )}
                  <th className="px-2 py-2 text-center w-8">P</th>
                </>
              )}
              <th className="px-2 py-2 text-center w-12">Skóre</th>
              <th className="px-2 py-2 text-center w-10 font-semibold text-accentPrimary">B</th>
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((row) => (
              <tr
                key={row.position}
                className={`border-b border-borderSoft/50 ${
                  row.isOurTeam
                    ? "bg-accentPrimary/10 font-semibold"
                    : "hover:bg-slate-800/30"
                }`}
              >
                <td className="px-2 py-2 text-center text-slate-500">
                  {row.position}.
                </td>
                <td className={`px-2 py-2 ${row.isOurTeam ? "text-accentPrimary" : "text-slate-200"}`}>
                  {row.teamName}
                  {row.isOurTeam && <span className="ml-1 text-xs">⭐</span>}
                </td>
                <td className="px-2 py-2 text-center text-slate-400">
                  {row.gamesPlayed}
                </td>
                {!compact && (
                  <>
                    <td className="px-2 py-2 text-center text-accentSuccess">
                      {row.wins}
                    </td>
                    {hasOvertimeColumns ? (
                      <>
                        <td className="px-2 py-2 text-center text-accentSuccess/70">
                          {row.winsOT || 0}
                        </td>
                        <td className="px-2 py-2 text-center text-accentDanger/70">
                          {row.lossesOT || 0}
                        </td>
                      </>
                    ) : (
                      <td className="px-2 py-2 text-center text-slate-400">
                        {row.draws || 0}
                      </td>
                    )}
                    <td className="px-2 py-2 text-center text-accentDanger">
                      {row.losses}
                    </td>
                  </>
                )}
                <td className="px-2 py-2 text-center text-slate-400">
                  {row.goalsFor}:{row.goalsAgainst}
                </td>
                <td className="px-2 py-2 text-center font-bold text-accentPrimary">
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Modal version for displaying standings in a popup
interface StandingsModalProps {
  open: boolean;
  onClose: () => void;
  standings: CompetitionStandings | null;
  title?: string;
  loading?: boolean;
  onRefresh?: () => void;
}

export function StandingsModal({
  open,
  onClose,
  standings,
  title,
  loading,
  onRefresh,
}: StandingsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-bgSurfaceSoft">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderSoft px-4 py-3">
          <h3 className="text-lg font-semibold">{title || "Tabulka soutěže"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-slate-400">Načítám tabulku...</div>
            </div>
          ) : standings ? (
            <StandingsTable standings={standings} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-4">📊</div>
              <div className="text-sm text-slate-400">Tabulka není k dispozici</div>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="mt-4 rounded-lg bg-accentPrimary px-4 py-2 text-sm font-medium text-white"
                >
                  Načíst tabulku
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-borderSoft px-4 py-3 flex items-center justify-between">
          {standings && (
            <span className="text-xs text-slate-500">
              Aktualizováno: {new Date(standings.updatedAt).toLocaleString("cs-CZ")}
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            {onRefresh && standings && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-50"
              >
                🔄 Aktualizovat
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm text-slate-300"
            >
              Zavřít
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact inline version for showing in match details
interface StandingsPreviewProps {
  standings: CompetitionStandings;
  maxRows?: number;
  onExpand?: () => void;
}

export function StandingsPreview({ standings, maxRows = 5, onExpand }: StandingsPreviewProps) {
  if (!standings || standings.rows.length === 0) return null;

  // Find our team's position
  const ourTeamIndex = standings.rows.findIndex(r => r.isOurTeam);
  
  // Show rows around our team, or top rows if not found
  let displayRows: StandingsRow[];
  if (ourTeamIndex >= 0) {
    const start = Math.max(0, ourTeamIndex - Math.floor(maxRows / 2));
    const end = Math.min(standings.rows.length, start + maxRows);
    displayRows = standings.rows.slice(start, end);
  } else {
    displayRows = standings.rows.slice(0, maxRows);
  }

  return (
    <div className="rounded-xl bg-bgSurfaceSoft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-borderSoft bg-slate-800/50 text-slate-400">
              <th className="px-2 py-1.5 text-center w-6">#</th>
              <th className="px-2 py-1.5 text-left">Tým</th>
              <th className="px-2 py-1.5 text-center w-10">Skóre</th>
              <th className="px-2 py-1.5 text-center w-8">B</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr
                key={row.position}
                className={`border-b border-borderSoft/50 ${
                  row.isOurTeam ? "bg-accentPrimary/10" : ""
                }`}
              >
                <td className="px-2 py-1.5 text-center text-slate-500">
                  {row.position}.
                </td>
                <td className={`px-2 py-1.5 truncate max-w-[120px] ${row.isOurTeam ? "font-semibold text-accentPrimary" : "text-slate-200"}`}>
                  {row.teamName}
                </td>
                <td className="px-2 py-1.5 text-center text-slate-400">
                  {row.goalsFor}:{row.goalsAgainst}
                </td>
                <td className="px-2 py-1.5 text-center font-bold text-accentPrimary">
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onExpand && standings.rows.length > maxRows && (
        <button
          onClick={onExpand}
          className="w-full border-t border-borderSoft py-2 text-xs text-accentPrimary hover:bg-slate-800/30"
        >
          Zobrazit celou tabulku →
        </button>
      )}
    </div>
  );
}

