"use client";

import React, { useState, useEffect } from "react";
import type { Match, Goalie } from "@/lib/types";

type ManualStatsModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    goalieId: string;
    shots: number;
    saves: number;
    goals: number;
  }) => void;
  match: Match;
  goalies: Goalie[];
};

export function ManualStatsModal({
  open,
  onClose,
  onSave,
  match,
  goalies,
}: ManualStatsModalProps) {
  const [goalieId, setGoalieId] = useState(match.goalieId || "");
  const [shots, setShots] = useState(match.manualStats?.shots || 0);
  const [saves, setSaves] = useState(match.manualStats?.saves || 0);
  const [goals, setGoals] = useState(match.manualStats?.goals || 0);

  useEffect(() => {
    if (open) {
      setGoalieId(match.goalieId || "");
      setShots(match.manualStats?.shots || 0);
      setSaves(match.manualStats?.saves || 0);
      setGoals(match.manualStats?.goals || 0);
    }
  }, [open, match]);

  // Auto-calculate saves when shots or goals change
  useEffect(() => {
    if (shots > 0 && goals <= shots) {
      setSaves(shots - goals);
    }
  }, [shots, goals]);

  if (!open) return null;

  const handleSubmit = () => {
    onSave({
      goalieId,
      shots,
      saves,
      goals,
    });
    onClose();
  };

  const savePct = shots > 0 ? ((saves / shots) * 100).toFixed(1) : "0.0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-bgSurfaceSoft p-5">
        <h3 className="mb-1 text-center text-lg font-semibold">
          Statistiky zápasu
        </h3>
        <p className="mb-4 text-center text-xs text-slate-400">
          {match.home} vs {match.away}
        </p>

        {/* Goalie selector */}
        <div className="mb-4">
          <label className="mb-2 block text-xs text-slate-400">Brankář *</label>
          {goalies.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nejprve vytvořte brankáře v sekci Brankáři
            </p>
          ) : (
            <select
              value={goalieId}
              onChange={(e) => setGoalieId(e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm text-slate-100"
              required
            >
              <option value="">-- Vyberte brankáře --</option>
              {goalies.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.firstName} {g.lastName} ({g.team})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Stats inputs */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-center text-xs text-slate-400">
              Střely
            </label>
            <input
              type="number"
              min="0"
              value={shots}
              onChange={(e) => setShots(parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-slate-800 px-2 py-2 text-center text-lg font-bold text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-center text-xs text-slate-400">
              Zákroky
            </label>
            <input
              type="number"
              min="0"
              value={saves}
              onChange={(e) => setSaves(parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-slate-800 px-2 py-2 text-center text-lg font-bold text-accentSuccess"
            />
          </div>
          <div>
            <label className="mb-1 block text-center text-xs text-slate-400">
              Góly
            </label>
            <input
              type="number"
              min="0"
              value={goals}
              onChange={(e) => setGoals(parseInt(e.target.value) || 0)}
              className="w-full rounded-lg bg-slate-800 px-2 py-2 text-center text-lg font-bold text-accentDanger"
            />
          </div>
        </div>

        {/* Calculated save percentage */}
        <div className="mb-4 rounded-lg bg-slate-800/50 p-3 text-center">
          <div className="text-2xl font-bold text-accentPrimary">{savePct}%</div>
          <div className="text-xs text-slate-400">Úspěšnost zákroků</div>
        </div>

        {/* Match score reference */}
        {(match.homeScore !== undefined || match.awayScore !== undefined) && (
          <div className="mb-4 text-center text-xs text-slate-500">
            Výsledek zápasu: {match.homeScore ?? "?"} : {match.awayScore ?? "?"}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm text-slate-300"
          >
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={!goalieId}
            className="flex-1 rounded-xl bg-accentPrimary py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
}
















