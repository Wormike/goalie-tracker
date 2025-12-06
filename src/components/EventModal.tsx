"use client";

import React, { useEffect, useState } from "react";
import type {
  GoalType,
  ResultType,
  SaveType,
  SituationType,
  ShotZone,
  GoalPosition,
} from "@/lib/types";
import { GoalView } from "./GoalView";

type EventModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    result: ResultType;
    saveType?: SaveType;
    goalType?: GoalType;
    situation?: SituationType;
    goalPosition?: GoalPosition;
  }) => void;
  zone: ShotZone | null;
  header: string; // "2. třetina • 14:32 • Slot"
};

export function EventModal({
  open,
  onClose,
  onSubmit,
  zone,
  header,
}: EventModalProps) {
  const [result, setResult] = useState<ResultType | null>(null);
  const [saveType, setSaveType] = useState<SaveType | undefined>();
  const [goalType, setGoalType] = useState<GoalType | undefined>();
  const [situation, setSituation] = useState<SituationType>("even");
  const [goalPosition, setGoalPosition] = useState<GoalPosition | null>(null);
  const [showGoalView, setShowGoalView] = useState(false);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setSaveType(undefined);
      setGoalType(undefined);
      setSituation("even");
      setGoalPosition(null);
      setShowGoalView(false);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = !!result;

  const handleResultSelect = (r: ResultType) => {
    setResult(r);
    // Show goal position selector for saves and goals
    if (r === "save" || r === "goal") {
      setShowGoalView(true);
    } else {
      setShowGoalView(false);
      setGoalPosition(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-bgSurfaceSoft p-6 pb-8">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-700" />
        <p className="mb-1 text-center text-xs text-slate-400">{header}</p>
        <h2 className="mb-4 text-center text-lg font-semibold">
          Zaznamenat střelu {zone ? `(${zone})` : ""}
        </h2>

        {/* Result selection */}
        <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => handleResultSelect("save")}
            className={`rounded-xl border px-2 py-3 font-semibold ${
              result === "save"
                ? "border-accentSuccess bg-accentSuccess/20 text-accentSuccess"
                : "border-borderSoft bg-slate-800 text-slate-200"
            }`}
          >
            ✓ ZÁKROK
          </button>
          <button
            onClick={() => handleResultSelect("goal")}
            className={`rounded-xl border px-2 py-3 font-semibold ${
              result === "goal"
                ? "border-accentDanger bg-accentDanger/20 text-accentDanger"
                : "border-borderSoft bg-slate-800 text-slate-200"
            }`}
          >
            ✕ GÓL
          </button>
          <button
            onClick={() => handleResultSelect("miss")}
            className={`rounded-xl border px-2 py-3 font-semibold ${
              result === "miss"
                ? "border-slate-400 bg-slate-700/70 text-slate-50"
                : "border-borderSoft bg-slate-800 text-slate-200"
            }`}
          >
            ○ MIMO
          </button>
        </div>

        {/* Goal position selector */}
        {showGoalView && (
          <div className="mb-4">
            <p className="mb-2 text-xs text-slate-400">
              Kam směřovala střela? {goalPosition ? "✓" : "(volitelné)"}
            </p>
            <GoalView
              onSelect={setGoalPosition}
              selectedPosition={goalPosition}
              mode="select"
            />
          </div>
        )}

        {/* Save type */}
        {result === "save" && (
          <div className="mb-4">
            <p className="mb-2 text-xs text-slate-400">Typ zákroku</p>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setSaveType("catch")}
                className={`flex-1 rounded-xl border px-2 py-2 ${
                  saveType === "catch"
                    ? "border-accentPrimary bg-accentPrimary/20 text-accentPrimary"
                    : "border-borderSoft bg-slate-800"
                }`}
              >
                Chytil
              </button>
              <button
                onClick={() => setSaveType("rebound")}
                className={`flex-1 rounded-xl border px-2 py-2 ${
                  saveType === "rebound"
                    ? "border-accentPrimary bg-accentPrimary/20 text-accentPrimary"
                    : "border-borderSoft bg-slate-800"
                }`}
              >
                Vyrazil
              </button>
            </div>
          </div>
        )}

        {/* Goal type */}
        {result === "goal" && (
          <div className="mb-4">
            <p className="mb-2 text-xs text-slate-400">Typ gólu</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                ["direct", "Přímo"],
                ["rebound", "Dorážka"],
                ["breakaway", "Sam. únik"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setGoalType(value as GoalType)}
                  className={`rounded-xl border px-2 py-2 ${
                    goalType === value
                      ? "border-accentPrimary bg-accentPrimary/20 text-accentPrimary"
                      : "border-borderSoft bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Situation */}
        <div className="mb-4">
          <p className="mb-2 text-xs text-slate-400">Herní situace</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              ["even", "5v5"],
              ["powerplay", "PP"],
              ["shorthanded", "SH"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSituation(value as SituationType)}
                className={`rounded-xl border px-2 py-2 ${
                  situation === value
                    ? "border-accentPrimary bg-accentPrimary/20 text-accentPrimary"
                    : "border-borderSoft bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-800 py-3 text-sm text-slate-300"
          >
            Zrušit
          </button>
          <button
            disabled={!canSubmit}
            onClick={() =>
              result &&
              onSubmit({
                result,
                saveType,
                goalType,
                situation,
                goalPosition: goalPosition || undefined,
              })
            }
            className="flex-1 rounded-xl bg-accentPrimary py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
}
